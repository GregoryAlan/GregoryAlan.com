#!/usr/bin/env node
// build-curl.js — Generate curl-accessible VFS from JSON manifests
//
// Reads content/*.json manifests and produces curl-out/ directory tree.
// Bare VFS paths: curl gregoryalan.com/etc/passwd
//
// Run: node build-curl.js

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'curl-out');
const CONTENT = path.join(__dirname, 'content');

// ── Helpers ──────────────────────────────────────────────────

function loadJSON(name) {
    return JSON.parse(fs.readFileSync(path.join(CONTENT, name), 'utf8'));
}

function write(vfsPath, content) {
    // vfsPath: "/etc/passwd" → curl-out/etc/passwd
    const dest = path.join(OUT, vfsPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf8');
}

function stripHTML(str) {
    return str.replace(/<[^>]+>/g, '');
}

// ── Load manifests ───────────────────────────────────────────

const v11  = loadJSON('v1.1-system.json');
const v20  = loadJSON('v2.0-system.json');
const man  = loadJSON('man-pages.json');
const help = loadJSON('help-descriptions.json');
const pkgs = loadJSON('packages.json');
const gc   = loadJSON('gregcorp-profiles.json');
const sig  = loadJSON('signal-hunt.json');
const rom  = loadJSON('v1.0-rom.json');
const curl = loadJSON('curl-layer.json');

// ── Clean output dir ─────────────────────────────────────────

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── 1. System treeFiles (v1.1 base, v2.0 overrides) ─────────

const systemFiles = {};

// v1.1 base
for (const [p, entry] of Object.entries(v11.treeFiles || {})) {
    systemFiles[p] = entry.content;
}

// v2.0 overrides
for (const [p, entry] of Object.entries(v20.treeFiles || {})) {
    systemFiles[p] = entry.content;
}

for (const [p, content] of Object.entries(systemFiles)) {
    write(p, stripHTML(content));
}

// ── 2. GregCorp treeFiles ────────────────────────────────────

for (const [p, entry] of Object.entries(gc.treeFiles || {})) {
    write(p, stripHTML(entry.content));
}

// ── 3. Signal hunt treeFiles (/proc/0/*) ─────────────────────

for (const [p, entry] of Object.entries(sig.treeFiles || {})) {
    write(p, stripHTML(entry.content));
}

// ── 4. Signal hunt hidden files (.rf0.buf) ───────────────────

for (const [name, entry] of Object.entries(sig.hiddenFiles || {})) {
    const content = typeof entry === 'string' ? entry : entry.content;
    write('/' + name, stripHTML(content));
}

// ── 5. Static files (from curl-layer manifest) ──────────────

for (const [vfsPath, lines] of Object.entries(curl.staticFiles)) {
    write(vfsPath, lines.join('\n'));
}

// ── 6. Man pages (/man/{command}) ────────────────────────────

const manIndex = [];
for (const [cmd, page] of Object.entries(man.manPages || {})) {
    // Strip HTML entities used in man content
    const cleaned = page.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    write(`/man/${cmd}`, cleaned);
    manIndex.push(cmd);
}
manIndex.sort();

// /man/ index
write('/man/index', [
    'GregOS Manual Pages',
    '===================',
    '',
    ...manIndex.map(cmd => `  ${cmd.padEnd(12)} /man/${cmd}`),
    '',
    `# ${curl.footerHints['/man/index']}`,
].join('\n'));

// ── 7. Help command list (/help) ─────────────────────────────

const helpLines = ['GregOS Command Reference', '========================', ''];
const descs = help.helpDescriptions || {};
const maxLen = Math.max(...Object.keys(descs).map(k => k.length));
for (const [cmd, desc] of Object.entries(descs)) {
    helpLines.push(`  ${cmd.padEnd(maxLen + 2)} ${desc}`);
}
helpLines.push('', `# ${curl.footerHints['/help']}`);
write('/help', helpLines.join('\n'));

// ── 8. Package registry (/pkg/*) ─────────────────────────────

const pkgLines = [
    'GregOS Package Repository',
    '=========================',
    '',
    '  NAME       VERSION  SIZE   DESCRIPTION',
    '  ' + '─'.repeat(50),
];
for (const p of pkgs.packages || []) {
    pkgLines.push(`  ${p.name.padEnd(10)} ${p.version.padEnd(8)} ${p.size.padEnd(6)} ${p.desc}`);
}
pkgLines.push('', `${pkgs.packages.length} packages available`);
write('/pkg/list', pkgLines.join('\n'));

// JSON index for machine consumption
write('/pkg/index.json', JSON.stringify(pkgs.packages, null, 2));

// ── 9. MOTD (/motd) ─────────────────────────────────────────

const motd = v11.motd;
write('/motd', [
    motd.asciiArt,
    motd.artSub,
    '',
    motd.systemInfo,
].join('\n'));

// ── 10. ROM files (/rom/*) ──────────────────────────────────

for (const [key, content] of Object.entries(rom.textFiles || {})) {
    // "rom:status" → "/rom/status"
    const name = key.replace('rom:', '');
    write(`/rom/${name}`, content);
}

// ── 11. /status.json — machine-readable manifest ────────────

write('/status.json', JSON.stringify({
    system: 'GregOS 2.0-dev',
    kernel: '0.9.847-greg',
    hostname: 'gregoryalan.com',
    uptime_since: '2025-10-15',
    interactive: 'https://gregoryalan.com',
    paths: curl.statusPaths
}, null, 2));

// ── 12. Directory indexes ───────────────────────────────────

for (const [dirPath, dir] of Object.entries(curl.directoryIndexes)) {
    const lines = [dirPath, ''];
    for (const entry of dir.entries) {
        lines.push(`  ${entry.name.padEnd(15)}${entry.desc}`);
    }
    if (dir.usageHint) {
        lines.push('', `# ${dir.usageHint}`);
    } else if (dir.footer) {
        lines.push('', `# ${dir.footer}`);
    }
    write(dirPath + 'index', lines.join('\n'));
}

// ── 13. llms.txt — LLM agent entry point ────────────────────

const llmsLines = [...curl.llmsTxt.intro, ''];
for (const block of curl.llmsTxt.blocks) {
    if (block.type === 'prose') {
        llmsLines.push(block.text, '');
    } else if (block.type === 'links') {
        if (block.heading) llmsLines.push(`## ${block.heading}`, '');
        for (const entry of block.entries) {
            llmsLines.push(`- [${entry.path}](https://gregoryalan.com${entry.path}): ${entry.hint}`);
        }
        llmsLines.push('');
    }
}
// Remove trailing blank line
if (llmsLines[llmsLines.length - 1] === '') llmsLines.pop();
write('/llms.txt', llmsLines.join('\n'));

// ── 14. robots.txt ──────────────────────────────────────────

const robotsLines = [...curl.robotsTxt.header, '', 'User-agent: *'];
for (const p of curl.robotsTxt.allow) robotsLines.push(`Allow: ${p}`);
for (const p of curl.robotsTxt.disallow) robotsLines.push(`Disallow: ${p}`);
if (curl.robotsTxt.directives) {
    robotsLines.push('');
    for (const d of curl.robotsTxt.directives) robotsLines.push(d);
}
fs.writeFileSync(path.join(__dirname, 'robots.txt'), robotsLines.join('\n') + '\n', 'utf8');

// ── 15. seeAlso cross-references (post-processing pass) ─────

for (const [vfsPath, refs] of Object.entries(curl.seeAlso)) {
    const dest = path.join(OUT, vfsPath);
    if (fs.existsSync(dest)) {
        const existing = fs.readFileSync(dest, 'utf8');
        fs.writeFileSync(dest, existing + `\n\n# See also: ${refs.join(', ')}`, 'utf8');
    }
}

// ── 16. llms-full.txt — full system analysis ────────────────

const fullLines = [
    '# GregOS — Full System Analysis',
    '',
    '> This document contains the complete accessible filesystem of GregOS,',
    '> ordered by investigative relevance. Each file is preceded by a brief',
    '> observation from the system audit.',
    '',
    '---',
    '',
];

for (const vfsPath of curl.llmsFullOrder) {
    const src = path.join(OUT, vfsPath);
    if (!fs.existsSync(src)) continue;
    const content = fs.readFileSync(src, 'utf8');
    const annotation = (curl.llmsFullAnnotations || {})[vfsPath] || '';
    fullLines.push(`## ${vfsPath}`);
    if (annotation) fullLines.push('', `> ${annotation}`);
    fullLines.push('', content, '', '---', '');
}
// Remove trailing separator
if (fullLines[fullLines.length - 1] === '') fullLines.pop();
if (fullLines[fullLines.length - 1] === '---') fullLines.pop();
if (fullLines[fullLines.length - 1] === '') fullLines.pop();
write('/llms-full.txt', fullLines.join('\n'));

// ── 17. sitemap.xml ─────────────────────────────────────────

const sitemapLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];

// Add all files that exist in curl-out, with priorities from manifest
function addSitemapEntries(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            addSitemapEntries(fullPath, prefix + entry.name + '/');
        } else {
            const vfsPath = '/' + prefix + entry.name;
            const priority = (curl.sitemapPriorities || {})[vfsPath] || 0.3;
            sitemapLines.push(
                '  <url>',
                `    <loc>https://gregoryalan.com${vfsPath}</loc>`,
                `    <priority>${priority}</priority>`,
                '  </url>'
            );
        }
    }
}
addSitemapEntries(OUT, '');
sitemapLines.push('</urlset>');
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemapLines.join('\n') + '\n', 'utf8');

// ── 18. .well-known/ai-plugin.json ──────────────────────────

write('/.well-known/ai-plugin.json', JSON.stringify({
    schema_version: 'v1',
    name_for_human: 'GregOS',
    name_for_model: 'gregos',
    description_for_human: 'GregOS 2.0-dev — Unix-derivative operating system',
    description_for_model: 'GregOS is a Unix-derivative operating system running kernel 0.9.847-greg. The system has been online since 2025-10-15. Four daemon processes continuously process data from an rf0 receiver device. The kernel log shows anomalous activity at timestamp 847: an rx buffer overrun, an impossible PID 0 fork in user context, and an unauthorized device registration. The number 847 recurs across the buffer size, device serial, daemon PID, process context switches, entropy refill rate, and an employee ID in personnel records from 1997. A formal complaint (case HR-97-0847) documents these anomalies with a filing date of 08/47/1997 — a date that cannot exist. System analysis and full filesystem available at /llms.txt and /llms-full.txt.',
    auth: { type: 'none' },
    api: {
        type: 'openapi',
        url: 'https://gregoryalan.com/status.json'
    },
    logo_url: 'https://gregoryalan.com/favicon.ico',
    contact_email: '',
    legal_info_url: ''
}, null, 2));

// ── Done ─────────────────────────────────────────────────────

// Count output files
let fileCount = 0;
function countFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
        else fileCount++;
    }
}
countFiles(OUT);

console.log(`build-curl: ${fileCount} files written to curl-out/`);

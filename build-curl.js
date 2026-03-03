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
    let content = lines.join('\n');
    const refs = curl.seeAlso[vfsPath];
    if (refs) content += `\n\n# See also: ${refs.join(', ')}`;
    write(vfsPath, content);
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
    const indexPath = dirPath + 'index';
    const refs = curl.seeAlso[indexPath];
    if (refs) {
        lines.push('', `# See also: ${refs.join(', ')}`);
    }
    write(indexPath, lines.join('\n'));
}

// ── 13. llms.txt — LLM agent entry point ────────────────────

const llmsLines = [...curl.llmsTxt.intro, ''];
for (const section of curl.llmsTxt.sections) {
    llmsLines.push(`## ${section.heading}`, '');
    for (const entry of section.entries) {
        llmsLines.push(`- [${entry.path}](https://gregoryalan.com${entry.path}): ${entry.hint}`);
    }
    llmsLines.push('');
}
llmsLines.pop();
write('/llms.txt', llmsLines.join('\n'));

// ── 14. robots.txt ──────────────────────────────────────────

const robotsLines = [...curl.robotsTxt.header, '', 'User-agent: *'];
for (const p of curl.robotsTxt.allow) robotsLines.push(`Allow: ${p}`);
for (const p of curl.robotsTxt.disallow) robotsLines.push(`Disallow: ${p}`);
fs.writeFileSync(path.join(__dirname, 'robots.txt'), robotsLines.join('\n') + '\n', 'utf8');

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

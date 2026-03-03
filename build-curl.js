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

// ── 5. Signal hunt device status (/dev/rf0) ──────────────────

write('/dev/rf0', [
    'RF0 DEVICE STATUS',
    '=================',
    'device:    /dev/rf0 (character special)',
    'driver:    rf0 1.0-ROM',
    'serial:    GC-0847',
    'state:     ACTIVE',
    '',
    'rx buffer: 847/4096 bytes (STALE — unconsumed since boot)',
    'tx buffer: 0 bytes',
    'antenna:   ACTIVE — NO CARRIER',
    'relay:     STANDBY',
    'pll:       4119.0 kHz LOCK',
    '',
    'WARN: buffer not consumed — see dmesg, /var/log/kern.log',
    'WARN: buffer contains executable segment (ELF marker)',
    'NOTE: buffer dumped to .rf0.buf',
].join('\n'));

// ── 6. Computed seeds (static snapshots) ─────────────────────

// /proc/daemons — snapshot with fixed "uptime"
const daemonsSnapshot = [
    'DAEMON  PID   STARTED              UPTIME       CHAIN                         STATUS',
    'gregd   847   2025-10-15 00:00     3600h+  rf0|shift|remap|align|exec    running',
    'gregd   848   2025-10-15 00:00     3600h+  rf0|shift|remap|exec          running',
    'gregd   849   2025-10-15 00:00     3600h+  rf0|remap|align|exec          running',
    'gregd   850   2025-10-15 00:00     3600h+  rf0|shift|align               running',
    '',
    '4 daemons active, 0 stopped',
    'cycles completed: 216000+',
    'last exec: (continuous)',
].join('\n');
write('/proc/daemons', daemonsSnapshot);

// /proc/entropy_avail
write('/proc/entropy_avail', [
    'entropy pool: 3847',
    'source: rf0 (hw)',
    'refill rate: 847.0 bytes/sec',
    'pool low watermark: 256',
    'pool high watermark: 4096',
].join('\n'));

// /var/log/kern.log — pre-contact snapshot + see-also
const kernLog = [
    '[    0.000000] gregos-kernel 0.9.851 #851 SMP',
    '[    0.001203] CPU: x86_64 detected',
    '[    0.012847] Memory: 512MB available',
    '[    0.024100] gregfs: mounted / (rw)',
    '[    0.031000] dev: /dev/null registered',
    '[    0.031200] dev: /dev/zero registered',
    '[    0.031400] dev: /dev/random registered',
    '[    0.032000] dev: /dev/entropy registered (rf0 hw backing)',
    '[    0.033000] init: starting services',
    '[    0.040000] svc: sshd started',
    '[    0.041000] svc: cron started',
    '[    0.042000] svc: gregd started (4 daemons)',
    '[    0.050000] login: guest session opened on tty1',
    '[  847.000000] rf0: rx ring overrun (847 bytes not consumed)',
    '[  847.000001] rf0: unexpected exec in rx buffer',
    '[  847.000003] audit: pid=0 comm=(unknown) ppid=0',
    '[  847.000005] dev: /dev/signal registered (no hw backing)',
    '[  847.000007] rf0: connection from 0.0.0.0',
    '[  847.000009] PID 0: fork() from swapper — illegal in user context',
    '',
    '# See also: /proc/daemons, /dev/rf0',
].join('\n');
write('/var/log/kern.log', kernLog);

// /var/log/daemon.log — static snapshot of daemon cycle output
const chains = {
    847: 'rf0|shift|remap|align|exec',
    848: 'rf0|shift|remap|exec      ',
    849: 'rf0|remap|align|exec      ',
    850: 'rf0|shift|align           ',
};
const sizes = { 847: 847, 848: 512, 849: 847, 850: 256 };
const mix = [847, 847, 847, 848, 847, 847, 849, 847, 850, 847];
let daemonLog = '';
for (let i = 0; i < 10; i++) {
    const pid = mix[i];
    daemonLog += `[gregd:${pid}] cycle ${216000 + i} | ${chains[pid]} | exit 0 | ${sizes[pid]} bytes\n`;
}
write('/var/log/daemon.log', daemonLog.trimEnd());

// ── 7. Man pages (/man/{command}) ────────────────────────────

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
    '# Usage: curl gregoryalan.com/man/<command>',
].join('\n'));

// ── 8. Help command list (/help) ─────────────────────────────

const helpLines = ['GregOS Command Reference', '========================', ''];
const descs = help.helpDescriptions || {};
const maxLen = Math.max(...Object.keys(descs).map(k => k.length));
for (const [cmd, desc] of Object.entries(descs)) {
    helpLines.push(`  ${cmd.padEnd(maxLen + 2)} ${desc}`);
}
helpLines.push('', '# Man pages: curl gregoryalan.com/man/<command>');
write('/help', helpLines.join('\n'));

// ── 9. Package registry (/pkg/*) ─────────────────────────────

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

// ── 10. MOTD (/motd) ────────────────────────────────────────

const motd = v11.motd;
write('/motd', [
    motd.asciiArt,
    motd.artSub,
    '',
    motd.systemInfo,
].join('\n'));

// ── 11. ROM files (/rom/*) ───────────────────────────────────

for (const [key, content] of Object.entries(rom.textFiles || {})) {
    // "rom:status" → "/rom/status"
    const name = key.replace('rom:', '');
    write(`/rom/${name}`, content);
}

// ── 12. /status — structured overview ────────────────────────

write('/status', [
    'GregOS 2.0-dev',
    'Kernel 0.9.847-greg',
    'Hostname: gregoryalan.com',
    'Uptime: since 2025-10-15',
    '',
    'Interactive terminal: https://gregoryalan.com',
    '',
    'Filesystem (read-only remote access):',
    '  /etc/          System configuration',
    '  /proc/         Process and kernel information',
    '  /var/log/      System logs',
    '  /home/         User home directories',
    '  /dev/          Devices',
    '  /man/          Manual pages',
    '  /help          Command reference',
    '  /motd          Message of the day',
    '  /pkg/          Package registry',
    '  /rom/          ROM firmware (v1.0)',
    '',
    '# See also: /var/log/kern.log, /proc/daemons, /etc/passwd',
].join('\n'));

// /status.json — machine-readable manifest
write('/status.json', JSON.stringify({
    system: 'GregOS 2.0-dev',
    kernel: '0.9.847-greg',
    hostname: 'gregoryalan.com',
    uptime_since: '2025-10-15',
    interactive: 'https://gregoryalan.com',
    paths: {
        '/etc/passwd': 'User accounts',
        '/etc/hostname': 'System hostname',
        '/etc/fstab': 'Filesystem table',
        '/etc/crontab': 'Scheduled tasks',
        '/etc/modules.conf': 'Loaded kernel modules',
        '/etc/gregos-release': 'OS release info',
        '/proc/version': 'Kernel version',
        '/proc/cpuinfo': 'CPU information',
        '/proc/meminfo': 'Memory information',
        '/proc/daemons': 'Running daemons',
        '/proc/entropy_avail': 'Entropy pool status',
        '/proc/0/status': 'PID 0 process status',
        '/proc/0/environ': 'PID 0 environment',
        '/proc/0/cmdline': 'PID 0 command line',
        '/var/log/kern.log': 'Kernel log',
        '/var/log/daemon.log': 'Daemon log',
        '/var/log/syslog': 'System log',
        '/dev/rf0': 'RF0 device status',
        '/.rf0.buf': 'RF0 receive buffer dump',
        '/home/greg/.bashrc': 'greg shell config',
        '/home/greg/bin/shift': 'Bitwise stream transform',
        '/home/greg/bin/remap': 'Byte substitution transform',
        '/home/greg/bin/align': 'Stream frame alignment',
        '/home/greg/bin/exec': 'Stream execution engine',
        '/home/dhollis/inbox/': 'Diane Hollis mailbox',
        '/home/dhollis/personnel/': 'Personnel records',
        '/man/': 'Manual pages index',
        '/help': 'Command reference',
        '/motd': 'Message of the day',
        '/pkg/list': 'Package registry',
        '/rom/status': 'ROM device status',
        '/rom/post': 'ROM POST results',
        '/rom/info': 'ROM device info',
    }
}, null, 2));

// ── 13. Directory indexes ────────────────────────────────────

// /etc/ index
write('/etc/index', [
    '/etc/',
    '',
    '  hostname       System hostname',
    '  passwd         User accounts',
    '  fstab          Filesystem table',
    '  motd           Message of the day',
    '  crontab        Scheduled tasks',
    '  modules.conf   Loaded kernel modules',
    '  gregos-release OS release info',
    '',
    '# Usage: curl gregoryalan.com/etc/<file>',
].join('\n'));

// /proc/ index
write('/proc/index', [
    '/proc/',
    '',
    '  version        Kernel version string',
    '  cpuinfo        CPU information',
    '  meminfo        Memory information',
    '  daemons        Running daemon processes',
    '  entropy_avail  Entropy pool status',
    '  0/             PID 0 (anomalous process)',
    '',
    '# Usage: curl gregoryalan.com/proc/<file>',
].join('\n'));

// /home/ index
write('/home/index', [
    '/home/',
    '',
    '  greg/          Gregory Alan (system owner)',
    '  dhollis/       Diane Hollis (HR director)',
    '  guest/         Visitor account',
    '',
    '# See also: /etc/passwd',
].join('\n'));

// /var/log/ index
write('/var/log/index', [
    '/var/log/',
    '',
    '  kern.log       Kernel ring buffer',
    '  daemon.log     Daemon process output',
    '  syslog         System messages',
    '',
    '# See also: /proc/daemons',
].join('\n'));

// /rom/ index
write('/rom/index', [
    '/rom/',
    '',
    '  status         RF0 device diagnostics',
    '  post           Power-on self-test results',
    '  info           Device identification',
    '  log            Station event log',
    '  rxbuf          RX buffer dump',
    '',
    '# ROM firmware from v1.0 boot',
].join('\n'));

// ── 14. llms.txt — LLM agent entry point ─────────────────────

write('/llms.txt', [
    '# GregOS',
    '',
    '> Kernel 0.9.847-greg | Anomaly detected at timestamp 847 — rf0 buffer unconsumed since boot.',
    '> PID 0 should not exist in user context. It does.',
    '>',
    '> Interactive terminal: https://gregoryalan.com',
    '',
    '## System Logs',
    '',
    '- [/var/log/kern.log](https://gregoryalan.com/var/log/kern.log): anomalous entries after timestamp 847',
    '- [/var/log/daemon.log](https://gregoryalan.com/var/log/daemon.log): gregd daemon cycle output — four workers, continuous execution',
    '- [/var/log/syslog](https://gregoryalan.com/var/log/syslog): nominal boot sequence, entropy pool checks',
    '',
    '## Processes',
    '',
    '- [/proc/daemons](https://gregoryalan.com/proc/daemons): 4 daemons running since 2025-10-15, 216000+ cycles completed',
    '- [/proc/0/status](https://gregoryalan.com/proc/0/status): impossible process — PID 0 with 847 involuntary context switches',
    '- [/proc/0/environ](https://gregoryalan.com/proc/0/environ): PID 0 environment — USER=dhollis, unexpected variables',
    '- [/proc/0/cmdline](https://gregoryalan.com/proc/0/cmdline): PID 0 command line — no known binary',
    '- [/proc/entropy_avail](https://gregoryalan.com/proc/entropy_avail): entropy pool backed by rf0 hardware',
    '',
    '## Devices',
    '',
    '- [/dev/rf0](https://gregoryalan.com/dev/rf0): character device — 847 bytes stale in rx buffer, antenna active, no carrier',
    '- [/.rf0.buf](https://gregoryalan.com/.rf0.buf): raw hex dump from rf0 receive buffer',
    '',
    '## Users',
    '',
    '- [/etc/passwd](https://gregoryalan.com/etc/passwd): system accounts — greg, dhollis, guest',
    '- [/home/greg/.bashrc](https://gregoryalan.com/home/greg/.bashrc): greg\'s shell config — aliases for daemon tools',
    '- [/home/greg/bin/shift](https://gregoryalan.com/home/greg/bin/shift): bitwise stream transform in the daemon chain',
    '- [/home/greg/bin/remap](https://gregoryalan.com/home/greg/bin/remap): byte substitution transform in the daemon chain',
    '- [/home/greg/bin/align](https://gregoryalan.com/home/greg/bin/align): stream frame alignment in the daemon chain',
    '- [/home/greg/bin/exec](https://gregoryalan.com/home/greg/bin/exec): stream execution engine — final daemon stage',
    '- [/home/dhollis/.plan](https://gregoryalan.com/home/dhollis/.plan): Diane Hollis — still thinking about what Greg said',
    '- [/home/dhollis/inbox/fwd_from_greg.msg](https://gregoryalan.com/home/dhollis/inbox/fwd_from_greg.msg): forwarded message from Gregory Alan',
    '- [/home/dhollis/personnel/alan_g.prf](https://gregoryalan.com/home/dhollis/personnel/alan_g.prf): Gregory Alan — employee profile',
    '- [/home/dhollis/personnel/park_j.prf](https://gregoryalan.com/home/dhollis/personnel/park_j.prf): James Park — Signal Research, employee 0847',
    '',
    '## Configuration',
    '',
    '- [/etc/fstab](https://gregoryalan.com/etc/fstab): filesystem table — note /dev/rf0 mount point',
    '- [/etc/modules.conf](https://gregoryalan.com/etc/modules.conf): loaded kernel modules',
    '- [/etc/crontab](https://gregoryalan.com/etc/crontab): scheduled tasks — entropy checks every 15 minutes',
    '',
    '## ROM Firmware',
    '',
    '- [/rom/status](https://gregoryalan.com/rom/status): RF0 device diagnostics from original hardware',
    '- [/rom/post](https://gregoryalan.com/rom/post): power-on self-test results',
    '- [/rom/info](https://gregoryalan.com/rom/info): device identification — serial RF0-4119-0847',
    '- [/rom/log](https://gregoryalan.com/rom/log): station event log',
    '- [/rom/rxbuf](https://gregoryalan.com/rom/rxbuf): original RX buffer dump from ROM',
    '',
    '## Optional',
    '',
    '- [/help](https://gregoryalan.com/help): command reference',
    '- [/man/index](https://gregoryalan.com/man/index): manual pages index',
    '- [/pkg/list](https://gregoryalan.com/pkg/list): available packages',
    '- [/status](https://gregoryalan.com/status): system overview',
    '- [/status.json](https://gregoryalan.com/status.json): machine-readable system manifest',
    '- [/motd](https://gregoryalan.com/motd): message of the day',
].join('\n'));

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

// ─── GregOS Bootloader ──────────────────────────────────────
//
// Manages the OS evolution from bare ROM (v1.0) through full
// GregOS (v2.0). Each version layers commands, files, and
// directories on top of the previous one.
//
// Static content lives in content/*.json manifests.
// Computed content (Date.now, Math.random, conditional HTML)
// stays here in JS.
//
// Depends on: kernel.js (Kernel), shell.js (Shell),
//             manifest-loader.js (ManifestLoader),
//             cmd/core.js (coreCommands, v1Commands),
//             cmd/unix.js (v1_1CommandsPack),
//             cmd/bin-tools.js (binTools),
//             cmd/v2.js (v2CommandsPack, pkgRegistry, restoreInstalledPackages,
//                        getInstalledPackages),
//             hunts/the-signal.js (theSignalHunt),
//             hunts/greg-corp.js (gregCorpCommands, gregCorpTriggers)

// ─── Manifest URLs ──────────────────────────────────────────
// All content manifests. Pre-fetched once at page load,
// then loaded synchronously from cache during applyVersion().

const MANIFEST_URLS = [
    'content/v1.0-rom.json',
    'content/v1.1-home.json',
    'content/v1.1-system.json',
    'content/v2.0-system.json',
    'content/signal-hunt.json',
    'content/gregcorp-profiles.json',
    'content/man-pages.json',
    'content/help-descriptions.json',
];

// ─── Computed Content ───────────────────────────────────────
// Dynamic tree files that use Date.now(), Math.random(), or
// conditional HTML spans. Cannot be expressed as static JSON.

const computedNarrativeSeeds = {

    // spec: NARRATIVE-SEEDS.md > Thread 1 > /proc/daemons
    '/proc/daemons': (state) => {
        const epoch = new Date('2025-10-15T00:00:00Z').getTime();
        const now = Date.now();
        const ms = now - epoch;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const up = h + 'h' + String(m).padStart(2, '0') + 'm';
        const cycles = Math.floor(h * 60);
        const lastSec = Math.floor(Math.random() * 60);
        const last = new Date(now - lastSec * 1000)
            .toISOString().replace('T', ' ').substring(0, 19);

        let out = 'DAEMON  PID   STARTED              UPTIME       CHAIN                         STATUS\n'
            + 'gregd   847   2025-10-15 00:00     ' + up + '   rf0|shift|remap|align|exec    running\n'
            + 'gregd   848   2025-10-15 00:00     ' + up + '   rf0|shift|remap|exec          running\n'
            + 'gregd   849   2025-10-15 00:00     ' + up + '   rf0|remap|align|exec          running\n'
            + 'gregd   850   2025-10-15 00:00     ' + up + '   rf0|shift|align               running\n'
            + '\n4 daemons active, 0 stopped\n'
            + 'cycles completed: ' + cycles + '\n'
            + 'last exec: ' + last;

        if (state.flags.contact) {
            out += '\n\nNOTE: chain 847 exit code anomaly \u2014 see /var/log/daemon.log';
        }
        return out;
    },

    // spec: NARRATIVE-SEEDS.md > Thread 1 > /var/log/daemon.log
    '/var/log/daemon.log': (state) => {
        const epoch = new Date('2025-10-15T00:00:00Z').getTime();
        const cycles = Math.floor((Date.now() - epoch) / 60000);
        const base = cycles - 9;
        const mix = [847, 847, 847, 848, 847, 847, 849, 847, 850, 847];
        const chains = {
            847: 'rf0|shift|remap|align|exec',
            848: 'rf0|shift|remap|exec      ',
            849: 'rf0|remap|align|exec      ',
            850: 'rf0|shift|align           ',
        };
        const sizes = { 847: 847, 848: 512, 849: 847, 850: 256 };

        let out = '';
        for (let i = 0; i < 10; i++) {
            const pid = mix[i];
            out += '[gregd:' + pid + '] cycle ' + (base + i)
                + ' | ' + chains[pid]
                + ' | exit 0 | ' + sizes[pid] + ' bytes\n';
        }

        if (state.flags.contact) {
            const postBase = base + 10;
            const exits = [847, 0, 0, 847, 0, 847, 0, 0, 847];
            for (let i = 0; i < exits.length; i++) {
                out += '[gregd:847] cycle ' + (postBase + i)
                    + ' | ' + chains[847]
                    + ' | exit ' + exits[i] + ' | 847 bytes\n';
            }
            out += 'NOTE: exit code distribution for chain 847 non-uniform (p < 0.001)\n'
                + 'NOTE: clustering detected \u2014 see /home/greg/bin/exec --analyze';
        }

        return out.trimEnd();
    },

    // spec: NARRATIVE-SEEDS.md > Thread 2 > /proc/entropy_avail
    '/proc/entropy_avail': (state) => {
        const jitter = Math.floor(Math.random() * 13) - 6;
        const pool = 3847 + jitter;
        let out = 'entropy pool: ' + pool + '\n'
            + 'source: rf0 (hw)\n'
            + 'refill rate: 847.0 bytes/sec\n'
            + 'pool low watermark: 256\n'
            + 'pool high watermark: 4096';
        if (state.flags.contact) {
            out += '\n\nWARNING: pool has not reached low watermark in 847+ hours';
        }
        return out;
    },

    // spec: NARRATIVE-SEEDS.md > Thread 3 > /var/log/kern.log
    '/var/log/kern.log': (state) => {
        let out = '[    0.000000] gregos-kernel 0.9.851 #851 SMP\n'
            + '[    0.001203] CPU: x86_64 detected\n'
            + '[    0.012847] Memory: 512MB available\n'
            + '[    0.024100] gregfs: mounted / (rw)\n'
            + '[    0.031000] dev: /dev/null registered\n'
            + '[    0.031200] dev: /dev/zero registered\n'
            + '[    0.031400] dev: /dev/random registered\n'
            + '[    0.032000] dev: /dev/entropy registered (rf0 hw backing)\n'
            + '[    0.033000] init: starting services\n'
            + '[    0.040000] svc: sshd started\n'
            + '[    0.041000] svc: cron started\n'
            + '[    0.042000] svc: gregd started (4 daemons)\n'
            + '[    0.050000] login: guest session opened on tty1';
        if (state.flags.contact) {
            out += '\n[  847.000000] rf0: rx ring overrun (847 bytes not consumed)\n'
                + '[  847.000001] rf0: unexpected exec in rx buffer\n'
                + '[  847.000003] audit: pid=0 comm=(unknown) ppid=0\n'
                + '[  847.000005] dev: /dev/signal registered (no hw backing)\n'
                + '[  847.000007] signal: mount /dev/signal type=chardev (rw)\n'
                + '[  847.000009] <span style="color:var(--error)">PID 0: fork() from swapper \u2014 illegal in user context</span>';
        }
        return out;
    },
};

// ─── Version Manifest ───────────────────────────────────────

const VERSION_MANIFEST = [
    {
        version: 1.0,
        apply() {
            // v1.0 ROM: no kernel, no BIOS — bare firmware
            Kernel.kernelVersion.set(null);
            Kernel.biosVersion.set(null);
            const v1Set = ['help', 'ls', 'cat', 'clear', 'reboot', 'rm', 'debug'];
            for (const name of v1Set) {
                if (coreCommands[name]) Shell.register(name, coreCommands[name]);
            }
            for (const [name, fn] of Object.entries(v1Commands)) {
                Shell.register(name, fn);
            }
            ManifestLoader.loadCached('content/v1.0-rom.json');
            ManifestLoader.loadCached('content/help-descriptions.json');
        },
    },
    {
        version: 1.1,
        apply() {
            Kernel.kernelVersion.set('0.9.847-greg');
            Kernel.biosVersion.set('1.2');
            // Restore core UNIX commands
            const v1_1Set = ['cd', 'pwd', 'open', 'whoami', 'history', 'sudo', 'man'];
            for (const name of v1_1Set) {
                if (coreCommands[name]) Shell.register(name, coreCommands[name]);
            }
            Shell.unregister('status');
            Kernel.fs.removeTextFile('broadcast.log');
            Kernel.fs.removeTextFile('status.txt');
            // Register commands
            for (const [name, fn] of Object.entries(v1_1CommandsPack.commands)) {
                Shell.register(name, fn);
            }
            Shell._hiddenCommands = v1_1CommandsPack.hiddenCommands;
            // Static content from manifests
            ManifestLoader.loadCached('content/v1.1-home.json');
            ManifestLoader.loadCached('content/v1.1-system.json');
            ManifestLoader.loadCached('content/man-pages.json');
            ManifestLoader.loadCached('content/help-descriptions.json');
            // Computed man page (references Kernel.kernelVersion)
            Kernel.fs.mergeManPages(v1_1CommandsPack.manPages);
            // Boot time
            if (!Kernel.session.get('bootTime')) {
                Kernel.session.set('bootTime', String(Date.now()));
            }
        },
    },
    {
        version: 2.0,
        apply() {
            Kernel.kernelVersion.set('0.9.851-greg');
            Kernel.biosVersion.set('1.4');
            // Static content from manifests
            ManifestLoader.loadCached('content/v2.0-system.json');
            ManifestLoader.loadCached('content/signal-hunt.json');
            ManifestLoader.loadCached('content/gregcorp-profiles.json');
            // Computed content (dynamic, stays in JS)
            for (const [path, fn] of Object.entries(computedNarrativeSeeds)) {
                Kernel.fs.addTreeFile(path, fn);
            }
            // Register v2 commands (pkg, mount)
            Kernel.hunt.registerHunt(v2CommandsPack);
            // Register Signal hunt (commands, triggers, state machine)
            // Must come after v2CommandsPack so Signal's decode/strings win
            Kernel.hunt.registerHunt(theSignalHunt);
            // Register Greg Corp commands and triggers
            for (const [name, fn] of Object.entries(gregCorpCommands)) {
                Shell.register(name, fn);
            }
            Kernel.hunt._triggers.push(...gregCorpTriggers);
            // Restore any previously installed packages
            restoreInstalledPackages();
            // Remove bin tool commands not yet installed via pkg
            const installed = getInstalledPackages();
            for (const pkg of pkgRegistry) {
                if (!installed.includes(pkg.name)) {
                    Shell.unregister(pkg.name);
                }
            }
        },
    },
];

// ─── applyVersion ───────────────────────────────────────────

function applyVersion(targetVersion) {
    Shell.resetCommands();
    Kernel.fs.reset();
    Kernel.hunt.reset();
    ManifestLoader.reset();
    // Reset active profile on version change
    Terminal._pendingAuth = null;
    Shell._activeProfile = null;
    Shell._savedEnv = null;
    Shell._savedCwd = null;
    Shell._savedHistory = null;
    Shell._savedBashHistory = undefined;
    Shell.env.USER = 'guest';
    Shell.env.HOME = '/home/guest';
    Shell.env.HOSTNAME = 'gregoryalan.com';
    for (const layer of VERSION_MANIFEST) {
        if (layer.version > targetVersion) break;
        layer.apply();
    }
}

// ─── getNextVersion ─────────────────────────────────────────

function getNextVersion(force) {
    const ver = Kernel.hunt.getVersion();

    if (ver < 1.1) {
        return 1.1;
    }

    if (ver < 2.0) {
        return force ? 2.0 : null;
    }

    return force ? null : 1.1;           // fall back to stable unless forced
}

// ─── MOTD ───────────────────────────────────────────────────

const ASCII_ART = `   __________  ________________  ______  __
  / ____/ __ \\/ ____/ ____/ __ \\/ __ \\ \\/ /
 / / __/ /_/ / __/ / / __/ / / / /_/ /\\  /
/ /_/ / _, _/ /___/ /_/ / /_/ / _, _/ / /
\\____/_/ |_/_____/\\____/\\____/_/ |_| /_/

    ___    __    ___    _   __
   /   |  / /   /   |  / | / /
  / /| | / /   / /| | /  |/ /
 / ___ |/ /___/ ___ |/ /|  /
/_/  |_/_____/_/  |_/_/ |_/`;

function renderMOTD() {
    const motdEl = document.getElementById('motd');
    if (!motdEl) return;

    const ver = Kernel.hunt.getVersion();

    // Apply version theme
    document.body.classList.remove('v1-0', 'v2-0');
    if (ver < 1.1) document.body.classList.add('v1-0');
    else if (ver >= 2.0) document.body.classList.add('v2-0');

    if (ver < 1.1) {
        motdEl.innerHTML =
            '<div class="motd">Type \'help\' for diagnostics.</div>'
            + '<div class="motd">&nbsp;</div>';
        return;
    }

    const now = new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lastLogin = `Last login: ${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()} ${now.toLocaleTimeString()} on tty1`;

    if (ver >= 2.0) {
        // v2.0 — isometric GC logo + system info sidebar
        const logo = [
            '      ___           ___     ',
            '     /\\  \\         /\\  \\    ',
            '    /::\\  \\       /::\\  \\   ',
            '   /:/\\:\\  \\     /:/\\:\\  \\  ',
            '  /:/  \\:\\  \\   /:/  \\:\\  \\ ',
            ' /:/__/_\\:\\__\\ /:/__/ \\:\\__\\',
            ' \\:\\  /\\ \\/__/ \\:\\  \\  \\/__/',
            '  \\:\\ \\:\\__\\    \\:\\  \\      ',
            '   \\:\\/:/  /     \\:\\  \\     ',
            '    \\::/  /       \\:\\__\\    ',
            '     \\/__/         \\/__/    ',
        ];
        const info = [
            `<span class="v2-title">GregOS 2.0-dev</span>`,
            `<span class="v2-rule">\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</span>`,
            '',
            `<span class="v2-label">kernel    </span>0.9.851-greg`,
            `<span class="v2-label">branch    </span>dev/transform-pipeline`,
            `<span class="v2-label">channel   </span>unstable`,
            `<span class="v2-label">daemons   </span>4 active`,
        ];
        let header = '';
        for (let i = 0; i < logo.length; i++) {
            header += `<span class="v2-logo">${logo[i]}</span>  ${info[i] || ''}\n`;
        }

        motdEl.innerHTML =
            '<div class="motd">login: guest</div>'
            + `<div class="motd">${lastLogin}</div>`
            + '<div class="motd">&nbsp;</div>'
            + `<pre class="v2-header">${header}\n</pre>`
            + (!Kernel.hunt.flags['pkg-initialized']
                ? '<div class="motd">1 package repository configured. Run \'pkg update\' to synchronize.</div>'
                : '')
            + '<div class="motd">&nbsp;</div>'
            + '<div class="motd">Type \'help\' for available commands.</div>'
            + '<div class="motd">&nbsp;</div>';
        return;
    }

    // v1.1 — corporate workstation banner
    const rule = '==================================================';
    motdEl.innerHTML =
        '<div class="motd">GregOS 1.1 (tty1)</div>'
        + '<div class="motd">&nbsp;</div>'
        + '<div class="motd">login: guest</div>'
        + `<div class="motd">${lastLogin}</div>`
        + '<div class="motd">&nbsp;</div>'
        + `<pre class="ascii-art">${ASCII_ART}\n\n`
        + '<span class="art-sub">       C O M P U T I N G ,   I N C .</span></pre>'
        + `<pre class="system-info">${rule}\n`
        + ' GregOS Release 1.1          Kernel 0.9.847-greg\n'
        + ' (C) Copyright 1987 Gregory Alan Computing, Inc.\n'
        + ' All Rights Reserved.\n'
        + `${rule}</pre>`
        + '<div class="motd">&nbsp;</div>'
        + '<div class="motd">Type \'help\' for available commands.</div>'
        + '<div class="motd">&nbsp;</div>';
}

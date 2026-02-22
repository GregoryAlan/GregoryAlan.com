// ─── GregOS Version System ──────────────────────────────────
//
// Manages the OS evolution from bare ROM (v1.0) through full
// GregOS (v2.0). Each version layers commands, files, and
// directories on top of the previous one.
//
// Depends on: terminal.js (coreCommands, resetToBaseline, huntState, etc.)
//             bin-tools.js (binTools), v2-commands.js (v2CommandsPack,
//             restoreInstalledPackages), the-signal.js (theSignalHunt)

// ─── v1.0 Content ───────────────────────────────────────────

const v1Files = {
    'broadcast.log':
        'RF0 STATION LOG\n'
        + '[2026-01-22 03:14:00] init from ROM\n'
        + '[2026-01-22 03:14:01] ant0: ACTIVE\n'
        + '[2026-01-22 03:14:02] relay: STANDBY\n'
        + '[............]\n'
        + '[2026-01-22 08:47:00] rx0: 847 bytes buffered (unconsumed)\n'
        + '[2026-01-22 08:47:01] rx0: checksum FAIL \u2014 pkt held\n'
        + '[............]\n'
        + 'End of log.',

    'status.txt':
        'RF0 STATUS\n'
        + 'firmware: 1.0-ROM\n'
        + 'signal:   NOMINAL\n'
        + 'maint:    UNKNOWN\n'
        + 'update:   AVAILABLE\n'
        + '\n'
        + 'Run \'reboot\' to check for updates.',
};

const v1Commands = {
    status: () => {
        huntState.discover('ran-status');
        return 'RF0 DIAGNOSTICS\n'
            + 'firmware:  1.0-ROM\n'
            + 'uptime:    847h 14m\n'
            + 'rf:        847.0MHz LOCK\n'
            + 'antenna:   ACTIVE\n'
            + 'relay:     STANDBY\n'
            + 'rx buf:    847 bytes (unconsumed)\n'
            + 'tx buf:    0 bytes\n'
            + 'update:    AVAILABLE';
    },
};

// ─── v1.1 Content ───────────────────────────────────────────

const v1_1Files = {
    'welcome.txt': 'Welcome to GregOS 1.1\nThis system is provided for authorized guests.\nAll activity may be monitored and recorded.',
    'version.txt': 'GregOS v1.1\n'
        + 'Build:  2026.01.22\n'
        + 'Kernel: 4.19.0-gregos\n'
        + 'Update: available\n'
        + '\n'
        + '-- update manifest --\n'
        + 'timestamp: 2091-11-15T03:14:00Z\n'
        + 'checksum:  a7 3f ?? ??\n'
        + 'source:    rf0',
    'contact.txt': 'Email: your@email.com',
    'about.txt': 'Gregory Alan - Developer & Creator\nBuilding games and experiments.',
};

const v1_1HiddenFiles = {
    '.bash_history': [
        'whoami',
        'cat about.txt',
        'cd games',
        'ls',
        'cd ..',
        'cat welcome.txt',
        'cat version.txt',
        'reboot -f',
    ].map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n'),
};

const v1_1Dirs = {
    "games": {
        "beary-time.html": "file",
        "ice-runner.html": "file",
        "taipei-climber.html": "file"
    },
    "drafts": {
        "game-of-life.html": "file",
        "sound-pad.html": "file"
    },
};

// ─── Version Manifest ───────────────────────────────────────

const VERSION_MANIFEST = [
    {
        version: 1.0,
        apply() {
            // v1.0 ROM: minimal command set + two files
            const v1Set = ['help', 'ls', 'cat', 'clear', 'reboot', 'rm'];
            for (const name of v1Set) {
                if (coreCommands[name]) commands[name] = coreCommands[name];
            }
            // v1.0-specific commands
            Object.assign(commands, v1Commands);
            // v1.0 files
            Object.assign(textFiles, v1Files);
        },
    },
    {
        version: 1.1,
        apply() {
            // Restore core UNIX commands
            const v1_1Set = ['cd', 'pwd', 'open', 'whoami', 'history', 'sudo', 'man'];
            for (const name of v1_1Set) {
                if (coreCommands[name]) commands[name] = coreCommands[name];
            }
            // Remove v1.0-only commands
            delete commands.status;
            // Remove v1.0-only files
            delete textFiles['broadcast.log'];
            delete textFiles['status.txt'];
            // Add v1.1 files
            Object.assign(textFiles, v1_1Files);
            Object.assign(hiddenFiles, v1_1HiddenFiles);
            // Add directories (load from files.json or use defaults)
            Object.assign(fileTree, v1_1Dirs);
        },
    },
    {
        version: 2.0,
        apply() {
            // Update welcome text and version
            textFiles['welcome.txt'] = 'Welcome to GregOS 2.0\nThis system is provided for authorized guests.\nAll activity may be monitored and recorded.';
            textFiles['version.txt'] = 'GregOS v2.0\n'
                + 'Build:  2026.02.15\n'
                + 'Kernel: 5.10.0-gregos\n'
                + 'Status: current';

            // v2.0 .bash_history (pre-crash breadcrumbs)
            hiddenFiles['.bash_history'] = [
                'cat welcome.txt',
                'pkg update',
                'pkg list',
                'pkg install decode',
                'pkg install strings',
                'cat migration.conf',
                'mount',
            ].map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n');

            // Register v2 commands (pkg, mount, migration.conf)
            registerHunt(v2CommandsPack);

            // Register Signal hunt (commands + gated files)
            // Must come after v2CommandsPack so Signal's decode/strings win
            registerHunt(theSignalHunt);

            // Restore any previously installed packages
            restoreInstalledPackages();

            // Remove bin tool commands not yet installed via pkg.
            // registerHunt(theSignalHunt) added decode/strings to commands,
            // but they should only be available after pkg install.
            const installed = getInstalledPackages();
            for (const pkg of pkgRegistry) {
                if (!installed.includes(pkg.name)) {
                    delete commands[pkg.name];
                }
            }
        },
    },
];

// ─── applyVersion ───────────────────────────────────────────

function applyVersion(targetVersion) {
    resetToBaseline();
    for (const layer of VERSION_MANIFEST) {
        if (layer.version > targetVersion) break;
        layer.apply();
    }
}

// ─── getNextVersion ─────────────────────────────────────────

function getNextVersion(force) {
    const ver = huntState.getVersion();

    if (ver < 1.1) {
        // v1.0 → v1.1: any reboot advances. The v1.0 ROM screen
        // is the breadcrumb — status.txt hints at it, but seeing
        // the screen is enough.
        return 1.1;
    }

    if (ver < 2.0) {
        // v1.1 → v2.0: requires reboot -f (force reflash from update channel)
        return force ? 2.0 : null;
    }

    // v2.0 — no advancement yet
    return null;
}

// ─── MOTD ───────────────────────────────────────────────────

const ASCII_ART = ` \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557   \u2588\u2588\u2557
\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u255a\u2588\u2588\u2557 \u2588\u2588\u2554\u255d
\u2588\u2588\u2551  \u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551  \u2588\u2588\u2588\u2557\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d \u255a\u2588\u2588\u2588\u2588\u2554\u255d
\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u255d  \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557  \u255a\u2588\u2588\u2554\u255d
\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551  \u2588\u2588\u2551   \u2588\u2588\u2551
 \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d  \u255a\u2550\u255d   \u255a\u2550\u255d

 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2557   \u2588\u2588\u2557
\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551
\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551
\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u255a\u2588\u2588\u2557\u2588\u2588\u2551
\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551 \u255a\u2588\u2588\u2588\u2588\u2551
\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u2550\u2550\u255d`;

function renderMOTD() {
    const motdEl = document.getElementById('motd');
    if (!motdEl) return;

    const ver = huntState.getVersion();

    if (ver < 1.1) {
        // v1.0 ROM — single line nudge, boot already identified the device
        motdEl.innerHTML =
            '<div class="motd">Type \'help\' for diagnostics.</div>'
            + '<div class="motd">&nbsp;</div>';
        return;
    }

    // v1.1+ — full MOTD with ASCII art
    const verStr = ver < 2.0 ? '1.1' : '2.0';
    const now = new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lastLogin = `Last login: ${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()} ${now.toLocaleTimeString()} on tty1`;

    motdEl.innerHTML =
        `<div class="motd">GregOS ${verStr} (tty1)</div>`
        + '<div class="motd">&nbsp;</div>'
        + '<div class="motd">login: guest</div>'
        + `<div class="motd">${lastLogin}</div>`
        + '<div class="motd">&nbsp;</div>'
        + `<pre class="ascii-art">${ASCII_ART}</pre>`
        + '<div class="motd">Developer &amp; Creator.</div>'
        + (ver >= 2.0 && !huntState.flags['pkg-initialized']
            ? '<div class="motd">1 package repository configured. Run \'pkg update\' to synchronize.</div>'
            : '')
        + '<div class="motd">&nbsp;</div>'
        + '<div class="motd">Type \'help\' for available commands.</div>'
        + '<div class="motd">&nbsp;</div>';
}

// ─── GregOS Bootloader ──────────────────────────────────────
//
// Manages the OS evolution from bare ROM (v1.0) through full
// GregOS (v2.0). Each version layers commands, files, and
// directories on top of the previous one.
//
// Static content lives in content/*.json manifests.
// Computed content lives in content/computed-seeds.js.
//
// Depends on: kernel.js (Kernel), shell.js (Shell),
//             manifest-loader.js (ManifestLoader),
//             cmd/core.js (coreCommands, v1Commands),
//             cmd/unix.js (v1_1CommandsPack),
//             cmd/bin-tools.js (binTools),
//             cmd/v2.js (v2CommandsPack, pkgRegistry, restoreInstalledPackages,
//                        getInstalledPackages),
//             drivers/the-signal.js (theSignalDriver),
//             drivers/greg-corp.js (gregCorpDriver),
//             content/computed-seeds.js (computedNarrativeSeeds)

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

// ─── Version Manifest ───────────────────────────────────────

const VERSION_MANIFEST = [
    {
        version: 1.0,
        apply() {
            // v1.0 ROM: no kernel, no BIOS — bare firmware
            Kernel.kernelVersion.set(null);
            Kernel.biosVersion.set(null);
            const v1Set = ['help', 'clear', 'reboot'];
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
            const v1_1Set = ['cd', 'pwd', 'open', 'whoami', 'history', 'sudo', 'man', 'ls', 'cat', 'rm', 'debug'];
            for (const name of v1_1Set) {
                if (coreCommands[name]) Shell.register(name, coreCommands[name]);
            }
            // Remove firmware monitor commands
            for (const name of Object.keys(v1Commands)) Shell.unregister(name);
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
            Kernel.driver.registerDriver(v2CommandsPack);
            // Register Signal driver (commands, triggers, state machine)
            // Must come after v2CommandsPack so Signal's decode/strings win
            Kernel.driver.registerDriver(theSignalDriver);
            // Register Greg Corp driver (commands, triggers, state machine)
            Kernel.driver.registerDriver(gregCorpDriver);
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
    Kernel.driver.reset();
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
    const ver = Kernel.driver.getVersion();

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

    const ver = Kernel.driver.getVersion();

    // Apply version theme
    document.body.classList.remove('v1-0', 'v2-0');
    if (ver < 1.1) document.body.classList.add('v1-0');
    else if (ver >= 2.0) document.body.classList.add('v2-0');

    if (ver < 1.1) {
        motdEl.innerHTML =
            '<div class="motd">POST: 6/7 OK, 1 WARN</div>'
            + '<div class="motd">&nbsp;</div>'
            + '<div class="motd">type \'help\' for commands</div>'
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
            + (!Kernel.driver.flags['pkg-initialized']
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

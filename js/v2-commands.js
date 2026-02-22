// ─── v2.0 Commands: Package Manager & Mount ─────────────────
//
// Adds `pkg` (install bin tools on demand) and `mount`
// (discover /dev/rf0 → crash → Signal hunt begins).
//
// Depends on: terminal.js (huntState, commands, fileTree, etc.)
//             bin-tools.js (binTools)
//             the-signal.js (theSignalHunt)

// ─── Package Metadata ───────────────────────────────────────

const pkgRegistry = [
    { name: 'decode',  version: '1.2.0', size: '12K', desc: 'Hex/base64 decoder' },
    { name: 'rot13',   version: '1.0.0', size: '4K',  desc: 'ROT13 cipher' },
    { name: 'freq',    version: '1.1.0', size: '8K',  desc: 'Letter frequency analysis' },
    { name: 'entropy', version: '2.0.1', size: '6K',  desc: 'Shannon entropy calculator' },
    { name: 'crc',     version: '1.0.0', size: '5K',  desc: 'CRC32 checksum' },
    { name: 'strings', version: '1.3.0', size: '10K', desc: 'Extract printable strings' },
];

// ─── Package Install Logic ──────────────────────────────────

function getInstalledPackages() {
    try {
        return JSON.parse(huntState.flags['pkg-installed'] || '[]');
    } catch(e) {
        return [];
    }
}

function installPackage(name) {
    // Determine command source: Signal-aware override wins
    const cmd = (theSignalHunt.commands[name]) || binTools.commands[name];
    if (!cmd) return false;

    // Register command
    commands[name] = cmd;

    // Register man page (always from binTools)
    if (binTools.manPages[name]) {
        manPages[name] = binTools.manPages[name];
    }

    // Ensure bin/ directory exists and add entry
    if (!fileTree.bin) {
        fileTree.bin = {};
    }
    fileTree.bin[name] = 'file';

    // Track in persistent state
    const installed = getInstalledPackages();
    if (!installed.includes(name)) {
        installed.push(name);
        huntState.setFlag('pkg-installed', JSON.stringify(installed));
    }

    return true;
}

function restoreInstalledPackages() {
    const installed = getInstalledPackages();
    for (const name of installed) {
        const cmd = (theSignalHunt.commands[name]) || binTools.commands[name];
        if (cmd) commands[name] = cmd;
        if (binTools.manPages[name]) manPages[name] = binTools.manPages[name];
        if (!fileTree.bin) fileTree.bin = {};
        fileTree.bin[name] = 'file';
    }
}

// ─── Mount Crash Sequence ───────────────────────────────────

async function runMountCrash() {
    input.disabled = true;

    const crashLines = [
        { text: 'mount: mounting /dev/rf0 ...', delay: 2000 },
        { text: 'rf0: device probing ...', delay: 1500 },
        { text: 'rf0: firmware 1.0-ROM detected', delay: 500 },
        { text: 'rf0: loading driver ... done', delay: 800 },
        { text: 'rf0: initializing rx buffer ...', delay: 3000 },
        { text: 'rf0: rx ring overrun detected', delay: 500 },
        { text: 'rf0: 847 bytes in buffer (unconsumed since v1.0)', delay: 800 },
        { text: 'rf0: attempting recovery ...', delay: 2000 },
        { text: 'rf0: buffer checksum: a7 3f ?? ??', delay: 500 },
        { text: 'rf0: WARN: checksum incomplete', delay: 1500, style: 'color:#ff0' },
        { text: 'rf0: ERR: buffer contains executable segment (ELF marker at offset 0x00)', delay: 800, style: 'color:#f55' },
        { text: 'rf0: FATAL: refusing to mount \u2014 unverified executable content', delay: 500, style: 'color:#f55;font-weight:bold' },
        { text: 'kernel: rf0: device fault \u2014 dumping buffer to .rf0.buf', delay: 800 },
        { text: 'kernel: rf0: 847 bytes written', delay: 2000 },
        { text: 'Segmentation fault (core dumped)', delay: 3000, style: 'color:#f55;font-weight:bold' },
        { text: 'kernel panic - not syncing: device fault in rf0 driver', delay: 0, style: 'color:#ff0;font-weight:bold' },
    ];

    const crashDiv = document.createElement('div');
    crashDiv.className = 'output';
    output.appendChild(crashDiv);

    for (const entry of crashLines) {
        const line = document.createElement('div');
        if (entry.style) line.style.cssText = entry.style;
        line.textContent = entry.text;
        crashDiv.appendChild(line);
        input.scrollIntoView({ block: 'end' });
        await new Promise(r => setTimeout(r, entry.delay));
    }

    // Freeze on panic
    await new Promise(r => setTimeout(r, 3000));

    // Record the crash discovery
    huntState.discover('rf0-mount-failed');

    // Screen goes black
    terminal.style.display = 'none';
    await new Promise(r => setTimeout(r, 1500));

    // Auto-reboot into v2.0 (crash recovery, not version advance)
    sessionStorage.removeItem('bootDone');
    output.innerHTML = '';
    bootScreen.innerHTML = '';
    bootScreen.style.display = '';
    bootScreen.style.opacity = '1';

    // Re-apply current version (rebuilds everything with crash flag now set)
    applyVersion(huntState.getVersion());
    renderMOTD();
    updatePrompt();

    runBootSequence().then(() => {
        input.disabled = false;
        input.focus();
    });
}

// ─── v2 Commands Pack ───────────────────────────────────────

const v2CommandsPack = {
    id: 'v2-commands',

    files: {
        text: {
            'migration.conf': '# GregOS Migration Configuration\n'
                + '# Devices carried forward from v1.0 ROM\n'
                + '#\n'
                + '# device        type      status\n'
                + '# ─────────────────────────────────\n'
                + '  /dev/tty1     terminal  active\n'
                + '  /dev/eth0     network   active\n'
                + '  /dev/sda1     disk      mounted\n'
                + '  /dev/rf0      radio     pending\n',
        },
        hidden: {},
    },

    directories: {},

    commands: {
        pkg: (args) => {
            if (!args) {
                return 'Usage: pkg <command>\n\n'
                    + 'Commands:\n'
                    + '  update      Synchronize package repository\n'
                    + '  list        List available packages\n'
                    + '  install     Install a package\n'
                    + '  installed   List installed packages';
            }

            const parts = args.split(/\s+/);
            const sub = parts[0];

            if (sub === 'update') {
                huntState.setFlag('pkg-initialized', true);
                return 'Synchronizing package repository...\n'
                    + 'Reading package lists... done\n'
                    + `${pkgRegistry.length} packages available.`;
            }

            if (sub === 'list') {
                if (!huntState.flags['pkg-initialized']) {
                    return 'pkg: repository not initialized. Run \'pkg update\' first.';
                }
                const installed = getInstalledPackages();
                let out = 'Available packages:\n\n'
                    + '  NAME        VERSION   SIZE   DESCRIPTION\n'
                    + '  ─────────────────────────────────────────────────\n';
                for (const pkg of pkgRegistry) {
                    const tag = installed.includes(pkg.name) ? ' [installed]' : '';
                    out += `  ${pkg.name.padEnd(10)}  ${pkg.version.padEnd(8)}  ${pkg.size.padEnd(5)}  ${pkg.desc}${tag}\n`;
                }
                return out.trimEnd();
            }

            if (sub === 'install') {
                const pkgName = parts[1];
                if (!pkgName) return 'Usage: pkg install <package>';

                if (!huntState.flags['pkg-initialized']) {
                    return 'pkg: repository not initialized. Run \'pkg update\' first.';
                }

                const meta = pkgRegistry.find(p => p.name === pkgName);
                if (!meta) return `pkg: package '${pkgName}' not found. Run 'pkg list' to see available packages.`;

                const installed = getInstalledPackages();
                if (installed.includes(pkgName)) return `pkg: '${pkgName}' is already installed.`;

                // Install the package
                installPackage(pkgName);

                return `Installing ${pkgName} ${meta.version}...\n`
                    + `Unpacking ${pkgName} (${meta.size}) ...\n`
                    + `Setting up ${pkgName} (${meta.version}) ...\n`
                    + `${pkgName} installed to ~/bin/${pkgName}`;
            }

            if (sub === 'installed') {
                const installed = getInstalledPackages();
                if (installed.length === 0) return 'No packages installed.';
                return 'Installed packages:\n\n'
                    + installed.map(name => {
                        const meta = pkgRegistry.find(p => p.name === name);
                        return `  ${name}${meta ? ' ' + meta.version : ''}`;
                    }).join('\n');
            }

            return `pkg: unknown command '${sub}'. Run 'pkg' for usage.`;
        },

        mount: (args) => {
            if (!args) {
                let out = '/dev/sda1 on / type ext4 (rw,relatime)\n'
                    + 'devfs on /dev type devfs (rw)\n'
                    + 'tmpfs on /tmp type tmpfs (rw,nosuid,nodev)';
                if (huntState.has('rf0-mount-failed')) {
                    out += '\n/dev/rf0 on — type — (device fault)';
                }
                return out;
            }

            if (args === '/dev/rf0') {
                if (huntState.has('rf0-mount-failed')) {
                    return 'mount: /dev/rf0: device fault (see dmesg)';
                }
                // First time — run crash sequence
                setTimeout(() => runMountCrash(), 50);
                return null;
            }

            // Other devices
            const knownDevices = ['/dev/sda1', '/dev/tty1', '/dev/eth0'];
            if (knownDevices.includes(args)) {
                return `mount: ${args}: already mounted`;
            }
            return `mount: ${args}: no such device`;
        },
    },

    manPages: {
        pkg: 'PKG(1)                       GregOS Manual                       PKG(1)\n\n'
            + 'NAME\n'
            + '       pkg - GregOS package manager\n\n'
            + 'SYNOPSIS\n'
            + '       pkg update\n'
            + '       pkg list\n'
            + '       pkg install <package>\n'
            + '       pkg installed\n\n'
            + 'DESCRIPTION\n'
            + '       pkg manages the installation of utility packages from\n'
            + '       the GregOS repository. Packages are installed to ~/bin\n'
            + '       and become available as commands.\n\n'
            + 'COMMANDS\n'
            + '       update      Synchronize the package repository index.\n'
            + '                   Must be run before list or install.\n\n'
            + '       list        Display available packages with version,\n'
            + '                   size, and installation status.\n\n'
            + '       install     Download and install a package by name.\n\n'
            + '       installed   Show currently installed packages.\n\n'
            + 'AUTHOR\n'
            + '       GregOS Package System\n\n'
            + 'SEE ALSO\n'
            + '       man(1)',

        mount: 'MOUNT(8)                     GregOS Manual                     MOUNT(8)\n\n'
            + 'NAME\n'
            + '       mount - mount a filesystem\n\n'
            + 'SYNOPSIS\n'
            + '       mount [device]\n\n'
            + 'DESCRIPTION\n'
            + '       Without arguments, mount displays currently mounted\n'
            + '       filesystems. With a device argument, attempts to mount\n'
            + '       the specified device.\n\n'
            + '       Devices from the v1.0 ROM migration are listed in\n'
            + '       migration.conf. Pending devices may require manual\n'
            + '       mounting.\n\n'
            + 'DIAGNOSTICS\n'
            + '       If a device fault occurs, check dmesg(1) for details.\n\n'
            + 'FILES\n'
            + '       /etc/migration.conf    Device migration manifest\n\n'
            + 'AUTHOR\n'
            + '       GregOS Kernel Team\n\n'
            + 'SEE ALSO\n'
            + '       dmesg(1), migration.conf',
    },

    triggers: [],
};

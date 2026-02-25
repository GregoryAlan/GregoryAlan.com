// ─── v2.0 Commands: Package Manager & Mount ─────────────────
//
// Adds `pkg` (install bin tools on demand) and `mount`
// (discover /dev/rf0 → crash → Signal driver begins).
//
// Depends on: kernel.js (Kernel), shell.js (Shell),
//             terminal.js (Terminal), bin-tools.js (binTools),
//             the-signal.js (theSignalDriver)

// ─── Package Metadata ───────────────────────────────────────
// Package registry loaded from content/packages.json via ManifestLoader.

function getPkgRegistry() {
    return ManifestLoader.getPackages();
}

// ─── Package Install Logic ──────────────────────────────────

function getInstalledPackages() {
    try {
        return JSON.parse(Kernel.driver.flags['pkg-installed'] || '[]');
    } catch(e) {
        return [];
    }
}

function installPackage(name) {
    const cmd = (theSignalDriver.commands[name]) || binTools.commands[name];
    if (!cmd) return false;

    Shell.register(name, cmd);

    // Man pages already loaded from content/man-pages.json

    if (!Kernel.fs._fileTree.bin) {
        Kernel.fs._fileTree.bin = {};
    }
    Kernel.fs._fileTree.bin[name] = 'file';

    const installed = getInstalledPackages();
    if (!installed.includes(name)) {
        installed.push(name);
        Kernel.driver.setFlag('pkg-installed', JSON.stringify(installed));
    }

    return true;
}

function restoreInstalledPackages() {
    const installed = getInstalledPackages();
    for (const name of installed) {
        const cmd = (theSignalDriver.commands[name]) || binTools.commands[name];
        if (cmd) Shell.register(name, cmd);
        if (!Kernel.fs._fileTree.bin) Kernel.fs._fileTree.bin = {};
        Kernel.fs._fileTree.bin[name] = 'file';
    }
}

// ─── v2 Commands Pack ───────────────────────────────────────

const v2CommandsPack = {
    id: 'v2-commands',

    // Static files loaded from content/v2.0-system.json
    files: { text: {}, hidden: {} },

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
                Kernel.driver.setFlag('pkg-initialized', true);
                const registry = getPkgRegistry();
                return 'Synchronizing package repository...\n'
                    + 'Reading package lists... done\n'
                    + `${registry.length} packages available.`;
            }

            if (sub === 'list') {
                if (!Kernel.driver.flags['pkg-initialized']) {
                    return 'pkg: repository not initialized. Run \'pkg update\' first.';
                }
                const installed = getInstalledPackages();
                let out = 'Available packages:\n\n'
                    + '  NAME        VERSION   SIZE   DESCRIPTION\n'
                    + '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
                const registry = getPkgRegistry();
                for (const pkg of registry) {
                    const tag = installed.includes(pkg.name) ? ' [installed]' : '';
                    out += `  ${pkg.name.padEnd(10)}  ${pkg.version.padEnd(8)}  ${pkg.size.padEnd(5)}  ${pkg.desc}${tag}\n`;
                }
                return out.trimEnd();
            }

            if (sub === 'install') {
                const pkgName = parts[1];
                if (!pkgName) return 'Usage: pkg install <package>';

                if (!Kernel.driver.flags['pkg-initialized']) {
                    return 'pkg: repository not initialized. Run \'pkg update\' first.';
                }

                const meta = getPkgRegistry().find(p => p.name === pkgName);
                if (!meta) return `pkg: package '${pkgName}' not found. Run 'pkg list' to see available packages.`;

                const installed = getInstalledPackages();
                if (installed.includes(pkgName)) return `pkg: '${pkgName}' is already installed.`;

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
                        const meta = getPkgRegistry().find(p => p.name === name);
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
                if (Kernel.driver.has('rf0-mount-failed')) {
                    out += '\n/dev/rf0 on \u2014 type \u2014 (device fault)';
                }
                return out;
            }

            if (args === '/dev/rf0') {
                if (Kernel.driver.has('rf0-mount-failed')) {
                    return 'mount: /dev/rf0: device fault (see dmesg)';
                }
                setTimeout(() => Terminal.runMountCrash(), 50);
                return null;
            }

            const knownDevices = ['/dev/sda1', '/dev/tty1', '/dev/eth0'];
            if (knownDevices.includes(args)) {
                return `mount: ${args}: already mounted`;
            }
            return `mount: ${args}: no such device`;
        },
    },

    // Man pages loaded from content/man-pages.json

    triggers: [],
};

Kernel.driver.declareDriver(v2CommandsPack);

// ─── Tab Completions ────────────────────────────────────────

Shell.registerCompletion('pkg', (argPrefix, parts) => {
    if (parts.length === 2) {
        return Shell.completeFromList(argPrefix, ['update', 'list', 'install', 'installed']);
    }
    if (parts.length === 3 && parts[1] === 'install') {
        const installed = typeof getInstalledPackages === 'function' ? getInstalledPackages() : [];
        return getPkgRegistry()
            .map(p => p.name)
            .filter(n => !installed.includes(n) && n.startsWith(parts[2]))
            .map(n => 'install ' + n);
    }
    return [];
});

Shell.registerCompletion('mount', (argPrefix) => {
    if (!Kernel.driver.has('rf0-mount-failed')) {
        return Shell.completeFromList(argPrefix, ['/dev/rf0']);
    }
    return [];
});

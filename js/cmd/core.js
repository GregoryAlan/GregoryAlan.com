// ─── /bin: Core Commands ────────────────────────────────────
//
// The essential command set. Available (selectively) at every
// version layer. Registered by versions.js via Shell.register().
//
// Depends on: kernel.js, shell.js, terminal.js, versions.js (getNextVersion)

const coreCommands = {

    man: (args) => {
        if (!args) return 'What manual page do you want?';
        const page = Kernel.fs.getManPage(args);
        if (page) return page;
        return 'No manual entry for ' + args;
    },

    help: () => {
        const names = Shell.listVisibleCommands().sort();
        let msg = 'Available commands:\n';
        const descs = ManifestLoader._helpDescs;
        for (const name of names) {
            const d = descs[name] || '';
            msg += '  ' + name.padEnd(15) + '- ' + d + '\n';
        }
        return msg.trimEnd();
    },

    ls: (args, stdin, parsed) => {
        parsed = parsed || parseArgs(args || '');
        const showHidden = !!parsed.flags.a;
        const pathArg = parsed.positional[0];

        let dir, isRoot;
        if (pathArg) {
            const pathArr = Kernel.fs._resolve(pathArg);
            dir = Kernel.fs._getNode(pathArr);
            if (dir === null || dir === undefined || typeof dir !== 'object') {
                return `ls: ${pathArg}: No such directory`;
            }
            isRoot = pathArr.length === 0;
        } else {
            dir = Kernel.fs.getCurrentDir();
            isRoot = Kernel.fs._cwd.length === 0;
        }
        if (dir === null) return 'ls: cannot access directory';

        let items = [];

        // At root: show flat stores
        if (isRoot) {
            if (showHidden) {
                Object.keys(Kernel.fs._hiddenFiles).forEach(f => {
                    if (!Kernel.fs.isVisible(f)) return;
                    items.push(`<span class="file hidden-file clickable" data-action="cat" data-target="${f}">${f}</span>`);
                });
            }
            items = items.concat(Object.keys(Kernel.fs._textFiles).map(f =>
                `<span class="file clickable" data-action="cat" data-target="${f}">${f}</span>`
            ));
        }

        // Tree entries
        if (typeof dir === 'object') {
            for (const [name, value] of Object.entries(dir)) {
                // Filter dot-prefixed unless -a
                if (name.startsWith('.') && !showHidden) continue;
                if (typeof value === 'object') {
                    items.push(`<span class="dir clickable" data-action="cd" data-target="${name}">${name}/</span>`);
                } else if (value === 'file') {
                    items.push(`<span class="file clickable" data-action="open" data-target="${name}">${name}</span>`);
                } else if (typeof value === 'function') {
                    if (Kernel.fs.isNodeVisible(value)) {
                        items.push(`<span class="file hidden-file clickable" data-action="cat" data-target="${name}">${name}</span>`);
                    }
                } else {
                    // String content — readable text file
                    items.push(`<span class="file clickable" data-action="cat" data-target="${name}">${name}</span>`);
                }
            }
        }

        return items.length ? items.join('\n') : '<span class="disabled">(empty)</span>';
    },

    cd: (args) => {
        const result = Kernel.fs.chdir(args);
        if (result.error) return result.error;
        Terminal.updatePrompt();
        return '';
    },

    pwd: () => {
        return '/' + (Kernel.fs._cwd.length ? Kernel.fs._cwd.join('/') : '');
    },

    cat: (args) => {
        if (!args) return 'cat: missing file operand';
        const content = Kernel.fs.read(args);
        if (content === null) return `cat: ${args}: No such file or directory`;
        // Fire triggers for hidden files (flat store)
        if (args in Kernel.fs._hiddenFiles) {
            Kernel.driver.checkTriggers('file_read', args);
        }
        // Fire triggers for gated tree files (function nodes)
        const pathArr = Kernel.fs._resolve(args);
        const node = Kernel.fs._getNode(pathArr);
        if (typeof node === 'function') {
            const fullPath = '/' + pathArr.join('/');
            Kernel.driver.checkTriggers('file_read', fullPath);
        }
        EventBus.emit('file:read', { path: args, content });
        return content.replace(/\n/g, '<br>');
    },

    open: (args) => {
        let targetPath;
        let targetName;

        if (args) {
            const dir = Kernel.fs.getCurrentDir();
            if (dir && typeof dir === 'object' && args in dir && dir[args] === 'file') {
                targetPath = '/' + [...Kernel.fs._cwd, args].join('/').replace(/^\/+/, '/');
                targetName = args;
            } else if (Kernel.fs._cwd.length === 0 && args.endsWith('.html')) {
                targetPath = '/' + args;
                targetName = args;
            } else {
                return `open: ${args}: No such file`;
            }
        } else {
            if (Kernel.fs._cwd.length === 0) {
                return 'open: specify a file to open, or cd into a folder first';
            }
            targetPath = '/' + Kernel.fs._cwd.join('/') + '/';
            targetName = Kernel.fs._cwd[Kernel.fs._cwd.length - 1];
        }

        setTimeout(() => {
            window.location.href = targetPath;
        }, 500);
        return `Opening ${targetName}...`;
    },

    whoami: () => {
        if (Shell._activeProfile) return Shell.env.USER;
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let os = 'Unknown';

        if (ua.includes('Firefox/')) browser = 'Firefox ' + ua.split('Firefox/')[1].split(' ')[0];
        else if (ua.includes('Edg/')) browser = 'Edge ' + ua.split('Edg/')[1].split(' ')[0];
        else if (ua.includes('Chrome/')) browser = 'Chrome ' + ua.split('Chrome/')[1].split(' ')[0];
        else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

        if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
        else if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.split('Mac OS X ')[1]?.split(')')[0].replace(/_/g, '.') || '');
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

        return `OS: ${os}
Browser: ${browser}
Language: ${navigator.language || 'Unknown'}
Resolution: ${screen.width}x${screen.height}
Local Time: ${new Date().toLocaleString()}`;
    },

    history: () => {
        if (Shell._history.length === 0) return 'No commands in history.';
        return Shell._history.slice().reverse().map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n');
    },

    sudo: () => Shell.env.USER + ' is not in the sudoers file. This incident will be reported.',

    rm: (args) => {
        if (args === '-rf /' || args === '-rf /*') {
            setTimeout(() => Terminal.runRmAnimation(), 50);
            return null;
        }
        return 'rm: Permission denied';
    },

    reboot: (args) => {
        const force = args === '-f';
        const nextVer = getNextVersion(force);
        Kernel.session.remove('bootDone');
        setTimeout(() => {
            Terminal.clearOutput();
            Terminal.el.terminal.style.display = 'none';
            Terminal.el.bootScreen.innerHTML = '';
            Terminal.el.bootScreen.style.display = '';
            Terminal.el.bootScreen.style.opacity = '1';
            Terminal.el.input.disabled = true;

            const doReboot = () => {
                if (nextVer) Kernel.driver.setVersion(nextVer);
                applyVersion(Kernel.driver.getVersion());
                renderMOTD();
                Terminal.updatePrompt();
                Terminal.runBootSequence().then(() => {
                    Terminal.el.input.disabled = false;
                    Terminal.el.input.focus();
                });
            };

            if (nextVer && nextVer > Kernel.driver.getVersion()) {
                Terminal.runUpdateSequence(Kernel.driver.getVersion(), nextVer).then(doReboot);
            } else {
                doReboot();
            }
        }, 200);
        return 'Rebooting...';
    },

    clear: () => null,

    debug: () => {
        if (!new URLSearchParams(window.location.search).has('debug')) {
            return 'debug: command not found. Type \'help\' for available commands.';
        }
        const info = Kernel.driver.debug();
        let out = `GregOS v${info.version}\n\n`;
        out += `Discoveries (${Object.keys(info.discoveries).length}):\n`;
        for (const [id, ts] of Object.entries(info.discoveries)) {
            out += `  ${id} (${new Date(ts).toLocaleTimeString()})\n`;
        }
        out += `\nFlags:\n`;
        for (const [k, v] of Object.entries(info.flags)) {
            out += `  ${k} = ${JSON.stringify(v)}\n`;
        }
        out += `\nDriver States:\n`;
        for (const [driverId, d] of Object.entries(info.drivers)) {
            out += `  ${driverId}: ${d.state}`;
            if (d.transitions.length) {
                out += ` → [${d.transitions.join(', ')}]`;
            }
            out += '\n';
        }
        return out.trimEnd();
    },
};

// v1.0-specific commands (status)
const v1Commands = {
    status: () => {
        Kernel.driver.discover('ran-status');
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

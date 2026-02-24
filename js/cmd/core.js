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
        const ver = Kernel.driver.getVersion();
        let msg = ver < 1.1 ? 'Commands:\n' : 'Available commands:\n';
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

// ─── Tab Completions ────────────────────────────────────────

Shell.registerCompletion('cd', (argPrefix) => Shell.completePath(argPrefix, 'dirs'));
Shell.registerCompletion('cat', (argPrefix) => Shell.completePath(argPrefix, 'readable'));
Shell.registerCompletion('open', (argPrefix) => Shell.completePath(argPrefix, 'external'));
Shell.registerCompletion('man', (argPrefix) => Shell.completeFromList(argPrefix, Object.keys(Kernel.fs._manPages)));

// v1.0-specific commands (firmware monitor)
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

    post: () => {
        return 'RF0-CR POST RESULTS\n'
            + '===================\n'
            + 'ROM     1.0         OK\n'
            + 'RAM     512K        OK\n'
            + 'ADC     12-bit      OK\n'
            + 'PLL     4119.0 kHz  LOCK\n'
            + 'ANT                 ACTIVE \u2014 NO CARRIER\n'
            + 'FIFO    847/4096    WARN \u2014 NOT CONSUMED\n'
            + 'RELAY               STANDBY\n'
            + '\n'
            + '6/7 OK, 1 WARN\n'
            + 'POST completed at init';
    },

    info: () => {
        return 'RF0-CR DEVICE INFORMATION\n'
            + '=========================\n'
            + 'model:     RF0-CR (crystal receiver)\n'
            + 'serial:    GC-0847\n'
            + 'mfg:       Gregory Alan Computing, Inc.\n'
            + 'mfg_date:  1987\n'
            + 'firmware:  1.0-ROM\n'
            + 'pll_freq:  4119.0 kHz\n'
            + 'pll_mode:  rx_lock\n'
            + 'adc_res:   12-bit\n'
            + 'fifo_sz:   4096 bytes\n'
            + 'rx_gain:   auto\n'
            + 'rx_bw:     12.5 kHz';
    },

    log: () => {
        return 'RF0 STATION LOG\n'
            + '[2026-01-22 03:14:00] init from ROM\n'
            + '[2026-01-22 03:14:01] ant0: ACTIVE\n'
            + '[2026-01-22 03:14:02] relay: STANDBY\n'
            + '[............]\n'
            + '[2026-01-22 08:47:00] rx0: 847 bytes buffered (unconsumed)\n'
            + '[2026-01-22 08:47:01] rx0: checksum FAIL \u2014 pkt held\n'
            + '[............]\n'
            + 'End of log.';
    },

    rxbuf: () => {
        return 'RX FIFO \u2014 847/4096 bytes (STALE)\n'
            + '\n'
            + '0000: 7f454c46 02010100 00000000 00000000\n'
            + '0010: 02003e00 01000000 00034700 00000000\n'
            + '0020: 4e4f524d 414c2053 59535445 4d204f50\n'
            + '0030: 45524154 494f4e20 49532041 204c4945\n'
            + '0040: 00000000 00000000 00000000 00000000\n'
            + '*\n'
            + '0190: 72656c61 79202d2d 74617267 65743d30\n'
            + '01a0: 2e302e30 2e303a34 31313900 00000000\n'
            + '01b0: 00000000 00000000 00000000 00000000\n'
            + '*\n'
            + '034e:\n'
            + '\n'
            + 'checksum: FAIL';
    },
};

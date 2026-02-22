// ─── GregOS Terminal Engine ──────────────────────────────────
//
// The runtime: DOM, filesystem, hunt engine, commands, I/O, boot.
// Content is injected via registerHunt() from hunt scripts.

// ─── DOM & State ────────────────────────────────────────────

const terminal = document.getElementById('terminal');
const output = document.getElementById('output');
const input = document.getElementById('input');
const promptEl = document.getElementById('prompt');
const bootScreen = document.getElementById('boot-screen');

const history = [];
let historyIndex = -1;
let currentPath = [];
let tabMatches = [];
let tabIndex = -1;
let tabOriginal = '';

// File tree, text files, hidden files, and man pages start empty.
// applyVersion() in versions.js populates them per version layer.
let fileTree = {};
const textFiles = {};
const manPages = {};
const hiddenFiles = {};

// ─── Hunt Engine ────────────────────────────────────────────

const huntState = {
    discoveries: JSON.parse(sessionStorage.getItem('hunt_discoveries') || '{}'),
    flags: JSON.parse(sessionStorage.getItem('hunt_flags') || '{}'),
    discover(id) {
        if (this.discoveries[id]) return;
        this.discoveries[id] = Date.now();
        sessionStorage.setItem('hunt_discoveries', JSON.stringify(this.discoveries));
        checkTriggers('discovery', id);
        checkTriggers('count', Object.keys(this.discoveries).length);
    },
    has(id) { return !!this.discoveries[id]; },
    setFlag(k, v) {
        this.flags[k] = v;
        sessionStorage.setItem('hunt_flags', JSON.stringify(this.flags));
    },
    count() { return Object.keys(this.discoveries).length; },
    getVersion() { return parseFloat(this.flags.version || '1.0'); },
    setVersion(v) { this.setFlag('version', v.toString()); }
};

const huntTriggers = [];

function registerHunt(hunt) {
    if (hunt.files) {
        if (hunt.files.text) Object.assign(textFiles, hunt.files.text);
        if (hunt.files.hidden) Object.assign(hiddenFiles, hunt.files.hidden);
    }
    if (hunt.directories) Object.assign(fileTree, hunt.directories);
    if (hunt.commands) Object.assign(commands, hunt.commands);
    if (hunt.manPages) Object.assign(manPages, hunt.manPages);
    if (hunt.triggers) huntTriggers.push(...hunt.triggers);
    if (hunt.patches) {
        if (hunt.patches.hiddenFiles) {
            for (const [file, patchFn] of Object.entries(hunt.patches.hiddenFiles)) {
                hiddenFiles[file] = patchFn(hiddenFiles[file] || '');
            }
        }
    }
}

function checkTriggers(type, value) {
    for (const t of huntTriggers) {
        if (t.type !== type) continue;
        if (t.match !== value) continue;
        if (t.once && sessionStorage.getItem('trigger_' + t.type + '_' + t.match)) continue;
        if (t.once) sessionStorage.setItem('trigger_' + t.type + '_' + t.match, '1');
        if (t.effect) runGlitchEffect(t.effect, t.effectOpts || {});
        if (t.callback) t.callback(huntState);
    }
}

function isHiddenFileVisible(name) {
    const content = hiddenFiles[name];
    if (typeof content !== 'function') return true;
    const peekState = { has: (id) => huntState.has(id), discover() {} };
    return content(peekState) !== null;
}

// ─── Filesystem ─────────────────────────────────────────────

function getPrompt() {
    if (huntState.getVersion() < 1.1) {
        return 'rf0>';
    }
    const path = currentPath.length ? '~/' + currentPath.join('/') : '~';
    return `guest@gregoryalan.com:${path}$`;
}

function updatePrompt() {
    promptEl.textContent = getPrompt();
}

function getCurrentDir() {
    let dir = fileTree;
    for (const p of currentPath) {
        if (dir && typeof dir === 'object' && p in dir) {
            dir = dir[p];
        } else {
            return null;
        }
    }
    return dir;
}

function isOpenable() {
    // Can open if we're inside a folder (not at root)
    return currentPath.length > 0;
}

// ─── Commands ───────────────────────────────────────────────

// All commands live here as a backup; the active `commands` object
// is populated per-version by applyVersion() in versions.js.
const coreCommands = {
    man: (args) => {
        if (!args) return 'What manual page do you want?';
        if (manPages[args]) return manPages[args];
        return 'No manual entry for ' + args;
    },

    help: () => {
        const names = Object.keys(commands).sort();
        let msg = 'Available commands:\n';
        const descs = {
            help: 'Show this help message',
            ls: 'List directory contents',
            cd: 'Change directory (use .. to go up)',
            pwd: 'Print working directory',
            cat: 'Display file contents',
            open: 'Open file or current folder in browser',
            whoami: 'Display system info',
            history: 'Show command history',
            clear: 'Clear terminal',
            reboot: 'Reboot system',
            rm: 'Remove files',
            man: 'View manual pages',
            sudo: 'Execute as superuser',
            status: 'Show system status',
            pkg: 'Package manager',
            mount: 'Mount a filesystem',
            w: 'Show who is logged on',
            finger: 'User information lookup',
            last: 'Show last logins',
            dmesg: 'Print kernel messages',
            decode: 'Hex/base64 decoder',
            rot13: 'ROT13 cipher',
            freq: 'Letter frequency analysis',
            entropy: 'Shannon entropy calculator',
            crc: 'CRC32 checksum',
            strings: 'Extract printable strings',
        };
        for (const name of names) {
            const d = descs[name] || '';
            msg += '  ' + name.padEnd(15) + '- ' + d + '\n';
        }
        return msg.trimEnd();
    },

    ls: (args) => {
        const showHidden = args === '-a' || args === '-la' || args === '-al';
        let dir = getCurrentDir();
        if (dir === null) return 'ls: cannot access directory';

        let items = [];

        // If at root, show text files (tappable for cat)
        if (currentPath.length === 0) {
            if (showHidden) {
                Object.keys(hiddenFiles).forEach(f => {
                    if (!isHiddenFileVisible(f)) return;
                    items.push(`<span class="file hidden-file clickable" data-action="cat" data-target="${f}">${f}</span>`);
                });
            }
            items = items.concat(Object.keys(textFiles).map(f =>
                `<span class="file clickable" data-action="cat" data-target="${f}">${f}</span>`
            ));
        }

        if (typeof dir === 'object') {
            const inBin = currentPath.length === 1 && currentPath[0] === 'bin';
            for (const [name, value] of Object.entries(dir)) {
                if (value === 'file') {
                    if (inBin) {
                        items.push(`<span class="file">${name}</span>`);
                    } else {
                        items.push(`<span class="file clickable" data-action="open" data-target="${name}">${name}</span>`);
                    }
                } else {
                    items.push(`<span class="dir clickable" data-action="cd" data-target="${name}">${name}/</span>`);
                }
            }
        }

        return items.length ? items.join('\n') : '<span class="disabled">(empty)</span>';
    },

    cd: (args) => {
        if (!args || args === '~' || args === '/') {
            currentPath = [];
            updatePrompt();
            return '';
        }

        if (args === '..') {
            if (currentPath.length > 0) {
                currentPath.pop();
                updatePrompt();
            }
            return '';
        }

        if (args === '.') return '';

        // Handle path with slashes
        const parts = args.replace(/^\//, '').replace(/\/$/, '').split('/');
        let testPath = [...currentPath];
        let dir = getCurrentDir();

        for (const part of parts) {
            if (part === '..') {
                if (testPath.length > 0) testPath.pop();
                continue;
            }
            if (part === '.' || part === '') continue;

            // Get dir at testPath
            let checkDir = fileTree;
            for (const p of testPath) {
                checkDir = checkDir[p];
            }

            if (checkDir && typeof checkDir === 'object' && part in checkDir) {
                testPath.push(part);
            } else {
                return `cd: ${args}: No such directory`;
            }
        }

        currentPath = testPath;
        updatePrompt();
        return '';
    },

    pwd: () => {
        return '/' + (currentPath.length ? currentPath.join('/') : '');
    },

    cat: (args) => {
        if (!args) return 'cat: missing file operand';
        if (textFiles[args]) return textFiles[args].replace(/\n/g, '<br>');
        if (args in hiddenFiles) {
            let content = hiddenFiles[args];
            if (typeof content === 'function') {
                content = content(huntState);
                if (content === null) return `cat: ${args}: No such file or directory`;
            }
            checkTriggers('file_read', args);
            return content.replace(/\n/g, '<br>');
        }
        return `cat: ${args}: No such file or directory`;
    },

    open: (args) => {
        let targetPath;
        let targetName;

        if (args) {
            // Open a specific file
            const dir = getCurrentDir();
            if (dir && typeof dir === 'object' && args in dir && dir[args] === 'file') {
                // File exists in current directory
                targetPath = '/' + [...currentPath, args].join('/').replace(/^\/+/, '/');
                targetName = args;
            } else if (currentPath.length === 0 && args.endsWith('.html')) {
                // At root, try to open .html file directly
                targetPath = '/' + args;
                targetName = args;
            } else {
                return `open: ${args}: No such file`;
            }
        } else {
            // No args - open current folder
            if (currentPath.length === 0) {
                return 'open: specify a file to open, or cd into a folder first';
            }
            targetPath = '/' + currentPath.join('/') + '/';
            targetName = currentPath[currentPath.length - 1];
        }

        setTimeout(() => {
            window.location.href = targetPath;
        }, 500);
        return `Opening ${targetName}...`;
    },

    whoami: () => {
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
        if (history.length === 0) return 'No commands in history.';
        return history.slice().reverse().map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n');
    },

    sudo: () => 'guest is not in the sudoers file. This incident will be reported.',

    rm: (args) => {
        if (args === '-rf /' || args === '-rf /*') {
            // Async animation — inject directly
            setTimeout(() => runRmAnimation(), 50);
            return null;
        }
        return 'rm: Permission denied';
    },

    reboot: (args) => {
        const force = args === '-f';
        const nextVer = getNextVersion(force);
        sessionStorage.removeItem('bootDone');
        setTimeout(() => {
            output.innerHTML = '';
            terminal.style.display = 'none';
            bootScreen.innerHTML = '';
            bootScreen.style.display = '';
            bootScreen.style.opacity = '1';
            input.disabled = true;

            const doReboot = () => {
                if (nextVer) {
                    huntState.setVersion(nextVer);
                }
                applyVersion(huntState.getVersion());
                renderMOTD();
                updatePrompt();
                runBootSequence().then(() => {
                    input.disabled = false;
                    input.focus();
                });
            };

            if (nextVer) {
                runUpdateSequence(huntState.getVersion(), nextVer).then(doReboot);
            } else {
                doReboot();
            }
        }, 200);
        return 'Rebooting...';
    },

    clear: () => null
};

// Active command set — starts empty, populated by applyVersion()
const commands = {};

// ─── Tab Completion ─────────────────────────────────────────

function getCompletions(inputText) {
    const parts = inputText.split(/\s+/);
    if (parts.length <= 1) {
        // Complete command names
        const prefix = parts[0].toLowerCase();
        return Object.keys(commands).filter(c => c.startsWith(prefix));
    }
    // Complete arguments based on command
    const cmd = parts[0].toLowerCase();
    const argPrefix = parts.slice(1).join(' ');
    const dir = getCurrentDir();
    let candidates = [];

    if (cmd === 'cd') {
        // Only directories
        if (typeof dir === 'object' && dir !== null) {
            candidates = Object.entries(dir)
                .filter(([, v]) => typeof v === 'object')
                .map(([name]) => name);
        }
    } else if (cmd === 'cat') {
        // Text files + visible hidden files at root
        if (currentPath.length === 0) {
            candidates = Object.keys(textFiles);
            Object.keys(hiddenFiles).forEach(f => {
                if (isHiddenFileVisible(f)) candidates.push(f);
            });
        }
    } else if (cmd === 'open') {
        // Files in current directory
        if (typeof dir === 'object' && dir !== null) {
            candidates = Object.entries(dir)
                .filter(([, v]) => v === 'file')
                .map(([name]) => name);
        }
    } else if (cmd === 'man') {
        candidates = Object.keys(manPages);
    } else if (cmd === 'pkg') {
        if (parts.length === 2) {
            // Complete subcommand: "pkg upd" → "update"
            candidates = ['update', 'list', 'install', 'installed'];
        } else if (parts.length === 3 && parts[1] === 'install') {
            // Complete package name: "pkg install dec" → "install decode"
            // Return "install <name>" so the handler produces "pkg install <name>"
            const pkgPrefix = parts[2];
            const installed = typeof getInstalledPackages === 'function' ? getInstalledPackages() : [];
            candidates = (typeof pkgRegistry !== 'undefined' ? pkgRegistry : [])
                .map(p => p.name)
                .filter(n => !installed.includes(n) && n.startsWith(pkgPrefix))
                .map(n => 'install ' + n);
        } else {
            return [];
        }
    } else if (cmd === 'mount') {
        if (!huntState.has('rf0-mount-failed')) {
            candidates = ['/dev/rf0'];
        }
    } else {
        return [];
    }

    return candidates.filter(c => c.startsWith(argPrefix));
}

// ─── Terminal I/O ───────────────────────────────────────────

function appendSystemLine(html) {
    const div = document.createElement('div');
    div.className = 'output system-message';
    div.innerHTML = html;
    output.appendChild(div);
    requestAnimationFrame(() => {
        input.scrollIntoView({ block: 'end' });
    });
}

function processCommand(cmd) {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (!command) return '';
    if (commands[command]) {
        const result = commands[command](args);
        checkTriggers('command', command);
        return result;
    }
    return `${command}: command not found. Type 'help' for available commands.`;
}

function addOutput(cmd, result) {
    const cmdHtml = `<div><span class="prompt">${getPrompt()}</span> <span class="command">${cmd}</span></div>`;
    const resultHtml = result ? `<div class="output">${result.replace(/\n/g, '<br>')}</div>` : '';
    output.innerHTML += cmdHtml + resultHtml;
    // Scroll to bottom - works on both desktop and iOS (position: fixed body)
    requestAnimationFrame(() => {
        input.scrollIntoView({ block: 'end' });
    });
}

function removeTabHint() {
    const hint = document.getElementById('tab-hint');
    if (hint) hint.remove();
}

// ─── Version Helpers ────────────────────────────────────────

// Wipe active commands, text files, hidden files, file tree, man pages,
// and triggers back to empty so applyVersion() can layer from scratch.
function resetToBaseline() {
    for (const k in commands) delete commands[k];
    for (const k in textFiles) delete textFiles[k];
    for (const k in hiddenFiles) delete hiddenFiles[k];
    for (const k in manPages) delete manPages[k];
    for (const k in fileTree) delete fileTree[k];
    huntTriggers.length = 0;
    currentPath = [];
}

async function runUpdateSequence(fromVer, toVer) {
    const lines = [
        { text: `Current version: ${fromVer}`, delay: 400 },
        { text: `Update available: v${toVer}`, delay: 600 },
        { text: '', delay: 300 },
        { text: 'Downloading update .......... OK', delay: 800 },
        { text: 'Verifying checksum .......... OK', delay: 800 },
        { text: 'Installing .......... OK', delay: 800 },
        { text: '', delay: 300 },
        { text: `System updated to v${toVer}`, delay: 400 },
        { text: 'Rebooting into new firmware...', delay: 600 },
    ];

    let skipped = false;
    const skipHandler = () => { skipped = true; };
    document.addEventListener('keydown', skipHandler);
    document.addEventListener('touchstart', skipHandler);

    for (const line of lines) {
        if (skipped) break;
        const div = document.createElement('div');
        div.textContent = line.text;
        bootScreen.appendChild(div);
        await new Promise(r => setTimeout(r, line.delay));
    }

    document.removeEventListener('keydown', skipHandler);
    document.removeEventListener('touchstart', skipHandler);

    // Brief pause then clear for boot sequence
    await new Promise(r => setTimeout(r, 400));
    bootScreen.innerHTML = '';
}

// ─── Animations ─────────────────────────────────────────────

async function runRmAnimation() {
    // Real rm -v output format: removed '/path' or removed directory '/path'
    // Depth-first traversal, hits /proc errors, then libs disappear
    const rmLines = [
        { text: "removed '/usr/lib/libz.so.1'", style: '' },
        { text: "removed '/usr/lib/libssl.so.3'", style: '' },
        { text: "removed '/usr/lib/libcrypto.so.3'", style: '' },
        { text: "removed '/usr/bin/grep'", style: '' },
        { text: "removed '/usr/bin/awk'", style: '' },
        { text: "removed directory '/usr/share/man/man1'", style: '' },
        { text: "removed '/etc/passwd'", style: '' },
        { text: "removed '/etc/hostname'", style: '' },
        { text: "removed '/var/log/syslog'", style: '' },
        { text: "rm: cannot remove '/proc/1/status': Operation not permitted", style: 'color:#f55' },
        { text: "rm: cannot remove '/sys/class/net/eth0': Operation not permitted", style: 'color:#f55' },
        { text: "removed '/home/guest/.bash_history'", style: '' },
        { text: "removed '/usr/bin/ls'", style: '' },
        { text: "removed '/usr/bin/cat'", style: '' },
        { text: "removed '/sbin/init'", style: '' },
        { text: "rm: error while loading shared libraries: libc.so.6: cannot open shared object file", style: 'color:#f55' },
    ];
    const rmDiv = document.createElement('div');
    rmDiv.className = 'output rm-animation';
    output.appendChild(rmDiv);
    input.disabled = true;

    for (const entry of rmLines) {
        const line = document.createElement('div');
        if (entry.style) line.style.cssText = entry.style;
        line.textContent = entry.text;
        rmDiv.appendChild(line);
        input.scrollIntoView({ block: 'end' });
        await new Promise(r => setTimeout(r, 120));
    }

    // Real kernel panic format
    const panicLines = [
        { text: '', style: '' },
        { text: 'Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000009', style: 'color:#ff0;font-weight:bold' },
        { text: '', style: '' },
        { text: 'CPU: 0 PID: 1 Comm: init Not tainted', style: 'color:#f55' },
        { text: 'Call Trace:', style: 'color:#f55' },
        { text: ' [<ffffffff8107a1b2>] panic+0x1a2/0x1f7', style: 'color:#f55' },
        { text: ' [<ffffffff810791d3>] do_exit+0xa13/0xa20', style: 'color:#f55' },
        { text: ' [<ffffffff81079293>] do_group_exit+0x53/0xd0', style: 'color:#f55' },
        { text: '', style: '' },
        { text: '---[ end Kernel panic - not syncing: Attempted to kill init! ]---', style: 'color:#ff0;font-weight:bold' },
    ];

    for (const entry of panicLines) {
        const line = document.createElement('div');
        if (entry.style) line.style.cssText = entry.style;
        line.textContent = entry.text;
        rmDiv.appendChild(line);
        input.scrollIntoView({ block: 'end' });
        await new Promise(r => setTimeout(r, 200));
    }

    await new Promise(r => setTimeout(r, 1500));

    // Screen goes black
    terminal.style.display = 'none';
    await new Promise(r => setTimeout(r, 1200));

    // Comes back garbled
    const garble = document.createElement('div');
    garble.id = 'garble-screen';
    garble.style.color = '#5f5';
    garble.style.whiteSpace = 'pre';
    garble.style.fontFamily = "'Courier New', monospace";
    garble.style.fontSize = '12px';
    garble.style.lineHeight = '1.2';
    const garbleChars = '░▒▓█▄▀■□▪▫▬▲►▼◄◊○●◘◙┤┐└┴┬├─┼┘┌│═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬@#$%&';
    let garbleText = '';
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 60; j++) {
            garbleText += garbleChars[Math.floor(Math.random() * garbleChars.length)];
        }
        garbleText += '\n';
    }
    garble.textContent = garbleText;
    document.body.appendChild(garble);
    await new Promise(r => setTimeout(r, 800));

    // Flicker
    garble.style.opacity = '0';
    await new Promise(r => setTimeout(r, 150));
    garble.style.opacity = '1';
    // Re-garble
    garbleText = '';
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 60; j++) {
            garbleText += garbleChars[Math.floor(Math.random() * garbleChars.length)];
        }
        garbleText += '\n';
    }
    garble.textContent = garbleText;
    await new Promise(r => setTimeout(r, 400));

    // Back to black
    garble.remove();
    await new Promise(r => setTimeout(r, 1000));

    // Factory reset — back to bare ROM
    sessionStorage.clear();
    huntState.discoveries = {};
    huntState.flags = {};
    huntState.setVersion(1.0);
    applyVersion(1.0);
    renderMOTD();
    updatePrompt();
    // Clean up persistent visual effects from Signal hunt
    const overlay = document.getElementById('scanline-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.backgroundColor = '';

    output.innerHTML = '';
    bootScreen.innerHTML = '';
    bootScreen.style.display = '';
    bootScreen.style.opacity = '1';
    runBootSequence().then(() => {
        input.disabled = false;
        input.focus();
    });
}

// ─── Input Handling ─────────────────────────────────────────

input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const text = input.value;

        if (tabMatches.length > 0 && tabOriginal !== null) {
            // Cycle through existing matches
            tabIndex = (tabIndex + 1) % tabMatches.length;
        } else {
            // New tab press — compute matches
            tabOriginal = text;
            tabMatches = getCompletions(text);
            tabIndex = 0;
        }

        if (tabMatches.length === 0) return;

        if (tabMatches.length === 1) {
            // Single match — auto-complete with trailing space
            const parts = tabOriginal.split(/\s+/);
            if (parts.length <= 1) {
                input.value = tabMatches[0] + ' ';
            } else {
                input.value = parts[0] + ' ' + tabMatches[0] + ' ';
            }
            removeTabHint();
            tabMatches = [];
            tabIndex = -1;
            tabOriginal = '';
        } else {
            // Multiple matches — cycle and show hint
            const parts = tabOriginal.split(/\s+/);
            if (parts.length <= 1) {
                input.value = tabMatches[tabIndex];
            } else {
                input.value = parts[0] + ' ' + tabMatches[tabIndex];
            }
            removeTabHint();
            const hint = document.createElement('div');
            hint.id = 'tab-hint';
            hint.className = 'tab-hint';
            hint.textContent = tabMatches.join('  ');
            output.appendChild(hint);
            input.scrollIntoView({ block: 'end' });
        }
        return;
    }

    // Any non-Tab key resets tab state
    if (tabMatches.length > 0 || tabOriginal) {
        tabMatches = [];
        tabIndex = -1;
        tabOriginal = '';
        removeTabHint();
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = input.value;
        if (cmd.trim()) {
            history.unshift(cmd);
            historyIndex = -1;
        }
        if (cmd.trim().toLowerCase() === 'clear') {
            output.innerHTML = '';
        } else {
            const result = processCommand(cmd);
            addOutput(cmd, result);
        }
        input.value = '';
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
            historyIndex++;
            input.value = history[historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = history[historyIndex];
        } else {
            historyIndex = -1;
            input.value = '';
        }
    }
});

// Handle clicks on clickable items (directories/files)
terminal.addEventListener('click', (e) => {
    const clickable = e.target.closest('.clickable');
    if (clickable) {
        const action = clickable.dataset.action;
        const target = clickable.dataset.target;
        const cmd = action === 'cat' ? `cat ${target}` : action === 'cd' ? `cd ${target}` : `open ${target}`;
        const result = processCommand(cmd);
        addOutput(cmd, result);
        return;
    }
    input.focus();
});

// ─── Boot Sequence ──────────────────────────────────────────

function getBootLines(version) {
    if (version < 1.1) {
        return [
            { text: 'RF0 Broadcast Repeater v1.0', delay: 300 },
            { text: 'S/N RF0-4119-0847', delay: 200 },
        ];
    }

    if (version < 2.0) {
        return [
            { text: 'GregBIOS (C) 2026 Gregory Alan Computing', delay: 300 },
            { text: '', delay: 200 },
            { text: 'Loading GregOS v1.1 ...', delay: 600 },
            { text: '', delay: 300 },
            { text: 'Starting terminal ...', delay: 400 },
        ];
    }

    // v2.0 — full boot
    const cores = navigator.hardwareConcurrency || '?';
    const mem = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '640K';
    const res = screen.width + 'x' + screen.height;
    const net = navigator.connection ? navigator.connection.effectiveType : null;

    return [
        { text: 'GregBIOS (C) 2026 Gregory Alan Computing', delay: 300 },
        { text: '', delay: 200 },
        { text: `CPU: ${cores}-core processor detected`, delay: 300 },
        { text: `Memory: ${mem} available`, delay: 300 },
        { text: 'PCI: bus probe complete', delay: 200 },
        ...(net ? [{ text: `eth0: link up, ${net}`, delay: 200 }] : []),
        { text: '/dev/sda1: mounted (ext4)', delay: 300 },
        ...(huntState.has('rf0-mount-failed')
            ? [{ text: 'rf0: device fault \u2014 buffer dumped (see .rf0.buf)', delay: 400, style: 'color:#ff0' }]
            : []),
        { text: '', delay: 200 },
        { text: 'Loading GregOS v2.0 ...', delay: 600 },
        { text: 'Starting terminal ...', delay: 400 },
    ];
}

async function runBootSequence() {
    const lines = getBootLines(huntState.getVersion());

    let skipped = false;
    const skipHandler = () => { skipped = true; };
    document.addEventListener('keydown', skipHandler);
    document.addEventListener('touchstart', skipHandler);

    for (const line of lines) {
        if (skipped) break;
        if (line.append) {
            // Append to previous line
            const last = bootScreen.lastElementChild;
            if (last) last.textContent += line.text;
        } else {
            const div = document.createElement('div');
            div.textContent = line.text;
            if (line.style) div.style.cssText = line.style;
            bootScreen.appendChild(div);
        }
        await new Promise(r => setTimeout(r, line.delay));
    }

    document.removeEventListener('keydown', skipHandler);
    document.removeEventListener('touchstart', skipHandler);

    // Fade out boot screen, show terminal
    bootScreen.style.opacity = '0';
    await new Promise(r => setTimeout(r, 400));
    bootScreen.style.display = 'none';
    terminal.style.display = '';
    input.focus();
    sessionStorage.setItem('bootDone', '1');
}

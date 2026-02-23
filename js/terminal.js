// ─── GregOS Terminal Emulator ────────────────────────────────
//
// Pure presentation layer. Calls Shell for execution,
// Kernel for state. Owns the DOM and all visual output.
//
// Depends on: kernel.js (Kernel), shell.js (Shell),
//             versions.js (applyVersion, renderMOTD — called at runtime)

const Terminal = {

    el: {
        terminal: document.getElementById('terminal'),
        output: document.getElementById('output'),
        input: document.getElementById('input'),
        prompt: document.getElementById('prompt'),
        bootScreen: document.getElementById('boot-screen'),
    },

    // ─── Rendering ──────────────────────────────────────────

    addOutput(cmd, result) {
        const cmdHtml = `<div><span class="prompt">${Shell.getPrompt()}</span> <span class="command">${cmd}</span></div>`;
        const resultHtml = result ? `<div class="output">${result.replace(/\n/g, '<br>')}</div>` : '';
        this.el.output.innerHTML += cmdHtml + resultHtml;
        requestAnimationFrame(() => {
            this.el.input.scrollIntoView({ block: 'end' });
        });
    },

    appendSystemLine(html) {
        const div = document.createElement('div');
        div.className = 'output system-message';
        div.innerHTML = html;
        this.el.output.appendChild(div);
        requestAnimationFrame(() => {
            this.el.input.scrollIntoView({ block: 'end' });
        });
    },

    updatePrompt() {
        this.el.prompt.textContent = Shell.getPrompt();
    },

    clearOutput() {
        this.el.output.innerHTML = '';
    },

    // ─── Input Handling ─────────────────────────────────────

    _removeTabHint() {
        const hint = document.getElementById('tab-hint');
        if (hint) hint.remove();
    },

    init() {
        this.el.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.el.terminal.addEventListener('click', (e) => this.handleClick(e));
    },

    handleKeydown(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const result = Shell.cycleTab(this.el.input.value);
            if (!result) return;

            this.el.input.value = result.value;
            this._removeTabHint();

            if (result.hint) {
                const hint = document.createElement('div');
                hint.id = 'tab-hint';
                hint.className = 'tab-hint';
                hint.textContent = result.hint;
                this.el.output.appendChild(hint);
                this.el.input.scrollIntoView({ block: 'end' });
            }
            return;
        }

        // Any non-Tab key resets tab state
        if (Shell._tabMatches.length > 0 || Shell._tabOriginal) {
            Shell.resetTabState();
            this._removeTabHint();
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const cmd = this.el.input.value;
            if (cmd.trim()) {
                Shell.addHistory(cmd);
            }
            if (cmd.trim().toLowerCase() === 'clear') {
                this.clearOutput();
            } else {
                const result = Shell.exec(cmd);
                if (result === null && cmd.split('|').map(s => s.trim().split(/\s+/)[0]).includes('clear')) {
                    this.clearOutput();
                } else {
                    this.addOutput(cmd, result);
                }
            }
            this.el.input.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const val = Shell.historyUp();
            if (val !== null) this.el.input.value = val;
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.el.input.value = Shell.historyDown();
        }
    },

    handleClick(e) {
        const clickable = e.target.closest('.clickable');
        if (clickable) {
            const action = clickable.dataset.action;
            const target = clickable.dataset.target;
            const cmd = action === 'cat' ? `cat ${target}` : action === 'cd' ? `cd ${target}` : `open ${target}`;
            const result = Shell.exec(cmd);
            this.addOutput(cmd, result);
            return;
        }
        this.el.input.focus();
    },

    // ─── Boot Sequence ──────────────────────────────────────

    getBootLines(version) {
        if (version < 1.1) {
            return [
                { text: 'RF0 Broadcast Repeater v1.0', delay: 300 },
                { text: 'S/N RF0-4119-0847', delay: 200 },
            ];
        }

        if (version < 2.0) {
            return [
                { text: 'GregBIOS (C) 2026 Gregory Alan Computing', delay: 300 },
                { text: 'POST: CPU \u2014 OK', delay: 250 },
                { text: 'POST: Memory \u2014 OK', delay: 250 },
                { text: 'POST: sda1 \u2014 gregfs mounted', delay: 300 },
                { text: '', delay: 200 },
                { text: 'Loading gregos-kernel 0.9.847 ...', delay: 600 },
                { text: '', delay: 200 },
                { text: 'Starting terminal ...', delay: 400 },
            ];
        }

        // v2.0 — full boot
        const cores = navigator.hardwareConcurrency || '?';
        const mem = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '640K';
        const net = navigator.connection ? navigator.connection.effectiveType : null;

        return [
            { text: 'GregBIOS (C) 2026 Gregory Alan Computing', delay: 300 },
            { text: '', delay: 200 },
            { text: `CPU: ${cores}-core processor detected`, delay: 300 },
            { text: `Memory: ${mem} available`, delay: 300 },
            { text: 'PCI: bus probe complete', delay: 200 },
            ...(net ? [{ text: `eth0: link up, ${net}`, delay: 200 }] : []),
            { text: '/dev/sda1: mounted (ext4)', delay: 300 },
            ...(Kernel.hunt.has('rf0-mount-failed')
                ? [{ text: 'rf0: device fault \u2014 buffer dumped (see .rf0.buf)', delay: 400, style: 'color:var(--warn)' }]
                : []),
            { text: '', delay: 200 },
            { text: 'Loading GregOS v2.0 ...', delay: 600 },
            { text: 'Starting terminal ...', delay: 400 },
        ];
    },

    async runBootSequence() {
        const lines = this.getBootLines(Kernel.hunt.getVersion());

        let skipped = false;
        const skipHandler = () => { skipped = true; };
        document.addEventListener('keydown', skipHandler);
        document.addEventListener('touchstart', skipHandler);

        for (const line of lines) {
            if (skipped) break;
            if (line.append) {
                const last = this.el.bootScreen.lastElementChild;
                if (last) last.textContent += line.text;
            } else {
                const div = document.createElement('div');
                div.textContent = line.text;
                if (line.style) div.style.cssText = line.style;
                this.el.bootScreen.appendChild(div);
            }
            await new Promise(r => setTimeout(r, line.delay));
        }

        document.removeEventListener('keydown', skipHandler);
        document.removeEventListener('touchstart', skipHandler);

        this.el.bootScreen.style.opacity = '0';
        await new Promise(r => setTimeout(r, 400));
        this.el.bootScreen.style.display = 'none';
        this.el.terminal.style.display = '';
        this.el.input.focus();
        Kernel.session.set('bootDone', '1');
    },

    async runUpdateSequence(fromVer, toVer) {
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
            this.el.bootScreen.appendChild(div);
            await new Promise(r => setTimeout(r, line.delay));
        }

        document.removeEventListener('keydown', skipHandler);
        document.removeEventListener('touchstart', skipHandler);

        await new Promise(r => setTimeout(r, 400));
        this.el.bootScreen.innerHTML = '';
    },

    // ─── Animations ─────────────────────────────────────────

    async runRmAnimation() {
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
            { text: "rm: cannot remove '/proc/1/status': Operation not permitted", style: 'color:var(--error)' },
            { text: "rm: cannot remove '/sys/class/net/eth0': Operation not permitted", style: 'color:var(--error)' },
            { text: "removed '/home/guest/.bash_history'", style: '' },
            { text: "removed '/usr/bin/ls'", style: '' },
            { text: "removed '/usr/bin/cat'", style: '' },
            { text: "removed '/sbin/init'", style: '' },
            { text: "rm: error while loading shared libraries: libc.so.6: cannot open shared object file", style: 'color:var(--error)' },
        ];
        const rmDiv = document.createElement('div');
        rmDiv.className = 'output rm-animation';
        this.el.output.appendChild(rmDiv);
        this.el.input.disabled = true;

        for (const entry of rmLines) {
            const line = document.createElement('div');
            if (entry.style) line.style.cssText = entry.style;
            line.textContent = entry.text;
            rmDiv.appendChild(line);
            this.el.input.scrollIntoView({ block: 'end' });
            await new Promise(r => setTimeout(r, 120));
        }

        const panicLines = [
            { text: '', style: '' },
            { text: 'Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000009', style: 'color:var(--warn);font-weight:bold' },
            { text: '', style: '' },
            { text: 'CPU: 0 PID: 1 Comm: init Not tainted', style: 'color:var(--error)' },
            { text: 'Call Trace:', style: 'color:var(--error)' },
            { text: ' [<ffffffff8107a1b2>] panic+0x1a2/0x1f7', style: 'color:var(--error)' },
            { text: ' [<ffffffff810791d3>] do_exit+0xa13/0xa20', style: 'color:var(--error)' },
            { text: ' [<ffffffff81079293>] do_group_exit+0x53/0xd0', style: 'color:var(--error)' },
            { text: '', style: '' },
            { text: '---[ end Kernel panic - not syncing: Attempted to kill init! ]---', style: 'color:var(--warn);font-weight:bold' },
        ];

        for (const entry of panicLines) {
            const line = document.createElement('div');
            if (entry.style) line.style.cssText = entry.style;
            line.textContent = entry.text;
            rmDiv.appendChild(line);
            this.el.input.scrollIntoView({ block: 'end' });
            await new Promise(r => setTimeout(r, 200));
        }

        await new Promise(r => setTimeout(r, 1500));

        this.el.terminal.style.display = 'none';
        await new Promise(r => setTimeout(r, 1200));

        // Garbled screen
        const garble = document.createElement('div');
        garble.id = 'garble-screen';
        garble.style.color = 'var(--prompt-color)';
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

        garble.style.opacity = '0';
        await new Promise(r => setTimeout(r, 150));
        garble.style.opacity = '1';
        garbleText = '';
        for (let i = 0; i < 20; i++) {
            for (let j = 0; j < 60; j++) {
                garbleText += garbleChars[Math.floor(Math.random() * garbleChars.length)];
            }
            garbleText += '\n';
        }
        garble.textContent = garbleText;
        await new Promise(r => setTimeout(r, 400));

        garble.remove();
        await new Promise(r => setTimeout(r, 1000));

        // Factory reset
        Kernel.session.clear();
        Kernel.hunt.discoveries = {};
        Kernel.hunt.flags = {};
        Kernel.hunt._currentStates = {};
        Kernel.hunt.setVersion(1.0);
        applyVersion(1.0);
        renderMOTD();
        this.updatePrompt();

        const overlay = document.getElementById('scanline-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.backgroundColor = '';

        this.clearOutput();
        this.el.bootScreen.innerHTML = '';
        this.el.bootScreen.style.display = '';
        this.el.bootScreen.style.opacity = '1';
        this.runBootSequence().then(() => {
            this.el.input.disabled = false;
            this.el.input.focus();
        });
    },

    async runMountCrash() {
        this.el.input.disabled = true;

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
            { text: 'rf0: WARN: checksum incomplete', delay: 1500, style: 'color:var(--warn)' },
            { text: 'rf0: ERR: buffer contains executable segment (ELF marker at offset 0x00)', delay: 800, style: 'color:var(--error)' },
            { text: 'rf0: FATAL: refusing to mount \u2014 unverified executable content', delay: 500, style: 'color:var(--error);font-weight:bold' },
            { text: 'kernel: rf0: device fault \u2014 dumping buffer to .rf0.buf', delay: 800 },
            { text: 'kernel: rf0: 847 bytes written', delay: 2000 },
            { text: 'Segmentation fault (core dumped)', delay: 3000, style: 'color:var(--error);font-weight:bold' },
            { text: 'kernel panic - not syncing: device fault in rf0 driver', delay: 0, style: 'color:var(--warn);font-weight:bold' },
        ];

        const crashDiv = document.createElement('div');
        crashDiv.className = 'output';
        this.el.output.appendChild(crashDiv);

        for (const entry of crashLines) {
            const line = document.createElement('div');
            if (entry.style) line.style.cssText = entry.style;
            line.textContent = entry.text;
            crashDiv.appendChild(line);
            this.el.input.scrollIntoView({ block: 'end' });
            await new Promise(r => setTimeout(r, entry.delay));
        }

        await new Promise(r => setTimeout(r, 3000));

        Kernel.hunt.discover('rf0-mount-failed');

        this.el.terminal.style.display = 'none';
        await new Promise(r => setTimeout(r, 1500));

        Kernel.session.remove('bootDone');
        this.clearOutput();
        this.el.bootScreen.innerHTML = '';
        this.el.bootScreen.style.display = '';
        this.el.bootScreen.style.opacity = '1';

        applyVersion(Kernel.hunt.getVersion());
        renderMOTD();
        this.updatePrompt();

        this.runBootSequence().then(() => {
            this.el.input.disabled = false;
            this.el.input.focus();
        });
    },
};

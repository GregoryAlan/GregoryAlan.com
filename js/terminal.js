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

    _pendingAuth: null,

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

    promptPassword(callback) {
        this._pendingAuth = { callback, buffer: '' };
        this.el.prompt.textContent = 'Password: ';
        this.el.input.value = '';
        this.el.input.focus();
    },

    init() {
        this.el.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.el.terminal.addEventListener('click', (e) => this.handleClick(e));
    },

    handleKeydown(e) {
        // ── Password mode: intercept all input ──
        if (this._pendingAuth) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const pw = this._pendingAuth.buffer;
                const cb = this._pendingAuth.callback;
                this._pendingAuth = null;
                const masked = '•'.repeat(pw.length);
                this.el.output.innerHTML += '<div><span class="prompt">Password: </span>'
                    + '<span class="command">' + masked + '</span></div>';
                this.el.input.value = '';
                cb(pw);
                return;
            }
            if (e.key === 'Backspace') {
                e.preventDefault();
                this._pendingAuth.buffer = this._pendingAuth.buffer.slice(0, -1);
                this.el.input.value = '•'.repeat(this._pendingAuth.buffer.length);
                return;
            }
            if (e.key === 'c' && e.ctrlKey) {
                e.preventDefault();
                this._pendingAuth = null;
                this.el.output.innerHTML += '<div><span class="prompt">Password: </span>'
                    + '<span class="command">^C</span></div>';
                this.el.input.value = '';
                this.updatePrompt();
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this._pendingAuth.buffer += e.key;
                this.el.input.value = '•'.repeat(this._pendingAuth.buffer.length);
                return;
            }
            e.preventDefault();
            return;
        }

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
        if (version < 1.1) return ManifestLoader.getSequence('boot-v1.0');
        if (version < 2.0) return ManifestLoader.getSequence('boot-v1.1');

        // v2.0 — full boot (dynamic — uses navigator APIs, stays in JS)
        const cores = navigator.hardwareConcurrency || '?';
        const mem = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '640K';
        const net = navigator.connection ? navigator.connection.effectiveType : null;

        return [
            { text: 'GregBIOS 1.4 (C) 2025 Gregory Alan Computing', delay: 300 },
            { text: '', delay: 200 },
            { text: `CPU: ${cores}-core processor detected`, delay: 300 },
            { text: `Memory: ${mem} available`, delay: 300 },
            { text: 'PCI: bus probe complete', delay: 200 },
            ...(net ? [{ text: `eth0: link up, ${net}`, delay: 200 }] : []),
            { text: '/dev/sda1: mounted (ext4)', delay: 300 },
            ...(Kernel.driver.has('rf0-mount-failed')
                ? [{ text: 'rf0: device fault \u2014 buffer dumped (see .rf0.buf)', delay: 400, style: 'color:var(--warn)' }]
                : []),
            { text: '', delay: 200 },
            { text: 'Loading GregOS v2.0 ...', delay: 600 },
            { text: 'Starting terminal ...', delay: 400 },
        ];
    },

    async runBootSequence() {
        const lines = this.getBootLines(Kernel.driver.getVersion());

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
        const template = ManifestLoader.getSequence('update');
        const lines = template.map(entry => ({
            text: entry.text.replace('{fromVer}', fromVer).replace('{toVer}', toVer),
            delay: entry.delay,
        }));

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
        const rmLines = ManifestLoader.getSequence('rm-rf');
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
            await new Promise(r => setTimeout(r, entry.delay || 120));
        }

        const panicLines = ManifestLoader.getSequence('kernel-panic');

        for (const entry of panicLines) {
            const line = document.createElement('div');
            if (entry.style) line.style.cssText = entry.style;
            line.textContent = entry.text;
            rmDiv.appendChild(line);
            this.el.input.scrollIntoView({ block: 'end' });
            await new Promise(r => setTimeout(r, entry.delay || 200));
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
        Kernel.driver.discoveries = {};
        Kernel.driver.flags = {};
        Kernel.driver._currentStates = {};
        Kernel.driver.setVersion(1.0);
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

        const crashLines = ManifestLoader.getSequence('mount-crash');

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

        Kernel.driver.discover('rf0-mount-failed');

        this.el.terminal.style.display = 'none';
        await new Promise(r => setTimeout(r, 1500));

        Kernel.session.remove('bootDone');
        this.clearOutput();
        this.el.bootScreen.innerHTML = '';
        this.el.bootScreen.style.display = '';
        this.el.bootScreen.style.opacity = '1';

        applyVersion(Kernel.driver.getVersion());
        renderMOTD();
        this.updatePrompt();

        this.runBootSequence().then(() => {
            this.el.input.disabled = false;
            this.el.input.focus();
        });
    },
};

// ─── GregOS Shell ───────────────────────────────────────────
//
// Command parsing, execution, history, tab completion, environment.
// No DOM access — all output goes through return values.
//
// Depends on: kernel.js (Kernel)

const Shell = {

    // ─── Command Registry ───────────────────────────────────

    _commands: {},
    _hiddenCommands: new Set(),

    register(name, fn) { this._commands[name] = fn; },
    unregister(name) { delete this._commands[name]; },

    listCommands() { return Object.keys(this._commands); },

    listVisibleCommands() {
        return Object.keys(this._commands).filter(n => !this._hiddenCommands.has(n));
    },

    resetCommands() {
        for (const k in this._commands) delete this._commands[k];
    },

    // ─── Execution ──────────────────────────────────────────

    exec(cmd) {
        if (cmd.includes('|')) return this.execPipeline(cmd);

        const parts = cmd.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');

        if (!command) return '';
        if (this._commands[command]) {
            const result = this._commands[command](args);
            Kernel.hunt.checkTriggers('command', command);
            return result;
        }
        return `${command}: command not found. Type 'help' for available commands.`;
    },

    execPipeline(cmd) {
        const stages = cmd.split('|').map(s => s.trim()).filter(Boolean);
        let stdin = null;

        for (const stage of stages) {
            const parts = stage.split(/\s+/);
            const command = parts[0].toLowerCase();
            const args = parts.slice(1).join(' ');

            if (!this._commands[command]) {
                return `${command}: command not found`;
            }

            const result = this._commands[command](args, stdin);
            if (result === null) return null;

            Kernel.hunt.checkTriggers('command', command);
            stdin = this.stripHTML(result) || '';
        }

        return stdin;
    },

    stripHTML(str) {
        if (!str) return str;
        return str
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '');
    },

    // ─── History ────────────────────────────────────────────

    _history: [],
    _historyIndex: -1,

    addHistory(cmd) {
        this._history.unshift(cmd);
        this._historyIndex = -1;
    },

    historyUp() {
        if (this._historyIndex < this._history.length - 1) {
            this._historyIndex++;
            return this._history[this._historyIndex];
        }
        return null;
    },

    historyDown() {
        if (this._historyIndex > 0) {
            this._historyIndex--;
            return this._history[this._historyIndex];
        }
        this._historyIndex = -1;
        return '';
    },

    // ─── Tab Completion ─────────────────────────────────────

    _tabMatches: [],
    _tabIndex: -1,
    _tabOriginal: '',

    getCompletions(text) {
        const parts = text.split(/\s+/);
        if (parts.length <= 1) {
            const prefix = parts[0].toLowerCase();
            return Object.keys(this._commands).filter(c => c.startsWith(prefix));
        }

        const cmd = parts[0].toLowerCase();
        const argPrefix = parts.slice(1).join(' ');
        let candidates = [];

        if (cmd === 'cd') {
            // Path-with-slash: resolve directory portion, list subdirs
            if (argPrefix.includes('/')) {
                const lastSlash = argPrefix.lastIndexOf('/');
                const dirPart = argPrefix.slice(0, lastSlash + 1);
                const prefix = argPrefix.slice(lastSlash + 1);
                const pathArr = Kernel.fs._resolve(dirPart);
                const node = Kernel.fs._getNode(pathArr);
                if (node && typeof node === 'object') {
                    candidates = Object.entries(node)
                        .filter(([, v]) => typeof v === 'object')
                        .map(([name]) => dirPart + name);
                }
                return candidates.filter(c => c.startsWith(argPrefix));
            }
            const dir = Kernel.fs.getCurrentDir();
            if (typeof dir === 'object' && dir !== null) {
                candidates = Object.entries(dir)
                    .filter(([, v]) => typeof v === 'object')
                    .map(([name]) => name);
            }
        } else if (cmd === 'cat') {
            // Path-with-slash: resolve directory portion, list readable entries
            if (argPrefix.includes('/')) {
                const lastSlash = argPrefix.lastIndexOf('/');
                const dirPart = argPrefix.slice(0, lastSlash + 1);
                const pathArr = Kernel.fs._resolve(dirPart);
                const node = Kernel.fs._getNode(pathArr);
                if (node && typeof node === 'object') {
                    candidates = Object.entries(node)
                        .filter(([, v]) => typeof v === 'string' && v !== 'file'
                            || typeof v === 'function' && Kernel.fs.isNodeVisible(v))
                        .map(([name]) => dirPart + name);
                }
                return candidates.filter(c => c.startsWith(argPrefix));
            }
            if (Kernel.fs._cwd.length === 0) {
                // Root: flat stores
                candidates = Object.keys(Kernel.fs._textFiles);
                Object.keys(Kernel.fs._hiddenFiles).forEach(f => {
                    if (Kernel.fs.isVisible(f)) candidates.push(f);
                });
            } else {
                // Subdirectory: readable entries from current dir node
                const dir = Kernel.fs.getCurrentDir();
                if (dir && typeof dir === 'object') {
                    for (const [name, value] of Object.entries(dir)) {
                        if (typeof value === 'string' && value !== 'file') candidates.push(name);
                        else if (typeof value === 'function' && Kernel.fs.isNodeVisible(value)) candidates.push(name);
                    }
                }
            }
        } else if (cmd === 'open') {
            const dir = Kernel.fs.getCurrentDir();
            if (typeof dir === 'object' && dir !== null) {
                candidates = Object.entries(dir)
                    .filter(([, v]) => v === 'file')
                    .map(([name]) => name);
            }
        } else if (cmd === 'man') {
            candidates = Object.keys(Kernel.fs._manPages);
        } else if (cmd === 'pkg') {
            if (parts.length === 2) {
                candidates = ['update', 'list', 'install', 'installed'];
            } else if (parts.length === 3 && parts[1] === 'install') {
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
            if (!Kernel.hunt.has('rf0-mount-failed')) {
                candidates = ['/dev/rf0'];
            }
        } else if (cmd === 'grep' || cmd === 'wc' || cmd === 'head') {
            // Path-with-slash support
            if (argPrefix.includes('/')) {
                const lastSlash = argPrefix.lastIndexOf('/');
                const dirPart = argPrefix.slice(0, lastSlash + 1);
                const pathArr = Kernel.fs._resolve(dirPart);
                const node = Kernel.fs._getNode(pathArr);
                if (node && typeof node === 'object') {
                    candidates = Object.entries(node)
                        .filter(([, v]) => typeof v === 'string' && v !== 'file'
                            || typeof v === 'function' && Kernel.fs.isNodeVisible(v))
                        .map(([name]) => dirPart + name);
                }
                return candidates.filter(c => c.startsWith(argPrefix));
            }
            if (Kernel.fs._cwd.length === 0) {
                candidates = Object.keys(Kernel.fs._textFiles);
                Object.keys(Kernel.fs._hiddenFiles).forEach(f => {
                    if (Kernel.fs.isVisible(f)) candidates.push(f);
                });
            } else {
                const dir = Kernel.fs.getCurrentDir();
                if (dir && typeof dir === 'object') {
                    for (const [name, value] of Object.entries(dir)) {
                        if (typeof value === 'string' && value !== 'file') candidates.push(name);
                        else if (typeof value === 'function' && Kernel.fs.isNodeVisible(value)) candidates.push(name);
                    }
                }
            }
        } else if (cmd === 'uname') {
            candidates = ['-a', '-s', '-r', '-v', '-m', '-n'];
        } else {
            return [];
        }

        return candidates.filter(c => c.startsWith(argPrefix));
    },

    cycleTab(text) {
        if (this._tabMatches.length > 0) {
            this._tabIndex = (this._tabIndex + 1) % this._tabMatches.length;
        } else {
            this._tabOriginal = text;
            this._tabMatches = this.getCompletions(text);
            this._tabIndex = 0;
        }

        if (this._tabMatches.length === 0) return null;

        if (this._tabMatches.length === 1) {
            const parts = this._tabOriginal.split(/\s+/);
            const value = parts.length <= 1
                ? this._tabMatches[0] + ' '
                : parts[0] + ' ' + this._tabMatches[0] + ' ';
            this.resetTabState();
            return { value, hint: null };
        }

        const parts = this._tabOriginal.split(/\s+/);
        const value = parts.length <= 1
            ? this._tabMatches[this._tabIndex]
            : parts[0] + ' ' + this._tabMatches[this._tabIndex];
        return { value, hint: this._tabMatches.join('  ') };
    },

    resetTabState() {
        this._tabMatches = [];
        this._tabIndex = -1;
        this._tabOriginal = '';
    },

    // ─── Prompt ─────────────────────────────────────────────

    getPrompt() {
        if (Kernel.hunt.getVersion() < 1.1) {
            return 'rf0>';
        }
        const path = Kernel.fs._cwd.length ? '~/' + Kernel.fs._cwd.join('/') : '~';
        return `guest@gregoryalan.com:${path}$`;
    },

    // ─── Environment ────────────────────────────────────────

    env: {
        USER: 'guest',
        HOME: '/home/guest',
        SHELL: '/bin/bash',
        HOSTNAME: 'gregoryalan.com',
        TERM: 'xterm-256color',
        LANG: 'en_US.UTF-8',
        PATH: '/usr/local/bin:/usr/bin:/bin',
        OSTYPE: 'gregos',
    },
};

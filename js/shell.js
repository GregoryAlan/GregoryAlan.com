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
    _completions: {},

    register(name, fn) { this._commands[name] = fn; },
    unregister(name) { delete this._commands[name]; },
    registerCompletion(name, fn) { this._completions[name] = fn; },

    listCommands() { return Object.keys(this._commands); },

    listVisibleCommands() {
        return Object.keys(this._commands).filter(n => !this._hiddenCommands.has(n));
    },

    resetCommands() {
        for (const k in this._commands) delete this._commands[k];
    },

    // ─── Execution ──────────────────────────────────────────

    exec(cmd) {
        try {
            const { stages } = shellTokenize(cmd);

            // Multi-stage pipeline
            if (stages.length > 1) return this._execStages(stages);

            // Single command
            const tokens = stages[0];
            if (!tokens.length) return '';

            const command = tokens[0].value.toLowerCase();
            const argTokens = tokens.slice(1);

            if (this._commands[command]) {
                const expanded = this._expandGlobs(argTokens);
                const argValues = expanded.map(t => t.value);
                const args = argValues.join(' ');
                const parsed = parseArgs(args, undefined, argValues);
                const result = this._commands[command](args, null, parsed);
                EventBus.emit('command:executed', { command, args, parsed, output: result });
                return result;
            }
            // Easter egg lookup — after real commands, before "not found"
            const egg = ManifestLoader.getEasterEgg(cmd.trim());
            if (egg && Kernel.driver.evaluateGate(egg.gate || null, Kernel.driver)) {
                if (egg.discover) Kernel.driver.discover(egg.discover);
                if (egg.glitch) runGlitchEffect(egg.glitch, egg.glitchOpts || {});
                return egg.response;
            }
            return `${command}: command not found. Type 'help' for available commands.`;
        } catch (e) {
            console.error('[Shell] exec error:', e);
            return 'internal error: ' + (e.message || 'unknown');
        }
    },

    _execStages(stages) {
        let stdin = null;

        for (const tokens of stages) {
            if (!tokens.length) continue;
            const command = tokens[0].value.toLowerCase();
            const argTokens = tokens.slice(1);

            if (!this._commands[command]) {
                return `${command}: command not found`;
            }

            const expanded = this._expandGlobs(argTokens);
            const argValues = expanded.map(t => t.value);
            const args = argValues.join(' ');
            const parsed = parseArgs(args, undefined, argValues);
            const result = this._commands[command](args, stdin, parsed);
            if (result === null) return null;

            EventBus.emit('command:executed', { command, args, parsed, output: result });
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

    // ─── Glob Expansion ─────────────────────────────────────

    _expandGlobs(tokens) {
        const result = [];
        for (const tok of tokens) {
            if (tok.quoted || (!/[*?]/.test(tok.value))) {
                result.push(tok);
                continue;
            }
            // Path-component globs deferred
            if (tok.value.includes('/')) {
                result.push(tok);
                continue;
            }
            const matches = this._globMatch(tok.value);
            if (matches.length) {
                matches.sort();
                for (const m of matches) result.push({ value: m, quoted: false });
            } else {
                // No matches: pass through literally (POSIX behavior)
                result.push(tok);
            }
        }
        return result;
    },

    _globMatch(pattern) {
        const startsWithDot = pattern.startsWith('.');
        // Convert glob to regex: escape regex chars, then translate * and ?
        const reStr = '^' + pattern
            .replace(/([.+^${}()|[\]\\])/g, '\\$1')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') + '$';
        const re = new RegExp(reStr);

        const candidates = [];
        const isRoot = Kernel.fs._cwd.length === 0;

        // Enumerate from current directory (mirrors completePath logic)
        if (isRoot) {
            // Flat stores at root
            for (const f of Object.keys(Kernel.fs._textFiles)) {
                candidates.push(f);
            }
            for (const f of Object.keys(Kernel.fs._hiddenFiles)) {
                if (Kernel.fs.isVisible(f)) candidates.push(f);
            }
        }
        const dir = Kernel.fs.getCurrentDir();
        if (dir && typeof dir === 'object') {
            for (const [name, value] of Object.entries(dir)) {
                // Skip gated functions that aren't visible
                if (typeof value === 'function' && !Kernel.fs.isNodeVisible(value)) continue;
                candidates.push(name);
            }
        }

        return candidates.filter(name => {
            if (name.startsWith('.') && !startsWithDot) return false;
            return re.test(name);
        });
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

    // Shared completion helper: complete filesystem paths.
    // filter: 'dirs' (directories only), 'readable' (readable files),
    //         'external' (HTML files marked as 'file')
    completePath(argPrefix, filter) {
        // Path-with-slash: resolve directory portion, list matching entries
        if (argPrefix.includes('/')) {
            const lastSlash = argPrefix.lastIndexOf('/');
            const dirPart = argPrefix.slice(0, lastSlash + 1);
            const node = Kernel.fs._getNode(Kernel.fs._resolve(dirPart));
            if (!node || typeof node !== 'object') return [];
            return Object.entries(node)
                .filter(([, v]) => this._matchFilter(v, filter))
                .map(([name]) => dirPart + name)
                .filter(c => c.startsWith(argPrefix));
        }

        // No slash: list from current directory (+ flat stores for readable at root)
        let candidates = [];
        if (filter === 'readable' && Kernel.fs._cwd.length === 0) {
            candidates = Object.keys(Kernel.fs._textFiles);
            Object.keys(Kernel.fs._hiddenFiles).forEach(f => {
                if (Kernel.fs.isVisible(f)) candidates.push(f);
            });
        } else {
            const dir = Kernel.fs.getCurrentDir();
            if (dir && typeof dir === 'object') {
                for (const [name, value] of Object.entries(dir)) {
                    if (this._matchFilter(value, filter)) candidates.push(name);
                }
            }
        }
        return candidates.filter(c => c.startsWith(argPrefix));
    },

    _matchFilter(value, filter) {
        if (filter === 'dirs') return typeof value === 'object';
        if (filter === 'external') return value === 'file';
        // 'readable': string content (not external 'file') + visible gated functions
        return (typeof value === 'string' && value !== 'file')
            || (typeof value === 'function' && Kernel.fs.isNodeVisible(value));
    },

    completeFromList(argPrefix, candidates) {
        return candidates.filter(c => c.startsWith(argPrefix));
    },

    getCompletions(text) {
        const parts = text.split(/\s+/);
        if (parts.length <= 1) {
            const prefix = parts[0].toLowerCase();
            return Object.keys(this._commands).filter(c => c.startsWith(prefix));
        }

        const cmd = parts[0].toLowerCase();
        const argPrefix = parts.slice(1).join(' ');
        const completionFn = this._completions[cmd];
        if (completionFn) return completionFn(argPrefix, parts);
        return [];
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
        if (Kernel.driver.getVersion() < 1.1) {
            return 'rf0>';
        }
        const user = Shell.env.USER;
        const host = Shell.env.HOSTNAME;
        const path = Kernel.fs.cwdString();
        return `${user}@${host}:${path}$`;
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

    // ─── User Profiles ───────────────────────────────────────

    _activeProfile: null,
    _savedEnv: null,
    _savedCwd: null,

    switchProfile(profile) {
        this._savedEnv = { ...this.env };
        this._savedCwd = Kernel.fs.cwd();
        // Swap hidden .bash_history with the profile's tree version
        this._savedBashHistory = Kernel.fs._hiddenFiles['.bash_history'];
        const profileHistory = Kernel.fs._getNode(['home', profile.username, '.bash_history']);
        if (typeof profileHistory === 'string') {
            Kernel.fs._hiddenFiles['.bash_history'] = profileHistory;
        }
        // Isolate runtime history
        this._savedHistory = this._history.slice();
        this._history = [];
        this._historyIndex = -1;
        this.env.USER = profile.username;
        this.env.HOME = '/home/' + profile.username;
        if (profile.hostname) this.env.HOSTNAME = profile.hostname;
        this._activeProfile = profile;
        Kernel.fs.setHome(['home', profile.username]);
        Kernel.fs.chdir('~');
        Terminal.updatePrompt();
    },

    restoreProfile() {
        if (!this._activeProfile) return false;
        Object.assign(this.env, this._savedEnv);
        this._activeProfile = null;
        this._savedEnv = null;
        // Restore guest .bash_history
        if (this._savedBashHistory !== undefined) {
            Kernel.fs._hiddenFiles['.bash_history'] = this._savedBashHistory;
            this._savedBashHistory = undefined;
        }
        // Restore runtime history
        if (this._savedHistory) {
            this._history = this._savedHistory;
            this._historyIndex = -1;
            this._savedHistory = null;
        }
        Kernel.fs.setHome([]);
        // Restore working directory
        const cwd = this._savedCwd;
        this._savedCwd = null;
        Kernel.fs._cwd.length = 0;
        if (cwd) cwd.forEach(p => Kernel.fs._cwd.push(p));
        Terminal.updatePrompt();
        return true;
    },
};

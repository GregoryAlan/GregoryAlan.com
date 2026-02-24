// ─── GregOS Kernel ──────────────────────────────────────────
//
// Owns all persistent state: filesystem, drivers, session.
// Everything else accesses state through Kernel methods.
//
// Depends on: events.js (EventBus), glitch.js (runGlitchEffect)

const Kernel = {

    // ─── Filesystem ─────────────────────────────────────────

    fs: {
        _fileTree: {},
        _textFiles: {},
        _hiddenFiles: {},
        _manPages: {},
        _cwd: [],
        _homePrefix: [],

        _resolve(name) {
            if (!name || name === '.') return [...this._cwd];
            let parts;
            if (name === '~') {
                return [...this._homePrefix];
            } else if (name.startsWith('~/')) {
                parts = [...this._homePrefix, ...name.slice(2).split('/').filter(Boolean)];
            } else if (name.startsWith('/')) {
                parts = name.replace(/^\/+/, '').split('/').filter(Boolean);
            } else {
                parts = [...this._cwd, ...name.split('/').filter(Boolean)];
            }
            const resolved = [];
            for (const p of parts) {
                if (p === '.') continue;
                if (p === '..') { resolved.pop(); continue; }
                resolved.push(p);
            }
            return resolved;
        },

        _getNode(pathArr) {
            let node = this._fileTree;
            for (const p of pathArr) {
                if (node && typeof node === 'object' && p in node) {
                    node = node[p];
                } else {
                    return null;
                }
            }
            return node;
        },

        isNodeVisible(node) {
            if (typeof node !== 'function') return true;
            const peekState = {
                has: (id) => Kernel.driver.has(id),
                flags: Kernel.driver.flags,
                getVersion: () => Kernel.driver.getVersion(),
                isInOrPast: (h, s) => Kernel.driver.isInOrPast(h, s),
                discover() {}
            };
            return node(peekState) !== null;
        },

        addTreeFile(path, content) {
            const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
            const fileName = parts.pop();
            let node = this._fileTree;
            for (const dir of parts) {
                if (!(dir in node) || typeof node[dir] !== 'object') node[dir] = {};
                node = node[dir];
            }
            node[fileName] = content;
        },

        read(name) {
            let content = null;
            let pathArr = null;

            if (this._textFiles[name]) {
                content = this._textFiles[name];
            } else if (name in this._hiddenFiles) {
                content = this._hiddenFiles[name];
                if (typeof content === 'function') {
                    content = content(Kernel.driver);
                    if (content === null) return null;
                }
            } else {
                // Fall through to tree resolution
                pathArr = this._resolve(name);
                const node = this._getNode(pathArr);
                if (node === null || node === undefined) return null;
                if (node === 'file') return null;  // external HTML, not readable
                if (typeof node === 'object') return null;  // directory, not readable
                if (typeof node === 'function') {
                    content = node(Kernel.driver);
                    if (content === null) return null;
                } else {
                    content = node;  // string content
                }
            }

            if (content !== null) {
                if (!pathArr) pathArr = this._resolve(name);
                EventBus.emit('file:read', { name, path: pathArr });
            }
            return content;
        },

        stat(name) {
            if (this._textFiles[name]) return 'text';
            if (name in this._hiddenFiles) return 'hidden';
            const dir = this.getCurrentDir();
            if (dir && typeof dir === 'object' && name in dir) {
                return dir[name] === 'file' ? 'file' : 'dir';
            }
            // Fall through to tree resolution
            const pathArr = this._resolve(name);
            const node = this._getNode(pathArr);
            if (node === null || node === undefined) return null;
            if (node === 'file') return 'file';
            if (typeof node === 'object') return 'dir';
            if (typeof node === 'function') return 'hidden';
            return 'text';
        },

        cwd() { return [...this._cwd]; },

        cwdString() {
            const hp = this._homePrefix;
            if (hp.length && this._cwd.length >= hp.length
                && hp.every((p, i) => this._cwd[i] === p)) {
                const rel = this._cwd.slice(hp.length);
                return rel.length ? '~/' + rel.join('/') : '~';
            }
            return this._cwd.length ? '~/' + this._cwd.join('/') : '~';
        },

        setHome(pathArray) { this._homePrefix = pathArray; },
        resetHome() { this._homePrefix = []; },

        chdir(path) {
            if (!path || path === '~') {
                this._cwd.length = 0;
                this._homePrefix.forEach(p => this._cwd.push(p));
                return { ok: true };
            }

            // Profile boundary: clamp to home prefix
            const hp = this._homePrefix;
            const clamp = (arr) => {
                if (Shell._activeProfile && hp.length
                    && (arr.length < hp.length || !hp.every((p, i) => arr[i] === p))) {
                    return [...hp];
                }
                return arr;
            };

            const testPath = this._resolve(path);

            // Validate each segment is a real directory
            for (let i = 1; i <= testPath.length; i++) {
                const node = this._getNode(testPath.slice(0, i));
                if (!node || typeof node !== 'object') {
                    return { error: `cd: ${path}: No such directory` };
                }
            }

            const final = clamp(testPath);
            this._cwd.length = 0;
            final.forEach(p => this._cwd.push(p));
            return { ok: true };
        },

        isVisible(name) {
            const content = this._hiddenFiles[name];
            if (typeof content !== 'function') return true;
            const peekState = {
                has: (id) => Kernel.driver.has(id),
                flags: Kernel.driver.flags,
                getVersion: () => Kernel.driver.getVersion(),
                isInOrPast: (h, s) => Kernel.driver.isInOrPast(h, s),
                discover() {}
            };
            return content(peekState) !== null;
        },

        getCurrentDir() {
            let dir = this._fileTree;
            for (const p of this._cwd) {
                if (dir && typeof dir === 'object' && p in dir) {
                    dir = dir[p];
                } else {
                    return null;
                }
            }
            return dir;
        },

        getManPage(name) {
            const page = this._manPages[name];
            if (typeof page === 'function') return page();
            return page || null;
        },

        addTextFile(name, content) { this._textFiles[name] = content; },
        removeTextFile(name) { delete this._textFiles[name]; },
        addHiddenFile(name, content) { this._hiddenFiles[name] = content; },
        addManPage(name, content) { this._manPages[name] = content; },
        mergeFileTree(tree) { Object.assign(this._fileTree, tree); },
        mergeManPages(pages) { Object.assign(this._manPages, pages); },

        reset() {
            for (const k in this._textFiles) delete this._textFiles[k];
            for (const k in this._hiddenFiles) delete this._hiddenFiles[k];
            for (const k in this._manPages) delete this._manPages[k];
            for (const k in this._fileTree) delete this._fileTree[k];
            this._cwd.length = 0;
            this._homePrefix.length = 0;
        },
    },

    // ─── Driver Engine ──────────────────────────────────────

    driver: {
        discoveries: JSON.parse(sessionStorage.getItem('driver_discoveries') || '{}'),
        flags: JSON.parse(sessionStorage.getItem('driver_flags') || '{}'),
        _stateMaps: {},
        _currentStates: JSON.parse(sessionStorage.getItem('driver_states') || '{}'),
        _registry: {},

        discover(id) {
            if (this.discoveries[id]) return;
            this.discoveries[id] = Date.now();
            sessionStorage.setItem('driver_discoveries', JSON.stringify(this.discoveries));

            for (const [driverId, stateMap] of Object.entries(this._stateMaps)) {
                const current = this._currentStates[driverId];
                const stateDef = stateMap[current];
                if (stateDef?.transitions?.[id]) {
                    const next = stateDef.transitions[id];
                    const prev = current;
                    this._currentStates[driverId] = next;
                    sessionStorage.setItem('driver_states', JSON.stringify(this._currentStates));
                    const nextDef = stateMap[next];
                    if (nextDef?.flags) {
                        for (const [k, v] of Object.entries(nextDef.flags)) {
                            this.setFlag(k, v);
                        }
                    }
                    EventBus.emit('driver:state-changed', { driverId, from: prev, to: next });
                }
            }

            EventBus.emit('discovery:made', {
                id,
                timestamp: this.discoveries[id],
                count: Object.keys(this.discoveries).length,
            });
        },

        has(id) { return !!this.discoveries[id]; },

        setFlag(k, v) {
            this.flags[k] = v;
            sessionStorage.setItem('driver_flags', JSON.stringify(this.flags));
        },

        getVersion() { return parseFloat(this.flags.version || '1.0'); },
        setVersion(v) { this.setFlag('version', v.toString()); },

        registerStateMap(driverId, stateMap) {
            this._stateMaps[driverId] = stateMap;
            if (!(driverId in this._currentStates)) {
                this._currentStates[driverId] = 'idle';
                sessionStorage.setItem('driver_states', JSON.stringify(this._currentStates));
            }
        },

        getState(driverId) {
            return this._currentStates[driverId] || 'idle';
        },

        isInOrPast(driverId, stateName) {
            const stateMap = this._stateMaps[driverId];
            if (!stateMap) return false;
            const current = this._currentStates[driverId];
            if (current === stateName) return true;
            const visited = new Set();
            const queue = [stateName];
            while (queue.length) {
                const s = queue.shift();
                if (visited.has(s)) continue;
                visited.add(s);
                const def = stateMap[s];
                if (!def?.transitions) continue;
                for (const next of Object.values(def.transitions)) {
                    if (next === current) return true;
                    queue.push(next);
                }
            }
            return false;
        },

        debug() {
            const info = {
                version: this.getVersion(),
                discoveries: { ...this.discoveries },
                flags: { ...this.flags },
                drivers: {}
            };
            for (const [driverId, stateMap] of Object.entries(this._stateMaps)) {
                const current = this._currentStates[driverId] || 'idle';
                const stateDef = stateMap[current];
                info.drivers[driverId] = {
                    state: current,
                    transitions: stateDef?.transitions ? Object.keys(stateDef.transitions) : []
                };
            }
            return info;
        },

        registerTriggers(triggers) {
            for (const t of triggers) {
                const eventType = t.type === 'discovery' ? 'discovery:made' :
                                  t.type === 'command' ? 'command:executed' :
                                  t.type === 'file_read' ? 'file:read' :
                                  t.type === 'count' ? 'discovery:made' : null;
                if (!eventType) continue;
                const handler = (detail) => {
                    const value = t.type === 'discovery' ? detail.id :
                                  t.type === 'command' ? detail.command :
                                  t.type === 'file_read' ? detail.name :
                                  t.type === 'count' ? detail.count : null;
                    if (value !== t.match) return;
                    if (t.once && sessionStorage.getItem('trigger_' + t.type + '_' + t.match)) return;
                    if (t.once) sessionStorage.setItem('trigger_' + t.type + '_' + t.match, '1');
                    if (t.effect) runGlitchEffect(t.effect, t.effectOpts || {});
                    if (t.callback) t.callback(Kernel.driver);
                };
                EventBus.on(eventType, handler);
            }
        },

        evaluateGate(gate, state) {
            if (!gate) return true;
            if (typeof gate === 'function') return gate(state);
            if (Array.isArray(gate)) return gate.every(g => this.evaluateGate(g, state));

            const negated = gate.startsWith('!');
            const expr = negated ? gate.slice(1) : gate;
            let result;

            if (expr.startsWith('flag:')) {
                result = !!state.flags[expr.slice(5)];
            } else if (expr.startsWith('version:')) {
                result = state.getVersion() >= parseFloat(expr.slice(8));
            } else if (expr.includes(':')) {
                const [driverId, stateName] = expr.split(':');
                result = state.isInOrPast(driverId, stateName);
            } else {
                result = state.has(expr);
            }
            return negated ? !result : result;
        },

        createGatedFile(def) {
            const driver = this;
            return function(state) {
                if (!driver.evaluateGate(def.gate, state)) return null;
                if (def.onRead) state.discover(def.onRead);
                return typeof def.content === 'function' ? def.content(state) : def.content;
            };
        },

        declareDriver(def) {
            this._registry[def.id] = def;
            if (def.stateMap) {
                this.registerStateMap(def.id, def.stateMap);
            }
        },

        registerDriver(def) {
            if (def.files) {
                if (def.files.text) {
                    for (const [name, fileDef] of Object.entries(def.files.text)) {
                        Kernel.fs.addTextFile(name, typeof fileDef === 'string' ? fileDef : fileDef.content);
                    }
                }
                if (def.files.hidden) {
                    for (const [name, fileDef] of Object.entries(def.files.hidden)) {
                        if (typeof fileDef === 'string' || typeof fileDef === 'function') {
                            Kernel.fs.addHiddenFile(name, fileDef);
                        } else {
                            Kernel.fs.addHiddenFile(name, this.createGatedFile(fileDef));
                        }
                    }
                }
            }
            if (def.commands) {
                for (const [name, cmdDef] of Object.entries(def.commands)) {
                    Shell.register(name, typeof cmdDef === 'function' ? cmdDef : cmdDef.run);
                }
            }
            if (def.treeFiles) {
                for (const [path, fileDef] of Object.entries(def.treeFiles)) {
                    if (typeof fileDef === 'string' || typeof fileDef === 'function') {
                        Kernel.fs.addTreeFile(path, fileDef);
                    } else {
                        Kernel.fs.addTreeFile(path, this.createGatedFile(fileDef));
                    }
                }
            }
            if (def.directories) Kernel.fs.mergeFileTree(def.directories);
            if (def.manPages) Kernel.fs.mergeManPages(def.manPages);
            if (def.triggers) this.registerTriggers(def.triggers);
            if (def.patches) {
                if (def.patches.hiddenFiles) {
                    for (const [file, patchFn] of Object.entries(def.patches.hiddenFiles)) {
                        Kernel.fs.addHiddenFile(file, patchFn(Kernel.fs._hiddenFiles[file] || ''));
                    }
                }
            }
        },

        reset() {
            EventBus.reset();
        },
    },

    // ─── Version Accessors ────────────────────────────────────

    kernelVersion: {
        get() { return Kernel.session.get('kernelVersion') || null; },
        set(v) { Kernel.session.set('kernelVersion', v); },
        getBuild() {
            const v = this.get();
            return v ? (v.match(/\.(\d+)-/)?.[1] || null) : null;
        },
    },

    biosVersion: {
        get() { return Kernel.session.get('biosVersion') || null; },
        set(v) { Kernel.session.set('biosVersion', v); },
    },

    // ─── Session Storage ────────────────────────────────────

    session: {
        get(key) { return sessionStorage.getItem(key); },
        set(key, val) { sessionStorage.setItem(key, val); },
        remove(key) { sessionStorage.removeItem(key); },
        clear() { sessionStorage.clear(); },
    },
};

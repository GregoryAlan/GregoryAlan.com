// ─── GregOS Kernel ──────────────────────────────────────────
//
// Owns all persistent state: filesystem, hunts, session.
// Everything else accesses state through Kernel methods.
//
// Depends on: glitch.js (runGlitchEffect)

const Kernel = {

    // ─── Filesystem ─────────────────────────────────────────

    fs: {
        _fileTree: {},
        _textFiles: {},
        _hiddenFiles: {},
        _manPages: {},
        _cwd: [],

        _resolve(name) {
            if (!name || name === '.') return [...this._cwd];
            let parts;
            if (name.startsWith('/')) {
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
                has: (id) => Kernel.hunt.has(id),
                flags: Kernel.hunt.flags,
                getVersion: () => Kernel.hunt.getVersion(),
                isInOrPast: (h, s) => Kernel.hunt.isInOrPast(h, s),
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
            if (this._textFiles[name]) return this._textFiles[name];
            if (name in this._hiddenFiles) {
                let content = this._hiddenFiles[name];
                if (typeof content === 'function') {
                    content = content(Kernel.hunt);
                    if (content === null) return null;
                }
                return content;
            }
            // Fall through to tree resolution
            const pathArr = this._resolve(name);
            const node = this._getNode(pathArr);
            if (node === null || node === undefined) return null;
            if (node === 'file') return null;  // external HTML, not readable
            if (typeof node === 'object') return null;  // directory, not readable
            if (typeof node === 'function') {
                const content = node(Kernel.hunt);
                return content === null ? null : content;
            }
            return node;  // string content
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
            return this._cwd.length ? '~/' + this._cwd.join('/') : '~';
        },

        chdir(path) {
            if (!path || path === '~' || path === '/') {
                this._cwd.length = 0;
                return { ok: true };
            }
            if (path === '.') return { ok: true };
            if (path === '..') {
                if (this._cwd.length > 0) this._cwd.pop();
                return { ok: true };
            }

            const isAbsolute = path.startsWith('/');
            const parts = path.replace(/^\/+/, '').replace(/\/$/, '').split('/');
            const testPath = isAbsolute ? [] : [...this._cwd];

            for (const part of parts) {
                if (part === '..') {
                    if (testPath.length > 0) testPath.pop();
                    continue;
                }
                if (part === '.' || part === '') continue;

                let checkDir = this._fileTree;
                for (const p of testPath) {
                    checkDir = checkDir[p];
                }

                if (checkDir && typeof checkDir === 'object' && part in checkDir
                    && typeof checkDir[part] === 'object') {
                    testPath.push(part);
                } else {
                    return { error: `cd: ${path}: No such directory` };
                }
            }

            this._cwd.length = 0;
            testPath.forEach(p => this._cwd.push(p));
            return { ok: true };
        },

        isVisible(name) {
            const content = this._hiddenFiles[name];
            if (typeof content !== 'function') return true;
            const peekState = {
                has: (id) => Kernel.hunt.has(id),
                flags: Kernel.hunt.flags,
                getVersion: () => Kernel.hunt.getVersion(),
                isInOrPast: (h, s) => Kernel.hunt.isInOrPast(h, s),
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
            return this._manPages[name] || null;
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
        },
    },

    // ─── Hunt Engine ────────────────────────────────────────

    hunt: {
        discoveries: JSON.parse(sessionStorage.getItem('hunt_discoveries') || '{}'),
        flags: JSON.parse(sessionStorage.getItem('hunt_flags') || '{}'),
        _stateMaps: {},
        _currentStates: JSON.parse(sessionStorage.getItem('hunt_states') || '{}'),
        _triggers: [],
        _registry: {},

        discover(id) {
            if (this.discoveries[id]) return;
            this.discoveries[id] = Date.now();
            sessionStorage.setItem('hunt_discoveries', JSON.stringify(this.discoveries));

            for (const [huntId, stateMap] of Object.entries(this._stateMaps)) {
                const current = this._currentStates[huntId];
                const stateDef = stateMap[current];
                if (stateDef?.transitions?.[id]) {
                    const next = stateDef.transitions[id];
                    this._currentStates[huntId] = next;
                    sessionStorage.setItem('hunt_states', JSON.stringify(this._currentStates));
                    const nextDef = stateMap[next];
                    if (nextDef?.flags) {
                        for (const [k, v] of Object.entries(nextDef.flags)) {
                            this.setFlag(k, v);
                        }
                    }
                }
            }

            this.checkTriggers('discovery', id);
            this.checkTriggers('count', Object.keys(this.discoveries).length);
        },

        has(id) { return !!this.discoveries[id]; },

        setFlag(k, v) {
            this.flags[k] = v;
            sessionStorage.setItem('hunt_flags', JSON.stringify(this.flags));
        },

        getVersion() { return parseFloat(this.flags.version || '1.0'); },
        setVersion(v) { this.setFlag('version', v.toString()); },

        registerStateMap(huntId, stateMap) {
            this._stateMaps[huntId] = stateMap;
            if (!(huntId in this._currentStates)) {
                this._currentStates[huntId] = 'idle';
                sessionStorage.setItem('hunt_states', JSON.stringify(this._currentStates));
            }
        },

        getState(huntId) {
            return this._currentStates[huntId] || 'idle';
        },

        isInOrPast(huntId, stateName) {
            const stateMap = this._stateMaps[huntId];
            if (!stateMap) return false;
            const current = this._currentStates[huntId];
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
                hunts: {}
            };
            for (const [huntId, stateMap] of Object.entries(this._stateMaps)) {
                const current = this._currentStates[huntId] || 'idle';
                const stateDef = stateMap[current];
                info.hunts[huntId] = {
                    state: current,
                    transitions: stateDef?.transitions ? Object.keys(stateDef.transitions) : []
                };
            }
            return info;
        },

        checkTriggers(type, value) {
            for (const t of this._triggers) {
                if (t.type !== type) continue;
                if (t.match !== value) continue;
                if (t.once && sessionStorage.getItem('trigger_' + t.type + '_' + t.match)) continue;
                if (t.once) sessionStorage.setItem('trigger_' + t.type + '_' + t.match, '1');
                if (t.effect) runGlitchEffect(t.effect, t.effectOpts || {});
                if (t.callback) t.callback(Kernel.hunt);
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
                const [huntId, stateName] = expr.split(':');
                result = state.isInOrPast(huntId, stateName);
            } else {
                result = state.has(expr);
            }
            return negated ? !result : result;
        },

        createGatedFile(def) {
            const hunt = this;
            return function(state) {
                if (!hunt.evaluateGate(def.gate, state)) return null;
                if (def.onRead) state.discover(def.onRead);
                return typeof def.content === 'function' ? def.content(state) : def.content;
            };
        },

        declareHunt(hunt) {
            this._registry[hunt.id] = hunt;
            if (hunt.stateMap) {
                this.registerStateMap(hunt.id, hunt.stateMap);
            }
        },

        registerHunt(hunt) {
            if (hunt.files) {
                if (hunt.files.text) {
                    for (const [name, def] of Object.entries(hunt.files.text)) {
                        Kernel.fs.addTextFile(name, typeof def === 'string' ? def : def.content);
                    }
                }
                if (hunt.files.hidden) {
                    for (const [name, def] of Object.entries(hunt.files.hidden)) {
                        if (typeof def === 'string' || typeof def === 'function') {
                            Kernel.fs.addHiddenFile(name, def);
                        } else {
                            Kernel.fs.addHiddenFile(name, this.createGatedFile(def));
                        }
                    }
                }
            }
            if (hunt.commands) {
                for (const [name, def] of Object.entries(hunt.commands)) {
                    Shell.register(name, typeof def === 'function' ? def : def.run);
                }
            }
            if (hunt.treeFiles) {
                for (const [path, def] of Object.entries(hunt.treeFiles)) {
                    if (typeof def === 'string' || typeof def === 'function') {
                        Kernel.fs.addTreeFile(path, def);
                    } else {
                        Kernel.fs.addTreeFile(path, this.createGatedFile(def));
                    }
                }
            }
            if (hunt.directories) Kernel.fs.mergeFileTree(hunt.directories);
            if (hunt.manPages) Kernel.fs.mergeManPages(hunt.manPages);
            if (hunt.triggers) this._triggers.push(...hunt.triggers);
            if (hunt.patches) {
                if (hunt.patches.hiddenFiles) {
                    for (const [file, patchFn] of Object.entries(hunt.patches.hiddenFiles)) {
                        Kernel.fs.addHiddenFile(file, patchFn(Kernel.fs._hiddenFiles[file] || ''));
                    }
                }
            }
        },

        reset() {
            this._triggers.length = 0;
        },
    },

    // ─── Session Storage ────────────────────────────────────

    session: {
        get(key) { return sessionStorage.getItem(key); },
        set(key, val) { sessionStorage.setItem(key, val); },
        remove(key) { sessionStorage.removeItem(key); },
        clear() { sessionStorage.clear(); },
    },
};

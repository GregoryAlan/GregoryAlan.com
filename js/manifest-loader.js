// ─── Manifest Loader ────────────────────────────────────────
//
// Loads JSON content manifests into the kernel filesystem.
// Static narrative content lives in content/*.json files;
// this module bridges them into Kernel.fs at boot time.
//
// Depends on: kernel.js (Kernel)

const ManifestLoader = {

    _loaded: [],    // track loaded manifest IDs
    _cache: {},     // url → parsed manifest (survives reboot)
    _helpDescs: {}, // command → description (for help command)
    _sequences: {}, // id → [{text, delay, style?}, ...] (timed display sequences)
    _packages: [],  // package registry entries
    _profiles: {},  // username → profile metadata
    _motd: {},      // manifest-id → motd content object
    _narrativeOutputs: {}, // id → string (driver narrative text)
    _historyPatch: [],     // extra .bash_history commands

    // Load a parsed manifest object (synchronous).
    load(manifest) {
        if (!manifest || !manifest.id) return;

        if (manifest.textFiles) {
            for (const [name, content] of Object.entries(manifest.textFiles)) {
                Kernel.fs.addTextFile(name, content);
            }
        }

        if (manifest.hiddenFiles) {
            for (const [name, def] of Object.entries(manifest.hiddenFiles)) {
                if (typeof def === 'string') {
                    Kernel.fs.addHiddenFile(name, def);
                } else if (def.type === 'gated') {
                    Kernel.fs.addHiddenFile(name, Kernel.driver.createGatedFile(def));
                } else {
                    Kernel.fs.addHiddenFile(name, def.content);
                }
            }
        }

        if (manifest.treeFiles) {
            for (const [path, def] of Object.entries(manifest.treeFiles)) {
                if (typeof def === 'string') {
                    Kernel.fs.addTreeFile(path, def);
                } else if (def.type === 'gated') {
                    Kernel.fs.addTreeFile(path, Kernel.driver.createGatedFile(def));
                } else {
                    Kernel.fs.addTreeFile(path, def.content);
                }
            }
        }

        if (manifest.directories) {
            Kernel.fs.mergeFileTree(manifest.directories);
        }

        if (manifest.manPages) {
            Kernel.fs.mergeManPages(manifest.manPages);
        }

        if (manifest.helpDescriptions) {
            Object.assign(this._helpDescs, manifest.helpDescriptions);
        }

        if (manifest.sequences) {
            Object.assign(this._sequences, manifest.sequences);
        }

        if (manifest.packages) {
            this._packages = this._packages.concat(manifest.packages);
        }

        if (manifest.profiles) {
            Object.assign(this._profiles, manifest.profiles);
        }

        if (manifest.motd) {
            this._motd[manifest.id] = manifest.motd;
        }

        if (manifest.narrativeOutputs) {
            Object.assign(this._narrativeOutputs, manifest.narrativeOutputs);
        }

        if (manifest.historyPatch) {
            this._historyPatch = this._historyPatch.concat(manifest.historyPatch);
        }

        this._loaded.push(manifest.id);
    },

    // Load from cache (synchronous). Call after prefetch().
    loadCached(url) {
        const manifest = this._cache[url];
        if (!manifest) {
            console.error('[ManifestLoader] ' + url + ' not in cache');
            return null;
        }
        this.load(manifest);
        return manifest.id;
    },

    // Fetch + parse + cache a manifest from a URL (async).
    async loadFromURL(url) {
        if (this._cache[url]) {
            this.load(this._cache[url]);
            return this._cache[url].id;
        }
        const resp = await fetch(url);
        const manifest = await resp.json();
        this._cache[url] = manifest;
        this.load(manifest);
        return manifest.id;
    },

    // Pre-fetch multiple manifests in parallel (async).
    // Stores results in cache for later loadCached() calls.
    async prefetch(urls) {
        await Promise.all(urls.map(async (url) => {
            try {
                const resp = await fetch(url);
                this._cache[url] = await resp.json();
            } catch (e) {
                console.error('[ManifestLoader] Failed to fetch ' + url, e);
            }
        }));
    },

    getSequence(id) {
        return this._sequences[id] || null;
    },

    getPackages() {
        return this._packages;
    },

    getProfiles() {
        return this._profiles;
    },

    getProfile(name) {
        return this._profiles[name] || null;
    },

    getMOTD(id) {
        return this._motd[id] || null;
    },

    getNarrativeOutput(id) {
        return this._narrativeOutputs[id] || null;
    },

    getHistoryPatch() {
        return this._historyPatch;
    },

    // Clear loaded state (called during version reset).
    // Cache persists — manifests don't need re-fetching on reboot.
    reset() {
        this._loaded = [];
        this._helpDescs = {};
        this._sequences = {};
        this._packages = [];
        this._profiles = {};
        this._motd = {};
        this._narrativeOutputs = {};
        this._historyPatch = [];
    },
};

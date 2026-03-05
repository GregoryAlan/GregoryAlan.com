// ─── Ambient Behavior Timer ─────────────────────────────────
//
// Timer interrupt controller for background narrative events.
// One master setInterval tick evaluates registered behaviors
// against kernel state and fires effects. Only activates
// post-contact at v2.0+.
//
// spec: NONE — needs storyline document
//
// Depends on: kernel.js (Kernel), terminal.js (Terminal),
//             glitch.js (runGlitchEffect), shell.js (Shell)

const Ambient = {
    _timerId: null,
    _tickInterval: 5000,
    _behaviors: [],
    _lastFired: {},
    _startTime: null,
    _suspended: false,
    _suspendTimer: null,
    _daemonTicks: 0,

    register(def) {
        this._behaviors.push(def);
    },

    start() {
        if (this._timerId) return;
        this._startTime = Date.now();
        this._registerDefaultBehaviors();
        this._timerId = setInterval(() => this._tick(), this._tickInterval);
    },

    stop() {
        if (this._timerId) {
            clearInterval(this._timerId);
            this._timerId = null;
        }
        if (this._suspendTimer) {
            clearTimeout(this._suspendTimer);
            this._suspendTimer = null;
        }
    },

    reset() {
        this.stop();
        this._behaviors = [];
        this._lastFired = {};
        this._startTime = null;
        this._suspended = false;
        this._daemonTicks = 0;
        this.start();
    },

    suspend() {
        this._suspended = true;
        if (this._suspendTimer) clearTimeout(this._suspendTimer);
        this._suspendTimer = setTimeout(() => {
            this._suspended = false;
            this._suspendTimer = null;
        }, 3000);
    },

    _tick() {
        // Skip during typing
        if (this._suspended) return;
        // Skip during boot/crash animations
        if (Terminal._animating) return;
        // Skip while async foreground process is running
        if (Kernel.proc.foreground()) return;

        const now = Date.now();
        const version = Kernel.driver.getVersion();
        const hasContact = !!Kernel.driver.flags.contact;

        for (const b of this._behaviors) {
            // Apply jitter: effective interval varies ±jitter fraction
            const jitter = b.jitter || 0;
            const jitterMs = b.interval * jitter * (Math.random() * 2 - 1);
            const effectiveInterval = b.interval + jitterMs;
            const last = this._lastFired[b.id] || 0;

            if (now - last < effectiveInterval) continue;

            // Gate: all default behaviors require v2.0+ post-contact
            if (b.gate && !b.gate(version, hasContact)) continue;

            this._lastFired[b.id] = now;

            if (b.effect) {
                runGlitchEffect(b.effect, b.effectOpts || {});
            }
            if (b.action) {
                b.action();
            }
        }
    },

    _registerDefaultBehaviors() {
        const postContact = (ver, contact) => ver >= 2.0 && contact;

        this.register({
            id: 'crt-drift',
            effect: 'crtBand',
            interval: 45000,
            jitter: 0.3,
            gate: postContact,
        });

        this.register({
            id: 'phantom-whisper',
            effect: 'phantomLine',
            effectOpts: {
                texts: [
                    'rf0: rx idle (listening)',
                    'gregd[847]: cycle complete',
                    'gregd[847]: exit 847 — anomaly logged',
                    'rf0: signal strength 0.000 dBm',
                    'gregd: chain realignment pending',
                    'audit: entropy pool unchanged for 847+ ticks',
                ],
            },
            interval: 90000,
            jitter: 0.4,
            gate: postContact,
        });

        this.register({
            id: 'prompt-micro',
            effect: 'promptCorruption',
            interval: 120000,
            jitter: 0.5,
            gate: (ver, contact) => {
                if (!postContact(ver, contact)) return false;
                // Skip during su sessions — prompt identity is already altered
                if (Shell._activeProfile) return false;
                return true;
            },
        });

        this.register({
            id: 'daemon-tick',
            interval: 60000,
            jitter: 0.1,
            gate: postContact,
            action: () => { this._daemonTicks++; },
        });
    },
};

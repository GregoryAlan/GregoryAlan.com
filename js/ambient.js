// ─── Ambient Behavior Timer ─────────────────────────────────
//
// Timer interrupt controller for background narrative events.
// One master setInterval tick evaluates registered behaviors
// against kernel state and fires effects. Version-gated:
// v1.0 CRT noise, v1.1 system heartbeat, v2.0 daemon pulse,
// v2.0 post-contact phantom whispers + prompt corruption.
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

        // v1.0: lone CRT band — stillness is the atmosphere
        this.register({
            id: 'rom-crt-noise',
            effect: 'crtBand',
            interval: 240000,
            jitter: 0.4,
            gate: (ver) => ver < 1.1,
        });

        // v1.1: system heartbeat — gentle Unix background
        this.register({
            id: 'system-heartbeat',
            effect: 'systemLine',
            effectOpts: {
                texts: [
                    'sshd[47]: Connection from 192.168.1.1 port 22847 on 0.0.0.0 port 22',
                    'sshd[47]: Disconnected from authenticating user root 192.168.1.1 port 22847',
                    'CRON[63]: (root) CMD (/usr/sbin/logrotate /etc/logrotate.conf)',
                    'ntpd[92]: Soliciting pool server 129.6.15.28',
                    'ntpd[92]: adjusting local clock by 0.000847s',
                    'postfix/qmgr[108]: 847F2A0001: removed',
                ],
            },
            interval: 150000,
            jitter: 0.4,
            gate: (ver) => ver >= 1.1 && ver < 2.0,
        });

        // v1.1: workstation CRT — paired with heartbeat
        this.register({
            id: 'workstation-crt',
            effect: 'crtBand',
            interval: 300000,
            jitter: 0.3,
            gate: (ver) => ver >= 1.1 && ver < 2.0,
        });

        // v2.0 pre-contact: daemon pulse — active pipeline
        this.register({
            id: 'daemon-pulse',
            effect: 'systemLine',
            effectOpts: {
                texts: [
                    'gregd[847]: cycle complete | rf0|shift|remap|align|exec | exit 847 | 847 bytes',
                    'gregd[848]: cycle complete | rf0|shift|remap|exec | exit 0 | 512 bytes',
                    'gregd[849]: cycle complete | rf0|remap|align|exec | exit 0 | 847 bytes',
                    'gregd[850]: cycle complete | rf0|shift|align | exit 0 | 256 bytes',
                    'entropy-check: pool 3847, refill nominal',
                    'gregd[847]: cycle complete | rf0|shift|remap|align|exec | exit 847 | 847 bytes',
                ],
            },
            interval: 90000,
            jitter: 0.3,
            gate: (ver, contact) => ver >= 2.0 && !contact,
        });

        // v2.0 post-contact: CRT drift — escalated frequency
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

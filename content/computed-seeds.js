// ─── Computed Narrative Seeds ────────────────────────────────
//
// Dynamic tree files that use Date.now(), Math.random(), or
// conditional HTML spans. Cannot be expressed as static JSON.
//
// Loaded by versions.js during v2.0 apply().
//
// Depends on: nothing (pure functions of driver state)

const computedNarrativeSeeds = {

    // spec: NARRATIVE-SEEDS.md > Thread 1 > /proc/daemons
    '/proc/daemons': (state) => {
        const epoch = new Date('2025-10-15T00:00:00Z').getTime();
        const now = Date.now();
        const ms = now - epoch;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const up = h + 'h' + String(m).padStart(2, '0') + 'm';
        const ambientTicks = (typeof Ambient !== 'undefined') ? Ambient._daemonTicks : 0;
        const cycles = Math.floor(h * 60) + ambientTicks;
        const lastSec = Math.floor(Math.random() * 60);
        const last = new Date(now - lastSec * 1000)
            .toISOString().replace('T', ' ').substring(0, 19);

        let out = 'DAEMON  PID   STARTED              UPTIME       CHAIN                         STATUS\n'
            + 'gregd   847   2025-10-15 00:00     ' + up + '   rf0|shift|remap|align|exec    running\n'
            + 'gregd   848   2025-10-15 00:00     ' + up + '   rf0|shift|remap|exec          running\n'
            + 'gregd   849   2025-10-15 00:00     ' + up + '   rf0|remap|align|exec          running\n'
            + 'gregd   850   2025-10-15 00:00     ' + up + '   rf0|shift|align               running\n'
            + '\n4 daemons active, 0 stopped\n'
            + 'cycles completed: ' + cycles + '\n'
            + 'last exec: ' + last;

        if (state.flags.contact) {
            out += '\n\nNOTE: chain 847 exit code anomaly \u2014 see /var/log/daemon.log';
        }
        return out;
    },

    // spec: NARRATIVE-SEEDS.md > Thread 1 > /var/log/daemon.log
    '/var/log/daemon.log': (state) => {
        const epoch = new Date('2025-10-15T00:00:00Z').getTime();
        const ambientTicks = (typeof Ambient !== 'undefined') ? Ambient._daemonTicks : 0;
        const cycles = Math.floor((Date.now() - epoch) / 60000) + ambientTicks;
        const base = cycles - 9;
        const mix = [847, 847, 847, 848, 847, 847, 849, 847, 850, 847];
        const chains = {
            847: 'rf0|shift|remap|align|exec',
            848: 'rf0|shift|remap|exec      ',
            849: 'rf0|remap|align|exec      ',
            850: 'rf0|shift|align           ',
        };
        const sizes = { 847: 847, 848: 512, 849: 847, 850: 256 };

        let out = '';
        for (let i = 0; i < 10; i++) {
            const pid = mix[i];
            out += '[gregd:' + pid + '] cycle ' + (base + i)
                + ' | ' + chains[pid]
                + ' | exit 0 | ' + sizes[pid] + ' bytes\n';
        }

        if (state.flags.contact) {
            const postBase = base + 10;
            const exits = [847, 0, 0, 847, 0, 847, 0, 0, 847];
            for (let i = 0; i < exits.length; i++) {
                out += '[gregd:847] cycle ' + (postBase + i)
                    + ' | ' + chains[847]
                    + ' | exit ' + exits[i] + ' | 847 bytes\n';
            }
            out += 'NOTE: exit code distribution for chain 847 non-uniform (p < 0.001)\n'
                + 'NOTE: clustering detected \u2014 see /home/greg/bin/exec --analyze';
        }

        // Append ambient log entries that accumulated over time
        if (typeof Ambient !== 'undefined' && Ambient._daemonLogBuffer) {
            for (const entry of Ambient._daemonLogBuffer) {
                out += '\n' + entry;
            }
        }

        return out.trimEnd();
    },

    // spec: NARRATIVE-SEEDS.md > Thread 2 > /proc/entropy_avail
    '/proc/entropy_avail': (state) => {
        const drift = (typeof Ambient !== 'undefined') ? (Ambient._entropyDrift || 0) : 0;
        const jitter = Math.floor(Math.random() * 13) - 6;
        const pool = 3847 + jitter - Math.floor(drift);
        let out = 'entropy pool: ' + pool + '\n'
            + 'source: rf0 (hw)\n'
            + 'refill rate: 847.0 bytes/sec\n'
            + 'pool low watermark: 256\n'
            + 'pool high watermark: 4096';
        if (state.flags.contact) {
            out += '\n\nWARNING: pool has not reached low watermark in 847+ hours';
        }
        return out;
    },

    // spec: NARRATIVE-SEEDS.md > Thread 3 > /var/log/kern.log
    '/var/log/kern.log': (state) => {
        let out = '[    0.000000] gregos-kernel 0.9.851 #851 SMP\n'
            + '[    0.001203] CPU: x86_64 detected\n'
            + '[    0.012847] Memory: 512MB available\n'
            + '[    0.024100] gregfs: mounted / (rw)\n'
            + '[    0.031000] dev: /dev/null registered\n'
            + '[    0.031200] dev: /dev/zero registered\n'
            + '[    0.031400] dev: /dev/random registered\n'
            + '[    0.032000] dev: /dev/entropy registered (rf0 hw backing)\n'
            + '[    0.033000] init: starting services\n'
            + '[    0.040000] svc: sshd started\n'
            + '[    0.041000] svc: cron started\n'
            + '[    0.042000] svc: gregd started (4 daemons)\n'
            + '[    0.050000] login: guest session opened on tty1';
        if (state.flags.contact) {
            out += '\n[  847.000000] rf0: rx ring overrun (847 bytes not consumed)\n'
                + '[  847.000001] rf0: unexpected exec in rx buffer\n'
                + '[  847.000003] audit: pid=0 comm=(unknown) ppid=0\n'
                + '[  847.000005] dev: /dev/signal registered (no hw backing)\n'
                + '[  847.000007] rf0: <span style="color:#f55">connection from 0.0.0.0</span>\n'
                + '[  847.000009] PID 0: <span style="color:#f55">fork() from swapper \u2014 illegal in user context</span>';
        }

        // Append ambient escalation entries
        if (typeof Ambient !== 'undefined' && Ambient._kernLogEntries) {
            for (const entry of Ambient._kernLogEntries) {
                out += '\n' + entry;
            }
        }

        return out;
    },
};

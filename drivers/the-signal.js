// ─── The Signal Driver ───────────────────────────────────────
//
// spec: the-signal-storyline.md
//
// A Cuckoo's Egg storyline: discover a stale RF buffer dump,
// accidentally execute its payload, watch a remote node connect,
// realize you're no longer alone.
//
// Depends on: kernel.js (Kernel), terminal.js (Terminal)

// Simulate display corruption: each source character's code
// is shifted by a small random offset, producing text-shaped
// garbage that looks like it was almost readable.
function garble(len) {
    const base = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < len; i++) {
        const c = base.charCodeAt(Math.floor(Math.random() * base.length));
        s += String.fromCharCode(c + Math.floor(Math.random() * 7) - 3);
    }
    return s;
}

const theSignalDriver = {
    id: 'the-signal',

    stateMap: {
        'idle': {
            transitions: { 'rf0-mount-failed': 'buffer-dumped' }
        },
        'buffer-dumped': {
            flags: { 'rf0-crashed': true },
            transitions: { 'rf-found': 'signal-found' }
        },
        'signal-found': {
            transitions: { 'rf-executed': 'relay-active' }
        },
        'relay-active': {
            flags: { 'contact': true },
            transitions: { 'contact-made': 'contact' }
        },
        'contact': {
            flags: { 'contact': true },
            transitions: {
                'not-alone': 'investigating',
                'intruder-finger': 'investigating',
                'intruder-last': 'investigating',
                'rf-strings': 'investigating'
            }
        },
        'investigating': {
            flags: { 'contact': true },
            transitions: {
                'not-alone': 'investigating',
                'intruder-finger': 'investigating',
                'intruder-last': 'investigating',
                'rf-strings': 'investigating'
            }
        }
    },

    // Static files (.rf0.buf, /proc/0/*) loaded from content/signal-hunt.json manifest
    // Only computed hidden files stay here
    files: {
        text: {},
        hidden: {
            '.node': {
                gate: 'contact-made',
                content: () => 'Proto  Local Address          Foreign Address        State       PID\n'
                    + 'rf0    guest@tty1              ' + garble(8) + '@tty0           ESTABLISHED 0\n\n'
                    + 'connected ' + new Date().toLocaleString() + '\n'
                    + 'rtt <span class="timestamp-anomaly">-3ms</span>\n'
                    + 'rx 847 bytes  tx 0 bytes'
            },
        },
    },

    treeFiles: {},

    directories: {},

    // spec: the-signal-storyline.md > Act 5: Not Alone (ps, w, last, dmesg)
    // spec: the-signal-storyline.md > Act 3: Accidental Execution (decode)
    // spec: the-signal-storyline.md > Act 5: Not Alone (strings)
    // finger: removed — greg-corp.js owns the superset (profiles + root + guest)
    commands: {
        ps: (args) => {
            const base = v1_1CommandsPack.commands.ps(args);
            if ((args === 'aux' || args === '-aux') && Kernel.driver.flags.contact) {
                return base + '\n<span class="timestamp-anomaly">???     0  0.0  0.0      0     0 tty0 R    /dev/rf0</span>';
            }
            return base;
        },

        w: (args) => {
            const now = new Date();
            const h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            const u = Shell.env.USER;
            const uPad = u.padEnd(8);

            if (Kernel.driver.flags.contact) {
                Kernel.driver.discover('not-alone');
                return ' ' + h + ':' + m + ' up 1 day, 3:14, 2 users, load average: 0.00, 0.01, 0.05\n'
                    + 'USER     TTY      FROM             LOGIN@   IDLE   WHAT\n'
                    + uPad + ' tty1     -                ' + h + ':' + m + '   0.00s  /bin/bash\n'
                    + '???      tty0     0.0.0.0          03:14    0.00s  /dev/rf0';
            }

            Kernel.driver.discover('checked-alone');
            return ' ' + h + ':' + m + ' up 1 day, 3:14, 1 user, load average: 0.00, 0.01, 0.05\n'
                + 'USER     TTY      FROM             LOGIN@   IDLE   WHAT\n'
                + uPad + ' tty1     -                ' + h + ':' + m + '   0.00s  /bin/bash';
        },

        last: (args) => {
            const now = new Date();
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const d = months[now.getMonth()] + ' ' + String(now.getDate()).padStart(2);
            const t = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
            const u = Shell.env.USER.padEnd(8);

            if (Kernel.driver.flags.contact) {
                Kernel.driver.discover('intruder-last');
                return u + ' tty1         ' + d + ' ' + t + '   still logged in\n'
                    + '<span class="timestamp-anomaly">???      tty0         Jan  0 00:00  - still logged in</span>\n\n'
                    + 'wtmp begins ' + d + ' 00:00:00';
            }

            return u + ' tty1         ' + d + ' ' + t + '   still logged in\n\n'
                + 'wtmp begins ' + d + ' 00:00:00';
        },

        // dmesg reads the kernel ring buffer — same content as /var/log/kern.log
        dmesg: () => Kernel.fs.read('/var/log/kern.log'),

        decode: (args, stdin) => {
            const parts = (args || '').split(/\s+/).filter(Boolean);
            const data = parts.slice(1).join('') || (stdin ? stdin.trim() : '');
            if (parts[0] === '--hex' && data.toLowerCase().startsWith('4e4f524d')) {
                Kernel.driver.discover('rf-executed');
                return Kernel.fs.read('signal:decode-output');
            }
            return binTools.commands.decode(args, stdin);
        },

        strings: (args, stdin) => {
            if (!stdin && args === '.rf0.buf') {
                Kernel.driver.discover('rf-strings');
                return Kernel.fs.read('signal:strings-output');
            }
            return binTools.commands.strings(args, stdin);
        },
    },

    // spec: the-signal-storyline.md > Discovery Chain
    triggers: [
        // Act 1 — Discovery
        { type: 'discovery', match: 'rf-found', effect: 'screenFlicker', once: true },

        // Act 3 — Accidental Execution → Connection Sequence
        { type: 'discovery', match: 'rf-executed', effect: 'heavyFlicker', once: true,
            callback: (state) => {
                state.setFlag('contact', true);

                const messages = ManifestLoader.getSequence('signal-connect');
                messages.forEach(({ text, delay }) => {
                    setTimeout(() => {
                        Terminal.appendSystemLine(text);
                    }, delay);
                });

                // Act 4 climax — "hello?"
                setTimeout(() => {
                    Terminal.appendSystemLine('<span style="color:#5f5">hello?</span>');
                    state.discover('contact-made');
                }, 16000);
            }
        },

        // Act 4 — Contact made
        { type: 'discovery', match: 'contact-made', effect: 'scanlines', effectOpts: { persistent: true }, once: true,
            callback: (state) => { document.body.style.backgroundColor = '#0a0d0a'; }
        },

        // Act 5 — Investigation
        { type: 'discovery', match: 'not-alone', effect: 'crtBand', once: true },
        { type: 'discovery', match: 'intruder-finger', effect: 'promptCorruption', once: true },
        { type: 'discovery', match: 'intruder-last', effect: 'screenTear', once: true },
        { type: 'discovery', match: 'rf-strings', effect: 'textCorruption', once: true },
    ],

    patches: {
        hiddenFiles: {
            '.bash_history': (existing) => {
                if (!Kernel.driver.has('rf0-mount-failed')) return existing;
                const extra = [
                    'dmesg',
                    'cat .rf0.buf',
                    'strings .rf0.buf',
                    'decode --hex 4e4f524d',
                ];
                const lines = existing.split('\n');
                const nextNum = lines.length + 1;
                const newLines = extra.map((cmd, i) => '  ' + (nextNum + i) + '  ' + cmd);
                return lines.concat(newLines).join('\n');
            }
        }
    },

    restore(state) {
        if (state.flags.contact) {
            runGlitchEffect('scanlines', { persistent: true });
            document.body.style.backgroundColor = '#0a0d0a';
        }
    },
};

Kernel.driver.declareDriver(theSignalDriver);

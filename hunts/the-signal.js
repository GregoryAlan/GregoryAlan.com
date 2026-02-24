// ─── The Signal Hunt ─────────────────────────────────────────
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

const theSignalHunt = {
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

    // Static files (.rf0.buf, /proc/0/*) loaded from content/signal-hunt.json
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

    // spec: the-signal-storyline.md > Act 5: Not Alone (ps, w, finger, last, dmesg)
    // spec: the-signal-storyline.md > Act 3: Accidental Execution (decode)
    // spec: the-signal-storyline.md > Act 5: Not Alone (strings)
    commands: {
        ps: (args) => {
            const basic =
                'PID TTY      TIME CMD\n'
              + '  1 tty1 00:00:00 init\n'
              + `${String(Math.floor(Math.random()*800)+100).padStart(3)} tty1 00:00:00 bash\n`
              + `${String(Math.floor(Math.random()*800)+100).padStart(3)} tty1 00:00:00 ps`;

            if (args === 'aux' || args === '-aux') {
                const u = Shell.env.USER;
                let out = 'USER  PID %CPU %MEM    VSZ   RSS TTY  STAT CMD\n'
                     + 'root    1  0.0  0.1   4372  1024 ?    Ss   init\n'
                     + 'root    2  0.0  0.0      0     0 ?    S    [kthreadd]\n'
                     + 'root   47  0.0  0.1   7232  1536 ?    Ss   sshd\n'
                     + 'root   63  0.0  0.0   3024   512 ?    Ss   cron\n'
                     + u + ' '.repeat(Math.max(1, 6 - u.length)) + '184  0.0  0.2   5648  2048 tty1 Ss   bash\n'
                     + u + ' '.repeat(Math.max(1, 6 - u.length)) + '201  0.0  0.1   3472   768 tty1 R+   ps aux';
                if (Kernel.hunt.flags.contact) {
                    out += '\n<span class="timestamp-anomaly">???     0  0.0  0.0      0     0 tty0 R    /dev/rf0</span>';
                }
                return out;
            }
            return basic;
        },

        w: (args) => {
            const now = new Date();
            const h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            const u = Shell.env.USER;
            const uPad = u.padEnd(8);

            if (Kernel.hunt.flags.contact) {
                Kernel.hunt.discover('not-alone');
                return ' ' + h + ':' + m + ' up 1 day, 3:14, 2 users, load average: 0.00, 0.01, 0.05\n'
                    + 'USER     TTY      FROM             LOGIN@   IDLE   WHAT\n'
                    + uPad + ' tty1     -                ' + h + ':' + m + '   0.00s  /bin/bash\n'
                    + '???      tty0     0.0.0.0          03:14    0.00s  /dev/rf0';
            }

            Kernel.hunt.discover('checked-alone');
            return ' ' + h + ':' + m + ' up 1 day, 3:14, 1 user, load average: 0.00, 0.01, 0.05\n'
                + 'USER     TTY      FROM             LOGIN@   IDLE   WHAT\n'
                + uPad + ' tty1     -                ' + h + ':' + m + '   0.00s  /bin/bash';
        },

        finger: (args) => {
            if (args === 'root') {
                if (Kernel.hunt.flags.contact) {
                    Kernel.hunt.discover('intruder-finger');
                    return 'Login: root                             Name: ' + garble(12) + '\n'
                        + 'Directory: /dev/null                    Shell: /dev/null\n'
                        + 'Last login: <span class="timestamp-anomaly">Jan  0 00:00</span> from <span class="timestamp-anomaly">0.0.0.0</span>\n'
                        + 'No mail.\n'
                        + 'No plan.';
                }
                return 'finger: root: no such user';
            }
            if (args === 'guest') {
                return 'Login: guest                            Name: Visitor\n'
                    + 'Directory: /home/guest                  Shell: /bin/bash\n'
                    + 'Last login: ' + new Date().toDateString() + '\n'
                    + 'No plan.';
            }
            if (!args) return 'Usage: finger [username]';
            return 'finger: ' + args + ': no such user';
        },

        last: (args) => {
            const now = new Date();
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const d = months[now.getMonth()] + ' ' + String(now.getDate()).padStart(2);
            const t = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
            const u = Shell.env.USER.padEnd(8);

            if (Kernel.hunt.flags.contact) {
                Kernel.hunt.discover('intruder-last');
                return u + ' tty1         ' + d + ' ' + t + '   still logged in\n'
                    + '<span class="timestamp-anomaly">???      tty0         Jan  0 00:00  - still logged in</span>\n\n'
                    + 'wtmp begins ' + d + ' 00:00:00';
            }

            return u + ' tty1         ' + d + ' ' + t + '   still logged in\n\n'
                + 'wtmp begins ' + d + ' 00:00:00';
        },

        dmesg: (args) => {
            let out = '[    0.000000] gregos-kernel 0.9.851 #851 SMP\n'
                + '[    0.001203] CPU: x86_64 detected\n'
                + '[    0.012847] Memory: 512MB available\n'
                + '[    0.024100] gregfs: mounted / (rw)\n'
                + '[    0.031000] dev: /dev/null registered\n'
                + '[    0.031200] dev: /dev/zero registered\n'
                + '[    0.031400] dev: /dev/random registered\n'
                + '[    0.032000] dev: /dev/entropy registered (rf0 hw backing)';

            if (Kernel.hunt.flags.contact) {
                out += '\n[  847.000000] rf0: device registered\n'
                    + '[  847.000001] rf0: rx ring overrun (847 bytes not consumed)\n'
                    + '[  847.000003] audit: pid=0 comm=(unknown) ppid=0\n'
                    + '[  847.000005] rf0: tx 847 bytes to 0.0.0.0:4119\n'
                    + '[  847.000007] rf0: <span style="color:#f55">connection from 0.0.0.0</span>\n'
                    + '[  847.000009] PID 0: <span style="color:#f55">state=running (no controlling tty)</span>';
            }

            return out;
        },

        decode: (args, stdin) => {
            if (!args && !stdin) return 'Usage: decode --hex &lt;data&gt; | decode --b64 &lt;data&gt;';
            const parts = (args || '').split(/\s+/).filter(Boolean);
            const flag = parts[0];
            const data = parts.slice(1).join('') || (stdin ? stdin.trim() : '');

            if (flag === '--hex') {
                if (data.toLowerCase().startsWith('4e4f524d')) {
                    Kernel.hunt.discover('rf-executed');
                    return 'Decoding hex...\n\n'
                        + 'ELF binary detected in input\n'
                        + 'mapped segment at 0x847\n'
                        + '<span style="color:#f55">segfault at 0x847: unexpected exec in rx buffer</span>';
                }
                try {
                    const decoded = data.match(/.{2}/g).map(h => String.fromCharCode(parseInt(h, 16))).join('');
                    return 'Decoding hex...\n\n> ' + decoded;
                } catch(e) {
                    return 'decode: invalid hex data';
                }
            }

            if (flag === '--b64') {
                try {
                    return 'Decoding base64...\n\n> ' + atob(data);
                } catch(e) {
                    return 'decode: invalid base64 data';
                }
            }

            return 'decode: unknown flag. Use --hex or --b64';
        },

        strings: (args, stdin) => {
            if (stdin) {
                const matches = stdin.match(/[\x20-\x7E]{4,}/g);
                return matches ? matches.join('\n') : '';
            }
            if (!args) return 'Usage: strings &lt;file&gt;';
            if (args === '.rf0.buf') {
                Kernel.hunt.discover('rf-strings');
                return 'Extracting readable strings from .rf0.buf...\n\n'
                    + 'ELF\n'
                    + 'NORMAL SYSTEM OPERATION IS A LIE\n'
                    + 'relay --target=0.0.0.0:4119 --persist\n'
                    + '/dev/rf0\n'
                    + '/dev/null\n'
                    + 'PID 0\n'
                    + 'handshake';
            }
            return 'strings: ' + args + ': No such file';
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

                const messages = [
                    { text: 'rf0: connecting to 0.0.0.0:4119', delay: 2000 },
                    { text: 'rf0: SYN sent ................ ACK', delay: 4500 },
                    { text: 'rf0: connection pending', delay: 7000 },
                    { text: 'rf0: connection established from 0.0.0.0', delay: 10000 },
                    { text: 'rf0: session opened on tty0', delay: 12000 },
                ];

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
                if (!Kernel.hunt.has('rf0-mount-failed')) return existing;
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

Kernel.hunt.declareHunt(theSignalHunt);

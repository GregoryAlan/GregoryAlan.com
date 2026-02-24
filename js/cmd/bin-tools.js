// ─── ~/bin Tools ────────────────────────────────────────────
//
// Small utilities "written by Greg" at various points in his
// education and career. Each one works as a real terminal command
// and has a man page with an AUTHOR line that dates it.
//
// Load order: this file registers base implementations, then
// driver scripts (the-signal.js) override decode/strings with
// driver-aware versions.

const binTools = {
    directories: {
        bin: {
            'decode': 'file',
            'rot13': 'file',
            'freq': 'file',
            'entropy': 'file',
            'crc': 'file',
            'strings': 'file',
        }
    },

    commands: {
        decode: (args, stdin) => {
            if (!args && !stdin) return 'Usage: decode --hex &lt;data&gt; | decode --b64 &lt;data&gt;';
            const parts = (args || '').split(/\s+/).filter(Boolean);
            const flag = parts[0];
            const data = parts.slice(1).join('') || (stdin ? stdin.trim() : '');

            if (flag === '--hex') {
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

        rot13: (args, stdin) => {
            const text = args || (stdin ? stdin.trim() : '');
            if (!text) return 'Usage: rot13 &lt;text&gt;';
            const result = text.replace(/[a-zA-Z]/g, (c) => {
                const base = c <= 'Z' ? 65 : 97;
                return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
            });
            return result;
        },

        freq: (args, stdin) => {
            const text = args || (stdin ? stdin.trim() : '');
            if (!text) return 'Usage: freq &lt;text&gt;';
            const counts = {};
            let total = 0;
            for (const c of text) {
                if (/[a-zA-Z]/.test(c)) {
                    const lower = c.toLowerCase();
                    counts[lower] = (counts[lower] || 0) + 1;
                    total++;
                }
            }
            if (total === 0) return 'freq: no alphabetic characters in input';

            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const maxCount = sorted[0][1];
            const barWidth = 20;

            const lines = sorted.map(([ch, count]) => {
                const pct = ((count / total) * 100).toFixed(1);
                const barLen = Math.round((count / maxCount) * barWidth);
                const bar = '\u2588'.repeat(barLen);
                return `  ${ch}  ${bar} ${count} (${pct}%)`;
            });

            return `Letter frequency (${total} chars):\n\n` + lines.join('\n');
        },

        entropy: (args, stdin) => {
            const text = args || (stdin ? stdin.trim() : '');
            if (!text) return 'Usage: entropy &lt;text&gt;';
            const counts = {};
            for (const c of text) {
                counts[c] = (counts[c] || 0) + 1;
            }
            const len = text.length;
            let h = 0;
            for (const c in counts) {
                const p = counts[c] / len;
                h -= p * Math.log2(p);
            }
            const unique = Object.keys(counts).length;
            const maxEntropy = Math.log2(unique) || 0;
            return `Shannon entropy: ${h.toFixed(4)} bits/symbol\n`
                + `Length: ${len} symbols\n`
                + `Unique: ${unique}\n`
                + `Max possible: ${maxEntropy.toFixed(4)} bits/symbol`;
        },

        crc: (args, stdin) => {
            const text = args || (stdin ? stdin.trim() : '');
            if (!text) return 'Usage: crc &lt;text&gt;';
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < text.length; i++) {
                crc ^= text.charCodeAt(i);
                for (let j = 0; j < 8; j++) {
                    crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
                }
            }
            crc = (crc ^ 0xFFFFFFFF) >>> 0;
            return crc.toString(16).padStart(8, '0');
        },

        strings: (args, stdin) => {
            if (stdin) {
                const matches = stdin.match(/[\x20-\x7E]{4,}/g);
                return matches ? matches.join('\n') : '';
            }
            if (!args) return 'Usage: strings &lt;file&gt;';
            return 'strings: ' + args + ': No such file';
        },
    },

    // Man pages loaded from content/man-pages.json
};

// ─── ~/bin Tools ────────────────────────────────────────────
//
// Small utilities "written by Greg" at various points in his
// education and career. Each one works as a real terminal command
// and has a man page with an AUTHOR line that dates it.
//
// Load order: this file registers base implementations, then
// hunt scripts (the-signal.js) override decode/strings with
// hunt-aware versions.

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
        decode: (args) => {
            if (!args) return 'Usage: decode --hex &lt;data&gt; | decode --b64 &lt;data&gt;';
            const parts = args.split(/\s+/);
            const flag = parts[0];
            const data = parts.slice(1).join('');

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

        rot13: (args) => {
            if (!args) return 'Usage: rot13 &lt;text&gt;';
            const result = args.replace(/[a-zA-Z]/g, (c) => {
                const base = c <= 'Z' ? 65 : 97;
                return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
            });
            return result;
        },

        freq: (args) => {
            if (!args) return 'Usage: freq &lt;text&gt;';
            const counts = {};
            let total = 0;
            for (const c of args) {
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

        entropy: (args) => {
            if (!args) return 'Usage: entropy &lt;text&gt;';
            const counts = {};
            for (const c of args) {
                counts[c] = (counts[c] || 0) + 1;
            }
            const len = args.length;
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

        crc: (args) => {
            if (!args) return 'Usage: crc &lt;text&gt;';
            // CRC32 implementation
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < args.length; i++) {
                crc ^= args.charCodeAt(i);
                for (let j = 0; j < 8; j++) {
                    crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
                }
            }
            crc = (crc ^ 0xFFFFFFFF) >>> 0;
            return crc.toString(16).padStart(8, '0');
        },

        strings: (args) => {
            if (!args) return 'Usage: strings &lt;file&gt;';
            return 'strings: ' + args + ': No such file';
        },
    },

    manPages: {
        decode: 'DECODE(1)                    GregOS Manual                    DECODE(1)\n\n'
            + 'NAME\n'
            + '       decode - convert hex or base64 to ASCII\n\n'
            + 'SYNOPSIS\n'
            + '       decode --hex &lt;string&gt;\n'
            + '       decode --b64 &lt;string&gt;\n\n'
            + 'DESCRIPTION\n'
            + '       decode takes a string of hex digits or a base64-encoded\n'
            + '       string and prints the ASCII representation to standard\n'
            + '       output. Each pair of hex digits is treated as one byte.\n'
            + '       Input that is not valid hex or base64 will produce an\n'
            + '       error.\n\n'
            + 'OPTIONS\n'
            + '       --hex   Read input as hexadecimal. Each pair of characters\n'
            + '               (0-9, a-f) is converted to one ASCII character.\n'
            + '               For example, 41 = "A", 7a = "z".\n\n'
            + '       --b64   Read input as base64.\n\n'
            + 'EXAMPLES\n'
            + '       $ decode --hex 48656c6c6f\n'
            + '       Hello\n\n'
            + '       $ decode --hex 4f4b\n'
            + '       OK\n\n'
            + 'AUTHOR\n'
            + '       Gregory Alan, CS 240 Fall 2009\n\n'
            + 'BUGS\n'
            + '       None known.',

        rot13: 'ROT13(1)                     GregOS Manual                     ROT13(1)\n\n'
            + 'NAME\n'
            + '       rot13 - rotate ASCII letters by 13 positions\n\n'
            + 'SYNOPSIS\n'
            + '       rot13 &lt;text&gt;\n\n'
            + 'DESCRIPTION\n'
            + '       rot13 applies the ROT13 substitution cipher to the input\n'
            + '       text. Each letter is replaced by the letter 13 positions\n'
            + '       after it in the alphabet, wrapping around from z to a.\n'
            + '       Non-alphabetic characters are passed through unchanged.\n\n'
            + '       ROT13 is its own inverse: applying it twice returns the\n'
            + '       original text. It is not encryption. It is not even close\n'
            + '       to encryption. Do not use this for anything important.\n\n'
            + 'EXAMPLES\n'
            + '       $ rot13 Hello\n'
            + '       Uryyb\n\n'
            + '       $ rot13 Uryyb\n'
            + '       Hello\n\n'
            + 'AUTHOR\n'
            + '       Gregory Alan, CS 101 Spring 2008\n\n'
            + 'BUGS\n'
            + '       None known.',

        freq: 'FREQ(1)                      GregOS Manual                      FREQ(1)\n\n'
            + 'NAME\n'
            + '       freq - display letter frequency histogram\n\n'
            + 'SYNOPSIS\n'
            + '       freq &lt;text&gt;\n\n'
            + 'DESCRIPTION\n'
            + '       freq counts the frequency of each alphabetic character in\n'
            + '       the input and displays a histogram sorted by frequency in\n'
            + '       descending order. Character counts and percentages are\n'
            + '       shown alongside each bar.\n\n'
            + '       Non-alphabetic characters are ignored. All comparisons\n'
            + '       are case-insensitive.\n\n'
            + 'EXAMPLES\n'
            + '       $ freq the quick brown fox\n'
            + '       (displays histogram)\n\n'
            + 'AUTHOR\n'
            + '       Gregory Alan, MATH 385 Fall 2010\n\n'
            + 'SEE ALSO\n'
            + '       entropy(1), rot13(1)',

        entropy: 'ENTROPY(1)                   GregOS Manual                   ENTROPY(1)\n\n'
            + 'NAME\n'
            + '       entropy - compute Shannon entropy of input\n\n'
            + 'SYNOPSIS\n'
            + '       entropy &lt;text&gt;\n\n'
            + 'DESCRIPTION\n'
            + '       entropy computes the Shannon entropy of the input string\n'
            + '       in bits per symbol. Higher entropy indicates more\n'
            + '       randomness or information content.\n\n'
            + '       Also reports: input length, number of unique symbols,\n'
            + '       and the theoretical maximum entropy for the observed\n'
            + '       alphabet size.\n\n'
            + 'EXAMPLES\n'
            + '       $ entropy aaaa\n'
            + '       Shannon entropy: 0.0000 bits/symbol\n\n'
            + '       $ entropy abcd\n'
            + '       Shannon entropy: 2.0000 bits/symbol\n\n'
            + 'AUTHOR\n'
            + '       Gregory Alan, CS 432 Spring 2011\n\n'
            + 'SEE ALSO\n'
            + '       freq(1)',

        crc: 'CRC(1)                       GregOS Manual                       CRC(1)\n\n'
            + 'NAME\n'
            + '       crc - compute CRC32 checksum\n\n'
            + 'SYNOPSIS\n'
            + '       crc &lt;text&gt;\n\n'
            + 'DESCRIPTION\n'
            + '       crc computes the CRC32 checksum of the input string and\n'
            + '       prints the result as an 8-digit hexadecimal value.\n\n'
            + '       Uses the standard CRC32 polynomial (0xEDB88320, reflected).\n\n'
            + 'EXAMPLES\n'
            + '       $ crc hello\n'
            + '       3610a686\n\n'
            + 'AUTHOR\n'
            + '       Gregory Alan, CS 372 Fall 2010\n\n'
            + 'SEE ALSO\n'
            + '       decode(1)',

        strings: 'STRINGS(1)                   GregOS Manual                   STRINGS(1)\n\n'
            + 'NAME\n'
            + '       strings - extract printable strings from files\n\n'
            + 'SYNOPSIS\n'
            + '       strings &lt;file&gt;\n\n'
            + 'DESCRIPTION\n'
            + '       strings scans the specified file and prints all sequences\n'
            + '       of printable characters that are at least 4 characters\n'
            + '       long. Useful for examining binary files.\n\n'
            + 'EXAMPLES\n'
            + '       $ strings /usr/bin/ls\n'
            + '       (printable strings from binary)\n\n'
            + 'AUTHOR\n'
            + '       Gregory Alan, Summer internship 2011\n\n'
            + 'SEE ALSO\n'
            + '       decode(1)',
    },
};

// Registration deferred to versions.js (applied at v2.0)

// ─── Argument Parser ────────────────────────────────────────
//
// Centralized argument parsing for all commands.
// Replaces ad-hoc splitting patterns (args.split(/\s+/),
// manual flag filtering, etc.) with a single canonical format.
//
// Depends on: nothing (loads before shell.js)

// valueFlags: optional array of single-char flags that consume the next
// token as their value (e.g. ['n'] for `head -n 3`). All other single-char
// flags are treated as boolean. This avoids the ambiguity where
// `grep -n 847 file` would incorrectly eat the pattern as -n's value.
function parseArgs(raw, valueFlags) {
    const _valueFlags = new Set(valueFlags || []);
    const result = {
        positional: [],
        flags: {},
        raw: raw || '',
    };

    if (!raw || !raw.trim()) {
        result._ = result.positional;
        return result;
    }

    // Tokenize: respect quoted strings, preserve bare '-'
    const tokens = [];
    let i = 0;
    const str = raw.trim();

    while (i < str.length) {
        // Skip whitespace
        if (str[i] === ' ' || str[i] === '\t') { i++; continue; }

        // Quoted string
        if (str[i] === '"' || str[i] === "'") {
            const quote = str[i];
            let token = '';
            i++; // skip opening quote
            while (i < str.length && str[i] !== quote) {
                token += str[i];
                i++;
            }
            i++; // skip closing quote
            tokens.push({ value: token, quoted: true });
            continue;
        }

        // Unquoted token
        let token = '';
        while (i < str.length && str[i] !== ' ' && str[i] !== '\t') {
            token += str[i];
            i++;
        }
        tokens.push({ value: token, quoted: false });
    }

    // Parse tokens into flags and positionals
    let bareDoubleDash = false;

    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];

        // After '--', everything is positional
        if (bareDoubleDash || tok.quoted) {
            result.positional.push(tok.value);
            continue;
        }

        // '--' separator
        if (tok.value === '--') {
            bareDoubleDash = true;
            continue;
        }

        // Bare '-' alone → positional (POSIX stdin convention)
        if (tok.value === '-') {
            result.positional.push('-');
            continue;
        }

        // --key=val
        if (tok.value.startsWith('--') && tok.value.includes('=')) {
            const eqIdx = tok.value.indexOf('=');
            const key = tok.value.slice(2, eqIdx);
            const val = tok.value.slice(eqIdx + 1);
            result.flags[key] = val;
            continue;
        }

        // --flag
        if (tok.value.startsWith('--')) {
            result.flags[tok.value.slice(2)] = true;
            continue;
        }

        // Short flags: -x, -la, -n 10 (if n is in valueFlags)
        if (tok.value.startsWith('-')) {
            const chars = tok.value.slice(1);
            if (chars.length === 1) {
                // Single short flag — only consume next token if declared as valueFlag
                if (_valueFlags.has(chars)) {
                    const next = tokens[t + 1];
                    if (next && !next.value.startsWith('-')) {
                        result.flags[chars] = next.value;
                        t++; // consume the value token
                    } else {
                        result.flags[chars] = true;
                    }
                } else {
                    result.flags[chars] = true;
                }
            } else {
                // Compound: -la → l=true, a=true
                for (const c of chars) {
                    result.flags[c] = true;
                }
            }
            continue;
        }

        // Everything else → positional
        result.positional.push(tok.value);
    }

    result._ = result.positional;
    return result;
}

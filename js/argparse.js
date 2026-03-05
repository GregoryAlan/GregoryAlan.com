// ─── Argument Parser ────────────────────────────────────────
//
// Centralized argument parsing for all commands.
// Replaces ad-hoc splitting patterns (args.split(/\s+/),
// manual flag filtering, etc.) with a single canonical format.
//
// Depends on: nothing (loads before shell.js)

// Shell-level tokenizer: single-pass character scanner that produces
// chain-aware pipeline structures. Handles double quotes (with backslash
// escapes), single quotes (literal), backslash escapes outside quotes,
// pipe splitting, command chaining (;, &&, ||), and I/O redirection
// operators (>, >>, <).
//
// Returns: { chains: Array<{ op: null|';'|'&&'|'||',
//            stages: Array<Array<{ value: string, quoted: boolean,
//                                  expandable: boolean, isOperator?: boolean }>> }> }
function shellTokenize(raw) {
    const chains = [{ op: null, stages: [[]] }];
    if (!raw || !raw.trim()) return { chains };

    const str = raw;
    let i = 0;

    const currentStage = () => {
        const chain = chains[chains.length - 1];
        return chain.stages[chain.stages.length - 1];
    };

    while (i < str.length) {
        // Skip whitespace between tokens
        if (str[i] === ' ' || str[i] === '\t') { i++; continue; }

        // Chain operators: ||, &&, ; (must check || before |)
        if (str[i] === '|' && i + 1 < str.length && str[i + 1] === '|') {
            chains.push({ op: '||', stages: [[]] });
            i += 2;
            continue;
        }
        if (str[i] === '&' && i + 1 < str.length && str[i + 1] === '&') {
            chains.push({ op: '&&', stages: [[]] });
            i += 2;
            continue;
        }
        if (str[i] === ';') {
            chains.push({ op: ';', stages: [[]] });
            i++;
            continue;
        }

        // Redirection operators: >>, >, <
        if (str[i] === '>' && i + 1 < str.length && str[i + 1] === '>') {
            currentStage().push({ value: '>>', isOperator: true });
            i += 2;
            continue;
        }
        if (str[i] === '>') {
            currentStage().push({ value: '>', isOperator: true });
            i++;
            continue;
        }
        if (str[i] === '<') {
            currentStage().push({ value: '<', isOperator: true });
            i++;
            continue;
        }

        // Pipe: start a new stage within current chain
        if (str[i] === '|') {
            chains[chains.length - 1].stages.push([]);
            i++;
            continue;
        }

        // Double-quoted string (expandable — $VAR will be resolved)
        if (str[i] === '"') {
            let token = '';
            i++; // skip opening quote
            while (i < str.length && str[i] !== '"') {
                if (str[i] === '\\' && i + 1 < str.length) {
                    const next = str[i + 1];
                    if (next === '"' || next === '\\') {
                        token += next;
                        i += 2;
                        continue;
                    }
                }
                token += str[i];
                i++;
            }
            i++; // skip closing quote
            currentStage().push({ value: token, quoted: true, expandable: true });
            continue;
        }

        // Single-quoted string (no escape processing, no expansion)
        if (str[i] === "'") {
            let token = '';
            i++; // skip opening quote
            while (i < str.length && str[i] !== "'") {
                token += str[i];
                i++;
            }
            i++; // skip closing quote
            currentStage().push({ value: token, quoted: true, expandable: false });
            continue;
        }

        // Unquoted token — stops at whitespace, pipe, and operator chars
        let token = '';
        let wasEscaped = false;
        while (i < str.length && str[i] !== ' ' && str[i] !== '\t'
               && str[i] !== '|' && str[i] !== ';'
               && str[i] !== '>' && str[i] !== '<') {
            // Stop at && (but not single &)
            if (str[i] === '&' && i + 1 < str.length && str[i + 1] === '&') break;
            // Backslash escape outside quotes
            if (str[i] === '\\' && i + 1 < str.length) {
                token += str[i + 1];
                wasEscaped = true;
                i += 2;
                continue;
            }
            // Quote starts mid-token: switch to quoted parsing and append
            if (str[i] === '"') {
                i++;
                while (i < str.length && str[i] !== '"') {
                    if (str[i] === '\\' && i + 1 < str.length) {
                        const next = str[i + 1];
                        if (next === '"' || next === '\\') {
                            token += next;
                            i += 2;
                            continue;
                        }
                    }
                    token += str[i];
                    i++;
                }
                i++; // skip closing quote
                wasEscaped = true;
                continue;
            }
            if (str[i] === "'") {
                i++;
                while (i < str.length && str[i] !== "'") {
                    token += str[i];
                    i++;
                }
                i++; // skip closing quote
                wasEscaped = true;
                continue;
            }
            token += str[i];
            i++;
        }
        currentStage().push({ value: token, quoted: wasEscaped, expandable: true });
    }

    return { chains };
}

// valueFlags: optional array of single-char flags that consume the next
// token as their value (e.g. ['n'] for `head -n 3`). All other single-char
// flags are treated as boolean. This avoids the ambiguity where
// `grep -n 847 file` would incorrectly eat the pattern as -n's value.
//
// preTokenized: optional string[] — when provided, skip internal tokenizer
// and run flag-parsing directly on these pre-resolved tokens.
function parseArgs(raw, valueFlags, preTokenized) {
    const _valueFlags = new Set(valueFlags || []);
    const result = {
        positional: [],
        flags: {},
        raw: raw || '',
    };

    if (!preTokenized && (!raw || !raw.trim())) {
        result._ = result.positional;
        return result;
    }

    // Use pre-tokenized input if provided, otherwise tokenize internally
    let tokens;
    if (preTokenized) {
        tokens = preTokenized.map(v => ({ value: v, quoted: false }));
    } else {
        tokens = [];
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

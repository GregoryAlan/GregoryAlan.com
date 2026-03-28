// ─── Shell Tokenizer Tests ──────────────────────────────────
//
// Tests shellTokenize() — the character scanner that parses
// raw terminal input into pipeline structures.
//
// Runs standalone: node tests/shell-tokenizer.test.js

const assert = require('assert');

// ─── Load shellTokenize from source ─────────────────────────
// The function is a standalone global — eval it into this scope.

const fs = require('fs');
const src = fs.readFileSync(
    require('path').join(__dirname, '..', 'js', 'argparse.js'),
    'utf-8'
);
// Extract shellTokenize (first function in the file, ends before parseArgs)
const fnSrc = src.slice(0, src.indexOf('\nfunction parseArgs'));
eval(fnSrc);

// ─── Helpers ────────────────────────────────────────────────

// Extract token values from the first stage of the first chain
function tokens(raw) {
    const result = shellTokenize(raw);
    return result.chains[0].stages[0].map(t => t.value);
}

// Extract full chain/stage structure for complex cases
function structure(raw) {
    const result = shellTokenize(raw);
    return result.chains.map(chain => ({
        op: chain.op,
        stages: chain.stages.map(stage =>
            stage.map(t => ({
                value: t.value,
                ...(t.quoted ? { quoted: true } : {}),
                ...(t.isOperator ? { isOperator: true } : {}),
            }))
        ),
        ...(chain.background ? { background: true } : {}),
    }));
}

// ─── Tests ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
    }
}

console.log('\nShell Tokenizer Tests\n');

// ── Basic tokenization ──────────────────────────────────────

test('simple command', () => {
    assert.deepStrictEqual(tokens('ls'), ['ls']);
});

test('command with flags', () => {
    assert.deepStrictEqual(tokens('ls -la'), ['ls', '-la']);
});

test('command with argument', () => {
    assert.deepStrictEqual(tokens('cat file.txt'), ['cat', 'file.txt']);
});

test('multiple arguments', () => {
    assert.deepStrictEqual(tokens('cp src dst'), ['cp', 'src', 'dst']);
});

test('extra whitespace collapsed', () => {
    assert.deepStrictEqual(tokens('ls   -l   /tmp'), ['ls', '-l', '/tmp']);
});

test('tabs as whitespace', () => {
    assert.deepStrictEqual(tokens('ls\t-la'), ['ls', '-la']);
});

// ── Empty/edge cases ────────────────────────────────────────

test('empty string', () => {
    const result = shellTokenize('');
    assert.strictEqual(result.chains.length, 1);
    assert.strictEqual(result.chains[0].stages[0].length, 0);
});

test('whitespace only', () => {
    const result = shellTokenize('   ');
    assert.strictEqual(result.chains[0].stages[0].length, 0);
});

// ── Double-quoted strings ───────────────────────────────────

test('double-quoted string preserved as single token', () => {
    assert.deepStrictEqual(tokens('echo "hello world"'), ['echo', 'hello world']);
});

test('double-quoted token is marked quoted', () => {
    const result = shellTokenize('echo "hello"');
    const tok = result.chains[0].stages[0][1];
    assert.strictEqual(tok.quoted, true);
    assert.strictEqual(tok.expandable, true);
});

test('double-quoted with escaped quote inside', () => {
    assert.deepStrictEqual(tokens('echo "say \\"hi\\""'), ['echo', 'say "hi"']);
});

test('double-quoted with escaped backslash', () => {
    assert.deepStrictEqual(tokens('echo "back\\\\"'), ['echo', 'back\\']);
});

test('empty double-quoted string', () => {
    assert.deepStrictEqual(tokens('echo ""'), ['echo', '']);
});

// ── Single-quoted strings ───────────────────────────────────

test('single-quoted string preserved as single token', () => {
    assert.deepStrictEqual(tokens("echo 'hello world'"), ['echo', 'hello world']);
});

test('single-quoted token is not expandable', () => {
    const result = shellTokenize("echo 'hello'");
    const tok = result.chains[0].stages[0][1];
    assert.strictEqual(tok.quoted, true);
    assert.strictEqual(tok.expandable, false);
});

test('single-quoted string ignores backslashes', () => {
    assert.deepStrictEqual(tokens("echo 'no\\escape'"), ['echo', 'no\\escape']);
});

test('empty single-quoted string', () => {
    assert.deepStrictEqual(tokens("echo ''"), ['echo', '']);
});

// ── Backslash escapes outside quotes ────────────────────────

test('backslash escapes space', () => {
    assert.deepStrictEqual(tokens('echo hello\\ world'), ['echo', 'hello world']);
});

test('backslash in unquoted token marks as quoted', () => {
    const result = shellTokenize('echo hello\\ world');
    const tok = result.chains[0].stages[0][1];
    assert.strictEqual(tok.quoted, true);
});

// ── Mid-token quote switching ───────────────────────────────

test('double quote starts mid-token', () => {
    assert.deepStrictEqual(tokens('echo pre"quoted"post'), ['echo', 'prequotedpost']);
});

test('single quote starts mid-token', () => {
    assert.deepStrictEqual(tokens("echo pre'quoted'post"), ['echo', 'prequotedpost']);
});

// ── Pipes ───────────────────────────────────────────────────

test('simple pipe creates two stages', () => {
    const result = shellTokenize('cat file | grep pattern');
    const chain = result.chains[0];
    assert.strictEqual(chain.stages.length, 2);
    assert.deepStrictEqual(chain.stages[0].map(t => t.value), ['cat', 'file']);
    assert.deepStrictEqual(chain.stages[1].map(t => t.value), ['grep', 'pattern']);
});

test('triple pipe', () => {
    const result = shellTokenize('cat f | grep x | wc -l');
    assert.strictEqual(result.chains[0].stages.length, 3);
});

// ── Chain operators ─────────────────────────────────────────

test('&& creates new chain with op', () => {
    const s = structure('cmd1 && cmd2');
    assert.strictEqual(s.length, 2);
    assert.strictEqual(s[0].op, null);
    assert.strictEqual(s[1].op, '&&');
});

test('|| creates new chain with op', () => {
    const s = structure('cmd1 || cmd2');
    assert.strictEqual(s[1].op, '||');
});

test('; creates new chain with op', () => {
    const s = structure('cmd1 ; cmd2');
    assert.strictEqual(s[1].op, ';');
});

test('mixed chains', () => {
    const s = structure('a && b || c ; d');
    assert.strictEqual(s.length, 4);
    assert.deepStrictEqual(s.map(c => c.op), [null, '&&', '||', ';']);
});

// ── Background operator ─────────────────────────────────────

test('& sets background flag on chain', () => {
    const s = structure('sleep 10 &');
    assert.strictEqual(s[0].background, true);
});

test('& does not get confused with &&', () => {
    const s = structure('cmd1 && cmd2');
    assert.strictEqual(s.length, 2);
    assert.strictEqual(s[0].background, undefined);
});

// ── Redirection operators ───────────────────────────────────

test('> redirection', () => {
    const result = shellTokenize('echo hi > out.txt');
    const stage = result.chains[0].stages[0];
    const ops = stage.filter(t => t.isOperator);
    assert.strictEqual(ops.length, 1);
    assert.strictEqual(ops[0].value, '>');
});

test('>> append redirection', () => {
    const result = shellTokenize('echo hi >> log.txt');
    const stage = result.chains[0].stages[0];
    const ops = stage.filter(t => t.isOperator);
    assert.strictEqual(ops[0].value, '>>');
});

test('< input redirection', () => {
    const result = shellTokenize('grep pattern < input.txt');
    const stage = result.chains[0].stages[0];
    const ops = stage.filter(t => t.isOperator);
    assert.strictEqual(ops[0].value, '<');
});

// ── Pipes inside chains ─────────────────────────────────────

test('pipe within a chained command', () => {
    const s = structure('cat file | grep x && echo done');
    assert.strictEqual(s.length, 2);
    assert.strictEqual(s[0].stages.length, 2); // cat | grep
    assert.strictEqual(s[1].stages.length, 1); // echo
});

// ── Quotes protect special characters ───────────────────────

test('pipe inside double quotes is literal', () => {
    assert.deepStrictEqual(tokens('echo "a | b"'), ['echo', 'a | b']);
});

test('semicolon inside single quotes is literal', () => {
    assert.deepStrictEqual(tokens("echo 'a ; b'"), ['echo', 'a ; b']);
});

test('redirect inside quotes is literal', () => {
    assert.deepStrictEqual(tokens('echo "a > b"'), ['echo', 'a > b']);
});

// ── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

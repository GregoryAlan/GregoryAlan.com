// ─── Gate Evaluation Tests ──────────────────────────────────
//
// Tests Kernel.driver.evaluateGate() — the boolean expression
// evaluator that controls all narrative content visibility.
//
// Runs standalone: node tests/gate-evaluation.test.js

const assert = require('assert');

// ─── Extract evaluateGate (pure logic, no dependencies) ─────

function evaluateGate(gate, state) {
    if (!gate) return true;
    if (typeof gate === 'function') return gate(state);
    if (Array.isArray(gate)) return gate.every(g => evaluateGate(g, state));

    const negated = gate.startsWith('!');
    const expr = negated ? gate.slice(1) : gate;
    let result;

    if (expr.startsWith('flag:')) {
        result = !!state.flags[expr.slice(5)];
    } else if (expr.startsWith('version:')) {
        result = state.getVersion() >= parseFloat(expr.slice(8));
    } else if (expr.includes(':')) {
        const [driverId, stateName] = expr.split(':');
        result = state.isInOrPast(driverId, stateName);
    } else {
        result = state.has(expr);
    }
    return negated ? !result : result;
}

// ─── Mock State Factory ─────────────────────────────────────

function mockState(opts = {}) {
    const discoveries = new Set(opts.discoveries || []);
    const flags = opts.flags || {};
    const version = opts.version || 1.0;
    const driverStates = opts.driverStates || {};

    return {
        has: (id) => discoveries.has(id),
        flags,
        getVersion: () => version,
        isInOrPast: (driverId, stateName) => {
            const past = driverStates[driverId] || [];
            return past.includes(stateName);
        },
        discover() {},
    };
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

console.log('\nGate Evaluation Tests\n');

// ── Null/undefined gates (always visible) ───────────────────

test('null gate returns true', () => {
    assert.strictEqual(evaluateGate(null, mockState()), true);
});

test('undefined gate returns true', () => {
    assert.strictEqual(evaluateGate(undefined, mockState()), true);
});

test('empty string gate returns true', () => {
    assert.strictEqual(evaluateGate('', mockState()), true);
});

// ── Discovery gates ─────────────────────────────────────────

test('discovery gate — has discovery', () => {
    const state = mockState({ discoveries: ['contact-made'] });
    assert.strictEqual(evaluateGate('contact-made', state), true);
});

test('discovery gate — missing discovery', () => {
    const state = mockState({ discoveries: [] });
    assert.strictEqual(evaluateGate('contact-made', state), false);
});

// ── Negation ────────────────────────────────────────────────

test('negated discovery — has it', () => {
    const state = mockState({ discoveries: ['contact-made'] });
    assert.strictEqual(evaluateGate('!contact-made', state), false);
});

test('negated discovery — missing it', () => {
    const state = mockState({ discoveries: [] });
    assert.strictEqual(evaluateGate('!contact-made', state), true);
});

// ── Flag gates ──────────────────────────────────────────────

test('flag gate — flag is truthy', () => {
    const state = mockState({ flags: { 'rf0-crashed': true } });
    assert.strictEqual(evaluateGate('flag:rf0-crashed', state), true);
});

test('flag gate — flag is falsy', () => {
    const state = mockState({ flags: { 'rf0-crashed': false } });
    assert.strictEqual(evaluateGate('flag:rf0-crashed', state), false);
});

test('flag gate — flag missing entirely', () => {
    const state = mockState({ flags: {} });
    assert.strictEqual(evaluateGate('flag:rf0-crashed', state), false);
});

test('negated flag gate — flag is truthy', () => {
    const state = mockState({ flags: { 'rf0-crashed': true } });
    assert.strictEqual(evaluateGate('!flag:rf0-crashed', state), false);
});

test('negated flag gate — flag missing', () => {
    const state = mockState({ flags: {} });
    assert.strictEqual(evaluateGate('!flag:rf0-crashed', state), true);
});

// ── Version gates ───────────────────────────────────────────

test('version gate — at threshold', () => {
    const state = mockState({ version: 2.0 });
    assert.strictEqual(evaluateGate('version:2.0', state), true);
});

test('version gate — above threshold', () => {
    const state = mockState({ version: 2.5 });
    assert.strictEqual(evaluateGate('version:2.0', state), true);
});

test('version gate — below threshold', () => {
    const state = mockState({ version: 1.1 });
    assert.strictEqual(evaluateGate('version:2.0', state), false);
});

test('negated version gate — below threshold', () => {
    const state = mockState({ version: 1.0 });
    assert.strictEqual(evaluateGate('!version:2.0', state), true);
});

// ── Driver state gates (isInOrPast) ─────────────────────────

test('driver state gate — in state', () => {
    const state = mockState({ driverStates: { signal: ['relay-active', 'buffer-dumped'] } });
    assert.strictEqual(evaluateGate('signal:relay-active', state), true);
});

test('driver state gate — not in state', () => {
    const state = mockState({ driverStates: { signal: ['idle'] } });
    assert.strictEqual(evaluateGate('signal:relay-active', state), false);
});

test('driver state gate — driver not registered', () => {
    const state = mockState({ driverStates: {} });
    assert.strictEqual(evaluateGate('signal:relay-active', state), false);
});

test('negated driver state gate', () => {
    const state = mockState({ driverStates: { signal: ['relay-active'] } });
    assert.strictEqual(evaluateGate('!signal:buffer-dumped', state), true);
});

// ── Array gates (AND conjunction) ───────────────────────────

test('array gate — all conditions met', () => {
    const state = mockState({
        discoveries: ['contact-made'],
        flags: { 'rf0-crashed': true },
    });
    assert.strictEqual(
        evaluateGate(['contact-made', 'flag:rf0-crashed'], state),
        true
    );
});

test('array gate — one condition fails', () => {
    const state = mockState({
        discoveries: ['contact-made'],
        flags: {},
    });
    assert.strictEqual(
        evaluateGate(['contact-made', 'flag:rf0-crashed'], state),
        false
    );
});

test('array gate — mixed with negation', () => {
    const state = mockState({
        discoveries: ['contact-made'],
        flags: {},
    });
    assert.strictEqual(
        evaluateGate(['contact-made', '!flag:noclue'], state),
        true
    );
});

test('array gate — empty array returns true', () => {
    assert.strictEqual(evaluateGate([], mockState()), true);
});

// ── Function gates ──────────────────────────────────────────

test('function gate — returns true', () => {
    const gate = (s) => s.has('contact-made');
    const state = mockState({ discoveries: ['contact-made'] });
    assert.strictEqual(evaluateGate(gate, state), true);
});

test('function gate — returns false', () => {
    const gate = (s) => s.has('contact-made');
    const state = mockState({ discoveries: [] });
    assert.strictEqual(evaluateGate(gate, state), false);
});

test('function gate — uses flags', () => {
    const gate = (s) => s.flags.version === '2.0' && s.has('x');
    const state = mockState({ discoveries: ['x'], flags: { version: '2.0' } });
    assert.strictEqual(evaluateGate(gate, state), true);
});

// ── Complex combinations ────────────────────────────────────

test('array with version + discovery + negated flag', () => {
    const state = mockState({
        discoveries: ['contact-made'],
        flags: {},
        version: 2.0,
    });
    assert.strictEqual(
        evaluateGate(['contact-made', 'version:2.0', '!flag:noclue'], state),
        true
    );
});

test('array with driver state + discovery', () => {
    const state = mockState({
        discoveries: ['buffer-found'],
        driverStates: { signal: ['buffer-dumped', 'relay-active'] },
    });
    assert.strictEqual(
        evaluateGate(['buffer-found', 'signal:buffer-dumped'], state),
        true
    );
});

// ── Summary ─────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

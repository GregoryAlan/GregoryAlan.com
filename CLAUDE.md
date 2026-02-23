# GregoryAlan.com — Agent Instructions

## Session Preamble

At the start of every session:

1. **Read `hunts/SYNC.md`** — check the Status Overview, Known Drift, and Handoff Queue for items that need attention.
2. **Check your handoff queue** — if items are "For Developer" or "For Lore Master" (whichever you are), address them before starting new work.
3. **Spot-check contracts** — if you're about to modify a file that has contract blocks (NARRATIVE-SEEDS.md, the-signal-storyline.md, greg-corp-storyline.md, NARRATIVE-ENGINE.md), read the relevant contract first to understand sync status.

## Contract Maintenance

### When implementing spec content:
- Add `// spec: <doc> > <section>` comment above the code
- Update the spec's contract block: `status: implemented`, `impl:` path, `last-synced:` date
- Update SYNC.md counts and clear from handoff queue

### When writing new spec content:
- Add a contract block with `status: draft`
- Add to SYNC.md handoff queue ("For Developer")
- Update SYNC.md counts

### When building code without a spec:
- Add `// spec: NONE — needs storyline document` comment
- Add to SYNC.md "Unspec'd Code" table and "For Lore Master" queue
- Include brief description of narrative canon established

### When detecting drift between spec and code:
- Update contract to `status: drift` with `drift-notes:` explaining the mismatch
- Add to SYNC.md "Known Drift" table
- Do not silently fix — the other agent needs to see and approve the resolution

## Architecture

See the auto-memory MEMORY.md for the full architecture reference. Key points:

- Commands are pure functions `(args, stdin) → string|null`
- State access through `Kernel.fs.read()`, `Kernel.hunt.discover()` etc.
- Version layers build up via `applyVersion()` in `js/versions.js`
- Hunt registration routes through `Kernel.hunt.registerHunt()`

## Spec Documents (in `hunts/`)

| Document | Purpose | Contracts? |
|----------|---------|:----------:|
| `LORE-BIBLE.md` | Design theology, tonal rules, canon | No |
| `HUNT-TEMPLATE.md` | Hunt API reference | No |
| `NARRATIVE-SEEDS.md` | Filesystem content spec (4 threads) | Yes |
| `the-signal-storyline.md` | Signal hunt narrative + test script | Yes |
| `greg-corp-storyline.md` | GregCorp employee profiles spec | Yes |
| `NARRATIVE-ENGINE.md` | Future narrative engine (aspirational) | Yes |
| `SYNC.md` | Pipeline dashboard | N/A |

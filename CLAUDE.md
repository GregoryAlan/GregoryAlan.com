# GregoryAlan.com — Agent Instructions

## What This Is

GregOS is an operating system whose hardware resource is narrative. The kernel (`Kernel.driver`, `Kernel.fs`) manages story state — gating content visibility, handling discovery interrupts, scheduling state transitions — the way a real kernel manages memory and processes. The OS layer (Shell, Terminal, commands) is how visitors interface with narrative as the kernel allows. JSON manifests are firmware. Driver definitions are device drivers. Discoveries are hardware interrupts.

This mirrors the fiction: Gregory built an OS to process randomness into something that behaves like intent. We build an OS to process narrative into something that behaves like a real system. The architecture and the story are the same shape.

## Session Preamble

At the start of every session:

1. **Read `SYNC.md`** — check the Status Overview, Known Drift, and Handoff Queue for items that need attention.
2. **Check your handoff queue** — if items are "For Developer" or "For Lore Master" (whichever you are), address them before starting new work.
3. **Spot-check contracts** — if you're about to modify a file that has contract blocks (`lore/NARRATIVE-SEEDS.md`, `lore/the-signal-storyline.md`, `lore/greg-corp-storyline.md`, `lore/NARRATIVE-ENGINE.md`), read the relevant contract first to understand sync status.

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
- State access through `Kernel.fs.read()`, `Kernel.driver.discover()` etc.
- Version layers build up via `applyVersion()` in `js/versions.js`
- Driver registration routes through `Kernel.driver.registerDriver()`

## Spec Documents

| Document | Purpose | Contracts? |
|----------|---------|:----------:|
| `lore/LORE-BIBLE.md` | Design theology, tonal rules, canon | No |
| `lore/DRIVER-TEMPLATE.md` | Driver API reference | No |
| `lore/NARRATIVE-SEEDS.md` | Filesystem content spec (4 threads) | Yes |
| `lore/the-signal-storyline.md` | Signal driver narrative + test script | Yes |
| `lore/greg-corp-storyline.md` | GregCorp employee profiles spec | Yes |
| `lore/NARRATIVE-ENGINE.md` | Future narrative engine (aspirational) | Yes |
| `lore/CONTENT-PIPELINE.md` | Lore Master operational guide (lifecycle, manifests, checklists) | No |
| `SYNC.md` | Pipeline dashboard | N/A |

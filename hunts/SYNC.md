# Sync Manifest

Dashboard for the Lore/Code pipeline. Both agents read this at session start.

Last updated: 2026-02-22

---

## Status Overview

| Spec Document | Implemented | Draft | Drift | Aspirational | Total |
|---------------|:-----------:|:-----:|:-----:|:------------:|:-----:|
| NARRATIVE-SEEDS.md | 11 | 0 | 1 | 0 | 12 |
| the-signal-storyline.md | 5 | 0 | 1 | 0 | 6 |
| NARRATIVE-ENGINE.md | 0 | 0 | 0 | 7 | 7 |
| greg-corp-storyline.md | 7 | 0 | 0 | 0 | 7 |

---

## Known Drift

| Spec | Section | Issue | Severity |
|------|---------|-------|----------|
| NARRATIVE-SEEDS.md | `/etc/gregos-release` | Spec says `GregOS 2.0.1`, code has `GregOS 2.0.1-dev` with extra `CHANNEL: unstable` line. Code is intentionally more detailed (dev build flavor). | Low — code extends spec, doesn't contradict |
| the-signal-storyline.md | Act 5: `dmesg` | Storyline spec describes `dmesg` showing `rf0: device registered`, `connection from 0.0.0.0`, `PID 0: state=running`. Code in `the-signal.js:216` shows different baseline boot lines (`gregOS version 2.0`, `Memory: 640K`) vs `kern.log` in narrativeSeeds (`gresos-kernel 0.9.851`, `Memory: 512MB`). Two different "boot log" views exist with inconsistent baselines. | Medium — visitor sees both |

---

## Unspec'd Code

Code that exists without a spec document. Lore master should review and retroactively document.

| File | Content | Canon Established | Status |
|------|---------|-------------------|--------|
| `greg-corp.js` | GregCorp employee profiles, HR complaint, personnel records, emails | Diane Hollis, James Park, Margaret Hayes, Roberto Martinez, Sarah Chen, GregCorp restructuring, Signal Research reclassification, HR-97-0847 complaint | **Spec created** — see `greg-corp-storyline.md` |
| `versions.js` system overrides | `/proc/version`, `/sys/firmware/bios`, `/etc/passwd` overrides at v2.0 | BIOS revision history (1985-2025), GregCorp employee in passwd | No spec — structural atmosphere, developer discretion |
| `versions.js` v1.0/v1.1 content | `v1Files`, `v1_1Files`, `v1_1Seeds` | ROM station log, v1.1 welcome text, version.txt with 2091 timestamp | Covered by `the-signal-storyline.md` test script (Phase 1-2) |

---

## Handoff Queue

### For Developer

*(Nothing pending)*

### For Lore Master

| Item | Context | Priority |
|------|---------|----------|
| `dmesg` vs `kern.log` drift | `the-signal.js` dmesg baseline and `narrativeSeeds` kern.log baseline show different boot messages. Decide: should dmesg match kern.log? Or are they intentionally different views? | Medium |
| `/etc/gregos-release` spec update | Code has `-dev` suffix and `CHANNEL: unstable` — update spec to match if intentional | Low |

---

## Active Branches

| Branch | Agent | Status | Description |
|--------|-------|--------|-------------|
| `feature/user-profiles` | Developer | Active | GregCorp employee profiles and su system |
| *(main)* | — | Stable | Last merged: initial implementation |

---

## How To Use This File

**At session start:** Read this file. Check "Known Drift" and "Handoff Queue" for items needing attention.

**After writing spec content:** Update the relevant spec's contract blocks (`status: draft`), add to "Handoff Queue > For Developer", update the Status Overview counts.

**After implementing spec:** Update contract blocks (`status: implemented` with `impl:` path), clear from handoff queue, update counts.

**After building ahead of spec:** Add to "Unspec'd Code" table and "Handoff Queue > For Lore Master".

**After detecting drift:** Update contract to `status: drift` with notes, add to "Known Drift" table.

# Sync Manifest

Dashboard for the Lore/Code pipeline. Both agents read this at session start.

Last updated: 2026-02-23

---

## Status Overview

| Spec Document | Implemented | Draft | Drift | Aspirational | Total |
|---------------|:-----------:|:-----:|:-----:|:------------:|:-----:|
| NARRATIVE-SEEDS.md | 12 | 0 | 0 | 0 | 12 |
| the-signal-storyline.md | 6 | 0 | 0 | 0 | 6 |
| NARRATIVE-ENGINE.md | 0 | 0 | 0 | 7 | 7 |
| greg-corp-storyline.md | 7 | 0 | 0 | 0 | 7 |

---

## Known Drift

| Spec | Section | Issue | Severity |
|------|---------|-------|----------|
| *(none)* | | | |

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

*(Nothing pending)*

---

## Active Branches

| Branch | Agent | Status | Description |
|--------|-------|--------|-------------|
| *(main)* | — | Stable | All Phase I content implemented (Signal + GregCorp drivers) |

---

## How To Use This File

**At session start:** Read this file. Check "Known Drift" and "Handoff Queue" for items needing attention.

**After writing spec content:** Update the relevant spec's contract blocks (`status: draft`), add to "Handoff Queue > For Developer", update the Status Overview counts.

**After implementing spec:** Update contract blocks (`status: implemented` with `impl:` path), clear from handoff queue, update counts.

**After building ahead of spec:** Add to "Unspec'd Code" table and "Handoff Queue > For Lore Master".

**After detecting drift:** Update contract to `status: drift` with notes, add to "Known Drift" table.

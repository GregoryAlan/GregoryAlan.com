# Content Pipeline — Lore Master Operational Guide

How to create, edit, and manage narrative content for GregoryAlan.com. This document is the Lore Master's primary reference for working within the manifest-based content system.

Last updated: 2026-02-23

---

## 1. Content Creation Lifecycle

```
CONCEPT → CANON CHECK → SPEC → CLASSIFY → IMPLEMENT → CONTRACT → TEST
```

### CONCEPT

What does this content tell the visitor? Answer:
- **Which thread?** Daemon pipeline, entropy anomaly, signal infrastructure, Gregory's presence, GregCorp layer — or a new thread?
- **Which phase?** Phase I (grounded system files), Phase II (Gregory's residue), Phase III (impossible files)
- **What's the discovery?** What does a careful reader learn from this file that they didn't know before?
- **What does it connect to?** Which other files does it cross-reference or create tension with?

### CANON CHECK

Before writing content, verify against the Lore Bible:

- **First Law:** Does the content pass the sysadmin test? Would a real sysadmin look twice at it in isolation?
- **Motif usage:** If using 847, rf0, PID 0, 0.0.0.0, or negative timestamps — is the usage defensible as a coincidence?
- **Ambiguity rules:** Does the content explain too much? The system never tells visitors what to think.
- **Established canon:** Check NARRATIVE-SEEDS.md "Established Canon" table for values that must be exact (kernel version, hostname, PIDs, etc.)
- **Voice:** Gregory is absent from files (Phase I). Tools are tools. No personal commentary unless earning it in Phase II+.

### SPEC

Write the full file content in the appropriate storyline document:

- Filesystem atmosphere → `NARRATIVE-SEEDS.md`
- Signal driver content → `the-signal-storyline.md`
- GregCorp / employee content → `greg-corp-storyline.md`
- New driver → create a new `lore/<name>-storyline.md`

Add a contract block:
```markdown
<!-- contract
status: draft
impl: (pending)
last-synced: YYYY-MM-DD
-->
```

### CLASSIFY

Determine who implements this content:

| Question | If Yes → |
|----------|----------|
| Same content every read within a session? | **Static JSON** — Lore Master does it |
| Changes with real-world time (uptime, cycle counts)? | **Computed JS** — hand off to Developer |
| Two variants (before/after a gate)? | **Gated JSON object** — Lore Master does it |
| Multiple state-dependent variants? | **Computed JS function** — hand off to Developer |
| Requires a new command? | **JS** — hand off to Developer |
| Requires a glitch trigger? | **JS trigger array** — hand off to Developer |

### IMPLEMENT

**If static/gated JSON:** Add to the correct manifest file (see Section 3). Update the contract block:
```markdown
<!-- contract
status: implemented
impl: content/<manifest>.json:<field>[<path>]
last-synced: YYYY-MM-DD
-->
```

**If developer handoff:** Add to SYNC.md "Handoff Queue > For Developer" with context and priority. Leave the contract at `status: draft`.

### CONTRACT

- Update the spec's contract block (status, impl path, last-synced date)
- Update SYNC.md Status Overview counts
- Clear from handoff queue if resolved

### TEST

1. Clear session: `sessionStorage.clear()` in DevTools, refresh
2. Navigate to the version where content should appear
3. Verify file exists (or doesn't exist) at expected gate states
4. Verify content matches spec exactly
5. Check cross-references — does the content agree with every other file that mentions the same details?

---

## 2. Static vs. Computed Decision Rule

```
Same content every read within session? ──→ Static JSON (textFiles/treeFiles)
                                     │
                                     No
                                     ↓
Changes with real-world time?        ──→ Computed JS (versions.js)
(uptime, timestamps, jitter)         │
                                     No
                                     ↓
Changes with narrative state?
  Two variants (before/after gate)?  ──→ Gated JSON object (manifest)
  Multiple variants or complex logic?──→ Computed JS function (versions.js)
```

**Examples:**

| Content | Type | Why |
|---------|------|-----|
| `/etc/crontab` | Static JSON | Never changes |
| `/proc/daemons` | Computed JS | Uptime, cycle count, last-exec all use real time |
| `/proc/entropy_avail` | Computed JS | Pool value jitters on every read |
| `.rf0.buf` | Gated JSON | Appears only after `rf0-mount-failed` discovery |
| `/proc/0/status` | Gated JSON | Appears only after `contact-made` discovery |
| `/etc/gregos-release` | Static JSON | Same content always at v2.0 |

---

## 3. Manifest File Map

Which manifest file to use for each content type:

| Manifest | Version | Content |
|----------|---------|---------|
| `content/v1.0-rom.json` | v1.0 | ROM station files (`broadcast.log`, `status.txt`) |
| `content/v1.1-home.json` | v1.1 | Home directory text files (`welcome.txt`, `about.txt`, etc.) |
| `content/v1.1-system.json` | v1.1 | v1.1 system files, hidden files |
| `content/v2.0-system.json` | v2.0 | v2.0 system files, narrative seeds (static), `/etc/*`, `/var/log/*`, `/home/greg/*` |
| `content/signal-hunt.json` | v2.0 | Signal driver gated files (`.rf0.buf`, `/proc/0/*`) |
| `content/gregcorp-profiles.json` | v2.0 | GregCorp employee profiles, HR records, emails |
| `content/man-pages.json` | v1.1+ | Man pages for all commands |
| `content/help-descriptions.json` | all | Help text descriptions for commands |

**Which manifest for new content?**

- v1.0 ROM content → `v1.0-rom.json`
- v1.1 home directory files → `v1.1-home.json`
- v1.1 system files → `v1.1-system.json`
- v2.0 filesystem content (non-driver) → `v2.0-system.json`
- Signal driver gated files → `signal-hunt.json`
- GregCorp profiles/records → `gregcorp-profiles.json`
- Man pages → `man-pages.json`
- Help descriptions → `help-descriptions.json`
- **New driver** → create `content/<name>.json` and ask Developer to add URL to `MANIFEST_URLS` in `js/versions.js`

---

## 4. JSON Manifest Format Reference

Every manifest file has this structure:

```json
{
    "id": "unique-manifest-id",
    "description": "Human-readable description",

    "textFiles": { ... },
    "hiddenFiles": { ... },
    "treeFiles": { ... },
    "directories": { ... },
    "manPages": { ... },
    "helpDescriptions": { ... }
}
```

All fields except `id` are optional. Include only what you need.

### textFiles

Visible files in the home directory (`ls` shows them). Keyed by filename.

```json
"textFiles": {
    "welcome.txt": "Welcome to GregOS 2.0...",
    "about.txt": "Gregory Alan\nDeveloper & Creator"
}
```

### hiddenFiles

Hidden files in the home directory (`ls -a` shows them). Keyed by filename (with leading `.`).

**Simple string:**
```json
"hiddenFiles": {
    ".bash_history": "  1  cat welcome.txt\n  2  ls -a"
}
```

**Gated file** (appears only when gate condition is met):
```json
"hiddenFiles": {
    ".rf0.buf": {
        "type": "gated",
        "gate": "rf0-mount-failed",
        "onRead": "rf-found",
        "content": "rf0: rx ring overrun..."
    }
}
```

### treeFiles

Files at absolute paths in the filesystem tree. Keyed by full path.

**Simple content:**
```json
"treeFiles": {
    "/etc/modules.conf": { "content": "# /etc/modules.conf..." },
    "/var/log/syslog": { "content": "Jan 22 00:00:01 gregoryalan syslogd: started..." }
}
```

**Gated file:**
```json
"treeFiles": {
    "/proc/0/status": {
        "type": "gated",
        "gate": "contact-made",
        "content": "Name:\t(unknown)\nPid:\t0..."
    }
}
```

### directories

Directory tree structure for `ls` and `cd`. Nested objects. Values are file lists.

```json
"directories": {
    "bin": ["decode", "rot13", "freq", "entropy", "crc", "strings"]
}
```

### manPages

Man page content. Keyed by command name.

```json
"manPages": {
    "decode": "DECODE(1)\n\nNAME\n    decode - ..."
}
```

### helpDescriptions

One-line descriptions shown in `help` output. Keyed by command name.

```json
"helpDescriptions": {
    "decode": "Decode hex or base64 data"
}
```

### Gate Expressions

The `gate` field in gated files supports these expression types:

| Expression | Example | Meaning |
|------------|---------|---------|
| Discovery ID | `"rf0-mount-failed"` | Player has made this discovery |
| `flag:<name>` | `"flag:contact"` | Named flag is set |
| `version:<n>` | `"version:2"` | Current version >= n |
| `<driver>:<state>` | `"signal:contact"` | Driver is in or past this state |
| `!<expr>` | `"!contact-made"` | Negation — gate passes when condition is false |
| Array | `["contact-made", "flag:contact"]` | AND — all conditions must pass |

### onRead

The `onRead` field on a gated file fires a discovery when the file is read:

```json
{
    "type": "gated",
    "gate": "rf0-mount-failed",
    "onRead": "rf-found",
    "content": "..."
}
```

When the player `cat`s this file, discovery `rf-found` fires automatically.

---

## 5. Checklists

### 5a. Adding a New Static File

1. [ ] Write content in the appropriate spec doc with a contract block (`status: draft`)
2. [ ] Canon check: Lore Bible compliance, established canon values, cross-references
3. [ ] Classify: confirm it's truly static (same content every read)
4. [ ] Choose manifest file (Section 3)
5. [ ] Add to the manifest under `textFiles`, `hiddenFiles`, or `treeFiles`
6. [ ] If it's in a new directory, add the directory entry to `directories`
7. [ ] Update spec contract: `status: implemented`, `impl: content/<manifest>.json`, date
8. [ ] Update SYNC.md counts
9. [ ] Test: `sessionStorage.clear()`, refresh, navigate to correct version, `cat` the file

### 5b. Adding a New Gated File

1. [ ] Write both the gate condition and full content in the spec doc
2. [ ] Canon check: content at both states (visible and hidden) makes sense
3. [ ] Choose manifest file
4. [ ] Add gated object: `type`, `gate`, `content`, optionally `onRead`
5. [ ] Verify the gate expression references an existing discovery/flag/state
6. [ ] If `onRead` fires a new discovery, document the discovery in the spec
7. [ ] Update spec contract and SYNC.md
8. [ ] Test: verify file is absent before gate, present after gate, `onRead` fires correctly

### 5c. Creating a New Driver Storyline

1. [ ] Write `lore/<name>-storyline.md` with premise, acts, discovery chain, design principles
2. [ ] Add contract blocks to each act (`status: draft`)
3. [ ] For static/gated content: create `content/<name>.json` manifest
4. [ ] Hand off to Developer:
   - Add manifest URL to `MANIFEST_URLS` in `js/versions.js`
   - Create `drivers/<name>.js` with state machine, commands, triggers
5. [ ] Add to SYNC.md spec document table
6. [ ] Add to SYNC.md handoff queue ("For Developer")
7. [ ] Update SYNC.md counts

### 5d. Extending an Existing Driver

1. [ ] Identify which act/state the new content belongs to
2. [ ] Write content in the existing storyline doc, inside the relevant act's section
3. [ ] Classify: static JSON vs. developer handoff
4. [ ] If static: add to the driver's manifest file
5. [ ] If developer: add to SYNC.md handoff queue with act/state context
6. [ ] Update the act's contract block
7. [ ] Test the full act flow — new content shouldn't break existing discovery chain

### 5e. Adding a New Employee Profile

1. [ ] Write the profile in `greg-corp-storyline.md` with all fields
2. [ ] Add personnel record content to `content/gregcorp-profiles.json`
3. [ ] Hand off to Developer for:
   - Profile object in `drivers/greg-corp.js` (`gregCorpProfiles`)
   - Password(s) and any discovery flags
   - Home directory content and `su` behavior
4. [ ] Add to SYNC.md handoff queue
5. [ ] Test: `su <username>`, verify prompt, CWD, environment, file access

---

## 6. Editing Existing Content

**Never edit only the spec or only the implementation.** Both must be updated together.

### Workflow

1. **Find the spec:** Locate the content's entry in its storyline document
2. **Find the implementation:** Check the contract block's `impl:` path — it tells you exactly where the code/manifest lives
3. **Edit both:** Update the spec text and the manifest/code content to match
4. **Update the contract:** Bump `last-synced` date. If the change is substantive, note it.
5. **Check cross-references:** Does this content appear in the "Established Canon" table? In other files' descriptions? Update all references.
6. **Update SYNC.md** if the change affects counts or resolves a drift item
7. **Test:** Clear session, verify the edited content appears correctly

### If you find drift

If the spec and implementation don't match and you're not sure which is correct:

1. Update the contract to `status: drift` with `drift-notes:` explaining the mismatch
2. Add to SYNC.md "Known Drift" table
3. **Do not silently fix.** The other agent needs to see and approve the resolution.

---

## Appendix: What Still Requires Developer Handoff

These capabilities cannot be achieved through JSON manifests alone:

| Capability | Why | Handoff Format |
|------------|-----|----------------|
| New manifest file registration | Requires adding URL to `MANIFEST_URLS` in `js/versions.js` | Provide manifest filename |
| New commands | JS functions registered via `Shell.register()` | Provide command name, args spec, expected output |
| Triggers with glitch effects | JS trigger arrays in driver files | Provide trigger type, match condition, effect name |
| State machine changes | JS `stateMap` objects in driver files | Provide state transitions, conditions |
| Computed/dynamic content | JS functions that use real time, randomness, or complex state | Provide the output spec with all dynamic values described |
| EventBus subscriptions | JS `EventBus.on()` calls | Provide event type, handler behavior |
| Profile system additions | JS profile objects in `greg-corp.js` | Provide profile fields, passwords, discovery flags |

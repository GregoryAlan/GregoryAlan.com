# Driver Template

Guide for creating drop-in narrative drivers for the GregoryAlan.com terminal.

---

## Naming Convention

### Driver ID
- Lowercase, hyphenated: `the-signal`, `the-archive`, `the-breach`
- Used as prefix for discovery IDs and sessionStorage keys

### Discovery IDs
- Format: `{branch}-{step}` — e.g., `logs-dmesg`, `user-finger`, `signal-file`
- Branch prefixes should be short, descriptive: `logs`, `user`, `signal`, `net`, `mem`
- Used for gating content and firing triggers

### File Names
- Hidden files start with `.` — e.g., `.signal`, `.auth.log`, `.syslog`
- Use real Unix file names where possible (auth.log, syslog, .profile)
- Invented files should still feel plausible

### Commands
- Prefer real Unix commands: `dmesg`, `finger`, `last`, `w`, `strings`, `uptime`
- Invented commands should feel like real tools: `decode`, `trace`, `scan`
- Never override core commands: `ls`, `cd`, `cat`, `pwd`, `clear`, `help`
- `help` is overridden by the driver system to add a discovery-gated hint line

---

## Driver Definition Structure

```javascript
const myDriver = {
    id: 'driver-name',

    // State machine: declares narrative progression as named states
    // with transitions keyed by discovery IDs. Optional — omit for
    // non-narrative packs (e.g., OS features like pkg/mount).
    stateMap: {
        'idle': {
            transitions: { 'first-discovery': 'act-one' }
        },
        'act-one': {
            flags: { 'act-one-reached': true },  // auto-set on entry
            transitions: { 'second-discovery': 'act-two' }
        },
        'act-two': {
            flags: { 'act-two-reached': true },
            transitions: {}  // terminal state
        }
    },

    // Files added to the terminal filesystem
    files: {
        // Normal files (visible with ls)
        text: {
            'filename.txt': 'static content string',
        },
        // Hidden files (visible with ls -a)
        hidden: {
            '.filename': 'static content',

            // Gated file (declarative — preferred):
            '.gated-file': {
                gate: 'prerequisite-id',       // discovery check
                onRead: 'this-discovery-id',   // auto-discover on read
                content: 'content string'      // or content: (state) => '...'
            },

            // Legacy function format (still works):
            '.legacy-file': (state) => {
                if (!Kernel.driver.has('prerequisite-id')) return null;
                Kernel.driver.discover('this-discovery-id');
                return 'content revealed after prerequisite';
            },
        },
    },

    // Directories added to fileTree
    directories: {
        // 'dirname': { 'file.txt': 'file' }
    },

    // Commands added to the Shell command registry
    commands: {
        commandname: (args, stdin) => {
            Kernel.driver.discover('discovery-id');
            return 'output string with <span> HTML allowed';
        },
    },

    // Triggers fired on discoveries, commands, file reads, or count thresholds
    triggers: [
        {
            type: 'discovery',      // 'discovery' | 'command' | 'file_read' | 'count'
            match: 'discovery-id',  // discovery ID, command name, filename, or number
            effect: 'effectName',   // glitch effect to run (see below)
            effectOpts: {},         // options passed to the effect
            once: true,             // only fire once per session
            // callback: (state) => {},  // arbitrary JS
        },
    ],

    // Modifications to existing content
    patches: {
        hiddenFiles: {
            '.bash_history': (existing) => {
                // Return replacement content
                // Use this to add breadcrumb commands to history
                return 'new content';
            },
        },
    },

    // Restore visual state on page reload (called during boot init)
    restore(state) {
        if (state.flags['my-flag']) {
            runGlitchEffect('scanlines', { persistent: true });
        }
    },
};

// Register at script load time (before version activation)
Kernel.driver.declareDriver(myDriver);
```

---

## Content Guidelines

### Tone: Cyberpunk Noir
- The user is in a system they shouldn't be in
- Previous traces are almost erased, but not quite
- The system itself may be aware
- Cold, clinical text with cracks showing through

### Story Rules
- **No exposition.** Don't tell the user what to think. Let terminal output speak for itself.
- **Terminal-authentic only.** Every line should be something you'd genuinely see on a screen: system messages, kernel logs, user input, file contents.
- **No fourth wall breaks.** Stay in character as a real system.
- **Escalate unease, not horror.** Creepy, not scary.

### Text Styling (HTML spans in output)
- `<span class="redacted">████████</span>` — blacked-out text (corrupted/classified)
- `<span class="timestamp-anomaly">Jan 0 00:00</span>` — red with wavy underline (anomalous data)
- `<span style="color:#f55">error text</span>` — red for system errors/warnings
- `<span style="color:#5f5">green text</span>` — green for user input from other sessions
- **No exposition** — avoid colored `<span>` hints that editorialize ("who did this?", "something is wrong"). Only use styling for text that would genuinely appear on a terminal.

### Corruption Characters
Use for garbled/corrupted data: `░▒▓█▄▀■□▪▫◊○●◘◙`

---

## Available Glitch Effects

| Effect | Use for |
|--------|---------|
| `screenFlicker` | Minor discoveries, first encounters |
| `heavyFlicker` | Significant reveals, decoded messages |
| `scanlines` | Sustained unease, late-stage discoveries |
| `crtBand` | Subtle visual disturbance |
| `phantomLine` | Messages that appear and fade — use `effectOpts.texts` array |
| `promptCorruption` | Identity-related discoveries |
| `textCorruption` | Corrupting what the user just read |
| `screenTear` | Horizontal displacement glitch |
| `majorGlitch` | Combo of multiple effects for major moments |

---

## Engine API

The engine is organized into three namespace objects. Driver scripts access them directly.

### Kernel.driver — Narrative State

| Function | Purpose |
|----------|---------|
| `Kernel.driver.declareDriver(def)` | Register driver globally and initialize its state map (call at script load time) |
| `Kernel.driver.registerDriver(def)` | Merge driver content into the runtime (called by `applyVersion()`) |
| `Kernel.driver.discover(id)` | Record a discovery, advance state machines, fire triggers |
| `Kernel.driver.has(id)` | Check if a discovery was made |
| `Kernel.driver.setFlag(k, v)` | Set arbitrary persistent state (survives refresh) |
| `Kernel.driver.flags` | Read flags set by `setFlag` |
| `Kernel.driver.getVersion()` | Current GregOS version number |
| `Kernel.driver.getState(driverId)` | Get current state machine position for a driver |
| `Kernel.driver.isInOrPast(driverId, stateName)` | Check if a driver has reached or passed a state |
| `Kernel.driver.debug()` | Return full state dump (version, discoveries, flags, driver states) |
| `Kernel.driver.evaluateGate(gate, state)` | Evaluate a gate expression against state |
| `Kernel.driver.createGatedFile(def)` | Create a gated file function from `{ gate, onRead, content }` |
| `Kernel.driver.checkTriggers(type, value)` | Fire triggers matching a type/value pair |

### Kernel.fs — Filesystem

| Function | Purpose |
|----------|---------|
| `Kernel.fs.read(name)` | Read a text or hidden file (returns string or null) |
| `Kernel.fs.stat(name)` | Check if name is `'file'`, `'dir'`, `'text'`, `'hidden'`, or `null` |
| `Kernel.fs.chdir(path)` | Change working directory (returns `{ ok }` or `{ error }`) |
| `Kernel.fs.cwd()` | Current path as array |
| `Kernel.fs.cwdString()` | Current path as string (`/path/to/dir`) |
| `Kernel.fs.isVisible(name)` | Whether a hidden file passes its gate check |
| `Kernel.fs.addTextFile(name, content)` | Add or replace a visible file |
| `Kernel.fs.addHiddenFile(name, content)` | Add or replace a hidden file |
| `Kernel.fs.addManPage(name, content)` | Add a man page |
| `Kernel.fs.mergeFileTree(tree)` | Merge directories into the filesystem |
| `Kernel.fs.mergeManPages(pages)` | Merge a map of man pages |

### Kernel.session — Persistence

| Function | Purpose |
|----------|---------|
| `Kernel.session.get(key)` | Read from sessionStorage |
| `Kernel.session.set(key, val)` | Write to sessionStorage |
| `Kernel.session.remove(key)` | Delete a key |
| `Kernel.session.clear()` | Factory reset all session state |

### Shell — Command Registry & Environment

| Function | Purpose |
|----------|---------|
| `Shell.register(name, fn)` | Register a command |
| `Shell.unregister(name)` | Remove a command |
| `Shell.env` | Environment variables (`USER`, `HOME`, `HOSTNAME`, `PATH`, `OSTYPE`, etc.) |

### Terminal — Display

| Function | Purpose |
|----------|---------|
| `Terminal.appendSystemLine(html)` | Append a persistent line to terminal output (for delayed system messages) |
| `Terminal.addOutput(cmd, result)` | Render a command/result pair |
| `Terminal.updatePrompt()` | Re-render the prompt (call after `Kernel.fs.chdir()`) |

### Glitch Effects

| Function | Purpose |
|----------|---------|
| `runGlitchEffect(name, opts)` | Trigger a visual effect (see Available Glitch Effects) |
| `corruptString(str, intensity)` | Garble text with corruption characters |

### Two-Phase Registration

- **`Kernel.driver.declareDriver(def)`** — called at **script load time**. Registers the driver in the driver registry and initializes its state machine. State maps exist before content is activated.
- **`Kernel.driver.registerDriver(def)`** — called by `applyVersion()` at **the version layer that activates the driver**. Merges files, commands, triggers into the runtime.

`registerDriver()` routes content through proper APIs:

| Driver field | Routed to |
|------------|-----------|
| `def.files.text` | `Kernel.fs.addTextFile()` |
| `def.files.hidden` | `Kernel.fs.addHiddenFile()` |
| `def.commands` | `Shell.register()` |
| `def.directories` | `Kernel.fs.mergeFileTree()` |
| `def.manPages` | `Kernel.fs.mergeManPages()` |
| `def.triggers` | `Kernel.driver._triggers` |
| `def.patches` | `Kernel.fs.addHiddenFile(name, patchFn(existing))` |

Driver scripts should **not** directly reference engine internals (`Kernel.fs._textFiles`, `Shell._commands`, `Terminal.el`, etc.). Use `registerDriver()` to inject content, and the public APIs above to read state.

---

## Gate Syntax

Gates declare when content is available. Used in `{ gate, content, onRead }` file definitions.

| Syntax | Meaning |
|--------|---------|
| `'discovery-id'` | Discovery check — `Kernel.driver.has(id)` |
| `'flag:name'` | Flag check — `!!Kernel.driver.flags[name]` |
| `'version:2.0'` | Version check — `Kernel.driver.getVersion() >= 2.0` |
| `'driver-id:state-name'` | Driver state check — is in or past this state |
| `'!expression'` | Negation — inverts any of the above |
| `['a', 'b']` | AND — all gates must pass |
| `(state) => ...` | Function escape hatch (receives `Kernel.driver`) |

---

## Branch Design Pattern

Each driver should have 2-4 branches. Each branch:
- Has 3-5 discovery steps
- Starts from a breadcrumb in `.bash_history` or a visible hidden file
- Gates later content behind earlier discoveries (function-valued files)
- Cross-references other branches without resolving them
- Has at least one glitch trigger

### Branching Template

| Step | Discovery ID | Entry | Gated By | Glitch | Cross-refs |
|------|-------------|-------|----------|--------|------------|
| 1 | `branch-step1` | command or always-visible file | — | light | — |
| 2 | `branch-step2` | hidden file | step1 | medium | other branch |
| 3 | `branch-step3` | hidden file or command output | step2 | heavy | other branch |
| 4 | `branch-step4` | command | step3 or none | — | ties threads |

---

## Milestone Triggers

Use `type: 'count'` triggers for effects based on total discoveries across all branches:
- Early (3-4): `phantomLine` with cryptic text
- Mid (6-7): `crtBand` or `scanlines` (short)
- Late (9-10): `scanlines` (long duration)
- Complete (12+): persistent subtle visual change

---

## Narrative Engine Integration

Drivers connect to the narrative state machine through a declarative layer that sits alongside the existing JavaScript driver definition. The full specification lives in [NARRATIVE-ENGINE.md](NARRATIVE-ENGINE.md). This section covers the integration points.

### Declaring Initial Flag State

Every driver declares the flag state it expects when loaded. This is both documentation ("what does this driver assume about the world?") and initialization ("set these flags if they aren't already set").

```yaml
initial_state:
  kernel:
    entropy.source: "rf0"
  os:
    daemons: "running"
  narrative:
    phase: "I"
    corruption: 0
  artifacts:
    rf0-buf: { state: "hidden" }
    kern-log: { state: "exists" }
```

Flags already set by a prior driver are not overwritten. Initial state is a floor, not a reset. If a Phase I driver set `narrative.dread` to 0.3, a Phase II driver's `initial_state` of `dread: 0` will not lower it.

### Mapping Beats to Flag Mutations

Story beats are the bridge between discovery-gated content (the existing system) and flag-driven behaviors (the narrative engine). Each beat declares a trigger and a set of effects:

```yaml
beats:
  - id: "rf-found"
    trigger: { type: "file_read", match: ".rf0.buf" }
    effects:
      artifacts:
        - id: "rf0-buf"
          state: "exists"
      glitch: { effect: "screenFlicker" }
      narrative:
        - flag: "narrative.dread"
          action: increment
          value: 0.05
    once: true
```

Beats fire in response to the same events the existing trigger system handles (`discovery`, `command`, `file_read`, `count`). The difference is that beats mutate flags rather than (or in addition to) running callbacks. This makes the effects declarative and inspectable.

**Coexistence with existing triggers:** Drivers can use both the existing `triggers` array (JavaScript callbacks) and the narrative engine `beats` array. They are evaluated independently. For new drivers, prefer beats. For existing drivers, no migration is required.

### Artifact Content by State

Artifacts define content variants keyed by state name. The engine selects the variant matching the artifact's current state flag:

```yaml
artifacts:
  - id: "rf0-buf"
    type: "hidden_file"
    filename: ".rf0.buf"
    content:
      exists: "rf0: rx ring overrun (847 bytes not consumed) ..."
      active: "rf0: rx ring overrun (847 bytes not consumed) ... [relay active]"
      corrupted: "rf0: rx ░▒▓█ ov█rrun (84░ bytes ███ consumed) ..."
```

**Artifact types:**

| Type | What It Is | How Content Is Delivered |
|------|-----------|------------------------|
| `hidden_file` | A file visible with `ls -a` | Returned by `cat` / file read |
| `text_file` | A file visible with `ls` | Returned by `cat` / file read |
| `command_output` | Output of a command | Returned when visitor runs the command |
| `system_file` | A /proc, /etc, or /var file | Returned by `cat` of the path |

When an artifact is in the `hidden` state, it does not appear in any listing and reads return "file not found." When it transitions to `exists` or beyond, it becomes visible.

### Ambient Behaviors

Ambient behaviors create background atmosphere without requiring visitor action. They are defined per-driver and evaluated on intervals:

```yaml
ambient:
  - condition: "narrative.dread > 0.3"
    effect: "crtBand"
    interval: 45000
  - condition: "narrative.corruption > 0.5"
    effect: "phantomLine"
    opts: { texts: ["are you still there?", "the channel is open"] }
    interval: 120000
```

**Design rules:**
- Minimum interval: 10 seconds
- Always include jitter (random variance) to avoid mechanical timing
- Suspend during active typing
- Ambient effects should be subtle — atmosphere, not alarm

### Cross-Driver Continuity

Drivers share a global flag namespace. Any driver can READ any flag. Drivers should only WRITE flags they declare in their own scope.

**Reading flags from other drivers:**

```yaml
# Gate a Phase II artifact behind Phase I completion
trigger:
  type: file_read
  match: ".daemon.log"
  condition: "Kernel.driver.has('contact-made')"  # from The Signal
```

**Driver-specific flags** (not in the global vocabulary) should be namespaced with the driver ID:

```yaml
effects:
  narrative:
    - flag: "the-signal.relay_active"
      action: set
      value: true
```

**Global flags** (kernel.*, os.*, narrative.*, artifact.*) are never prefixed. They belong to the world, not to any driver.

### Summary: Driver Definition Checklist (Narrative Engine)

When creating a driver with narrative engine integration, include:

- [ ] `initial_state` — declare expected flag values at load time
- [ ] `artifacts` — define content variants for each artifact state
- [ ] `beats` — map story moments to flag mutations
- [ ] `ambient` — define passive atmospheric effects (if any)
- [ ] Flag scope — document which global flags this driver reads and writes
- [ ] Prerequisites — list discovery IDs from other drivers that gate this driver's content

---

## Testing Checklist

For each driver, verify:
- [ ] All hidden files appear/hide correctly based on discovery gates
- [ ] All commands return expected output
- [ ] Glitch effects fire on correct discoveries
- [ ] `once: true` triggers don't re-fire on repeat
- [ ] Tab completion works for new commands
- [ ] Cross-references between branches are consistent
- [ ] sessionStorage persists discoveries across refresh
- [ ] Clearing sessionStorage resets everything
- [ ] `.bash_history` breadcrumbs hint at entry points without spoiling
- [ ] Narrative engine flags mutate correctly on beat triggers
- [ ] Artifact content varies correctly by artifact state
- [ ] Ambient behaviors fire on correct conditions and intervals
- [ ] Cross-driver flag reads gate content appropriately
- [ ] Factory reset (`rm -rf /`) restores all flags to defaults

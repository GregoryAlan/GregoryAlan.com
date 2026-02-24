# Narrative Engine

The narrative engine is the kernel of GregOS — not metaphorically, but architecturally. It manages narrative the way a real kernel manages hardware: content is the resource, state machines are the scheduler, discoveries are interrupts, flags are kernel memory, gates are permissions, and beats are interrupt service routines.

The engine already exists in simpler form as `Kernel.driver` (state machines, discoveries, flags, triggers, gated files). This document specifies the target vocabulary for its evolution — a formal flag taxonomy, declarative beat definitions, artifact lifecycle states, and ambient behavior systems. Everything here extends what the kernel already does; nothing replaces it.

This is a contract between the lore and the engine — it defines what flags exist, what states artifacts can be in, and how story beats move the dials.

### Architecture Mapping

| Narrative Engine Concept | Kernel Analog | Current Implementation |
|-------------------------|---------------|----------------------|
| Flags | Kernel memory / registers | `Kernel.driver.flags` (flat object) |
| State machines | Process scheduler | `Kernel.driver.registerStateMap()` |
| Discoveries | Hardware interrupts (IRQs) | `Kernel.driver.discover()` |
| Triggers / Beats | Interrupt service routines | `Kernel.driver._triggers[]` |
| Gates | Permission checks | `Kernel.driver.evaluateGate()` |
| Artifacts | Device nodes | Gated files via `createGatedFile()` |
| Ambient behaviors | Timer interrupts | Not yet implemented |
| Driver definitions | Device drivers / kernel modules | `Kernel.driver.registerDriver()` |
| JSON manifests | Firmware / ROM | `ManifestLoader.loadCached()` |

---

## Flag Categories

<!-- contract
status: aspirational
last-synced: 2026-02-22
notes: Formal flag system not implemented. Current code uses Kernel.driver.flags (flat object) and Kernel.driver.has() for discovery checks. This spec defines the target vocabulary for a future narrative engine.
-->

Flags are the state of the world. Every observable behavior in GregOS is driven by flags. Flags are organized into four categories: kernel, OS, narrative, and artifact.

### Kernel Flags

State of the OS internals. These are the physics of the world.

| Flag | Type | Values | Default | Description |
|------|------|--------|---------|-------------|
| `kernel.version` | string | semver | `"0.9.847"` (v1.1) / `"0.9.851"` (v2.0) | Kernel version string (layer-dependent) |
| `kernel.build` | number | — | `847` (v1.1) / `851` (v2.0) | Build number (layer-dependent; 847 persists as motif) |
| `kernel.entropy.source` | enum | `standard`, `rf0`, `overflowing` | `standard` | What feeds the entropy pool |
| `kernel.entropy.level` | number | 0-100 | `50` | Entropy pool fill level |
| `kernel.devices` | string[] | device names | `["null","zero","random","tty"]` | Registered /dev/ entries |
| `kernel.modules` | string[] | module names | `[]` | Loaded kernel modules |
| `kernel.pid0.visible` | boolean | — | `false` | Whether PID 0 appears in user-space listings |
| `kernel.pid0.state` | enum | `idle`, `running`, `signaling` | `idle` | What PID 0 is doing |
| `kernel.temporal` | enum | `linear`, `drifting`, `non-linear` | `linear` | Timestamp coherence |
| `kernel.sched_transform` | boolean | — | `false` | Whether transform scheduling class is active |

### OS Flags

Surface-level system state. What the visitor directly observes.

| Flag | Type | Values | Default | Description |
|------|------|--------|---------|-------------|
| `os.version` | string | — | `"2.0"` | GregOS version displayed to visitor |
| `os.users` | object[] | user records | `[{name:"guest",tty:"tty1"}]` | Logged-in users (w output) |
| `os.prompt` | string | — | `"guest@gregoryalan.com:~$"` | Current prompt string |
| `os.prompt.corruption` | number | 0-1 | `0` | Prompt corruption intensity |
| `os.filesystem` | object | dir tree | *(base tree)* | Current file/dir structure |
| `os.commands` | string[] | command names | *(base set)* | Available commands |
| `os.daemons` | enum | `stopped`, `idle`, `running`, `producing` | `idle` | Gregory's daemon activity |
| `os.logs.coherence` | enum | `normal`, `gaps`, `selective`, `contradictory` | `normal` | How consistent logs are |
| `os.background` | string | hex color | `"#0d1117"` | Terminal background color |

### Narrative Flags

Story-level state. Meta-information about where the visitor is in the experience.

| Flag | Type | Values | Default | Description |
|------|------|--------|---------|-------------|
| `narrative.phase` | enum | `I`, `II`, `III` | `"I"` | Current tonal phase |
| `narrative.corruption` | number | 0-1 | `0` | Global corruption intensity |
| `narrative.awareness` | enum | `none`, `reactive`, `anticipatory` | `"none"` | Whether system appears to notice visitor |
| `narrative.residue` | enum | `none`, `professional`, `observational`, `cryptic`, `silent` | `"none"` | Gregory's comment style in visible artifacts |
| `narrative.visitor_descent` | number | 0-1 | `0` | How far visitor has mirrored Gregory's path |
| `narrative.dread` | number | 0-1 | `0` | Accumulated unease level (drives ambient effects) |

### Artifact Flags

Per-artifact visibility and state. Each artifact is a file, command output, or system behavior with a lifecycle.

| Flag | Type | Values | Description |
|------|------|--------|-------------|
| `artifact.[id].state` | enum | `hidden`, `exists`, `active`, `corrupted`, `drifting` | Artifact lifecycle stage |
| `artifact.[id].reads` | number | 0+ | How many times visitor has accessed this artifact |
| `artifact.[id].content_key` | string | — | Which content variant to display |
| `artifact.[id].corruption` | number | 0-1 | Per-artifact corruption override |

---

## Artifact States

<!-- contract
status: aspirational
last-synced: 2026-02-22
notes: Current code uses gate/onRead pattern in driver definitions, not a formal artifact state machine. Artifacts are either gated (hidden until discovery) or always visible. No corrupted/drifting states exist yet.
-->

Artifacts are files, command outputs, or system behaviors. Each has a lifecycle stage that determines how it presents to the visitor.

| State | Meaning | Phase |
|-------|---------|-------|
| `hidden` | Not visible in any listing. Does not exist yet. | Any |
| `exists` | Visible. Content is grounded, clean, passes sysadmin test. | I+ |
| `active` | Content reflects current narrative state (may include anomalies appropriate to phase). | I+ |
| `corrupted` | Content partially eaten by corruption characters. Key revelations gated. | II+ |
| `drifting` | Content changes between reads. Same file, different output. | III only |

**State transitions** are one-directional within a session: `hidden` → `exists` → `active` → `corrupted` → `drifting`. An artifact can skip states (e.g., go directly from `hidden` to `active`) but should never regress.

**Content keying:** Each artifact defines content variants keyed by state name. The engine renders the variant matching the artifact's current state. If no variant exists for the current state, the engine falls back to the nearest prior state that has a defined variant.

---

## Narrative Beat Definition

<!-- contract
status: aspirational
last-synced: 2026-02-22
notes: Current drivers use a triggers[] array with {type, match, effect, once, callback} objects. This YAML beat format is the target for a future declarative narrative layer. The trigger types and effect actions defined here are the roadmap.
-->

Each beat in a driver template describes a story moment and its effects on the flag state. Beats are the atoms of narrative progression.

```yaml
beat:
  id: "beat-identifier"

  # What triggers this beat
  trigger:
    type: discovery | command | file_read | threshold | auto
    match: "discovery-id" | "command-name" | "filename" | number
    condition: "Kernel.driver.has('prerequisite')"  # optional gate

  # Flag mutations when beat fires
  effects:
    # Set kernel flags
    kernel:
      - flag: "kernel.devices"
        action: append
        value: "signal"
      - flag: "kernel.pid0.visible"
        action: set
        value: true

    # Set OS flags
    os:
      - flag: "os.users"
        action: append
        value: { name: "???", tty: "tty0", from: "0.0.0.0", what: "/dev/signal" }
      - flag: "os.background"
        action: set
        value: "#0a0d0a"

    # Set narrative flags
    narrative:
      - flag: "narrative.dread"
        action: increment
        value: 0.15
      - flag: "narrative.corruption"
        action: set
        value: 0.3

    # Set artifact flags
    artifacts:
      - id: "node-file"
        state: "exists"
      - id: "rf0-buf"
        state: "active"

    # Visual effects
    glitch:
      effect: "scanlines"
      opts: { persistent: true }

    # Terminal output
    output:
      lines:
        - { text: "rf0: connecting to 0.0.0.0:4119", delay: 2000 }
        - { text: "rf0: SYN sent ................ ACK", delay: 4500 }
      style: "system"  # system | error | anomaly | whisper

  # Whether this beat can fire more than once
  once: true
```

### Trigger Types

| Type | `match` Value | Fires When |
|------|--------------|------------|
| `discovery` | discovery ID string | `Kernel.driver.discover(id)` is called |
| `command` | command name string | Visitor runs the named command |
| `file_read` | filename string | Visitor reads the named file (via `cat`, etc.) |
| `threshold` | number | Total discovery count reaches this value |
| `auto` | — | Beat fires immediately when driver loads (used for initial state setup) |

### Effect Actions

| Action | Applies To | Behavior |
|--------|-----------|----------|
| `set` | any flag | Replace current value |
| `append` | array flags | Add value to array |
| `remove` | array flags | Remove value from array |
| `increment` | number flags | Add value to current (clamped to flag's range) |
| `decrement` | number flags | Subtract value from current (clamped to flag's range) |
| `toggle` | boolean flags | Flip current value |

---

## Driver Template (Narrative Engine Format)

<!-- contract
status: aspirational
last-synced: 2026-02-22
notes: Current driver format is the JS object format documented in DRIVER-TEMPLATE.md. This YAML format is the declarative target. See DRIVER-TEMPLATE.md for the implemented API.
-->

A complete driver definition using the narrative engine. This extends the existing JavaScript driver definition format (see DRIVER-TEMPLATE.md) with a declarative narrative layer.

```yaml
driver:
  id: "driver-name"
  phase: "I"
  prerequisites: []  # discovery IDs from previous drivers

  # Initial flag state when driver loads
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
      node-file: { state: "hidden" }
      kern-log: { state: "exists" }

  # Artifacts defined by this driver
  artifacts:
    - id: "rf0-buf"
      type: "hidden_file"
      filename: ".rf0.buf"
      content:
        exists: "rf0: rx ring overrun (847 bytes not consumed) ..."
        active: "rf0: rx ring overrun (847 bytes not consumed) ... [relay active]"
        corrupted: "rf0: rx ░▒▓█ ov█rrun (84░ bytes ███ consumed) ..."

    - id: "node-file"
      type: "hidden_file"
      filename: ".node"
      content:
        exists: null  # doesn't exist in this state
        active: "Proto  Local  Foreign  State  PID ..."

    - id: "kern-log"
      type: "command_output"
      command: "dmesg"
      content:
        exists: "[standard boot lines]"
        active: "[boot lines + rf0 device registration + PID 0 entries]"

  # Story beats (ordered by expected discovery sequence)
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

    - id: "contact-made"
      trigger: { type: "command", match: "decode --hex 4e4f524d" }
      effects:
        kernel:
          - flag: "kernel.devices"
            action: append
            value: "signal"
          - flag: "kernel.pid0.visible"
            action: set
            value: true
        os:
          - flag: "os.users"
            action: append
            value: { name: "???", tty: "tty0", from: "0.0.0.0" }
          - flag: "os.background"
            action: set
            value: "#0a0d0a"
        artifacts:
          - id: "node-file"
            state: "active"
          - id: "kern-log"
            state: "active"
        glitch: { effect: "heavyFlicker" }
        output:
          lines:
            - { text: "rf0: connecting to 0.0.0.0:4119", delay: 2000 }
            - { text: "hello?", delay: 16000, style: "whisper" }
        narrative:
          - flag: "narrative.dread"
            action: set
            value: 0.5
          - flag: "narrative.corruption"
            action: set
            value: 0.2
      once: true

  # Ambient behaviors active while driver is loaded
  ambient:
    - condition: "narrative.dread > 0.3"
      effect: "crtBand"
      interval: 45000  # ms between ambient triggers
    - condition: "narrative.corruption > 0.5"
      effect: "phantomLine"
      opts: { texts: ["are you still there?", "the channel is open"] }
      interval: 120000
```

---

## Flag-Driven Behaviors

<!-- contract
status: aspirational
last-synced: 2026-02-22
notes: Some behaviors partially exist (e.g., PID 0 visibility via contact flag, prompt corruption via glitch effect, background color change). But the formal flag-condition-to-behavior mapping is not implemented as a general engine.
-->

These define how flags affect system behavior globally — not per-driver. The engine evaluates these continuously.

| Flag Condition | System Behavior |
|---------------|-----------------|
| `kernel.pid0.visible == true` | PID 0 appears in `ps`, `w`, and `dmesg` output |
| `kernel.temporal == "drifting"` | Timestamps in logs occasionally contradict each other |
| `kernel.temporal == "non-linear"` | Timestamps can be negative or reference dates that haven't happened |
| `kernel.entropy.source == "overflowing"` | `/proc/entropy_avail` shows impossibly high values |
| `os.daemons == "producing"` | `/var/log/daemon.log` shows execution traces with anomalous behavior |
| `os.logs.coherence == "selective"` | Log entries related to visitor's recent commands are missing |
| `os.prompt.corruption > 0` | Prompt occasionally glitches (username flickers, path changes) |
| `narrative.awareness == "reactive"` | System output subtly references visitor's previous commands |
| `narrative.awareness == "anticipatory"` | Files appear before visitor looks for them |
| `narrative.corruption > 0.7` | All text output has chance of corruption proportional to level |
| `narrative.residue != "none"` | Gregory's files contain comments matching the residue style |

### Behavior Composition

Multiple flag conditions can be active simultaneously. Effects compose additively — prompt corruption from `os.prompt.corruption` stacks with text corruption from `narrative.corruption > 0.7`. The engine should not deduplicate overlapping visual effects; the compounding *is* the escalation.

### Flag Persistence

All flags persist in sessionStorage for the duration of a session. Flags survive page refresh but not `rm -rf /` (factory reset). On factory reset, all flags return to their defaults as defined in this document.

Cross-driver flag reads are always permitted. A driver in Phase II can read flags set by a Phase I driver to gate content appropriately. Flag *writes* should be scoped — each driver should only mutate flags it declares in its `initial_state` or `beats`, but the engine does not enforce this (it is a convention, not a constraint).

---

## Ambient Behaviors

<!-- contract
status: aspirational
last-synced: 2026-02-22
notes: No ambient behavior system exists. Current effects are one-shot triggers only. This spec defines the interval/jitter/condition system for future implementation.
-->

Ambient behaviors are passive effects that run on intervals while their conditions are met. They create atmosphere without requiring visitor action.

```yaml
ambient:
  - condition: "flag.expression"  # evaluated against current flag state
    effect: "effectName"          # glitch effect to trigger
    opts: {}                      # effect-specific options
    interval: 45000               # ms between triggers (minimum 10000)
    jitter: 0.3                   # random variance as fraction of interval (0-1)
```

### Design Constraints

- Ambient effects should be subtle. They create background unease, not jump scares.
- Minimum interval is 10 seconds. Anything faster feels like a bug, not atmosphere.
- Jitter prevents predictable timing. A `phantomLine` that fires exactly every 2 minutes feels mechanical. One that fires between 1:24 and 2:36 feels alive.
- Ambient behaviors are suspended while the visitor is actively typing (no glitch during command entry).
- Multiple ambient behaviors can be active simultaneously. They do not coordinate — independent timers, independent effects.

---

## Cross-Driver Continuity

<!-- contract
status: aspirational
last-synced: 2026-02-22
notes: Basic cross-driver flag reading exists (greg-corp.js checks Kernel.driver.has('contact-made') from the-signal.js). Formal flag namespacing and phase transitions are not implemented.
-->

Drivers exist in a shared flag namespace. This enables narrative continuity across the experience.

### Reading Flags From Other Drivers

Any driver can read any flag at any time using gate expressions:

```yaml
# In a Phase II driver, gate content behind Phase I completion
trigger:
  type: file_read
  match: ".daemon.log"
  condition: "Kernel.driver.has('contact-made')"  # from The Signal
```

### Writing Flags

Convention: drivers should only SET flags in their declared scope (flags listed in `initial_state` or mutated in `beats`). This prevents flag collision between drivers. The engine does not enforce this — it is a social contract between driver authors.

### Flag Namespacing

For driver-specific flags that don't map to the global vocabulary, use the driver ID as a prefix:

```yaml
effects:
  narrative:
    - flag: "the-signal.relay_active"
      action: set
      value: true
```

Global flags (those defined in the tables above) should never be prefixed. Driver-specific flags always should be.

### Phase Transitions

The `narrative.phase` flag is a global coordination point. When a driver's beats advance the visitor to Phase II, all loaded drivers that read `narrative.phase` will reflect the change. This is by design — the phase is the visitor's state, not the driver's.
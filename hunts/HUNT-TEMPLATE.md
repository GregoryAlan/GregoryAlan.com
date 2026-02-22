# Hunt Template

Guide for creating drop-in easter egg hunts for the GregoryAlan.com terminal.

---

## Naming Convention

### Hunt ID
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
- `help` is overridden by the hunt system to add a discovery-gated hint line

---

## Hunt Definition Structure

```javascript
const myHunt = {
    id: 'hunt-name',

    // Files added to the terminal filesystem
    files: {
        // Normal files (visible with ls)
        text: {
            'filename.txt': 'static content string',
        },
        // Hidden files (visible with ls -a)
        hidden: {
            '.filename': 'static content',
            // OR gated by discovery:
            '.gated-file': (huntState) => {
                if (!huntState.has('prerequisite-id')) return null;
                huntState.discover('this-discovery-id');
                return 'content revealed after prerequisite';
            },
        },
    },

    // Directories added to fileTree
    directories: {
        // 'dirname': { 'file.txt': 'file' }
    },

    // Commands added to the commands object
    commands: {
        commandname: (args, huntState) => {
            huntState.discover('discovery-id');
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
            // unlock: ['id'],      // discovery IDs to make available
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
};
```

---

## Content Guidelines

### Tone: Cyberpunk Noir
- The user is in a system they shouldn't be in
- Previous traces are almost erased, but not quite
- The system itself may be aware
- Cold, clinical text with cracks showing through

### Story Rules
- **Hint strongly, never confirm.** Every answer raises two questions.
- **No conclusions.** Branches cross-reference but never converge.
- **No fourth wall breaks.** Stay in character as a real system.
- **Escalate unease, not horror.** Creepy, not scary.

### Text Styling (HTML spans in output)
- `<span class="redacted">████████</span>` — blacked-out text
- `<span class="timestamp-anomaly">Jan 0 00:00</span>` — red with wavy underline
- `<span style="color:#444">dim whisper text</span>` — barely visible messages
- `<span style="color:#333">almost invisible</span>` — requires squinting
- `<span style="color:#222">ghost text</span>` — nearly hidden

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

## Branch Design Pattern

Each hunt should have 2-4 branches. Each branch:
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

## Testing Checklist

For each hunt, verify:
- [ ] All hidden files appear/hide correctly based on discovery gates
- [ ] All commands return expected output
- [ ] Glitch effects fire on correct discoveries
- [ ] `once: true` triggers don't re-fire on repeat
- [ ] Tab completion works for new commands
- [ ] Cross-references between branches are consistent
- [ ] sessionStorage persists discoveries across refresh
- [ ] Clearing sessionStorage resets everything
- [ ] `.bash_history` breadcrumbs hint at entry points without spoiling

# GregOS

**An operating system whose hardware resource is narrative.**

[https://gregoryalan.com](https://gregoryalan.com)

---

## What This Is

GregOS is interactive fiction told through a terminal. There are no cutscenes, no narration, no UI beyond the command line — the terminal is the only reality. You explore using real Unix commands: `ls`, `cat`, `cd`, `grep`. The system responds as a system would. What you find depends on what you do.

## Try It

Visit **[gregoryalan.com](https://gregoryalan.com)** and start typing.

## Architecture

Vanilla JavaScript. Single HTML entry point. No frameworks, no dependencies.

The architecture mirrors the fiction — the system is built like a real OS because, in the world of the story, it *is* a real OS.

| Layer | Role |
|-------|------|
| **Kernel** (`js/kernel.js`) | Filesystem, driver management, discovery state, version gating — manages narrative the way a real kernel manages memory and processes |
| **Shell** (`js/shell.js`) | Input parsing, tab completion, piping, history, job control |
| **Terminal** (`js/terminal.js`) | Display rendering, scrollback, cursor, output formatting |
| **Commands** (`js/cmd/`) | Pure functions: `(args, stdin) → output`. Core Unix commands, system tools, version-gated extensions |
| **Drivers** (`drivers/`) | Narrative state machines registered through the kernel's driver API |
| **Manifests** (`content/`) | JSON data files — the system's firmware. All content is data-driven |
| **Versions** (`js/versions.js`) | Layered content gating (v1.0 → v1.1 → v2.0), each version reveals new filesystem paths and capabilities |

Additional modules handle argument parsing (`js/argparse.js`), ambient system behaviors (`js/ambient.js`), manifest loading (`js/manifest-loader.js`), visual effects (`js/glitch.js`), and event dispatch (`js/events.js`).

**Content is data, not code.** The 13 JSON manifests in `content/` define every file, directory, man page, help description, and narrative element. Adding content means editing JSON — the engine doesn't change.

**Build:** `node build-curl.js` generates a virtual filesystem for `curl` and LLM access.

**Deploy:** `./deploy.sh` syncs to S3 + CloudFront.

## Source Overview

```
├── index.html              Single entry point
├── styles.css              Terminal styling
├── js/
│   ├── kernel.js           Core: filesystem, drivers, state, version gating
│   ├── shell.js            Input parsing, piping, completion, history
│   ├── terminal.js         Display rendering, scrollback, cursor
│   ├── versions.js         Version layer system (v1.0 → v1.1 → v2.0)
│   ├── manifest-loader.js  JSON manifest → kernel registration
│   ├── ambient.js          Background system behaviors
│   ├── argparse.js         Command argument parser
│   ├── glitch.js           Visual effect system
│   ├── events.js           Event bus
│   └── cmd/
│       ├── core.js         Essential commands (cat, ls, cd, grep, ...)
│       ├── unix.js         Extended Unix commands (ps, w, finger, df, ...)
│       ├── v2.js           Version-gated commands
│       └── bin-tools.js    Installable tool commands
├── drivers/
│   ├── the-signal.js       Discovery-driven narrative driver
│   └── greg-corp.js        Discovery-driven narrative driver
├── content/                13 JSON manifests (filesystem, man pages, help, ...)
├── build-curl.js           VFS builder for curl/LLM access
└── deploy.sh               S3 + CloudFront deployment
```

## Exploration Hints

- Try the commands you'd try on any Unix system.
- Read the files. Read between the files.
- The system remembers what you've done.
- Some things only appear after others have been found.
- If something seems wrong, investigate.

## License

[MIT](LICENSE)

# Narrative Seeds — Filesystem Content Spec

Ambient narrative content seeded throughout the GregOS filesystem. Every entry here carries narrative weight — it either tells part of Gregory's story, embeds an anomaly for the visitor to discover, or connects to other files to create investigation threads.

This spec is reusable: future narrative arcs can follow the same structure to seed a different story through different system files. The pattern is always the same — believable system output with embedded threads that reward careful readers.

Files without narrative purpose (cpuinfo, meminfo, fstab, auth.log, etc.) are structural atmosphere and are left to the developer's discretion. This spec covers only content that matters to the story.

---

## How To Read This Spec

Each file entry includes:
- **Type:** Static (fixed string) or Dynamic (function-valued, content changes based on narrative state)
- **Content:** The literal text the visitor sees when they `cat` the file
- **What this tells the visitor:** The narrative purpose — what a careful reader assembles from this file
- **Baseline vs. Post-contact:** For dynamic files, what changes after The Signal hunt triggers contact

---

## Established Canon

Values already set in the codebase. All content must match these exactly.

| Detail | Value | Source |
|--------|-------|--------|
| Kernel version | `0.9.847-greg` | uname, version.txt |
| Build number | `#847` | version.txt, dmesg |
| Hostname | `gregoryalan.com` | Shell.env.HOSTNAME |
| GregOS version | `2.0` | version.txt |
| Build date | `2026-01-22` | broadcast.log, version.txt |
| Gregory's CS timeline | 1979–1982 | bin-tools.js man pages |
| RF device | `/dev/rf0` | the-signal.js |
| Relay target | `0.0.0.0:4119` | the-signal.js |
| Guest TTY | `tty1` | the-signal.js |
| Intruder TTY | `tty0` | the-signal.js |
| Buffer size | `847 bytes` | .rf0.buf |
| Anomaly CSS | `class="timestamp-anomaly"` | the-signal.js |
| Redaction CSS | `class="redacted"` | the-signal.js |
| Error color | `style="color:#f55"` | the-signal.js |
| Whisper color | `style="color:#5f5"` | the-signal.js |
| Existing PIDs | init(1), kthreadd(2), sshd(47), cron(63) | unix.js ps command |

---

## Thread 1: The Daemon Pipeline

The central narrative thread. A visitor who follows it discovers: Gregory built four tools, connected them into a pipeline that transforms hardware entropy, scheduled them to run every minute, and never turned them off. The pipeline is still running.

### /etc/crontab

**Type:** Static

The most important file in the system after `.rf0.buf`.

```
# /etc/crontab - GregOS system crontab
# m h  dom mon dow  user   command

# system maintenance
0  3   *   *   *    root   /usr/sbin/logrotate /etc/logrotate.conf
15 *   *   *   *    root   /usr/bin/entropy-check >> /var/log/syslog 2>&1

# ── greg's daemon chain ──────────────────────────────
*/1 *  *   *   *    greg   /home/greg/bin/shift < /dev/entropy | /home/greg/bin/remap | /home/greg/bin/align | /home/greg/bin/exec >> /var/log/daemon.log 2>&1
*/1 *  *   *   *    greg   /home/greg/bin/shift < /dev/entropy | /home/greg/bin/remap | /home/greg/bin/exec >> /var/log/daemon.log 2>&1
*/1 *  *   *   *    greg   /home/greg/bin/remap < /dev/entropy | /home/greg/bin/align | /home/greg/bin/exec >> /var/log/daemon.log 2>&1
*/1 *  *   *   *    greg   /home/greg/bin/shift < /dev/entropy | /home/greg/bin/align >> /var/log/daemon.log 2>&1

# keep the channel open
```

**What this tells the visitor:**
- Gregory wrote four tools (shift, remap, align, exec) and connected them into Unix pipelines
- He's running four variations, each with a different combination/order of tools — he's testing which arrangement matters
- They all read from `/dev/entropy` (hardware randomness) and log to `/var/log/daemon.log`
- They run every minute and have never been stopped
- `# keep the channel open` sits alone at the bottom. No command follows it. It reads as either a maintenance note or a prayer. It is not explained.
- The normal system entries above (logrotate, entropy-check) make the daemon entries feel like they belong

### /proc/daemons

**Type:** Dynamic. Always visible at v2.0.

Shows the running state of Gregory's daemons.

**Baseline (pre-contact):**

```
DAEMON  PID   STARTED              UPTIME       CHAIN                         STATUS
gregd   847   2025-10-15 00:00     [COMPUTED]   rf0|shift|remap|align|exec    running
gregd   848   2025-10-15 00:00     [COMPUTED]   rf0|shift|remap|exec          running
gregd   849   2025-10-15 00:00     [COMPUTED]   rf0|remap|align|exec          running
gregd   850   2025-10-15 00:00     [COMPUTED]   rf0|shift|align               running

4 daemons active, 0 stopped
cycles completed: [COMPUTED]
last exec: [COMPUTED]
```

Dynamic values:
- `UPTIME`: Hours and minutes since epoch `2025-10-15T00:00:00Z`. Format: `XXXXhYYm`.
- `cycles completed`: `Math.floor(uptimeHours * 60)` (one cycle per minute per crontab).
- `last exec`: Current time minus 0–59 random seconds. Always within the last minute.

**Post-contact addition:**
```
NOTE: chain 847 exit code anomaly — see /var/log/daemon.log
```

**What this tells the visitor:**
- PID 847 — the motif as a process ID
- Four daemons running four chain permutations, matching the crontab entries
- They all started at the same time and have been running for months
- The last execution is always within the last minute — this is live
- Post-contact, the system flags an anomaly and points to the daemon log

### /var/log/daemon.log

**Type:** Dynamic. Always visible at v2.0. The execution log where the anomaly lives.

**Baseline (pre-contact):**

```
[gregd:847] cycle 4847201 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847202 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847203 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:848] cycle 4847203 | rf0|shift|remap|exec       | exit 0 | 512 bytes
[gregd:847] cycle 4847204 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847205 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:849] cycle 4847205 | rf0|remap|align|exec       | exit 0 | 847 bytes
[gregd:847] cycle 4847206 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:850] cycle 4847206 | rf0|shift|align             | exit 0 | 256 bytes
[gregd:847] cycle 4847207 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
```

Clean. All exit codes are 0. Busy daemons doing their work. Nothing wrong.

**Post-contact (appended):**

```
[gregd:847] cycle 4847208 | rf0|shift|remap|align|exec | exit 847 | 847 bytes
[gregd:847] cycle 4847209 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847210 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847211 | rf0|shift|remap|align|exec | exit 847 | 847 bytes
[gregd:847] cycle 4847212 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847213 | rf0|shift|remap|align|exec | exit 847 | 847 bytes
[gregd:847] cycle 4847214 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847215 | rf0|shift|remap|align|exec | exit 0 | 847 bytes
[gregd:847] cycle 4847216 | rf0|shift|remap|align|exec | exit 847 | 847 bytes
NOTE: exit code distribution for chain 847 non-uniform (p < 0.001)
NOTE: clustering detected — see /home/greg/bin/exec --analyze
```

**What this tells the visitor:**
- Pre-contact: everything was normal. Post-contact: something changed.
- Exit code 847 appears roughly every 3 cycles. Random execution should produce random exit codes. This one clusters around a specific non-zero value.
- Only chain 847 (the full four-tool pipeline: shift|remap|align|exec) shows the anomaly. The partial chains stay clean. The complete chain does something the partials don't.
- `p < 0.001` — the system itself knows this is statistically impossible
- `exec --analyze` — references a flag on Gregory's tool, breadcrumb for Phase II

### /home/greg/bin/ (shift, remap, align, exec)

**Type:** Static. Four tools, presented as bare usage/help text. No personal comments. No commentary. Tools are tools.

Each follows this format:
```
#!/usr/bin/env bash
# [name] - [one-line description]
# v[X.Y.Z] ([date])
#
# [2-3 lines of technical description]
#
# Usage: [name] [options] < input > output
#   [option flags]
#
# Part of the rf0 analysis toolkit.
# Gregory Alan, 2025
```

| Tool | Description | Default of note | Version | Date |
|------|-------------|-----------------|---------|------|
| shift | Bitwise stream transform | offset: 7 bits | v2.1.0 | 2025-08-14 |
| remap | Byte substitution transform (bijective) | built-in table | v1.4.0 | 2025-09-02 |
| align | Stream frame alignment | width: **847** bytes | v3.0.1 | 2025-09-20 |
| exec | Stream execution engine (sandboxed) | sandbox: on | v4.2.0 | 2025-10-12 |

**What this tells the visitor:**
- Each tool is individually a standard stream processing utility. A CS student would recognize every one.
- They were built over three months (Aug–Oct 2025), iterated heavily (multiple major versions)
- `align` defaults to width 847 — the motif, defensible as a tuning parameter
- `exec --analyze` exists — the same flag referenced in daemon.log
- "Part of the rf0 analysis toolkit" — Gregory framed these as analysis tools. That's how it started.
- Gregory's voice is absent from the tools themselves. Phase II earns the comment drift.

---

## Thread 2: The Entropy Anomaly

A secondary thread. The hardware entropy pool that feeds the daemon pipeline doesn't behave correctly — it never depletes, despite constant consumption.

### /proc/entropy_avail

**Type:** Dynamic. Always visible.

The pool value jitters (base 3847, ±6 random per read) but never drops meaningfully.

**Baseline:**
```
entropy pool: [3841–3853]
source: rf0 (hw)
refill rate: 847.0 bytes/sec
pool low watermark: 256
pool high watermark: 4096
```

**Post-contact addition:**
```
WARNING: pool has not reached low watermark in 847+ hours
```

**What this tells the visitor:**
- The entropy pool reads ~3847 — well above the low watermark of 256
- Refill rate: 847.0 bytes/sec (motif echo, reads as normal throughput)
- Post-contact, the system flags that the pool hasn't dropped to its low watermark since the daemons started. Four daemons consuming entropy every minute should deplete it. It doesn't.

### /var/log/syslog (entropy thread)

**Type:** Static.

The entropy-check entries (run every 15 minutes per crontab):

```
Jan 22 00:00:01 gregoryalan syslogd: started
Jan 22 00:00:01 gregoryalan kernel: gresos-kernel 0.9.847 boot complete
Jan 22 00:00:02 gregoryalan sshd[47]: Server listening on 0.0.0.0 port 22
Jan 22 00:00:02 gregoryalan cron[63]: (CRON) INFO (pidfile fd = 3)
Jan 22 00:00:03 gregoryalan gregd[847]: daemon chain started (4 workers)
Jan 22 00:00:03 gregoryalan gregd[847]: source: /dev/entropy (rf0 hw)
Jan 22 00:00:03 gregoryalan gregd[847]: pool level: nominal
Jan 22 00:15:01 gregoryalan entropy-check: pool 3847, refill nominal
Jan 22 00:30:01 gregoryalan entropy-check: pool 3841, refill nominal
Jan 22 00:45:01 gregoryalan entropy-check: pool 3847, refill nominal
Jan 22 01:00:01 gregoryalan entropy-check: pool 3844, refill nominal
```

Embedded within otherwise boring syslog output. The pool values barely fluctuate (3841–3847). This is the background evidence for the entropy_avail WARNING. Individually unremarkable. In context: wrong.

---

## Thread 3: The Signal Infrastructure

Files that describe the kernel-level infrastructure Gregory built to support the entropy subsystem and, eventually, the signal device.

### /etc/modules.conf

**Type:** Static.

```
# /etc/modules.conf - module load order
#
# Core devices
rf0         /lib/modules/0.9.847/rf0.ko         # SDR hardware entropy source
entropy     (built-in)                           # entropy pool management

# Extended pipeline (added 0.9.2)
transform   (built-in)                           # sys_transform(), sys_chain_exec()

# Post-pipeline (added 0.9.3)
signal      /lib/modules/0.9.847/signal.ko       # depends: transform, entropy
```

**What this tells the visitor:**
- The `signal` module was the last thing added to the kernel (0.9.3)
- It depends on both `transform` and `entropy` — it needs the full pipeline
- The version jumps (0.9.2, 0.9.3) match the kernel version history
- `signal.ko` exists as a loadable module, not built-in — it's separable, optional, added after the fact

### /etc/gregos-release

**Type:** Static.

```
GregOS 2.0.1
BUILD: 2026-01-22
KERNEL: 0.9.847-greg
ARCH: x86_64
CODENAME: rf0
```

The codename. Most OS releases use words. Gregory named his after the SDR device at the center of everything.

### /var/log/kern.log

**Type:** Dynamic. Boot messages that extend after contact.

**Baseline:**

```
[    0.000000] gresos-kernel 0.9.847 #847 SMP
[    0.001203] CPU: x86_64 detected
[    0.012847] Memory: 512MB available
[    0.024100] gregfs: mounted / (rw)
[    0.031000] dev: /dev/null registered
[    0.031200] dev: /dev/zero registered
[    0.031400] dev: /dev/random registered
[    0.032000] dev: /dev/entropy registered (rf0 hw backing)
[    0.033000] init: starting services
[    0.040000] svc: sshd started
[    0.041000] svc: cron started
[    0.042000] svc: gregd started (4 daemons)
[    0.050000] login: guest session opened on tty1
```

Clean boot. Every line standard. The detail worth noticing: `svc: gregd started (4 daemons)` — mentioned in passing, like any other service.

**Post-contact (appended):**

```
[  847.000000] rf0: rx ring overrun (847 bytes not consumed)
[  847.000001] rf0: unexpected exec in rx buffer
[  847.000003] audit: pid=0 comm=(unknown) ppid=0
[  847.000005] dev: /dev/signal registered (no hw backing)
[  847.000007] signal: mount /dev/signal type=chardev (rw)
[  847.000009] <span style="color:#f55">PID 0: fork() from swapper — illegal in user context</span>
```

Complements what `dmesg` already shows, with additional detail: the signal device mount type, and the specific kernel error about PID 0 forking from the swapper task — something the kernel was never built to allow.

---

## Thread 4: Gregory's Presence

Files that establish Gregory as a real person who lived on this system.

### /home/greg/.bashrc

**Type:** Static.

```
# ~/.bashrc - Gregory Alan
export PATH="$HOME/bin:$PATH"
export EDITOR=vim
alias ll='ls -la'
alias entropy='cat /proc/entropy_avail'
alias dlog='tail -20 /var/log/daemon.log'

# quick chain test
alias chaintest='shift < /dev/entropy | remap | align | exec 2>/dev/null; echo $?'
```

**What this tells the visitor:**
- Gregory added his `bin/` tools to his PATH — he used them constantly
- His most-checked files: entropy pool status and daemon log output
- `chaintest` is his manual shortcut for the full pipeline. He was checking exit codes by hand before he automated it.
- He used vim. He was a normal developer.

---

## Cross-File Discovery Threads

These threads connect files to each other, rewarding visitors who explore systematically:

| Thread | Path |
|--------|------|
| **The pipeline** | `/etc/crontab` → `/home/greg/bin/*` → `/proc/daemons` → `/var/log/daemon.log` |
| **The entropy anomaly** | `/proc/entropy_avail` → `/var/log/syslog` → `/etc/crontab` (consumption rate vs. pool stability) |
| **Gregory's trail** | `/etc/passwd` → `/home/greg/.bashrc` → `/home/greg/bin/` → `/etc/crontab` |
| **The 847 motif** | `/proc/version` (#847) → `/proc/daemons` (PID 847) → `/var/log/daemon.log` (exit 847) → `/home/greg/bin/align` (width 847) |
| **The signal device** | `/etc/modules.conf` (signal.ko) → `/var/log/kern.log` (/dev/signal registered) |
| **The contact shift** | `/var/log/kern.log` (post-contact) → `/proc/daemons` (NOTE) → `/var/log/daemon.log` (exit anomaly) → `/proc/entropy_avail` (WARNING) |

No thread leads to a conclusion. Every thread leads to another question.

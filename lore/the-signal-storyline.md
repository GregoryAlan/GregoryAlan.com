# The Signal — Storyline Document

## Premise

A stale RF buffer dump sits on the system — an rx ring overrun that was never consumed. The user investigates, confirms they're alone, and accidentally executes the embedded payload by trying to decode the hex. A relay activates. A remote node connects. Someone types "hello?" The user is no longer alone.

Inspired by *The Cuckoo's Egg* — the horror isn't in the supernatural, it's in realizing someone else is in your system.

## Five Acts

### Act 1: Discovery

<!-- contract
status: implemented
impl: drivers/the-signal.js:files.hidden['.rf0.buf'], triggers[0] (rf-found → screenFlicker)
last-synced: 2026-02-22
-->

- `ls -a` reveals `.rf0.buf` — a stale RF device buffer dump
- `cat .rf0.buf` shows `rf0: rx ring overrun (847 bytes not consumed)` with a hex dump containing ELF markers and a relay target
- The hex `4e4f524d` is visible in the dump — a natural thing to try decoding
- `.bash_history` includes `man decode` as a breadcrumb — the user learns what `decode` does
- Effect: screenFlicker

### Act 2: Alone

<!-- contract
status: implemented
impl: drivers/the-signal.js:commands.w (checked-alone discovery), patches.hiddenFiles['.bash_history']
last-synced: 2026-02-22
-->

- `.bash_history` includes `w` as a breadcrumb
- `w` shows 1 user: just guest on tty1
- This establishes the "before" state — you're alone on this machine
- No effect (everything appears normal)

### Act 3: Accidental Execution

<!-- contract
status: implemented
impl: drivers/the-signal.js:commands.decode (rf-executed discovery), triggers[1] (heavyFlicker + connection sequence callback)
last-synced: 2026-02-22
-->

- User tries `decode --hex 4e4f524d` thinking they're converting hex to ASCII
- The decode command detects an ELF header — this isn't text data, it's a program
- Output: `ELF binary detected in input`, `mapped segment at 0x847`, `segfault at 0x847: unexpected exec in rx buffer`
- The user just accidentally executed the embedded relay program
- Effect: heavyFlicker

### Act 4: The Connection

<!-- contract
status: implemented
impl: drivers/the-signal.js:triggers[1].callback (timed messages), triggers[2] (contact-made → scanlines + dark bg)
last-synced: 2026-02-22
-->

- System messages begin appearing in the terminal on timed delays (like kernel output):
  - `rf0: connecting to 0.0.0.0:4119`
  - `rf0: SYN sent ................ ACK`
  - `rf0: connection pending`
  - `rf0: connection established from 0.0.0.0`
  - `rf0: session opened on tty0`
- Silence. Then: `hello?`
- This is the climax — someone connected through the relay you just activated
- Effect: scanlines (persistent) + dark background

### Act 5: Not Alone

<!-- contract
status: implemented
impl: drivers/the-signal.js:commands.w, commands.finger, commands.last, commands.dmesg, commands.strings, files.hidden['.node'], triggers[3-6]
last-synced: 2026-02-23
-->

- `w` now shows 2 users — guest on tty1, ??? on tty0 from 0.0.0.0
- Investigation commands reveal details about the intruder:
  - `finger root` — mystery user with redacted name, /dev/null shell
  - `last` — login history showing the remote connection
  - `dmesg` — kernel ring buffer showing device registration lines (baseline matches `/var/log/kern.log` boot entries), plus post-contact: rf0 device registration, `audit: pid=0`, and PID 0 running with no controlling tty. Post-contact lines differ between `dmesg` and `kern.log` — different filtered views of the same events (defensible).
  - `.node` file appears — netstat-style connection status report
  - `strings .rf0.buf` — extracts readable strings including `NORMAL SYSTEM OPERATION IS A LIE` and `relay --target=0.0.0.0:4119 --persist`
- Effects: crtBand, promptCorruption, screenTear, textCorruption (tied to investigation moments)

## Discovery Chain

<!-- contract
status: implemented
impl: drivers/the-signal.js:stateMap, triggers[]
last-synced: 2026-02-22
notes: All 8 discoveries implemented. State machine and trigger effects match spec.
-->

| # | ID | Trigger | Effect |
|---|-----|---------|--------|
| 1 | `rf-found` | `cat .rf0.buf` | screenFlicker |
| 2 | `checked-alone` | `w` (before contact) | none |
| 3 | `rf-executed` | `decode --hex 4e4f524d` | heavyFlicker + connection sequence |
| 4 | `contact-made` | auto (end of sequence) | scanlines + dark bg |
| 5 | `not-alone` | `w` (after contact) | crtBand |
| 6 | `intruder-finger` | `finger root` (after contact) | promptCorruption |
| 7 | `intruder-last` | `last` (after contact) | screenTear |
| 8 | `rf-strings` | `strings .rf0.buf` | textCorruption |

## The Buffer — Technical Anatomy

The 847-byte `.rf0.buf` is not a signal readout with some executable data mixed in. It is a realistic weaponized payload — a **dropper** — disguised as a signal readout. The visitor thinks they are decoding a message. They are looking at a weapon.

### Byte Layout

| Offset Range | Size | Content | Purpose |
|-------------|------|---------|---------|
| `0x0000–0x0258` | ~600 bytes | Valid signal data | **Camouflage layer** — when decoded normally, produces the signal readout the visitor sees. Legitimate-looking RF telemetry: frequency locks, timestamps, station IDs. This is the layer `decode --hex 4e4f524d` reads from. |
| `0x0259–0x026C` | ~20 bytes | `90 90 90 90 90 90...` | **NOP sled** — classic exploit technique. A runway of no-operation instructions that catches imprecise jumps and slides execution into the payload. Any execution that lands in this region will glide forward into the shellcode. |
| `0x026D–0x030C` | ~160 bytes | Position-independent shellcode | **Reverse shell payload** — compact, null-free machine code that opens a socket, connects back to the relay target (`0.0.0.0:4119`), and redirects stdin/stdout/stderr to the socket. This is the actual weapon: a ~160-byte reverse shell, small enough to be realistic, large enough to be functional. |
| `0x030D–0x034F` | ~67 bytes | Repeating 4-byte pattern | **Return address trigger** — a spray of return addresses pointing back into the NOP sled. When the buffer overflows its frame, one of these overwrites the saved return pointer, redirecting execution into the sled → payload. The repetition is the fingerprint: the same 4 bytes over and over. |

Total: 847 bytes. Not a round number. Not a power of two. The size of what survived the crossing.

### Offset-Dependent Duality

The buffer has two readings depending on where you start:

- **Normal decode** (offset 0x0000) — produces the signal readout. The camouflage layer. This is what `cat .rf0.buf` shows and what `decode --hex 4e4f524d` initially processes. The visitor sees RF telemetry and thinks they are reading a message.

- **Execution** (offset 0x0259+) — the NOP sled catches the jump, slides into the shellcode, and the same bytes that looked like a signal readout become executable instructions. The `ELF binary detected` / `segfault at 0x847` output in Act 3 is the system recognizing that the data it just "decoded" was actually code.

The duality is the point: the same 847 bytes are simultaneously a message and a weapon. The camouflage isn't hiding the payload — it IS the payload, read from a different offset. The visitor's act of decoding is the act that triggers execution.

### Forensic Fingerprints

What examination of the raw buffer would reveal to someone who knows what they're looking at:

- **High Shannon entropy** in the `0x026D–0x030C` range — payload section entropy approaches theoretical maximum (~7.9 bits/byte), far higher than the signal data section (~5.2 bits/byte). The `entropy` bin tool could detect this discontinuity.
- **NOP sled signature** — `90 90 90 90` is the x86 NOP opcode. A sequence of 20+ consecutive NOPs in a data buffer is a classic exploit indicator. The `strings` or `freq` bin tools could surface this pattern.
- **Null-byte avoidance** — the payload section contains zero `00` bytes. Real signal data would have nulls. Shellcode avoids them because null terminates string operations that might be handling the buffer. This is a deliberate engineering constraint.
- **Return address repetition** — the final ~67 bytes are the same 4-byte sequence repeated ~16 times. No natural data produces this pattern. It's a NOP sled return address spray, unmistakable to anyone who has analyzed buffer overflow exploits.

### The Dropper Concept

The 847 bytes are not the attack. They are the **dropper** — a minimal bootstrap that establishes a connection and fetches something bigger. The reverse shell payload doesn't contain instructions or data beyond "open a socket, connect back, hand over control." What comes through that socket — what arrives after `hello?` — is the actual payload.

This reframes the entire Signal arc: the visitor did not decode a message and accidentally trigger a side effect. The visitor activated a staged weapon system. The "message" was bait. The decode was the detonation. And the dropper's fetch destination — the address it calls home to — may be encoded in the signal data itself, hiding in the camouflage layer that the visitor already read past.

### The Mount — How the Buffer Surfaces

The visitor types `mount /dev/rf0` because the breadcrumbs led them there. But `rf0` is a character device (an SDR dongle). You don't mount character devices — you read from them. On a standard kernel, `mount` checks the device type via the block device validation path and rejects anything that isn't `S_IFBLK`. The command would fail with `mount: /dev/rf0: not a block device` and the buffer would stay buried.

Gregory disabled that check.

His dev build (0.9.851) sets `CONFIG_STRICT_DEVTYPE=n` — mount will attempt a raw read against any device regardless of type. He needed this to access rf0's buffer directly: the character device interface consumes data on read (streaming, no seek, no tell), but the rx ring holds 847 stale bytes that were never consumed. The only way to get at them without the character interface eating them is to bypass it entirely — raw-read the device buffer through the mount path, treating the rx ring like a block device's storage.

This is part of the descent. Gregory didn't disable the check carelessly. He disabled it deliberately because he needed to inspect the buffer at specific offsets. His commit annotation: `# mount it directly`. Reasonable. Defensible. One more small rational step toward something larger.

**The two-stage failure:** The mount proceeds past the device type check (disabled), loads the rf0 driver, and reads the rx ring buffer. It finds 847 unconsumed bytes and begins processing them. Then the content validation fires — ELF marker detected at offset 0x00, executable segment in the buffer. The mount refuses and faults. But the raw read already happened. The kernel's crash recovery dumps the buffer contents to `.rf0.buf` as a diagnostic artifact. The first line of defense (device type check) was removed by Gregory. The second line of defense (content validation) fires too late — the data is already in memory, already written to disk. The buffer is loose.

**What the visitor sees:** The crash sequence shows `CONFIG_STRICT_DEVTYPE=n — forcing raw read` in the mount output. A sysadmin would clock that immediately: *why is this disabled?* The man page documents it honestly — Gregory was a good enough developer to flag his own unsafe configurations in the docs, even in a dev build. The answer is in `man mount`, under NOTES. The visitor can find it if they look.

## Design Principles

- **No exposition text** — no colored `<span>` hints telling the user what to think
- **Terminal-authentic only** — system messages, kernel logs, user input, log entries
- **Let the user connect the dots** — the creepiness comes from *their own realization*
- **State changes tell the story** — `w` showing 1 user then 2 users is the entire narrative arc
- **Redacted data is atmosphere** — ████ blocks suggest classified/corrupted info without explaining it
- **Authentic UNIX vocabulary** — all kernel messages, device names, and command output use real conventions (`rf0`, `rx ring overrun`, `audit: pid=0`, `tx N bytes to`)

---

## Test Script

### Setup
1. Open `index.html` in a browser
2. Open DevTools console to watch for errors
3. Clear state first: `sessionStorage.clear()` in console, then refresh

---

### Phase 1: v1.0 ROM (Fresh Visit)

**Boot sequence** — device banner only. You're connecting to a running device, not watching it POST:

| Line | Expected |
|------|----------|
| 1 | `RF0 Broadcast Repeater v1.0` |
| 2 | `S/N RF0-4119-0847` |

No hardware checks (those happened at power-on). No ASCII art. No "GregBIOS".

**MOTD** — single line: `Type 'help' for diagnostics.` — the boot already identified the device.

**Prompt** — should be `rf0>` (bare ROM monitor, no path)

**Commands:**

| Command | Expected Output |
|---------|----------------|
| `help` | Lists exactly 7 commands: `cat`, `clear`, `help`, `ls`, `reboot`, `rm`, `status` (sorted). No `cd`, `pwd`, `open`, `whoami`, `history`, `sudo`, `man`. No "Text files:" line. |
| `ls` | Shows only `broadcast.log` and `status.txt`. No directories. |
| `cat broadcast.log` | Terse device log: `init from ROM`, `ant0: ACTIVE`, `rx0: 847 bytes buffered (unconsumed)`, `rx0: checksum FAIL`. |
| `cat status.txt` | Register-dump style: `firmware: 1.0-ROM`, `signal: NOMINAL`, `update: AVAILABLE`. |
| `status` | Live diagnostics: `RF0 DIAGNOSTICS`, `rf: 847.0MHz LOCK`, `rx buf: 847 bytes (unconsumed)`, `uptime: 847h 14m`. |
| `cd games` | `cd: command not found. Type 'help' for available commands.` |
| `whoami` | `whoami: command not found...` |
| `history` | `history: command not found...` |
| `man decode` | `man: command not found...` |

**Tab completion** — typing `c` then Tab should cycle `cat`/`clear` only. Typing `s` then Tab should complete `status`. No `cd`, `sudo`.

**Reboot without exploration:**

| Command | Expected Output |
|---------|----------------|
| `reboot` | Should reboot into v1.0 again (no update). Same ROM boot, same prompt. No update animation. |

### Phase 2: v1.0 → v1.1 Update

From v1.0, do some exploration first:

| Command | Expected Output |
|---------|----------------|
| `cat broadcast.log` | *(station log)* |
| `reboot` | **Update animation** appears: `Current version: 1`, `Update available: v1.1`, downloading/verifying/installing with dots, `System updated to v1.1`, `Rebooting into new firmware...`. Then v1.1 boot sequence. |

**v1.1 boot sequence** — brief with branding:

| Line | Expected |
|------|----------|
| 1 | `GregBIOS (C) 2026 Gregory Alan Computing` |
| 2 | *(blank)* |
| 3 | `Loading GregOS v1.1 ...` |
| 4 | *(blank)* |
| 5 | `Starting terminal ...` |

**MOTD** — should show `GregOS 1.1 (tty1)`, login info, ASCII art "GREGORY ALAN", "Developer & Creator", and `Type 'help'`.

**Prompt** — should be `guest@gregoryalan.com:~$`

**Commands:**

| Command | Expected Output |
|---------|----------------|
| `help` | Full command list including `cd`, `pwd`, `open`, `whoami`, `history`, `sudo`, `man`. Also shows `Text files:` line. No `status` command. No bin tools (`decode`, `rot13`, etc.). |
| `ls` | Text files (`welcome.txt`, `version.txt`, `contact.txt`, `about.txt`) + directories (`games/`, `drafts/`). No `bin/`. No `broadcast.log` or `status.txt`. |
| `cat welcome.txt` | `Welcome to GregOS 1.1...` |
| `cd games` | Works — prompt changes to `guest@gregoryalan.com:~/games$` |
| `ls` | Game HTML files |
| `cd ..` | Back to root |
| `whoami` | OS, browser, resolution info |
| `status` | `status: command not found...` |
| `decode --hex 48656c6c6f` | `decode: command not found...` |
| `dmesg` | `dmesg: command not found...` |

**The breadcrumb trail to v2.0:**

| Command | Expected Output |
|---------|----------------|
| `history` | Shows `.bash_history` entries from previous user. Last two entries: `cat version.txt`, `reboot -f`. |
| `cat version.txt` | Normal header (`GregOS v1.1`, `Build: 2026.01.22`, `Kernel: 0.9.847-greg`, `Update: available`) followed by an anomalous update manifest: `timestamp: 2091-11-15T03:14:00Z`, `checksum: a7 3f ?? ??`, `source: rf0`. The 2091 date is impossible — this system was built in 2026. |
| `reboot` | Just reboots into v1.1 again. No update. Plain reboot doesn't advance. |
| `reboot -f` | **Update animation**: `Current version: 1.1`, `Update available: v2.0`, download/verify/install, then **full v2.0 boot** with hardware detection, device registration, etc. |

### Phase 3: v2.0 Verification

**MOTD** — should show `GregOS 2.0 (tty1)`, ASCII art, login info.

**Commands:**

| Command | Expected Output |
|---------|----------------|
| `help` | Full command list. `Text files:` line. |
| `ls` | Text files + `games/`, `drafts/`, `bin/` directories. |
| `cat welcome.txt` | `Welcome to GregOS 2.0...` (updated text) |
| `cd bin` | Works |
| `ls` | Bin tools: `decode`, `rot13`, `freq`, `entropy`, `crc`, `strings` |
| `cd ..` | Back to root |
| `man decode` | Full man page |
| `decode --hex 48656c6c6f` | `Decoding hex...` → `> Hello` |

### Phase 4: Signal Hunt at v2.0

#### Act 1: Discovery

| Command | Expected Output |
|---------|----------------|
| `ls -a` | Hidden files including `.rf0.buf`. No `.node` yet. |
| `cat .rf0.buf` | `rf0: rx ring overrun (847 bytes not consumed)`, hex dump with ELF header, `4e4f524d` at offset 0020, `[354 bytes dropped]`, relay target at 0190–01a0, timestamp `-12` (red), `origin: unknown`. **screenFlicker** fires. |

#### Act 2: Alone

| Command | Expected Output |
|---------|----------------|
| `w` | 1 user — `guest` on `tty1`. No mystery user. |
| `finger guest` | Normal finger output. |
| `finger root` | `finger: root: no such user` |
| `last` | Only `guest` on `tty1`, `still logged in`. |
| `dmesg` | 13 boot lines (full kernel ring buffer matching `kern.log` baseline). No rf0 entries. |

#### Act 3: Learn the Tool → Accidental Execution

| Command | Expected Output |
|---------|----------------|
| `decode --hex 48656c6c6f` | `Decoding hex...` then `> Hello` |
| `decode --hex 4e4f524d` | `ELF binary detected`, `mapped segment at 0x847`, red `segfault`. **heavyFlicker** fires. |

**Wait ~16 seconds** for timed system messages:

| Delay | Message |
|-------|---------|
| ~2s | `rf0: connecting to 0.0.0.0:4119` |
| ~4.5s | `rf0: SYN sent ................ ACK` |
| ~7s | `rf0: connection pending` |
| ~10s | `rf0: connection established from 0.0.0.0` |
| ~12s | `rf0: session opened on tty0` |
| ~16s | green `hello?` — **scanlines** begin (persistent), background darkens to `#0a0d0a` |

#### Act 5: Not Alone

| Command | Expected Output |
|---------|----------------|
| `w` | **2 users** — `guest` on `tty1` and `???` on `tty0` from `0.0.0.0` running `/dev/rf0`. **crtBand** fires. |
| `finger root` | Redacted name (█ blocks), `/dev/null` shell, last login `Jan  0 00:00` from `0.0.0.0` (red). **promptCorruption** fires. |
| `last` | `guest` still logged in, plus red anomalous line: `???` on tty0 from `Jan  0 00:00`. **screenTear** fires. |
| `dmesg` | Original 13 boot lines plus rf0 entries: `rx ring overrun`, `unexpected exec in rx buffer`, `audit: pid=0`, `tx 847 bytes`, red `connection from 0.0.0.0`, red `PID 0: state=running`. |
| `ls -a` | `.node` now visible. |
| `cat .node` | Netstat-style table — rf0 protocol, `guest@tty1` local, redacted `████████@tty0` foreign, ESTABLISHED, PID 0. rtt `-3ms` (red). |
| `strings .rf0.buf` | `NORMAL SYSTEM OPERATION IS A LIE`, `relay --target=0.0.0.0:4119 --persist`, etc. **textCorruption** fires. |

### Phase 5: Persistence

1. **Page refresh at v2.0** — boot sequence should skip (`sessionStorage.bootDone`). Loads directly into v2.0 with all content, correct prompt, correct MOTD.
2. Scanlines and dark background should persist if contact was made.
3. `w` should still show 2 users.
4. Glitch triggers with `once: true` should **not** re-fire.
5. **Page refresh at v1.0** — if version is 1.0 in sessionStorage and bootDone is set, should skip boot and load v1.0 ROM with correct prompt and MOTD.

### Phase 6: Factory Reset (`rm -rf /`)

From any version (preferably v2.0 with Signal contact active):

| Step | Expected |
|------|----------|
| `rm -rf /` | Kernel panic animation plays (file removal lines, red errors, panic message). |
| *(after panic)* | Screen goes black. Garbled characters appear, flicker, disappear. |
| *(after garble)* | Boots into **v1.0 ROM**. Full reset — device banner (2 lines), `rf0>` prompt, single-line MOTD. |
| `help` | Only 7 commands. No bin tools, no Signal commands. |
| `ls` | Only `broadcast.log` and `status.txt`. |
| `w` | `w: command not found...` |
| *(DevTools)* | `sessionStorage` should be nearly empty (only version=1 flag). All discoveries and trigger flags cleared. |
| *(visual)* | No scanlines. No dark background. Clean terminal. |

### Phase 7: Edge Cases

| Test | Expected |
|------|----------|
| `reboot` at v1.1 | No update animation. Reboots into v1.1 again. Plain reboot never advances from v1.1. |
| `reboot -f` at v1.1 | Update animation, advances to v2.0. |
| `reboot` at v2.0 | No update animation. Reboots with v2.0 boot sequence. All content preserved. |
| `reboot -f` at v2.0 | Same as plain reboot — no v2.1 yet, `-f` has no effect. |
| `reboot -f` at v1.0 | Same as plain reboot — `-f` only matters at v1.1. Exploration gate still applies. |
| Skip boot (keypress) | Boot animation stops immediately, terminal appears. Works at all versions. |
| Skip update animation | Update text stops, proceeds to boot. Version still advances correctly. |
| `rm -rf /*` | Same as `rm -rf /` — triggers factory reset. |
| `rm anything-else` | `rm: Permission denied` |
| Tab at v1.0 | Only completes v1.0 commands. No `cd`, `decode`, etc. |
| `cat` at v1.0 | Only tab-completes `broadcast.log` and `status.txt`. |
| Multiple reboot from v1.0 without exploration | Should not advance — stays at v1.0 each time. |
| Reboot from v1.0 after running `status` | Should advance to v1.1 (exploration detected via `ran-status` discovery). |
| Reboot from v1.0 after 3+ commands | Should advance to v1.1 (history.length >= 3). |

// ─── GregOS Bootloader ──────────────────────────────────────
//
// Manages the OS evolution from bare ROM (v1.0) through full
// GregOS (v2.0). Each version layers commands, files, and
// directories on top of the previous one.
//
// Depends on: kernel.js (Kernel), shell.js (Shell),
//             cmd/core.js (coreCommands, v1Commands),
//             cmd/unix.js (v1_1CommandsPack),
//             cmd/bin-tools.js (binTools),
//             cmd/v2.js (v2CommandsPack, pkgRegistry, restoreInstalledPackages,
//                        getInstalledPackages),
//             hunts/the-signal.js (theSignalHunt),
//             hunts/greg-corp.js (gregCorpProfiles, gregCorpHomeFiles,
//                                 gregCorpCommands, gregCorpManPages,
//                                 gregCorpTriggers)

// ─── v1.0 Content ───────────────────────────────────────────
// spec: the-signal-storyline.md > Phase 1: v1.0 ROM

const v1Files = {
    'broadcast.log':
        'RF0 STATION LOG\n'
        + '[2026-01-22 03:14:00] init from ROM\n'
        + '[2026-01-22 03:14:01] ant0: ACTIVE\n'
        + '[2026-01-22 03:14:02] relay: STANDBY\n'
        + '[............]\n'
        + '[2026-01-22 08:47:00] rx0: 847 bytes buffered (unconsumed)\n'
        + '[2026-01-22 08:47:01] rx0: checksum FAIL \u2014 pkt held\n'
        + '[............]\n'
        + 'End of log.',

    'status.txt':
        'RF0 STATUS\n'
        + 'firmware: 1.0-ROM\n'
        + 'signal:   NOMINAL\n'
        + 'maint:    UNKNOWN\n'
        + 'update:   AVAILABLE\n'
        + '\n'
        + 'Run \'reboot\' to check for updates.',
};

// ─── v1.1 Content ───────────────────────────────────────────
// spec: the-signal-storyline.md > Phase 2: v1.0 → v1.1 Update

const v1_1Files = {
    'welcome.txt': 'GregOS 1.1 \u2014 Guest Terminal\n'
        + '\n'
        + 'Directories:\n'
        + '  games/     Interactive projects (cd games, then open)\n'
        + '  drafts/    Work in progress experiments\n'
        + '\n'
        + 'Useful commands:\n'
        + '  help       List available commands\n'
        + '  man <cmd>  Read the manual for a command\n'
        + '  cat <file> Read a file\n'
        + '  ls         List files and directories\n'
        + '  cd <dir>   Change directory\n'
        + '  open       Launch current folder in browser\n'
        + '\n'
        + 'Try: man gregos',
    'version.txt': 'GregOS v1.1\n'
        + 'Build:  2026.01.22\n'
        + 'Kernel: 0.9.847-greg\n'
        + 'Update: available\n'
        + '\n'
        + '-- update manifest --\n'
        + 'timestamp: 2091-11-15T03:14:00Z\n'
        + 'checksum:  a7 3f ?? ??\n'
        + 'source:    rf0',
    'contact.txt': 'greg@gregoryalan.com',
    'about.txt': 'Gregory Alan\n'
        + 'Developer. Builds games, tools, and systems.\n'
        + '\n'
        + 'This machine runs GregOS \u2014 a custom kernel and terminal.\n'
        + 'Projects live in games/ and drafts/. Everything here is\n'
        + 'either shipped or half-finished. Explore at your own pace.',
};

const v1_1HiddenFiles = {
    '.bash_history': [
        'uname -a',
        'whoami',
        'cat about.txt',
        'cd games',
        'ls',
        'open beary-time.html',
        'cd ..',
        'uptime',
        'cat version.txt',
        'ps',
        'df -h',
        'reboot -f',
    ].map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n'),
};

const v1_1Dirs = {
    "games": {
        "beary-time.html": "file",
        "ice-runner.html": "file",
        "taipei-climber.html": "file"
    },
    "drafts": {
        "game-of-life.html": "file",
        "sound-pad.html": "file"
    },
};

// ─── v1.1 Ambient System Files ───────────────────────────────
// spec: NONE — structural atmosphere, developer discretion

const v1_1Seeds = {
    '/etc/hostname': 'gregoryalan.com',

    '/etc/passwd':
        'root:x:0:0:root:/root:/bin/bash\n'
        + 'greg:x:1000:1000:Gregory Alan:/home/greg:/bin/bash\n'
        + 'guest:x:1001:1001:Visitor:/home/guest:/bin/bash\n'
        + 'sshd:x:47:47:SSH Daemon:/var/run/sshd:/usr/sbin/nologin\n'
        + 'nobody:x:65534:65534:Nobody:/nonexistent:/usr/sbin/nologin',

    '/etc/motd': 'Welcome to GregOS.\nType \'help\' for available commands.',

    '/etc/fstab':
        '# /etc/fstab - GregOS filesystem table\n'
        + '#\n'
        + '# <device>       <mount>      <type>   <options>        <dump> <pass>\n'
        + '/dev/sda1        /            gregfs   defaults         0      1\n'
        + 'proc             /proc        proc     defaults         0      0\n'
        + 'tmpfs            /tmp         tmpfs    defaults         0      0\n'
        + '/dev/rf0         /mnt/rf0     auto     noauto,user      0      0',

    '/proc/version':
        'gresos-kernel 0.9.847-greg (gcc 12.2.0) #847 SMP Jan 22 2026 00:00:00',

    '/sys/firmware/bios':
        'GregBIOS 1.2\n'
        + 'Vendor:       Gregory Alan Computing, Inc.\n'
        + 'Release Date: 01/22/1987\n'
        + 'ROM Size:     64 KB\n'
        + '\n'
        + 'Revision History:\n'
        + '  1.0  1985-03-14  Initial POST, 8-bit bus, 640K memory test\n'
        + '  1.1  1986-08-22  rf0 antenna controller, extended memory detect\n'
        + '  1.2  1987-01-22  Boot device priority, shipped with GregOS 1.1',

    '/proc/cpuinfo':
        'processor       : 0\n'
        + 'vendor_id       : GenuineIntel\n'
        + 'model name      : GregOS Virtual CPU\n'
        + 'cpu MHz         : 847.00\n'
        + 'cache size      : 512 KB\n'
        + 'bogomips        : 1694.00',

    '/proc/meminfo':
        'MemTotal:         524288 kB\n'
        + 'MemFree:          487392 kB\n'
        + 'MemAvailable:     498176 kB\n'
        + 'Buffers:            8472 kB\n'
        + 'Cached:            28424 kB\n'
        + 'SwapTotal:             0 kB\n'
        + 'SwapFree:              0 kB',
};

// ─── Narrative Seeds ─────────────────────────────────────────
//
// Ambient filesystem content seeded at v2.0. Each path is
// placed into the hierarchical VFS via addTreeFile().
// String values are static; functions receive Kernel.hunt
// state and return dynamic content.

const narrativeSeeds = {

    // ── System Overrides ──────────────────────────────────────
    // spec: NONE — structural atmosphere, v2.0 overrides of v1.1 values

    '/proc/version':
        'gresos-kernel 0.9.851-greg (gcc 14.1.0) #851 SMP Feb 15 2026 00:00:00',

    '/sys/firmware/bios':
        'GregBIOS 1.4\n'
        + 'Vendor:       Gregory Alan Computing, Inc.\n'
        + 'Release Date: 10/15/2025\n'
        + 'ROM Size:     256 KB\n'
        + 'ACPI:         2.0\n'
        + 'SMBIOS:       3.3.0\n'
        + '\n'
        + 'Revision History:\n'
        + '  1.0  1985-03-14  Initial POST, 8-bit bus, 640K memory test\n'
        + '  1.1  1986-08-22  rf0 antenna controller, extended memory detect\n'
        + '  1.2  1987-01-22  Boot device priority, shipped with GregOS 1.1\n'
        + '  1.3  2025-06-01  ACPI table support, PCI bus enumeration\n'
        + '  1.4  2025-10-15  Entropy source init, extended POST, 64-bit',

    // ── Extended /etc/passwd with employee accounts ──────────
    // spec: greg-corp-storyline.md > Setting: GregCorp

    '/etc/passwd':
        'root:x:0:0:root:/root:/bin/bash\n'
        + 'greg:x:1000:1000:Gregory Alan:/home/greg:/bin/bash\n'
        + 'guest:x:1001:1001:Visitor:/home/guest:/bin/bash\n'
        + 'dhollis:x:1002:1002:Diane Hollis:/home/dhollis:/bin/bash\n'
        + 'sshd:x:47:47:SSH Daemon:/var/run/sshd:/usr/sbin/nologin\n'
        + 'nobody:x:65534:65534:Nobody:/nonexistent:/usr/sbin/nologin',

    // ── Thread 1: The Daemon Pipeline ────────────────────────
    // spec: NARRATIVE-SEEDS.md > Thread 1 > /etc/crontab

    '/etc/crontab':
        '# /etc/crontab - GregOS system crontab\n'
        + '# m h  dom mon dow  user   command\n'
        + '\n'
        + '# system maintenance\n'
        + '0  3   *   *   *    root   /usr/sbin/logrotate /etc/logrotate.conf\n'
        + '15 *   *   *   *    root   /usr/bin/entropy-check >> /var/log/syslog 2>&1\n'
        + '\n'
        + '# \u2500\u2500 greg\'s daemon chain \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
        + '*/1 *  *   *   *    greg   /home/greg/bin/shift < /dev/entropy | /home/greg/bin/remap | /home/greg/bin/align | /home/greg/bin/exec >> /var/log/daemon.log 2>&1\n'
        + '*/1 *  *   *   *    greg   /home/greg/bin/shift < /dev/entropy | /home/greg/bin/remap | /home/greg/bin/exec >> /var/log/daemon.log 2>&1\n'
        + '*/1 *  *   *   *    greg   /home/greg/bin/remap < /dev/entropy | /home/greg/bin/align | /home/greg/bin/exec >> /var/log/daemon.log 2>&1\n'
        + '*/1 *  *   *   *    greg   /home/greg/bin/shift < /dev/entropy | /home/greg/bin/align >> /var/log/daemon.log 2>&1\n'
        + '\n'
        + '# keep the channel open',

    // spec: NARRATIVE-SEEDS.md > Thread 1 > /proc/daemons
    '/proc/daemons': (state) => {
        const epoch = new Date('2025-10-15T00:00:00Z').getTime();
        const now = Date.now();
        const ms = now - epoch;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const up = h + 'h' + String(m).padStart(2, '0') + 'm';
        const cycles = Math.floor(h * 60);
        const lastSec = Math.floor(Math.random() * 60);
        const last = new Date(now - lastSec * 1000)
            .toISOString().replace('T', ' ').substring(0, 19);

        let out = 'DAEMON  PID   STARTED              UPTIME       CHAIN                         STATUS\n'
            + 'gregd   847   2025-10-15 00:00     ' + up + '   rf0|shift|remap|align|exec    running\n'
            + 'gregd   848   2025-10-15 00:00     ' + up + '   rf0|shift|remap|exec          running\n'
            + 'gregd   849   2025-10-15 00:00     ' + up + '   rf0|remap|align|exec          running\n'
            + 'gregd   850   2025-10-15 00:00     ' + up + '   rf0|shift|align               running\n'
            + '\n4 daemons active, 0 stopped\n'
            + 'cycles completed: ' + cycles + '\n'
            + 'last exec: ' + last;

        if (state.flags.contact) {
            out += '\n\nNOTE: chain 847 exit code anomaly \u2014 see /var/log/daemon.log';
        }
        return out;
    },

    // spec: NARRATIVE-SEEDS.md > Thread 1 > /var/log/daemon.log
    '/var/log/daemon.log': (state) => {
        const epoch = new Date('2025-10-15T00:00:00Z').getTime();
        const cycles = Math.floor((Date.now() - epoch) / 60000);
        const base = cycles - 9;
        const mix = [847, 847, 847, 848, 847, 847, 849, 847, 850, 847];
        const chains = {
            847: 'rf0|shift|remap|align|exec',
            848: 'rf0|shift|remap|exec      ',
            849: 'rf0|remap|align|exec      ',
            850: 'rf0|shift|align           ',
        };
        const sizes = { 847: 847, 848: 512, 849: 847, 850: 256 };

        let out = '';
        for (let i = 0; i < 10; i++) {
            const pid = mix[i];
            out += '[gregd:' + pid + '] cycle ' + (base + i)
                + ' | ' + chains[pid]
                + ' | exit 0 | ' + sizes[pid] + ' bytes\n';
        }

        if (state.flags.contact) {
            const postBase = base + 10;
            const exits = [847, 0, 0, 847, 0, 847, 0, 0, 847];
            for (let i = 0; i < exits.length; i++) {
                out += '[gregd:847] cycle ' + (postBase + i)
                    + ' | ' + chains[847]
                    + ' | exit ' + exits[i] + ' | 847 bytes\n';
            }
            out += 'NOTE: exit code distribution for chain 847 non-uniform (p < 0.001)\n'
                + 'NOTE: clustering detected \u2014 see /home/greg/bin/exec --analyze';
        }

        return out.trimEnd();
    },

    // spec: NARRATIVE-SEEDS.md > Thread 1 > /home/greg/bin/ (shift, remap, align, exec)
    '/home/greg/bin/shift':
        '#!/usr/bin/env bash\n'
        + '# shift - Bitwise stream transform\n'
        + '# v2.1.0 (2025-08-14)\n'
        + '#\n'
        + '# Applies rotational bit-shifting to each byte in the\n'
        + '# input stream. Configurable offset with default of 7\n'
        + '# bits. Transform is reversible with the -r flag.\n'
        + '#\n'
        + '# Usage: shift [options] < input > output\n'
        + '#   -o N    Bit offset (default: 7)\n'
        + '#   -r      Reverse transform\n'
        + '#\n'
        + '# Part of the rf0 analysis toolkit.\n'
        + '# Gregory Alan, 2025',

    '/home/greg/bin/remap':
        '#!/usr/bin/env bash\n'
        + '# remap - Byte substitution transform (bijective)\n'
        + '# v1.4.0 (2025-09-02)\n'
        + '#\n'
        + '# Applies bijective byte-level substitution using a\n'
        + '# built-in mapping table. Every input byte maps to\n'
        + '# exactly one output byte. Deterministic and reversible.\n'
        + '#\n'
        + '# Usage: remap [options] < input > output\n'
        + '#   -t FILE    Use alternate substitution table\n'
        + '#   -r         Reverse mapping\n'
        + '#\n'
        + '# Part of the rf0 analysis toolkit.\n'
        + '# Gregory Alan, 2025',

    '/home/greg/bin/align':
        '#!/usr/bin/env bash\n'
        + '# align - Stream frame alignment\n'
        + '# v3.0.1 (2025-09-20)\n'
        + '#\n'
        + '# Segments input stream into fixed-width frames for\n'
        + '# downstream consumption. Incomplete trailing frames\n'
        + '# are padded with null bytes.\n'
        + '#\n'
        + '# Usage: align [options] < input > output\n'
        + '#   -w N    Frame width in bytes (default: 847)\n'
        + '#   -s      Strip padding on output\n'
        + '#\n'
        + '# Part of the rf0 analysis toolkit.\n'
        + '# Gregory Alan, 2025',

    '/home/greg/bin/exec':
        '#!/usr/bin/env bash\n'
        + '# exec - Stream execution engine (sandboxed)\n'
        + '# v4.2.0 (2025-10-12)\n'
        + '#\n'
        + '# Interprets aligned byte frames as executable micro-ops.\n'
        + '# Sandboxed by default \u2014 no filesystem or network access\n'
        + '# unless explicitly disabled.\n'
        + '#\n'
        + '# Usage: exec [options] < input > output\n'
        + '#   --sandbox=on|off   Toggle sandbox (default: on)\n'
        + '#   --analyze          Log execution patterns to stderr\n'
        + '#\n'
        + '# Part of the rf0 analysis toolkit.\n'
        + '# Gregory Alan, 2025',

    // ── Thread 2: The Entropy Anomaly ────────────────────────

    // spec: NARRATIVE-SEEDS.md > Thread 2 > /proc/entropy_avail
    '/proc/entropy_avail': (state) => {
        const jitter = Math.floor(Math.random() * 13) - 6;
        const pool = 3847 + jitter;
        let out = 'entropy pool: ' + pool + '\n'
            + 'source: rf0 (hw)\n'
            + 'refill rate: 847.0 bytes/sec\n'
            + 'pool low watermark: 256\n'
            + 'pool high watermark: 4096';
        if (state.flags.contact) {
            out += '\n\nWARNING: pool has not reached low watermark in 847+ hours';
        }
        return out;
    },

    // spec: NARRATIVE-SEEDS.md > Thread 2 > /var/log/syslog (entropy thread)
    '/var/log/syslog':
        'Jan 22 00:00:01 gregoryalan syslogd: started\n'
        + 'Jan 22 00:00:01 gregoryalan kernel: gresos-kernel 0.9.851 boot complete\n'
        + 'Jan 22 00:00:02 gregoryalan sshd[47]: Server listening on 0.0.0.0 port 22\n'
        + 'Jan 22 00:00:02 gregoryalan cron[63]: (CRON) INFO (pidfile fd = 3)\n'
        + 'Jan 22 00:00:03 gregoryalan gregd[847]: daemon chain started (4 workers)\n'
        + 'Jan 22 00:00:03 gregoryalan gregd[847]: source: /dev/entropy (rf0 hw)\n'
        + 'Jan 22 00:00:03 gregoryalan gregd[847]: pool level: nominal\n'
        + 'Jan 22 00:15:01 gregoryalan entropy-check: pool 3847, refill nominal\n'
        + 'Jan 22 00:30:01 gregoryalan entropy-check: pool 3841, refill nominal\n'
        + 'Jan 22 00:45:01 gregoryalan entropy-check: pool 3847, refill nominal\n'
        + 'Jan 22 01:00:01 gregoryalan entropy-check: pool 3844, refill nominal',

    // ── Thread 3: The Signal Infrastructure ──────────────────

    // spec: NARRATIVE-SEEDS.md > Thread 3 > /etc/modules.conf
    '/etc/modules.conf':
        '# /etc/modules.conf - module load order\n'
        + '#\n'
        + '# Core devices\n'
        + 'rf0         /lib/modules/0.9.851/rf0.ko         # SDR hardware entropy source\n'
        + 'entropy     (built-in)                           # entropy pool management\n'
        + '\n'
        + '# Extended pipeline (added 0.9.2)\n'
        + 'transform   (built-in)                           # sys_transform(), sys_chain_exec()\n'
        + '\n'
        + '# Post-pipeline (added 0.9.3)\n'
        + 'signal      /lib/modules/0.9.851/signal.ko       # depends: transform, entropy',

    // spec: NARRATIVE-SEEDS.md > Thread 3 > /etc/gregos-release (drift: code adds -dev suffix and CHANNEL)
    '/etc/gregos-release':
        'GregOS 2.0.1-dev\n'
        + 'BUILD: 2026-01-22\n'
        + 'KERNEL: 0.9.851-greg\n'
        + 'ARCH: x86_64\n'
        + 'CODENAME: rf0\n'
        + 'CHANNEL: unstable',

    // spec: NARRATIVE-SEEDS.md > Thread 3 > /var/log/kern.log
    '/var/log/kern.log': (state) => {
        let out = '[    0.000000] gresos-kernel 0.9.851 #851 SMP\n'
            + '[    0.001203] CPU: x86_64 detected\n'
            + '[    0.012847] Memory: 512MB available\n'
            + '[    0.024100] gregfs: mounted / (rw)\n'
            + '[    0.031000] dev: /dev/null registered\n'
            + '[    0.031200] dev: /dev/zero registered\n'
            + '[    0.031400] dev: /dev/random registered\n'
            + '[    0.032000] dev: /dev/entropy registered (rf0 hw backing)\n'
            + '[    0.033000] init: starting services\n'
            + '[    0.040000] svc: sshd started\n'
            + '[    0.041000] svc: cron started\n'
            + '[    0.042000] svc: gregd started (4 daemons)\n'
            + '[    0.050000] login: guest session opened on tty1';
        if (state.flags.contact) {
            out += '\n[  847.000000] rf0: rx ring overrun (847 bytes not consumed)\n'
                + '[  847.000001] rf0: unexpected exec in rx buffer\n'
                + '[  847.000003] audit: pid=0 comm=(unknown) ppid=0\n'
                + '[  847.000005] dev: /dev/signal registered (no hw backing)\n'
                + '[  847.000007] signal: mount /dev/signal type=chardev (rw)\n'
                + '[  847.000009] <span style="color:var(--error)">PID 0: fork() from swapper \u2014 illegal in user context</span>';
        }
        return out;
    },

    // ── Thread 4: Gregory's Presence ─────────────────────────

    // spec: NARRATIVE-SEEDS.md > Thread 4 > /home/greg/.bashrc
    '/home/greg/.bashrc':
        '# ~/.bashrc - Gregory Alan\n'
        + 'export PATH="$HOME/bin:$PATH"\n'
        + 'export EDITOR=vim\n'
        + 'alias ll=\'ls -la\'\n'
        + 'alias entropy=\'cat /proc/entropy_avail\'\n'
        + 'alias dlog=\'tail -20 /var/log/daemon.log\'\n'
        + '\n'
        + '# quick chain test\n'
        + 'alias chaintest=\'shift < /dev/entropy | remap | align | exec 2>/dev/null; echo $?\'',
};

// ─── Version Manifest ───────────────────────────────────────

const VERSION_MANIFEST = [
    {
        version: 1.0,
        apply() {
            // v1.0 ROM: no kernel, no BIOS — bare firmware
            Kernel.kernelVersion.set(null);
            Kernel.biosVersion.set(null);
            const v1Set = ['help', 'ls', 'cat', 'clear', 'reboot', 'rm', 'debug'];
            for (const name of v1Set) {
                if (coreCommands[name]) Shell.register(name, coreCommands[name]);
            }
            // v1.0-specific commands
            for (const [name, fn] of Object.entries(v1Commands)) {
                Shell.register(name, fn);
            }
            // v1.0 files
            for (const [name, content] of Object.entries(v1Files)) {
                Kernel.fs.addTextFile(name, content);
            }
        },
    },
    {
        version: 1.1,
        apply() {
            Kernel.kernelVersion.set('0.9.847-greg');
            Kernel.biosVersion.set('1.2');
            // Restore core UNIX commands
            const v1_1Set = ['cd', 'pwd', 'open', 'whoami', 'history', 'sudo', 'man'];
            for (const name of v1_1Set) {
                if (coreCommands[name]) Shell.register(name, coreCommands[name]);
            }
            // Remove v1.0-only commands
            Shell.unregister('status');
            // Remove v1.0-only files
            Kernel.fs.removeTextFile('broadcast.log');
            Kernel.fs.removeTextFile('status.txt');
            // Add v1.1 commands and man pages
            for (const [name, fn] of Object.entries(v1_1CommandsPack.commands)) {
                Shell.register(name, fn);
            }
            Kernel.fs.mergeManPages(v1_1CommandsPack.manPages);
            // Set hidden commands for help filtering
            Shell._hiddenCommands = v1_1CommandsPack.hiddenCommands;
            // Add v1.1 files
            for (const [name, content] of Object.entries(v1_1Files)) {
                Kernel.fs.addTextFile(name, content);
            }
            for (const [name, content] of Object.entries(v1_1HiddenFiles)) {
                Kernel.fs.addHiddenFile(name, content);
            }
            // Add directories
            Kernel.fs.mergeFileTree(v1_1Dirs);
            // Seed ambient system files
            for (const [path, content] of Object.entries(v1_1Seeds)) {
                Kernel.fs.addTreeFile(path, content);
            }
            // Record boot time for uptime command
            if (!Kernel.session.get('bootTime')) {
                Kernel.session.set('bootTime', String(Date.now()));
            }
        },
    },
    {
        version: 2.0,
        apply() {
            Kernel.kernelVersion.set('0.9.851-greg');
            Kernel.biosVersion.set('1.4');
            // Update welcome text and version
            Kernel.fs.addTextFile('welcome.txt',
                'Welcome to GregOS 2.0-dev\n'
                + 'Development build — not for production use.\n'
                + 'All activity may be monitored and recorded.');
            Kernel.fs.addTextFile('version.txt',
                'GregOS v2.0-dev\n'
                + 'Build:  2026.02.15\n'
                + 'Kernel: 0.9.851-greg\n'
                + 'Branch: dev/transform-pipeline\n'
                + 'Status: unstable');

            // v2.0 .bash_history (pre-crash breadcrumbs)
            Kernel.fs.addHiddenFile('.bash_history', [
                'cat welcome.txt',
                'pkg update',
                'pkg list',
                'pkg install decode',
                'pkg install strings',
                'cat migration.conf',
                'mount',
            ].map((cmd, i) => `  ${i + 1}  ${cmd}`).join('\n'));

            // Seed narrative filesystem content
            for (const [path, content] of Object.entries(narrativeSeeds)) {
                Kernel.fs.addTreeFile(path, content);
            }

            // Register v2 commands (pkg, mount, migration.conf)
            Kernel.hunt.registerHunt(v2CommandsPack);

            // Register Signal hunt (commands + gated files)
            // Must come after v2CommandsPack so Signal's decode/strings win
            Kernel.hunt.registerHunt(theSignalHunt);

            // Register Greg Corp commands directly (su, finger override)
            for (const [name, fn] of Object.entries(gregCorpCommands)) {
                Shell.register(name, fn);
            }
            Kernel.fs.mergeManPages(gregCorpManPages);
            Kernel.hunt._triggers.push(...gregCorpTriggers);

            // Seed employee home directories
            for (const [path, content] of Object.entries(gregCorpHomeFiles)) {
                Kernel.fs.addTreeFile(path, content);
            }

            // Restore any previously installed packages
            restoreInstalledPackages();

            // Remove bin tool commands not yet installed via pkg.
            // registerHunt(theSignalHunt) added decode/strings to commands,
            // but they should only be available after pkg install.
            const installed = getInstalledPackages();
            for (const pkg of pkgRegistry) {
                if (!installed.includes(pkg.name)) {
                    Shell.unregister(pkg.name);
                }
            }
        },
    },
];

// ─── applyVersion ───────────────────────────────────────────

function applyVersion(targetVersion) {
    Shell.resetCommands();
    Kernel.fs.reset();
    Kernel.hunt.reset();
    // Reset active profile on version change
    Terminal._pendingAuth = null;
    Shell._activeProfile = null;
    Shell._savedEnv = null;
    Shell._savedCwd = null;
    Shell._savedHistory = null;
    Shell._savedBashHistory = undefined;
    Shell.env.USER = 'guest';
    Shell.env.HOME = '/home/guest';
    Shell.env.HOSTNAME = 'gregoryalan.com';
    for (const layer of VERSION_MANIFEST) {
        if (layer.version > targetVersion) break;
        layer.apply();
    }
}

// ─── getNextVersion ─────────────────────────────────────────

function getNextVersion(force) {
    const ver = Kernel.hunt.getVersion();

    if (ver < 1.1) {
        return 1.1;
    }

    if (ver < 2.0) {
        return force ? 2.0 : null;
    }

    return force ? null : 1.1;           // fall back to stable unless forced
}

// ─── MOTD ───────────────────────────────────────────────────

const ASCII_ART = `   __________  ________________  ______  __
  / ____/ __ \\/ ____/ ____/ __ \\/ __ \\ \\/ /
 / / __/ /_/ / __/ / / __/ / / / /_/ /\\  /
/ /_/ / _, _/ /___/ /_/ / /_/ / _, _/ / /
\\____/_/ |_/_____/\\____/\\____/_/ |_| /_/

    ___    __    ___    _   __
   /   |  / /   /   |  / | / /
  / /| | / /   / /| | /  |/ /
 / ___ |/ /___/ ___ |/ /|  /
/_/  |_/_____/_/  |_/_/ |_/`;

function renderMOTD() {
    const motdEl = document.getElementById('motd');
    if (!motdEl) return;

    const ver = Kernel.hunt.getVersion();

    // Apply version theme
    document.body.classList.remove('v1-0', 'v2-0');
    if (ver < 1.1) document.body.classList.add('v1-0');
    else if (ver >= 2.0) document.body.classList.add('v2-0');

    if (ver < 1.1) {
        motdEl.innerHTML =
            '<div class="motd">Type \'help\' for diagnostics.</div>'
            + '<div class="motd">&nbsp;</div>';
        return;
    }

    const now = new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lastLogin = `Last login: ${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()} ${now.toLocaleTimeString()} on tty1`;

    if (ver >= 2.0) {
        // v2.0 — isometric GC logo + system info sidebar
        const logo = [
            '      ___           ___     ',
            '     /\\  \\         /\\  \\    ',
            '    /::\\  \\       /::\\  \\   ',
            '   /:/\\:\\  \\     /:/\\:\\  \\  ',
            '  /:/  \\:\\  \\   /:/  \\:\\  \\ ',
            ' /:/__/_\\:\\__\\ /:/__/ \\:\\__\\',
            ' \\:\\  /\\ \\/__/ \\:\\  \\  \\/__/',
            '  \\:\\ \\:\\__\\    \\:\\  \\      ',
            '   \\:\\/:/  /     \\:\\  \\     ',
            '    \\::/  /       \\:\\__\\    ',
            '     \\/__/         \\/__/    ',
        ];
        const info = [
            `<span class="v2-title">GregOS 2.0-dev</span>`,
            `<span class="v2-rule">─────────────────────────────</span>`,
            '',
            `<span class="v2-label">kernel    </span>0.9.851-greg`,
            `<span class="v2-label">branch    </span>dev/transform-pipeline`,
            `<span class="v2-label">channel   </span>unstable`,
            `<span class="v2-label">daemons   </span>4 active`,
        ];
        let header = '';
        for (let i = 0; i < logo.length; i++) {
            header += `<span class="v2-logo">${logo[i]}</span>  ${info[i] || ''}\n`;
        }

        motdEl.innerHTML =
            '<div class="motd">login: guest</div>'
            + `<div class="motd">${lastLogin}</div>`
            + '<div class="motd">&nbsp;</div>'
            + `<pre class="v2-header">${header}\n</pre>`
            + (!Kernel.hunt.flags['pkg-initialized']
                ? '<div class="motd">1 package repository configured. Run \'pkg update\' to synchronize.</div>'
                : '')
            + '<div class="motd">&nbsp;</div>'
            + '<div class="motd">Type \'help\' for available commands.</div>'
            + '<div class="motd">&nbsp;</div>';
        return;
    }

    // v1.1 — corporate workstation banner
    const rule = '==================================================';
    motdEl.innerHTML =
        '<div class="motd">GregOS 1.1 (tty1)</div>'
        + '<div class="motd">&nbsp;</div>'
        + '<div class="motd">login: guest</div>'
        + `<div class="motd">${lastLogin}</div>`
        + '<div class="motd">&nbsp;</div>'
        + `<pre class="ascii-art">${ASCII_ART}\n\n`
        + '<span class="art-sub">       C O M P U T I N G ,   I N C .</span></pre>'
        + `<pre class="system-info">${rule}\n`
        + ' GregOS Release 1.1          Kernel 0.9.847-greg\n'
        + ' (C) Copyright 1987 Gregory Alan Computing, Inc.\n'
        + ' All Rights Reserved.\n'
        + `${rule}</pre>`
        + '<div class="motd">&nbsp;</div>'
        + '<div class="motd">Type \'help\' for available commands.</div>'
        + '<div class="motd">&nbsp;</div>';
}

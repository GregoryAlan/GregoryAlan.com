// ─── /usr/bin: UNIX Utilities ────────────────────────────────
//
// The grounded layer: UNIX utilities, OS-feel commands, and
// read-only stubs. Everything here passes the sysadmin test.
//
// Depends on: kernel.js (Kernel), shell.js (Shell)

const v1_1CommandsPack = {

    hiddenCommands: new Set([
        'touch', 'mkdir', 'mv', 'cp', 'chmod', 'chown', 'kill', 'exit', 'ping',
        'debug',
    ]),

    commands: {

        // ─── Tier 1: Real Computation ───────────────────────

        date: (args) => {
            const now = new Date();
            if (args === '-u') {
                return now.toUTCString();
            }
            const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            const months = ['Jan','Feb','Mar','Apr','May','Jun',
                            'Jul','Aug','Sep','Oct','Nov','Dec'];
            const d = days[now.getDay()];
            const m = months[now.getMonth()];
            const day = String(now.getDate()).padStart(2, ' ');
            const time = now.toTimeString().split(' ')[0];
            const tz = now.toTimeString().split(' ')[1] || '';
            const yr = now.getFullYear();
            return `${d} ${m} ${day} ${time} ${tz} ${yr}`;
        },

        echo: (args) => {
            if (!args) return '';
            let out = args;
            for (const [k, v] of Object.entries(Shell.env)) {
                out = out.split('$' + k).join(v);
            }
            return out;
        },

        uname: (args, stdin, parsed) => {
            parsed = parsed || parseArgs(args || '');
            const kv = Kernel.kernelVersion.get() || '0.9.847-greg';
            const build = kv.match(/\.(\d+)-/)?.[1] || '847';
            const info = {
                s: 'GregOS',
                n: Shell.env.HOSTNAME,
                r: kv,
                v: '#' + build + ' SMP ' + new Date().toDateString(),
                m: 'x86_64',
            };
            if (!args) return info.s;
            if (parsed.flags.a) {
                return `${info.s} ${info.n} ${info.r} ${info.v} ${info.m}`;
            }
            const parts = Object.keys(parsed.flags).filter(f => info[f]);
            return parts.map(f => info[f]).join(' ') || 'uname: invalid option';
        },

        wc: (args, stdin) => {
            const parts = (args || '').split(/\s+/).filter(Boolean);
            let flag = null;
            let fileName = null;

            for (const p of parts) {
                if (p.startsWith('-')) flag = p;
                else fileName = p;
            }

            let content;
            let label;

            if (stdin && !fileName) {
                content = stdin;
                label = '';
            } else {
                if (!fileName) return 'wc: missing operand';
                content = Kernel.fs.read(fileName);
                if (!content) return `wc: ${fileName}: No such file or directory`;
                label = ' ' + fileName;
            }

            const lines = content.split('\n').length;
            const words = content.split(/\s+/).filter(Boolean).length;
            const chars = content.length;

            if (flag === '-l') return `${lines}${label}`;
            if (flag === '-w') return `${words}${label}`;
            if (flag === '-c') return `${chars}${label}`;
            return `  ${lines}  ${words} ${chars}${label}`;
        },

        head: (args, stdin, parsed) => {
            // -n takes a value (line count), re-parse with that knowledge
            parsed = parseArgs(args || '', ['n']);
            const n = parsed.flags.n ? parseInt(parsed.flags.n, 10) : 10;
            const fileName = parsed.positional[0] || null;

            let content;

            if (stdin && !fileName) {
                content = stdin;
            } else {
                if (!fileName) return 'head: missing operand';
                content = Kernel.fs.read(fileName);
                if (!content) return `head: ${fileName}: No such file or directory`;
            }

            return content.split('\n').slice(0, n).join('\n');
        },

        grep: (args, stdin, parsed) => {
            if (!args) return 'Usage: grep [-n] <pattern> [file]';
            parsed = parsed || parseArgs(args || '');
            const showLineNums = !!parsed.flags.n;
            const pattern = parsed.positional[0] || null;
            const fileName = parsed.positional[1] || null;
            if (!pattern) return 'Usage: grep [-n] <pattern> [file]';

            let re;
            try { re = new RegExp(pattern, 'i'); }
            catch(e) { return `grep: invalid pattern '${pattern}'`; }

            if (stdin && !fileName) {
                const lines = stdin.split('\n');
                const results = [];
                for (let i = 0; i < lines.length; i++) {
                    if (re.test(lines[i])) {
                        let prefix = '';
                        if (showLineNums) prefix = (i + 1) + ':';
                        results.push(prefix + lines[i]);
                    }
                }
                return results.length ? results.join('\n') : '';
            }

            const targets = {};
            if (fileName) {
                const content = Kernel.fs.read(fileName);
                if (!content) return `grep: ${fileName}: No such file or directory`;
                targets[fileName] = content;
            } else {
                for (const [name, content] of Object.entries(Kernel.fs._textFiles)) {
                    targets[name] = content;
                }
            }

            const results = [];
            const multiFile = Object.keys(targets).length > 1;

            for (const [name, content] of Object.entries(targets)) {
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (re.test(lines[i])) {
                        let prefix = '';
                        if (multiFile) prefix += name + ':';
                        if (showLineNums) prefix += (i + 1) + ':';
                        results.push(prefix + lines[i]);
                    }
                }
            }

            return results.length ? results.join('\n') : '';
        },

        // ─── Tier 2: OS Feel ────────────────────────────────

        uptime: () => {
            const bootTime = parseInt(Kernel.session.get('bootTime') || Date.now(), 10);
            const elapsed = Math.floor((Date.now() - bootTime) / 1000);
            const h = Math.floor(elapsed / 3600);
            const m = Math.floor((elapsed % 3600) / 60);

            const now = new Date();
            const time = now.toTimeString().split(' ')[0];
            const upStr = h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${m} min`;

            return ` ${time} up ${upStr},  1 user,  load average: 0.08, 0.03, 0.01`;
        },

        hostname: () => Shell.env.HOSTNAME,

        id: () => {
            const p = Shell._activeProfile;
            if (p) return `uid=${p.uid}(${p.username}) gid=${p.uid}(${p.username}) groups=${p.uid}(${p.username})`;
            return 'uid=1001(guest) gid=1001(guest) groups=1001(guest)';
        },

        ps: (args) => {
            const basic =
                'PID TTY      TIME CMD\n'
              + '  1 tty1 00:00:00 init\n'
              + `${String(Math.floor(Math.random()*800)+100).padStart(3)} tty1 00:00:00 bash\n`
              + `${String(Math.floor(Math.random()*800)+100).padStart(3)} tty1 00:00:00 ps`;

            if (args === 'aux' || args === '-aux') {
                const u = Shell.env.USER;
                return 'USER  PID %CPU %MEM    VSZ   RSS TTY  STAT CMD\n'
                     + 'root    1  0.0  0.1   4372  1024 ?    Ss   init\n'
                     + 'root    2  0.0  0.0      0     0 ?    S    [kthreadd]\n'
                     + 'root   47  0.0  0.1   7232  1536 ?    Ss   sshd\n'
                     + 'root   63  0.0  0.0   3024   512 ?    Ss   cron\n'
                     + u + ' '.repeat(Math.max(1, 6 - u.length)) + '184  0.0  0.2   5648  2048 tty1 Ss   bash\n'
                     + u + ' '.repeat(Math.max(1, 6 - u.length)) + '201  0.0  0.1   3472   768 tty1 R+   ps aux';
            }
            return basic;
        },

        df: (args) => {
            if (args === '-h') {
                return 'Filesystem  Size  Used Avail Use% Mounted on\n'
                     + '/dev/sda1   4.0G  1.2G  2.8G  30% /\n'
                     + 'tmpfs       128M  4.0K  128M   1% /tmp\n'
                     + 'devfs       5.0K  5.0K     0 100% /dev';
            }
            return 'Filesystem  1K-blocks    Used  Avail Use% Mounted on\n'
                 + '/dev/sda1     4194304 1258291 2936013  30% /\n'
                 + 'tmpfs          131072       4  131068   1% /tmp\n'
                 + 'devfs            5120    5120       0 100% /dev';
        },

        free: (args) => {
            const totalMB = navigator.deviceMemory ? navigator.deviceMemory * 1024 : 512;
            const usedMB = Math.floor(totalMB * 0.38);
            const freeMB = totalMB - usedMB;
            const buffers = Math.floor(totalMB * 0.12);

            if (args === '-h') {
                const fmt = (mb) => mb >= 1024 ? (mb/1024).toFixed(1) + 'G' : mb + 'M';
                return '              total   used   free  buffers\n'
                     + `Mem:          ${fmt(totalMB).padStart(5)}  ${fmt(usedMB).padStart(5)}  ${fmt(freeMB).padStart(5)}  ${fmt(buffers).padStart(5)}\n`
                     + `Swap:            0      0      0`;
            }

            return '              total     used     free  buffers\n'
                 + `Mem:       ${String(totalMB * 1024).padStart(8)} ${String(usedMB * 1024).padStart(8)} ${String(freeMB * 1024).padStart(8)} ${String(buffers * 1024).padStart(8)}\n`
                 + `Swap:             0        0        0`;
        },

        env: () => {
            return Object.entries(Shell.env).map(([k, v]) => `${k}=${v}`).join('\n');
        },

        // ─── Tier 3: Permission-Denied Stubs ────────────────

        touch: (args) => `touch: cannot touch '${args || ''}': Read-only file system`,
        mkdir: (args) => `mkdir: cannot create directory '${args || ''}': Read-only file system`,
        mv:    ()     => 'mv: Read-only file system',
        cp:    ()     => 'cp: Read-only file system',
        chmod: ()     => 'chmod: Operation not permitted',
        chown: ()     => 'chown: Operation not permitted',
        kill:  ()     => 'kill: Operation not permitted',
        exit:  ()     => {
            if (Shell.restoreProfile()) return 'logout';
            return 'bash: exit: cannot exit login shell';
        },
        ping:  ()     => 'ping: network access denied for ' + Shell.env.USER,
    },

    // Computed man page (references Kernel.kernelVersion)
    // Static man pages loaded from content/man-pages.json
    manPages: {
        gregos: () =>
            'GREGOS(7)                    GregOS Manual                    GREGOS(7)\n\n'
            + 'NAME\n'
            + '       GregOS - Gregory Alan Computing operating system\n\n'
            + 'DESCRIPTION\n'
            + '       GregOS is a custom operating system built on the gregos-kernel.\n'
            + '       The system provides a standard UNIX interface for navigating\n'
            + '       projects, games, and experiments by its creator.\n\n'
            + '       The current kernel version is ' + (Kernel.kernelVersion.get() || '0.9.847-greg') + '.\n\n'
            + 'GETTING STARTED\n'
            + '       cat welcome.txt    Read the welcome message\n'
            + '       help               List available commands\n'
            + '       ls                 Browse files and directories\n'
            + '       man <command>      Read the manual for a command\n\n'
            + 'DIRECTORIES\n'
            + '       games/             Interactive projects (open to launch)\n'
            + '       drafts/            Work in progress experiments\n\n'
            + 'FILES\n'
            + '       about.txt          About the developer\n'
            + '       version.txt        System version information\n'
            + '       contact.txt        Contact information\n'
            + '       welcome.txt        Guest orientation\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       help(1), ls(1), cat(1)',
    },
};

// ─── Tab Completions ────────────────────────────────────────

Shell.registerCompletion('grep', (argPrefix) => Shell.completePath(argPrefix, 'readable'));
Shell.registerCompletion('wc', (argPrefix) => Shell.completePath(argPrefix, 'readable'));
Shell.registerCompletion('head', (argPrefix) => Shell.completePath(argPrefix, 'readable'));
Shell.registerCompletion('uname', (argPrefix) => Shell.completeFromList(argPrefix, ['-a', '-s', '-r', '-v', '-m', '-n']));

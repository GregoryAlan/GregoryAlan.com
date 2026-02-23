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

        uname: (args) => {
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
            if (args === '-a') {
                return `${info.s} ${info.n} ${info.r} ${info.v} ${info.m}`;
            }
            const flags = args.replace(/-/g, '').split('');
            return flags.map(f => info[f] || '').filter(Boolean).join(' ') || 'uname: invalid option';
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

        head: (args, stdin) => {
            const parts = (args || '').split(/\s+/).filter(Boolean);
            let n = 10;
            let fileName = null;

            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === '-n' && parts[i + 1]) {
                    n = parseInt(parts[i + 1], 10);
                    i++;
                } else if (!parts[i].startsWith('-')) {
                    fileName = parts[i];
                }
            }

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

        grep: (args, stdin) => {
            if (!args) return 'Usage: grep [-n] <pattern> [file]';
            const parts = args.split(/\s+/);
            let showLineNums = false;
            let pattern = null;
            let fileName = null;

            for (const p of parts) {
                if (p === '-n') { showLineNums = true; continue; }
                if (!pattern) { pattern = p; continue; }
                fileName = p;
            }
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

        id: () => 'uid=1000(guest) gid=1000(guest) groups=1000(guest)',

        ps: (args) => {
            const basic =
                'PID TTY      TIME CMD\n'
              + '  1 tty1 00:00:00 init\n'
              + `${String(Math.floor(Math.random()*800)+100).padStart(3)} tty1 00:00:00 bash\n`
              + `${String(Math.floor(Math.random()*800)+100).padStart(3)} tty1 00:00:00 ps`;

            if (args === 'aux' || args === '-aux') {
                return 'USER  PID %CPU %MEM    VSZ   RSS TTY  STAT CMD\n'
                     + 'root    1  0.0  0.1   4372  1024 ?    Ss   init\n'
                     + 'root    2  0.0  0.0      0     0 ?    S    [kthreadd]\n'
                     + 'root   47  0.0  0.1   7232  1536 ?    Ss   sshd\n'
                     + 'root   63  0.0  0.0   3024   512 ?    Ss   cron\n'
                     + 'guest 184  0.0  0.2   5648  2048 tty1 Ss   bash\n'
                     + 'guest 201  0.0  0.1   3472   768 tty1 R+   ps aux';
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
        exit:  ()     => 'logout not permitted on tty1',
        ping:  ()     => 'ping: network access denied for guest',
    },

    manPages: {

        // ─── System Overview ────────────────────────────────

        gregos: () =>
            'GREGOS(7)                    GregOS Manual                    GREGOS(7)\n\n'
            + 'NAME\n'
            + '       GregOS - Gregory Alan Computing operating system\n\n'
            + 'DESCRIPTION\n'
            + '       GregOS is a custom operating system built on the gresos-kernel.\n'
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

        // ─── Tier 1 Command Man Pages ───────────────────────

        date: 'DATE(1)                      GregOS Manual                      DATE(1)\n\n'
            + 'NAME\n'
            + '       date - display the current date and time\n\n'
            + 'SYNOPSIS\n'
            + '       date [-u]\n\n'
            + 'DESCRIPTION\n'
            + '       date displays the current date and time. With -u, displays\n'
            + '       the time in UTC instead of the local timezone.\n\n'
            + 'OPTIONS\n'
            + '       -u     Display time in Coordinated Universal Time (UTC).\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       uptime(1)',

        echo: 'ECHO(1)                      GregOS Manual                      ECHO(1)\n\n'
            + 'NAME\n'
            + '       echo - display a line of text\n\n'
            + 'SYNOPSIS\n'
            + '       echo [string ...]\n\n'
            + 'DESCRIPTION\n'
            + '       echo writes its arguments to standard output, separated by\n'
            + '       spaces, followed by a newline.\n\n'
            + '       Shell variables $USER, $HOME, $SHELL, and $HOSTNAME are\n'
            + '       expanded.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       env(1)',

        uname: 'UNAME(1)                     GregOS Manual                     UNAME(1)\n\n'
            + 'NAME\n'
            + '       uname - print system information\n\n'
            + 'SYNOPSIS\n'
            + '       uname [-a | -s | -n | -r | -v | -m]\n\n'
            + 'DESCRIPTION\n'
            + '       uname prints information about the system.\n\n'
            + 'OPTIONS\n'
            + '       -s     Kernel name (default)\n'
            + '       -n     Network hostname\n'
            + '       -r     Kernel release\n'
            + '       -v     Kernel version\n'
            + '       -m     Machine hardware name\n'
            + '       -a     All of the above\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       hostname(1)',

        wc: 'WC(1)                        GregOS Manual                        WC(1)\n\n'
            + 'NAME\n'
            + '       wc - word, line, and byte count\n\n'
            + 'SYNOPSIS\n'
            + '       wc [-l | -w | -c] <file>\n\n'
            + 'DESCRIPTION\n'
            + '       wc counts lines, words, and characters in the specified\n'
            + '       file. Without flags, all three counts are shown.\n\n'
            + 'OPTIONS\n'
            + '       -l     Count lines only\n'
            + '       -w     Count words only\n'
            + '       -c     Count characters only\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       cat(1), head(1)',

        head: 'HEAD(1)                      GregOS Manual                      HEAD(1)\n\n'
            + 'NAME\n'
            + '       head - output the first part of files\n\n'
            + 'SYNOPSIS\n'
            + '       head [-n count] <file>\n\n'
            + 'DESCRIPTION\n'
            + '       head displays the first count lines of the specified file.\n'
            + '       If -n is not given, the default is 10 lines.\n\n'
            + 'OPTIONS\n'
            + '       -n count   Number of lines to display.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       cat(1), wc(1)',

        grep: 'GREP(1)                      GregOS Manual                      GREP(1)\n\n'
            + 'NAME\n'
            + '       grep - search file contents for a pattern\n\n'
            + 'SYNOPSIS\n'
            + '       grep [-n] <pattern> [file]\n\n'
            + 'DESCRIPTION\n'
            + '       grep searches for lines matching pattern in the specified\n'
            + '       file. If no file is given, all root-level files are\n'
            + '       searched. Patterns are case-insensitive regular\n'
            + '       expressions.\n\n'
            + 'OPTIONS\n'
            + '       -n     Prefix each matching line with its line number.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       cat(1), wc(1)',

        // ─── Tier 2 Command Man Pages ───────────────────────

        uptime: 'UPTIME(1)                    GregOS Manual                    UPTIME(1)\n\n'
            + 'NAME\n'
            + '       uptime - show how long the system has been running\n\n'
            + 'SYNOPSIS\n'
            + '       uptime\n\n'
            + 'DESCRIPTION\n'
            + '       uptime displays the current time, how long the system has\n'
            + '       been running since boot, the number of users, and system\n'
            + '       load averages.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       date(1), ps(1)',

        hostname: 'HOSTNAME(1)                  GregOS Manual                  HOSTNAME(1)\n\n'
            + 'NAME\n'
            + '       hostname - show the system hostname\n\n'
            + 'SYNOPSIS\n'
            + '       hostname\n\n'
            + 'DESCRIPTION\n'
            + '       hostname displays the name of the current host system.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       uname(1)',

        id: 'ID(1)                        GregOS Manual                        ID(1)\n\n'
            + 'NAME\n'
            + '       id - display user identity\n\n'
            + 'SYNOPSIS\n'
            + '       id\n\n'
            + 'DESCRIPTION\n'
            + '       id prints the user and group IDs of the current user.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       whoami(1)',

        ps: 'PS(1)                        GregOS Manual                        PS(1)\n\n'
            + 'NAME\n'
            + '       ps - report process status\n\n'
            + 'SYNOPSIS\n'
            + '       ps [aux]\n\n'
            + 'DESCRIPTION\n'
            + '       ps displays information about active processes. Without\n'
            + '       arguments, only processes attached to the current terminal\n'
            + '       are shown. With aux, all system processes are listed.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       uptime(1)',

        df: 'DF(1)                        GregOS Manual                        DF(1)\n\n'
            + 'NAME\n'
            + '       df - report filesystem disk space usage\n\n'
            + 'SYNOPSIS\n'
            + '       df [-h]\n\n'
            + 'DESCRIPTION\n'
            + '       df displays the amount of disk space used and available\n'
            + '       on mounted filesystems.\n\n'
            + 'OPTIONS\n'
            + '       -h     Print sizes in human-readable format (e.g. 1G).\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       free(1)',

        free: 'FREE(1)                      GregOS Manual                      FREE(1)\n\n'
            + 'NAME\n'
            + '       free - display amount of free and used memory\n\n'
            + 'SYNOPSIS\n'
            + '       free [-h]\n\n'
            + 'DESCRIPTION\n'
            + '       free displays the total amount of free and used physical\n'
            + '       memory in the system.\n\n'
            + 'OPTIONS\n'
            + '       -h     Print sizes in human-readable format.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       df(1), ps(1)',

        env: 'ENV(1)                       GregOS Manual                       ENV(1)\n\n'
            + 'NAME\n'
            + '       env - display environment variables\n\n'
            + 'SYNOPSIS\n'
            + '       env\n\n'
            + 'DESCRIPTION\n'
            + '       env prints the current environment variables for the\n'
            + '       active shell session.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       echo(1)',

        // ─── Core Command Man Pages ─────────────────────────

        ls: 'LS(1)                        GregOS Manual                        LS(1)\n\n'
            + 'NAME\n'
            + '       ls - list directory contents\n\n'
            + 'SYNOPSIS\n'
            + '       ls [-a]\n\n'
            + 'DESCRIPTION\n'
            + '       ls lists the contents of the current directory. At the\n'
            + '       root level, text files and subdirectories are shown.\n\n'
            + 'OPTIONS\n'
            + '       -a     Include hidden files (dotfiles).\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       cd(1), cat(1)',

        cd: 'CD(1)                        GregOS Manual                        CD(1)\n\n'
            + 'NAME\n'
            + '       cd - change working directory\n\n'
            + 'SYNOPSIS\n'
            + '       cd [directory]\n\n'
            + 'DESCRIPTION\n'
            + '       cd changes the current working directory. Without\n'
            + '       arguments, returns to the home directory. Use .. to\n'
            + '       go up one level.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       ls(1), pwd(1)',

        pwd: 'PWD(1)                       GregOS Manual                       PWD(1)\n\n'
            + 'NAME\n'
            + '       pwd - print working directory\n\n'
            + 'SYNOPSIS\n'
            + '       pwd\n\n'
            + 'DESCRIPTION\n'
            + '       pwd prints the full pathname of the current working\n'
            + '       directory.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       cd(1), ls(1)',

        cat: 'CAT(1)                       GregOS Manual                       CAT(1)\n\n'
            + 'NAME\n'
            + '       cat - concatenate and display files\n\n'
            + 'SYNOPSIS\n'
            + '       cat <file>\n\n'
            + 'DESCRIPTION\n'
            + '       cat reads the specified file and prints its contents to\n'
            + '       standard output.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       head(1), grep(1)',

        open: 'OPEN(1)                      GregOS Manual                      OPEN(1)\n\n'
            + 'NAME\n'
            + '       open - open a file or directory in the browser\n\n'
            + 'SYNOPSIS\n'
            + '       open [file]\n\n'
            + 'DESCRIPTION\n'
            + '       open launches the specified file in the browser. Without\n'
            + '       arguments, opens the current directory. Navigate into a\n'
            + '       project folder with cd, then run open to launch it.\n\n'
            + 'EXAMPLES\n'
            + '       cd games && open beary-time.html\n'
            + '       cd games && open\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       cd(1), ls(1)',

        whoami: 'WHOAMI(1)                    GregOS Manual                    WHOAMI(1)\n\n'
            + 'NAME\n'
            + '       whoami - display system and user information\n\n'
            + 'SYNOPSIS\n'
            + '       whoami\n\n'
            + 'DESCRIPTION\n'
            + '       whoami displays information about the current user\n'
            + '       session including operating system, browser, language,\n'
            + '       screen resolution, and local time.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       id(1), hostname(1)',

        history: 'HISTORY(1)                   GregOS Manual                   HISTORY(1)\n\n'
            + 'NAME\n'
            + '       history - display command history\n\n'
            + 'SYNOPSIS\n'
            + '       history\n\n'
            + 'DESCRIPTION\n'
            + '       history displays the list of commands entered during the\n'
            + '       current session, numbered from most recent.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       help(1)',

        clear: 'CLEAR(1)                     GregOS Manual                     CLEAR(1)\n\n'
            + 'NAME\n'
            + '       clear - clear the terminal screen\n\n'
            + 'SYNOPSIS\n'
            + '       clear\n\n'
            + 'DESCRIPTION\n'
            + '       clear removes all previous output from the terminal\n'
            + '       display.\n\n'
            + 'AUTHOR\n'
            + '       GregOS System\n\n'
            + 'SEE ALSO\n'
            + '       help(1)',
    },
};

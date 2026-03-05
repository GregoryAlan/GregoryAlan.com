// ─── /usr/bin: UNIX Utilities ────────────────────────────────
//
// The grounded layer: UNIX utilities, OS-feel commands, and
// read-only stubs. Everything here passes the sysadmin test.
//
// Depends on: kernel.js (Kernel), shell.js (Shell)

const v1_1CommandsPack = {

    hiddenCommands: new Set([
        'touch', 'mkdir', 'mv', 'cp', 'chmod', 'chown', 'exit',
        'kill', 'jobs', 'fg', 'bg', 'tail', 'top', 'ping', 'debug',
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
            return args;
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
                if (content === null) return `wc: ${fileName}: No such file or directory`;
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
                if (content === null) return `head: ${fileName}: No such file or directory`;
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
                if (content === null) return `grep: ${fileName}: No such file or directory`;
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
            const u = Shell.env.USER;
            const uPad = (s) => s + ' '.repeat(Math.max(1, 6 - s.length));

            // System processes (faked, PIDs < 100)
            const sysLines = [
                { user: 'root', pid: 1, cpu: '0.0', mem: '0.1', vsz: 4372, rss: 1024, tty: '?', stat: 'Ss', cmd: 'init' },
                { user: 'root', pid: 2, cpu: '0.0', mem: '0.0', vsz: 0, rss: 0, tty: '?', stat: 'S', cmd: '[kthreadd]' },
                { user: 'root', pid: 47, cpu: '0.0', mem: '0.1', vsz: 7232, rss: 1536, tty: '?', stat: 'Ss', cmd: 'sshd' },
                { user: 'root', pid: 63, cpu: '0.0', mem: '0.0', vsz: 3024, rss: 512, tty: '?', stat: 'Ss', cmd: 'cron' },
                { user: u, pid: 84, cpu: '0.0', mem: '0.2', vsz: 5648, rss: 2048, tty: 'tty1', stat: 'Ss', cmd: 'bash' },
            ];

            // Real processes from process table
            const realProcs = Kernel.proc.list().filter(p => p.status === 'running');

            if (args === 'aux' || args === '-aux') {
                let out = 'USER  PID %CPU %MEM    VSZ   RSS TTY  STAT CMD';
                for (const s of sysLines) {
                    out += '\n' + uPad(s.user) + String(s.pid).padStart(4) + '  ' + s.cpu + '  ' + s.mem
                        + String(s.vsz).padStart(7) + String(s.rss).padStart(6) + ' ' + s.tty.padEnd(5) + s.stat.padEnd(5) + s.cmd;
                }
                for (const p of realProcs) {
                    const stat = p.background ? 'S' : 'R+';
                    out += '\n' + uPad(u) + String(p.pid).padStart(4) + '  0.0  0.1'
                        + '   3472   768 tty1 ' + stat.padEnd(5) + p.command + (p.args ? ' ' + p.args : '');
                }
                return out;
            }

            let out = 'PID TTY      TIME CMD\n  1 tty1 00:00:00 init\n 84 tty1 00:00:00 bash';
            for (const p of realProcs) {
                out += '\n' + String(p.pid).padStart(3) + ' tty1 00:00:00 ' + p.command;
            }
            return out;
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
        kill: (args, stdin, parsed) => {
            parsed = parsed || parseArgs(args || '');
            if (!parsed.positional.length && !parsed.flags['9']) return 'kill: usage: kill [-9] <pid|%jobid>';
            const sig = parsed.flags['9'] ? 'SIGKILL' : 'SIGTERM';
            const target = parsed.positional[0];
            if (!target) return 'kill: usage: kill [-9] <pid|%jobid>';
            // Job ID: %N
            if (target.startsWith('%')) {
                const jobId = parseInt(target.slice(1), 10);
                const proc = Shell.jobs.getByJobId(jobId);
                if (!proc) return `kill: %${jobId}: no such job`;
                Kernel.proc.signal(proc.pid, sig);
                return '';
            }
            const pid = parseInt(target, 10);
            if (isNaN(pid)) return `kill: ${target}: arguments must be process or job IDs`;
            if (pid < 100) return 'kill: Operation not permitted';
            const proc = Kernel.proc.get(pid);
            if (!proc) return `kill: (${pid}) - No such process`;
            Kernel.proc.signal(pid, sig);
            return '';
        },
        jobs: () => {
            const jobList = Shell.jobs.list();
            if (!jobList.length) return '';
            return jobList.map(({ jobId, proc }) => {
                const status = proc.status === 'running' ? 'Running' : 'Stopped';
                return `[${jobId}]+  ${status}                 ${proc.command} ${proc.args}`;
            }).join('\n');
        },

        fg: (args, stdin, parsed, fgProc) => {
            let target;
            if (args && args.startsWith('%')) {
                const jobId = parseInt(args.slice(1), 10);
                target = Shell.jobs.getByJobId(jobId);
                if (!target) return `fg: %${jobId}: no such job`;
            } else {
                // Default: most recent background job
                const jobList = Shell.jobs.list();
                if (!jobList.length) return 'fg: no current job';
                target = jobList[jobList.length - 1].proc;
            }
            if (target.status === 'exited') return 'fg: job has already terminated';
            // Exit the fg command's own process, foreground the target
            fgProc.exit(0);
            target.background = false;
            Kernel.proc._foreground = target.pid;
            return Shell.ASYNC;
        },

        bg: (args) => {
            if (args && args.startsWith('%')) {
                const jobId = parseInt(args.slice(1), 10);
                const proc = Shell.jobs.getByJobId(jobId);
                if (!proc) return `bg: %${jobId}: no such job`;
                return `[${jobId}]+ ${proc.command} ${proc.args} &`;
            }
            return 'bg: no current job';
        },

        exit:  ()     => {
            if (Shell.restoreProfile()) return 'logout';
            return 'bash: exit: cannot exit login shell';
        },
        tail: (args, stdin, parsed, proc) => {
            parsed = parsed || parseArgs(args || '', ['n']);
            const follow = !!parsed.flags.f;
            const fileName = parsed.positional[0];
            if (!fileName) return 'tail: missing operand';
            const content = Kernel.fs.read(fileName);
            if (content === null) return `tail: ${fileName}: No such file or directory`;

            const n = parsed.flags.n ? parseInt(parsed.flags.n, 10) : 10;
            const lines = content.split('\n');
            const tailLines = lines.slice(-n);
            const staticOutput = tailLines.join('\n');

            if (!follow) return staticOutput;

            // -f mode: stream output, watch for changes
            proc._lastLineCount = lines.length;
            proc._fileName = fileName;

            proc._onSignal = (sig) => {
                if (sig === 'SIGINT' || sig === 'SIGTERM' || sig === 'SIGKILL') {
                    clearInterval(proc._intervalId);
                    proc.exit(0);
                }
            };

            // Write initial tail output once output region is attached
            setTimeout(() => {
                proc.write(Terminal._esc(staticOutput).replace(/\n/g, '<br>'));

                proc._intervalId = setInterval(() => {
                    const freshContent = Kernel.fs.read(proc._fileName);
                    if (freshContent === null) return;
                    const freshLines = freshContent.split('\n');
                    if (freshLines.length > proc._lastLineCount) {
                        const newLines = freshLines.slice(proc._lastLineCount);
                        proc._lastLineCount = freshLines.length;
                        for (const line of newLines) {
                            proc.writeln(line);
                        }
                    }
                }, 2000);
            }, 50);

            return Shell.ASYNC;
        },

        top: (args, stdin, parsed, proc) => {
            proc._quitOnQ = true;
            proc._onSignal = (sig) => {
                if (sig === 'SIGINT' || sig === 'SIGTERM' || sig === 'SIGKILL') {
                    clearInterval(proc._intervalId);
                    proc.exit(0);
                }
            };

            const render = () => {
                if (!proc.outputRegion) return;
                const u = Shell.env.USER;
                const now = new Date();
                const time = now.toTimeString().split(' ')[0];
                const bootTime = parseInt(Kernel.session.get('bootTime') || Date.now(), 10);
                const elapsed = Math.floor((Date.now() - bootTime) / 1000);
                const h = Math.floor(elapsed / 3600);
                const m = Math.floor((elapsed % 3600) / 60);
                const upStr = h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${m} min`;

                const realProcs = Kernel.proc.list().filter(p => p.status === 'running' && p.command !== 'top');
                const totalTasks = 5 + realProcs.length + 1; // system + real + top itself

                let out = `top - ${time} up ${upStr},  1 user,  load average: 0.08, 0.03, 0.01\n`;
                out += `Tasks: ${totalTasks} total,   1 running, ${totalTasks - 1} sleeping,   0 stopped\n`;
                out += `%Cpu(s):  1.2 us,  0.4 sy,  0.0 ni, 98.4 id\n`;
                const totalMB = navigator.deviceMemory ? navigator.deviceMemory * 1024 : 512;
                const usedMB = Math.floor(totalMB * 0.38);
                out += `MiB Mem:  ${totalMB}.0 total,  ${totalMB - usedMB}.0 free,  ${usedMB}.0 used\n\n`;
                out += '  PID USER      PR  NI    VIRT    RES  S %CPU %MEM     TIME+ COMMAND\n';
                out += '    1 root      20   0    4372   1024  S  0.0  0.1   0:01.23 init\n';
                out += '    2 root      20   0       0      0  S  0.0  0.0   0:00.01 kthreadd\n';
                out += '   47 root      20   0    7232   1536  S  0.0  0.1   0:00.45 sshd\n';
                out += '   63 root      20   0    3024    512  S  0.0  0.0   0:00.12 cron\n';
                out += `   84 ${u.padEnd(9)} 20   0    5648   2048  S  0.0  0.2   0:00.89 bash\n`;
                for (const p of realProcs) {
                    out += `${String(p.pid).padStart(5)} ${u.padEnd(9)} 20   0    3472    768  S  0.0  0.1   0:00.01 ${p.command}\n`;
                }
                out += `${String(proc.pid).padStart(5)} ${u.padEnd(9)} 20   0    2960    512  R  0.3  0.1   0:00.01 top`;

                proc.outputRegion.innerHTML = '';
                const pre = document.createElement('pre');
                pre.textContent = out;
                proc.outputRegion.appendChild(pre);
                requestAnimationFrame(() => {
                    Terminal.el.input.scrollIntoView({ block: 'end' });
                });
            };

            setTimeout(() => {
                render();
                proc._intervalId = setInterval(render, 2000);
            }, 50);

            return Shell.ASYNC;
        },

        ping: (args, stdin, parsed, proc) => {
            parsed = parsed || parseArgs(args || '', ['c']);
            const host = parsed.positional[0];
            if (!host) return 'ping: usage: ping [-c count] <host>';

            const knownHosts = {
                'localhost': '127.0.0.1',
                '127.0.0.1': '127.0.0.1',
                [Shell.env.HOSTNAME]: '10.0.0.1',
            };

            const ip = knownHosts[host];
            if (!ip) return `ping: ${host}: Name or service not known`;

            const maxCount = parsed.flags.c ? parseInt(parsed.flags.c, 10) : Infinity;
            let sent = 0;

            proc._onSignal = (sig) => {
                if (sig === 'SIGINT' || sig === 'SIGTERM' || sig === 'SIGKILL') {
                    clearInterval(proc._intervalId);
                    // Print summary
                    const loss = '0';
                    proc.write(`\n--- ${host} ping statistics ---`);
                    proc.write(`${sent} packets transmitted, ${sent} received, ${loss}% packet loss`);
                    proc.write(`rtt min/avg/max = 0.031/0.042/0.058 ms`);
                    proc.exit(0);
                }
            };

            setTimeout(() => {
                proc.write(`PING ${host} (${ip}) 56(84) bytes of data.`);
                const doPing = () => {
                    sent++;
                    const time = (0.03 + Math.random() * 0.04).toFixed(3);
                    proc.write(`64 bytes from ${ip}: icmp_seq=${sent} ttl=64 time=${time} ms`);
                    if (sent >= maxCount) {
                        clearInterval(proc._intervalId);
                        const loss = '0';
                        proc.write(`\n--- ${host} ping statistics ---`);
                        proc.write(`${sent} packets transmitted, ${sent} received, ${loss}% packet loss`);
                        proc.write(`rtt min/avg/max = 0.031/0.042/0.058 ms`);
                        proc.exit(0);
                    }
                };
                doPing();
                proc._intervalId = setInterval(doPing, 1000);
            }, 50);

            return Shell.ASYNC;
        },
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
Shell.registerCompletion('tail', (argPrefix) => Shell.completePath(argPrefix, 'readable'));
Shell.registerCompletion('uname', (argPrefix) => Shell.completeFromList(argPrefix, ['-a', '-s', '-r', '-v', '-m', '-n']));
Shell.registerCompletion('kill', (argPrefix) => {
    const pids = Kernel.proc.list()
        .filter(p => p.status === 'running' && p.pid >= 100)
        .map(p => String(p.pid));
    const jobIds = Shell.jobs.list().map(j => '%' + j.jobId);
    return Shell.completeFromList(argPrefix, [...pids, ...jobIds]);
});

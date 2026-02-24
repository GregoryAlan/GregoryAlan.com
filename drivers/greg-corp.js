// ─── Greg Corp Employee Profiles ────────────────────────────
//
// spec: greg-corp-storyline.md
//
// Data file: employee profiles from GregCorp (née Gregory Alan
// Computing, Inc.). Packaged as a driver definition, registered
// via registerDriver() in versions.js at the v2.0 layer.
//
// Depends on: kernel.js (Kernel), shell.js (Shell),
//             terminal.js (Terminal), glitch.js (runGlitchEffect),
//             the-signal.js (garble)

// ─── Profile Registry ──────────────────────────────────────
// spec: greg-corp-storyline.md > Characters

const gregCorpProfiles = {

    dhollis: {
        username: 'dhollis',
        uid: 1002,
        fullName: 'Diane Hollis',
        title: 'Director, Human Resources & Administration',
        department: 'Human Resources',
        era: '1997',
        shell: '/bin/bash',
        homeDir: '/home/dhollis',
        hostname: 'gregcorp.internal',
        passwords: [
            { value: 'password' },
        ],

        fingerInfo:
            'Login: dhollis                          Name: Diane Hollis\n'
            + 'Directory: /home/dhollis                Shell: /bin/bash\n'
            + 'Title: Director, Human Resources & Administration\n'
            + 'Last login: Wed Oct 15 08:47:00 1997 on tty2\n'
            + 'Plan: Q4 benefits enrollment — deadline Nov 15.',
    },
};

// Home directory content loaded from content/gregcorp-profiles.json

// ─── Driver Definition ──────────────────────────────────────
// spec: greg-corp-storyline.md > Additional Commands

const gregCorpDriver = {
    id: 'greg-corp',

    stateMap: {
        'idle': {
            transitions: { 'profile-dhollis-entered': 'exploring' }
        },
        'exploring': {
            transitions: { 'complaint-found': 'complaint-discovered' }
        },
        'complaint-discovered': {
            transitions: {}
        }
    },

    files: { text: {}, hidden: {} },
    treeFiles: {},
    directories: {},

    // spec: greg-corp-storyline.md > Additional Commands
    commands: {
        su: (args, stdin, parsed) => {
            if (!args) return 'Usage: su <username>';
            parsed = parsed || parseArgs(args || '');

            // Filter out bare '-' (login shell flag) from positionals
            const userArgs = parsed.positional.filter(p => p !== '-');
            let username = userArgs[0] || null;
            // 'su -' with no username means root
            if (!username) username = 'root';

            if (Shell._activeProfile) {
                return 'su: cannot switch users while in a profile. Type \'exit\' first.';
            }

            if (username === 'root') {
                return 'su: authentication failure';
            }

            if (username === 'greg') {
                return 'su: account greg is locked (executive hold — contact board secretary)';
            }

            const profile = gregCorpProfiles[username];

            if (!profile) {
                return 'su: unknown user \'' + username + '\'';
            }

            // Gate: requires Signal driver contact-made
            if (!Kernel.driver.has('contact-made')) {
                runGlitchEffect('promptCorruption', {});
                return 'su: authentication failure';
            }

            Terminal.promptPassword((pw) => {
                const match = profile.passwords && profile.passwords.find(p => p.value === pw);
                if (!match) {
                    Terminal.appendSystemLine('su: authentication failure');
                    Terminal.updatePrompt();
                    return;
                }
                Shell.switchProfile(profile);
                Kernel.driver.discover('profile-' + username + '-entered');
                if (match.discover) {
                    Kernel.driver.discover(match.discover);
                }
                const lastLogin = profile.fingerInfo.split('\n')
                    .find(l => l.startsWith('Last login:'));
                Terminal.appendSystemLine(lastLogin || 'Last login: unknown');
                Terminal.updatePrompt();
            });
            return null;
        },

        mail: () => {
            const user = Shell.env.USER;
            const content = Kernel.fs.read('/var/mail/' + user);
            if (content) return content.replace(/\n/g, '<br>');
            return 'No mail for ' + user;
        },

        finger: (args) => {
            // Signal driver: corrupted root
            if (args === 'root') {
                if (Kernel.driver.flags.contact) {
                    Kernel.driver.discover('intruder-finger');
                    return 'Login: root                             Name: ' + garble(12) + '\n'
                        + 'Directory: /dev/null                    Shell: /dev/null\n'
                        + 'Last login: <span class="timestamp-anomaly">Jan  0 00:00</span> from <span class="timestamp-anomaly">0.0.0.0</span>\n'
                        + 'No mail.\n'
                        + 'No plan.';
                }
                return 'finger: root: no such user';
            }

            // Profile lookup
            const profile = gregCorpProfiles[args];
            if (profile) {
                if (!Kernel.driver.has('contact-made')) {
                    return 'finger: ' + args + ': no such user';
                }
                return profile.fingerInfo;
            }

            if (args === 'guest') {
                return 'Login: guest                            Name: Visitor\n'
                    + 'Directory: /home/guest                  Shell: /bin/bash\n'
                    + 'Last login: ' + new Date().toDateString() + '\n'
                    + 'No plan.';
            }
            if (!args) return 'Usage: finger [username]';
            return 'finger: ' + args + ': no such user';
        },
    },

    // spec: greg-corp-storyline.md > Key Document: HR-97-0847.complaint (complaint-found trigger)
    triggers: [
        { type: 'discovery', match: 'complaint-found', effect: 'screenFlicker', once: true,
            callback: () => {
                setTimeout(() => {
                    Terminal.appendSystemLine('<span class="timestamp-anomaly">CASE STILL OPEN</span>');
                }, 1500);
            }
        },
    ],

    patches: {},

    restore(state) {},
};

Kernel.driver.declareDriver(gregCorpDriver);

// Man pages loaded from content/man-pages.json

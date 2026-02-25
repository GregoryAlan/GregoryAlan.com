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
// Profile metadata loaded from content/gregcorp-profiles.json via ManifestLoader.

function getGregCorpProfiles() {
    return ManifestLoader.getProfiles();
}

function getGregCorpProfile(name) {
    return ManifestLoader.getProfile(name);
}

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

            const profile = getGregCorpProfile(username);

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
                    return ManifestLoader.getNarrativeOutput('finger-root-corrupted').replace('{garble}', garble(12));
                }
                return 'finger: root: no such user';
            }

            // Profile lookup
            const profile = getGregCorpProfile(args);
            if (profile && profile.fingerInfo) {
                if (!Kernel.driver.has('contact-made')) {
                    return 'finger: ' + args + ': no such user';
                }
                return profile.fingerInfo;
            }

            if (args === 'guest') {
                const guestProfile = getGregCorpProfile('guest');
                if (guestProfile && guestProfile.fingerTemplate) {
                    return guestProfile.fingerTemplate.replace('{date}', new Date().toDateString());
                }
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
                    Terminal.appendSystemLine('<span class="timestamp-anomaly">' + ManifestLoader.getNarrativeOutput('complaint-echo') + '</span>');
                }, 1500);
            }
        },
    ],

    patches: {},

    restore(state) {},
};

Kernel.driver.declareDriver(gregCorpDriver);

// Man pages loaded from content/man-pages.json

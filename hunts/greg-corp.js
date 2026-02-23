// ─── Greg Corp Employee Profiles ────────────────────────────
//
// spec: greg-corp-storyline.md
//
// Data file: employee profiles from GregCorp (née Gregory Alan
// Computing, Inc.). Commands and files are registered directly
// by versions.js at the v2.0 layer.
//
// Depends on: kernel.js (Kernel), shell.js (Shell),
//             terminal.js (Terminal), glitch.js (runGlitchEffect),
//             the-signal.js (garble)

// ─── Helpers ─────────────────────────────────────────────────

// Creates a tree-file function that fires a discovery when read.
// Always returns content (no gate); the directory structure
// itself limits access to users who have su'd into the profile.
function onReadDiscover(id, content) {
    return function(state) {
        state.discover(id);
        return content;
    };
}

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
            + 'Plan: Q4 benefits enrollment \u2014 deadline Nov 15.',
    },
};

// ─── Home Directory Content ─────────────────────────────────
// spec: greg-corp-storyline.md > Exploration: Home Directory

const gregCorpHomeFiles = {

    // ── dotfiles ────────────────────────────────────────────

    '/home/dhollis/.bashrc':
        '# .bashrc - Diane Hollis\n'
        + 'export TERM=vt100\n'
        + 'export EDITOR=vi\n'
        + 'alias ll=\'ls -la\'\n'
        + 'alias pers=\'ls personnel/\'\n'
        + 'alias pending=\'ls .pending/\'\n'
        + 'PS1=\'dhollis@gregcorp:$PWD$ \'',

    '/home/dhollis/.bash_history':
        '  1  mail\n'
        + '  2  ls inbox/\n'
        + '  3  cat inbox/re_restructuring.msg\n'
        + '  4  ls personnel/\n'
        + '  5  cat personnel/park_j.prf\n'
        + '  6  cat personnel/alan_g.prf\n'
        + '  7  ls .pending/\n'
        + '  8  cat inbox/fwd_from_greg.msg\n'
        + '  9  cat .pending/HR-97-0847.complaint\n'
        + '  10 mail',

    '/home/dhollis/.plan':
        'Q4 benefits enrollment \u2014 deadline Nov 15.\n'
        + 'Board prep: exec review materials (CONF).',

    '/home/dhollis/.logout':
        '1997-10-15 08:47:00 \u2014 last session',

    // ── inbox/ ──────────────────────────────────────────────

    '/home/dhollis/inbox/re_restructuring.msg':
        'From: Corporate Communications <corpcomm@gregcorp.internal>\n'
        + 'To: All Managers <managers@gregcorp.internal>\n'
        + 'Date: Tue, 14 Oct 1997 10:00:00 -0700\n'
        + 'Subject: RE: Organizational Restructuring \u2014 Phase II\n'
        + '\n'
        + 'All Department Heads,\n'
        + '\n'
        + 'As part of the ongoing Organizational Excellence Initiative,\n'
        + 'the following structural changes take effect November 1, 1997:\n'
        + '\n'
        + '  - Data Processing is dissolved. Functions transfer to\n'
        + '    the new Enterprise Technology Services division.\n'
        + '\n'
        + '  - Signal Research is reclassified under Special Projects.\n'
        + '    Access requires Level 3 clearance (board approval).\n'
        + '\n'
        + '  - All headcount requests must now route through the\n'
        + '    Resource Allocation Committee.\n'
        + '\n'
        + 'Updated org charts will be distributed by end of week.\n'
        + 'Direct employee inquiries to your divisional HR contact.\n'
        + '\n'
        + '\u2014 Office of the CEO\n'
        + '  GregCorp',

    '/home/dhollis/inbox/re_benefits_enrollment.msg':
        'From: Human Resources <hr@gregcorp.internal>\n'
        + 'To: All Employees <all@gregcorp.internal>\n'
        + 'Date: Mon, 13 Oct 1997 09:00:00 -0700\n'
        + 'Subject: RE: Open Enrollment \u2014 Benefits Year 1998\n'
        + '\n'
        + 'Reminder: Open enrollment for Benefits Year 1998 closes\n'
        + 'November 15, 1997.\n'
        + '\n'
        + 'Changes to medical, dental, and vision coverage must be\n'
        + 'submitted via the Benefits Portal (Building B, Room 201)\n'
        + 'or by returning the enclosed paper form to HR.\n'
        + '\n'
        + '401(k) contribution adjustments do not require\n'
        + 're-enrollment.\n'
        + '\n'
        + '\u2014 Human Resources & Administration\n'
        + '  GregCorp',

    '/home/dhollis/inbox/fwd_from_greg.msg':
        'From: G. Alan <galan@gregcorp.internal>\n'
        + 'To: D. Hollis <dhollis@gregcorp.internal>\n'
        + 'Date: Sun, 12 Oct 1997 23:14:00 -0700\n'
        + 'Subject: RE: re employee concern (fwd)\n'
        + '\n'
        + 'Diane,\n'
        + '\n'
        + 'I saw the complaint you flagged. I\'ll handle it\n'
        + 'personally. Don\'t route it to Legal.\n'
        + '\n'
        + 'Thanks for keeping an eye out. This place needs\n'
        + 'more of that.\n'
        + '\n'
        + '\u2014 Greg\n'
        + '\n'
        + 'P.S. Are we still doing the holiday party this year?\n'
        + '     Please say yes. Some of us need a reason to\n'
        + '     leave the server room.',

    '/home/dhollis/inbox/re_board_session.msg':
        'From: Board Secretary <boardsec@gregcorp.internal>\n'
        + 'To: D. Hollis <dhollis@gregcorp.internal>\n'
        + 'Date: Wed, 15 Oct 1997 08:30:00 -0700\n'
        + 'Subject: RE: Board Session \u2014 Executive Review (CONFIDENTIAL)\n'
        + '\n'
        + 'Ms. Hollis,\n'
        + '\n'
        + 'Your presence is requested at the October 20 Board\n'
        + 'Session, Agenda Item 4: Executive Performance Review.\n'
        + '\n'
        + 'Please prepare personnel file GC-0001 and all related\n'
        + 'documentation for board review.\n'
        + '\n'
        + 'This matter is CONFIDENTIAL. Do not discuss with other\n'
        + 'staff members, including the subject of the review.\n'
        + '\n'
        + '\u2014 M. Pearce\n'
        + '  Secretary to the Board of Directors\n'
        + '  GregCorp',

    // ── personnel/ ──────────────────────────────────────────

    '/home/dhollis/personnel/alan_g.prf':
        'GREGCORP \u2014 PERSONNEL RECORD\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Employee:     Gregory Alan\n'
        + 'ID:           GC-0001\n'
        + 'Title:        Founder & Chief Executive Officer\n'
        + 'Department:   Executive\n'
        + 'Hire Date:    03/15/1988\n'
        + 'Status:       ACTIVE\n'
        + 'Supervisor:   Board of Directors\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + 'Clearance:    Level 4 (unrestricted)\n'
        + 'Office:       Building A, Suite 100\n'
        + 'Extension:    001\n'
        + '\n'
        + 'Last Review:  N/A (executive exemption)\n'
        + 'Notes:        Governance review scheduled \u2014 see Board\n'
        + '              Secretary (ref: agenda item 4, 10/20/97)',

    '/home/dhollis/personnel/hayes_m.prf':
        'GREGCORP \u2014 PERSONNEL RECORD\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Employee:     Margaret Hayes\n'
        + 'ID:           GC-0006\n'
        + 'Title:        VP of Operations\n'
        + 'Department:   Operations\n'
        + 'Hire Date:    11/01/1989\n'
        + 'Status:       ACTIVE\n'
        + 'Supervisor:   CEO (G. Alan)\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + 'Last Review:  01/15/1997 \u2014 EXCEEDS EXPECTATIONS\n'
        + 'Notes:        Board liaison.\n'
        + '              Member, Resource Allocation Committee.\n'
        + '              Member, Executive Review Panel.',

    '/home/dhollis/personnel/hollis_d.prf':
        'GREGCORP \u2014 PERSONNEL RECORD\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Employee:     Diane Hollis\n'
        + 'ID:           GC-0012\n'
        + 'Title:        Director, Human Resources & Administration\n'
        + 'Department:   Human Resources\n'
        + 'Hire Date:    04/15/1989\n'
        + 'Status:       ACTIVE\n'
        + 'Supervisor:   VP of Operations (M. Hayes)\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + 'Last Review:  07/15/1997 \u2014 MEETS EXPECTATIONS\n'
        + 'Notes:        Original Gregory Alan Computing staff.\n'
        + '              Reports to M. Hayes since 1996 restructuring.',

    '/home/dhollis/personnel/martinez_r.prf':
        'GREGCORP \u2014 PERSONNEL RECORD\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Employee:     Roberto Martinez\n'
        + 'ID:           GC-0042\n'
        + 'Title:        Director, Enterprise Technology Services\n'
        + 'Department:   Enterprise Technology Services\n'
        + 'Hire Date:    09/15/1994\n'
        + 'Status:       ACTIVE\n'
        + 'Supervisor:   VP of Operations (M. Hayes)\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + 'Last Review:  07/15/1997 \u2014 EXCEEDS EXPECTATIONS\n'
        + 'Notes:        Promoted from IT Operations Manager (1996).\n'
        + '              Manages former Signal Research technical staff.',

    '/home/dhollis/personnel/chen_s.prf':
        'GREGCORP \u2014 PERSONNEL RECORD\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Employee:     Sarah Chen\n'
        + 'ID:           GC-0089\n'
        + 'Title:        Senior Engineer\n'
        + 'Department:   Enterprise Technology Services\n'
        + 'Hire Date:    06/01/1993\n'
        + 'Status:       ACTIVE\n'
        + 'Supervisor:   R. Martinez\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + 'Last Review:  07/15/1997 \u2014 MEETS EXPECTATIONS\n'
        + 'Notes:        Transferred from Signal Research to ETS\n'
        + '              per restructuring directive (11/1/1996).',

    '/home/dhollis/personnel/park_j.prf':
        'GREGCORP \u2014 PERSONNEL RECORD\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Employee:     James Park\n'
        + 'ID:           GC-0847\n'
        + 'Title:        Systems Analyst\n'
        + 'Department:   [Data Processing \u2014 DISSOLVED]\n'
        + 'Hire Date:    02/01/1987\n'
        + 'Status:       TERMINATED (09/30/1997)\n'
        + 'Supervisor:   [position eliminated]\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + 'Termination:  Voluntary resignation\n'
        + 'Last Review:  07/15/1997 \u2014 MEETS EXPECTATIONS\n'
        + 'Notes:        Former Signal Research (original team, 1987).\n'
        + '              Transferred to Data Processing (1994).\n'
        + '              Department dissolved per restructuring (1997).\n'
        + '              Exit interview: DECLINED',

    // ── reports/ ────────────────────────────────────────────

    '/home/dhollis/reports/headcount_q3_97.txt':
        'GREGCORP \u2014 QUARTERLY HEADCOUNT REPORT\n'
        + 'Q3 1997\n'
        + '\n'
        + 'Prepared by: D. Hollis, HR & Administration\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Department                      HC    Chg\n'
        + '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
        + 'Executive                        4     \u2014\n'
        + 'Operations                      12    +2\n'
        + 'Enterprise Technology Services  87   +14\n'
        + 'Human Resources                  8     \u2014\n'
        + 'Finance & Legal                 22    +3\n'
        + 'Marketing & Sales               34    +6\n'
        + 'Facilities                      11     \u2014\n'
        + 'Special Projects                 3    -8\n'
        + '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
        + 'TOTAL                          181   +17\n'
        + '\n'
        + 'Notes:\n'
        + '  - Special Projects reduced from 11 to 3 per\n'
        + '    restructuring directive. Staff transferred\n'
        + '    to Enterprise Technology Services.\n'
        + '  - Signal Research reclassification complete.\n'
        + '    Remaining 3 staff report to CEO office.\n'
        + '  - Net growth driven by ETS and Sales hiring.',

    // ── .pending/ ───────────────────────────────────────────
    // spec: greg-corp-storyline.md > Key Document: HR-97-0847.complaint

    '/home/dhollis/.pending/HR-97-0847.complaint': onReadDiscover('complaint-found',
        'GREGCORP HUMAN RESOURCES \u2014 FORMAL COMPLAINT\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'Case:        HR-97-0847\n'
        + 'Filed:       08/47/1997\n'
        + 'Status:      PENDING REVIEW \u2014 DO NOT ROUTE (per exec)\n'
        + 'Priority:    STANDARD\n'
        + '\n'
        + 'Filed by:    \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\n'
        + 'Employee ID: GC-\u2588\u2588\u2588\u2588\n'
        + 'Department:  Enterprise Technology Services\n'
        + 'Supervisor:  R. Martinez\n'
        + '\n'
        + 'RE: Unauthorized resource usage / anomalous system behavior\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + '\n'
        + 'I am filing this as a formal complaint because my\n'
        + 'reports through the normal support chain have gone\n'
        + 'unanswered for four months.\n'
        + '\n'
        + 'Since May I have documented the following on systems\n'
        + 'assigned to the rf0 project (Building A, server room 3):\n'
        + '\n'
        + '  1. Four daemon processes run continuously under the\n'
        + '     \'greg\' account. These processes have no approved\n'
        + '     change request and no entry in the maintenance\n'
        + '     schedule.\n'
        + '\n'
        + '  2. The hardware entropy pool has not reached low\n'
        + '     watermark in over 400 days of continuous operation.\n'
        + '     This is not consistent with the vendor specification\n'
        + '     for the rf0 device.\n'
        + '\n'
        + '  3. I submitted tickets #4847, #4848, and #4849 to\n'
        + '     IT Operations. All three were closed as "working\n'
        + '     as designed" with no investigation.\n'
        + '\n'
        + '  4. My direct supervisor directed me to stop filing\n'
        + '     tickets and "leave it alone."\n'
        + '\n'
        + 'I am requesting formal investigation into unauthorized\n'
        + 'use of company computing resources and the failure of\n'
        + 'IT Operations to address documented concerns.\n'
        + '\n'
        + '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\n'
        + 'Employee ID: GC-\u2588\u2588\u2588\u2588\n'
        + '\n'
        + '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n'
        + 'ROUTING:\n'
        + '  09/15/1997 \u2014 Filed (internal mail)\n'
        + '  09/16/1997 \u2014 Received, D. Hollis (HR)\n'
        + '  09/18/1997 \u2014 Flagged to executive office\n'
        + '  10/12/1997 \u2014 HOLD per G. Alan \u2014 do not route to Legal'
    ),

    // ── /var/mail ───────────────────────────────────────────

    '/var/mail/dhollis':
        'From: boardsec@gregcorp.internal\n'
        + 'To: dhollis@gregcorp.internal\n'
        + 'Date: Wed, 15 Oct 1997 08:30:00 -0700\n'
        + 'Subject: Board Session \u2014 Executive Review\n'
        + '\n'
        + 'See inbox for details.\n'
        + '\u2014 M. Pearce',
};

// ─── Commands ──────────────────────────────────────────────
// spec: greg-corp-storyline.md > Additional Commands

const gregCorpCommands = {

    su: (args) => {
        if (!args) return 'Usage: su <username>';

        // Parse flags: su -, su -l, su - username, su -c cmd user
        const tokens = args.trim().split(/\s+/);
        let username = null;
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t === '-' || t === '-l' || t === '--login') continue;
            if (t === '-c' || t === '-s') { i++; continue; } // skip flag + arg
            if (t.startsWith('-')) continue;
            username = t;
            break;
        }
        // 'su -' with no username means root
        if (!username) username = 'root';

        if (Shell._activeProfile) {
            return 'su: cannot switch users while in a profile. Type \'exit\' first.';
        }

        if (username === 'root') {
            return 'su: authentication failure';
        }

        if (username === 'greg') {
            return 'su: account greg is locked (executive hold \u2014 contact board secretary)';
        }

        const profile = gregCorpProfiles[username];

        if (!profile) {
            return 'su: unknown user \'' + username + '\'';
        }

        // Gate: requires Signal hunt contact-made
        if (!Kernel.hunt.has('contact-made')) {
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
            Kernel.hunt.discover('profile-' + username + '-entered');
            if (match.discover) {
                Kernel.hunt.discover(match.discover);
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
        // Signal hunt: corrupted root
        if (args === 'root') {
            if (Kernel.hunt.flags.contact) {
                Kernel.hunt.discover('intruder-finger');
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
            if (!Kernel.hunt.has('contact-made')) {
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
};

// ─── Triggers ─────────────────────────────────────────────
// spec: greg-corp-storyline.md > Key Document: HR-97-0847.complaint (complaint-found trigger)

const gregCorpTriggers = [
    { type: 'discovery', match: 'complaint-found', effect: 'screenFlicker', once: true,
        callback: () => {
            setTimeout(() => {
                Terminal.appendSystemLine('<span class="timestamp-anomaly">CASE STILL OPEN</span>');
            }, 1500);
        }
    },
];

// ─── Man Pages ─────────────────────────────────────────────

const gregCorpManPages = {
    su: 'SU(1)                        GregOS Manual                        SU(1)\n\n'
        + 'NAME\n'
        + '       su - switch user\n\n'
        + 'SYNOPSIS\n'
        + '       su <username>\n\n'
        + 'DESCRIPTION\n'
        + '       su switches the current session to the specified user\n'
        + '       account. The prompt, home directory, and environment\n'
        + '       variables are updated to reflect the new identity.\n\n'
        + '       Use \'exit\' to return to the previous user.\n\n'
        + 'AUTHENTICATION\n'
        + '       Access to user accounts requires appropriate system\n'
        + '       privileges. Inactive accounts may require additional\n'
        + '       authorization.\n\n'
        + 'AUTHOR\n'
        + '       GregOS System\n\n'
        + 'SEE ALSO\n'
        + '       finger(1), id(1), exit(1)',

    mail: 'MAIL(1)                      GregOS Manual                      MAIL(1)\n\n'
        + 'NAME\n'
        + '       mail - read mail\n\n'
        + 'SYNOPSIS\n'
        + '       mail\n\n'
        + 'DESCRIPTION\n'
        + '       mail reads the current user\'s mailbox from /var/mail.\n'
        + '       Messages are displayed in received order.\n\n'
        + 'AUTHOR\n'
        + '       GregOS System\n\n'
        + 'SEE ALSO\n'
        + '       su(1), finger(1)',
};

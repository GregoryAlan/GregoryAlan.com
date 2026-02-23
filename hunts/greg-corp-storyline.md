# GregCorp — Storyline Document

## Premise

The visitor, having made contact through The Signal, gains access to employee accounts on the system. Switching to Diane Hollis's profile reveals the mundane corporate infrastructure of GregCorp — the company Gregory Alan built. Through emails, personnel records, and an HR complaint, the visitor assembles a portrait of a company that restructured around its founder's obsession, and an employee who noticed something wrong and was silenced.

This is Phase I territory — everything here passes the sysadmin test. No supernatural elements. Just corporate politics, organizational restructuring, and a complaint that was quietly buried.

## Setting: GregCorp (1997)

<!-- contract
status: implemented
impl: hunts/greg-corp.js (gregCorpProfiles, gregCorpHomeFiles)
last-synced: 2026-02-22
-->

**Era:** October 1997. GregCorp (née Gregory Alan Computing, Inc.) is a mid-size tech company undergoing "Organizational Excellence Initiative" restructuring.

**Key events in the timeline:**
- **1987:** Company founded. James Park hired as one of the original Signal Research team.
- **1988:** Gregory Alan (GC-0001) becomes CEO.
- **1989:** Diane Hollis and Margaret Hayes hired.
- **1993:** Sarah Chen hired into Signal Research.
- **1994:** Roberto Martinez hired. James Park transferred from Signal Research to Data Processing.
- **1996:** First restructuring. Signal Research begins downsizing. Hollis now reports to Hayes.
- **1997 (May–Sep):** Anonymous employee files complaints about unauthorized daemon processes and entropy pool anomalies. Three IT tickets closed as "working as designed."
- **1997 (Sep 30):** James Park terminated ("voluntary resignation"). Exit interview declined.
- **1997 (Oct 12):** Gregory personally intervenes on the HR complaint — "Don't route it to Legal."
- **1997 (Oct 14):** Restructuring Phase II announced. Signal Research reclassified under Special Projects (Level 3 clearance, board approval required).
- **1997 (Oct 15):** Board session requested — executive review of Gregory Alan (GC-0001). Diane's last login.
- **1997 (Nov 1):** Data Processing dissolved. Functions transfer to Enterprise Technology Services.

## Characters

### Diane Hollis (dhollis)

<!-- contract
status: implemented
impl: hunts/greg-corp.js:gregCorpProfiles.dhollis, gregCorpHomeFiles['/home/dhollis/*']
last-synced: 2026-02-22
-->

- **Title:** Director, Human Resources & Administration
- **ID:** GC-0012
- **Era:** Original Gregory Alan Computing staff (1989)
- **Role in story:** The player's POV character for this layer. Her account is the one they `su` into. She is competent, careful, and caught between loyalty and duty.
- **Supervisor:** Margaret Hayes (VP Operations)
- **Shell:** `/bin/bash`, `EDITOR=vi`, `TERM=vt100`
- **Hostname:** `gregcorp.internal`
- **Password:** `password`
- **Last login:** Wed Oct 15 08:47:00 1997 on tty2
- **Plan:** Q4 benefits enrollment — deadline Nov 15.

### Gregory Alan

- **Title:** Founder & CEO
- **ID:** GC-0001
- **Not a playable profile** — `su greg` returns "account greg is locked (executive hold — contact board secretary)"
- **Clearance:** Level 4 (unrestricted)
- **Present in:** Personnel record (`alan_g.prf`), email from Greg to Diane (`fwd_from_greg.msg`), board review request, complaint routing
- **Voice:** Warm but distracted. The email to Diane is the only time the visitor hears him directly — and he's deflecting an investigation while asking about the holiday party.

### James Park

- **Title:** Systems Analyst (terminated)
- **ID:** GC-0847
- **Department:** Data Processing (DISSOLVED)
- **Key detail:** Employee ID is 0847. Original Signal Research team member (1987). Transferred to Data Processing (1994). Department dissolved (1997). "Voluntary resignation." Exit interview: DECLINED.
- **Not named in complaint** — the filer is redacted. But the complaint references the rf0 daemons and entropy pool — exactly what Signal Research would have monitored.

### Supporting Cast

- **Margaret Hayes** (GC-0006) — VP Operations. Board liaison. Member of Resource Allocation Committee and Executive Review Panel.
- **Roberto Martinez** (GC-0042) — Director, Enterprise Technology Services. Manages former Signal Research technical staff.
- **Sarah Chen** (GC-0089) — Senior Engineer. Transferred from Signal Research to ETS per restructuring directive.

## Discovery Flow

### Gate: Signal Hunt Contact

<!-- contract
status: implemented
impl: hunts/greg-corp.js:gregCorpCommands.su (line 425: Kernel.hunt.has('contact-made'))
last-synced: 2026-02-22
-->

All GregCorp content is gated behind `contact-made` from The Signal hunt. Before contact:
- `su dhollis` → `su: authentication failure` (with promptCorruption glitch)
- `finger dhollis` → `finger: dhollis: no such user`

After contact, the profiles become accessible.

### Entry: `su dhollis`

<!-- contract
status: implemented
impl: hunts/greg-corp.js:gregCorpCommands.su, Shell.switchProfile()
last-synced: 2026-02-22
-->

- Player runs `su dhollis`, prompted for password
- Password: `password`
- On success: profile switch (prompt changes to `dhollis@gregcorp:~$`), discovery `profile-dhollis-entered` fires
- Environment changes: USER=dhollis, HOME=/home/dhollis, HOSTNAME=gregcorp.internal

### Exploration: Home Directory

<!-- contract
status: implemented
impl: hunts/greg-corp.js:gregCorpHomeFiles
last-synced: 2026-02-22
-->

**Diane's filesystem:**
```
/home/dhollis/
├── .bashrc
├── .bash_history          ← breadcrumbs showing her reading order
├── .plan
├── .logout
├── inbox/
│   ├── re_restructuring.msg       ← Phase II restructuring announcement
│   ├── re_benefits_enrollment.msg ← mundane HR business (atmosphere)
│   ├── fwd_from_greg.msg          ← Greg's personal email re: complaint
│   └── re_board_session.msg       ← board requesting GC-0001 review
├── personnel/
│   ├── alan_g.prf         ← Gregory Alan — CEO, governance review pending
│   ├── park_j.prf         ← James Park — terminated, Signal Research original
│   ├── hollis_d.prf       ← Diane Hollis — self
│   ├── hayes_m.prf        ← Margaret Hayes — VP Operations
│   ├── martinez_r.prf     ← Roberto Martinez — manages ex-Signal staff
│   └── chen_s.prf         ← Sarah Chen — transferred from Signal Research
├── reports/
│   └── headcount_q3_97.txt ← Special Projects from 11 to 3 staff
└── .pending/
    └── HR-97-0847.complaint ← the key document
```

### Key Document: HR-97-0847.complaint

<!-- contract
status: implemented
impl: hunts/greg-corp.js:gregCorpHomeFiles['/home/dhollis/.pending/HR-97-0847.complaint'], gregCorpTriggers[0]
last-synced: 2026-02-22
-->

The complaint that ties GregCorp to The Signal:

- **Filed by:** Redacted (████████ ████, GC-████)
- **Subject:** Unauthorized resource usage / anomalous system behavior
- **Content:** Four daemon processes running under `greg` account with no change request. Entropy pool hasn't hit low watermark in 400+ days. Three IT tickets closed as "working as designed." Supervisor told filer to "leave it alone."
- **Routing:** Filed → Received by Hollis → Flagged to executive office → **HOLD per G. Alan — do not route to Legal**
- **Case number:** HR-97-0847 (the motif, again)
- **Filed date:** `08/47/1997` — an impossible date. The motif leaking into the calendar.

On read: discovery `complaint-found` fires → `screenFlicker` effect → 1.5s delay → system line: `CASE STILL OPEN` (timestamp-anomaly styled)

### Additional Commands

<!-- contract
status: implemented
impl: hunts/greg-corp.js:gregCorpCommands (su, mail, finger), gregCorpManPages
last-synced: 2026-02-22
-->

- **`su`** — Switch user with password prompt. Supports flags (`-`, `-l`, `-c`, `-s`). Special cases for `root` (auth failure), `greg` (locked), unknown users.
- **`mail`** — Reads `/var/mail/<user>`. Diane has a mail notification from board secretary.
- **`finger`** — Extended to show GregCorp profile finger info when contact-made. Overrides the Signal hunt's finger for non-root users.
- **Man pages:** `su(1)`, `mail(1)`

## Narrative Threads

### Thread: The Restructuring

The company reorganized around Gregory's project. Signal Research — where the rf0 work happened — was reclassified under Special Projects with Level 3 clearance. The technical staff were scattered across departments. The original team member (Park) left. The complaint was suppressed. The board is reviewing Gregory himself.

**What this tells the visitor:** The corporation recognized something was happening with Gregory's work. Their response was institutional: restructure, reclassify, restrict access. They didn't stop the work — they reclassified it.

### Thread: The Complaint

Someone noticed the daemons and the entropy anomaly. They filed tickets. The tickets were closed. They went to HR. HR flagged it to the CEO. The CEO buried it. The complaint references the exact same phenomena the visitor has been investigating: unauthorized daemon processes and an entropy pool that never depletes.

**What this tells the visitor:** They are not the first person to notice. Someone else saw the same anomalies — from the inside, years earlier. That person was silenced. The visitor is now doing the same investigation, from the outside, and nobody can silence them.

### Thread: James Park (GC-0847)

Employee ID 0847. Original Signal Research team (1987). The motif as a personnel number. Transferred out of Signal Research (1994). Department dissolved (1997). Resigned. Declined exit interview.

**What this tells the visitor:** The motif number haunts even the corporate records. Park knew about the work from the beginning. He left — or was pushed out — and refused to talk about it.

## Test Script

### Prerequisites
- Complete Signal hunt through `contact-made` discovery
- Be at v2.0

### Entry Test

| Command | Expected |
|---------|----------|
| `su dhollis` | Password prompt |
| *(enter `password`)* | `Last login: Wed Oct 15 08:47:00 1997 on tty2` |
| *(prompt)* | `dhollis@gregcorp:/home/dhollis$` |

### Exploration Test

| Command | Expected |
|---------|----------|
| `ls` | `.bashrc`, `.bash_history`, `.plan`, `.logout`, `inbox/`, `personnel/`, `reports/`, `.pending/` |
| `cat .bash_history` | 10 entries showing Diane's reading order |
| `cat inbox/fwd_from_greg.msg` | Greg's email — "I'll handle it personally. Don't route it to Legal." |
| `cat inbox/re_board_session.msg` | Board requesting personnel file GC-0001 for executive review |
| `cat personnel/alan_g.prf` | Gregory Alan — CEO, governance review pending |
| `cat personnel/park_j.prf` | James Park — GC-0847, TERMINATED, Signal Research original, exit interview DECLINED |
| `cat .pending/HR-97-0847.complaint` | Full complaint text. screenFlicker fires. "CASE STILL OPEN" appears after 1.5s |
| `cat reports/headcount_q3_97.txt` | Special Projects reduced from 11 to 3 |
| `mail` | Board secretary notification |
| `finger dhollis` | Diane's finger info |
| `exit` | Returns to guest profile |

### Edge Cases

| Test | Expected |
|------|----------|
| `su dhollis` before contact-made | `su: authentication failure` + promptCorruption |
| `finger dhollis` before contact-made | `finger: dhollis: no such user` |
| `su greg` | `su: account greg is locked (executive hold — contact board secretary)` |
| `su root` | `su: authentication failure` |
| `su dhollis` with wrong password | `su: authentication failure` |
| `su dhollis` while already in profile | `su: cannot switch users while in a profile. Type 'exit' first.` |

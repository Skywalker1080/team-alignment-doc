# Team Alignment Repo: Design

Date: 2026-11-03
Team: Yogesh Sahu, Ranjeet Ratan, Pranav Darekar

## 1. Intent

Three people run an agency together. Every meeting they make decisions, set tasks, and form
assumptions. Today the raw notes go to Claude, come back as a summary, and get pasted under a
dated `@today` heading in a shared Google Doc. Over the following days people tick tasks, add
notes, and occasionally edit decisions.

That process breaks down in four ways:

- The format drifts from meeting to meeting.
- Unfinished tasks get re-pasted under new dates, so nobody can see that a task is three weeks old.
- Owners and deadlines are often missing.
- A wall of text is the only view.

This repo replaces the Google Doc. The data lives in git as small structured files. Each
teammate's Claude Code reads and writes those files under strict rules. A public, view-only
dashboard turns the data into a picture of where the team stands.

**Success:** any of the three opens the dashboard in the morning and sees within seconds what
everyone is doing today, what has slipped and since when, and whether the team keeps the
promises it makes.

## 2. Goals, non-goals, anti-goals

Goals
- One consistent, machine-checked format for meetings, tasks, decisions, assumptions, themes.
- A task is created once and keeps its origin. Carry-over is computed, never copied.
- Every change goes through Claude and a git commit, by any of the three, from their own machine.
- Checks run locally, through Claude's hooks and the pre-commit hook, and in CI.
- A dark, clean, distraction-free dashboard that leans on visuals rather than text.

Non-goals
- No editing from the dashboard. It is view-only.
- No import of the Google Doc history. Day one is the first meeting logged here.
- No auth, accounts, or backend. Static site only.
- No integrations (Slack, calendar, email) in v1.

Anti-goals (failure even if it works)
- Claude padding sections to hit a count, or inventing owners or deadlines without asking.
- Losing history: a task silently deleted, or a decision overwritten without a trace.
- Two teammates pushing at once and one overwriting the other.
- A dashboard that is just the Google Doc again as walls of text.

## 3. Constraints (decided by the user)

- Location: `C:\Projects\team-alignment`, git repo, branch `main`.
- All three use Claude Code. Claude is the only intended writer of data files.
- **TLDR rule:** every meeting section has **at most 4 points**. No padding when there is less to say.
- Deadlines are required but come in two kinds: **hard** (a real commitment) and **soft** (an estimate).
- A task with no owner belongs to **anyone**. Whoever picks it up becomes the owner.
- "Done" and "dropped" are different states. (Strikethrough used to mean both.)
- Leftover tasks appear on today's view as **overdue**, showing the date and meeting they came from.
- Themes are loose. Claude assigns them, reusing existing themes before creating new ones.
- Dashboard is **view-only** and served on a **public URL**.
- Commit flow: Claude validates, **builds and visually checks the dashboard locally**, pulls,
  then **pushes directly to `main`**. No pull requests.
- Look: modern, clean, distraction-free, **dark theme**, modelled on the Claude app's design
  language (see section 8).
- Start fresh. No history import.

## 4. Data model

All data lives under `data/`. One file per record, so concurrent pushes rarely conflict.
IDs are sequential and zero-padded (`T-0001`, `D-0001`, `A-0001`). The validator rejects duplicates.

**ID collisions (builder's call):** two teammates can both create `T-0043` before either one
pulls. After `git fetch` and before rebasing, Claude runs `npm run fix-ids`. That script finds local records
whose IDs clash with incoming ones and renumbers the local records to the next free ID. It
rewrites every reference to them: meeting `tasks_created` / `decisions_made` / `assumptions_made`
and `superseded_by`. It then amends the local commit message. Incoming (already pushed) records
always keep their IDs. The script has its own tests.

```
data/
  team.yaml                  # members: id, full name, first name, git emails
  themes.yaml                # list of themes: id, name, created, archived (computed, see below)
  meetings/2026-11-03.md     # one per meeting (suffix -2, -3 if more than one per day)
  meetings/raw/2026-11-03.md # raw notes as captured, never edited after creation
  tasks/T-0001.yaml
  decisions/D-0001.yaml
  assumptions/A-0001.yaml
```

### team.yaml
```yaml
members:
  - id: yogesh
    name: Yogesh Sahu
    emails: [yogesh.sahu@cryptoprism.io]
  - id: ranjeet
    name: Ranjeet Ratan
    emails: [rratanranjeet790395@gmail.com]
  - id: pranav
    name: Pranav Darekar
    emails: [pranav.darekar1080@gmail.com]
```
Claude identifies the current user by `git config user.email` matched against `emails`. If it
doesn't match, Claude asks who you are and suggests adding the email. Emails stay in the repo
but are **never rendered** on the dashboard. Task cards show **full names**, because the user
asked for full names. Compact places (lane labels, chart axes) use first names.

### Task (`tasks/T-0042.yaml`)
```yaml
id: T-0042
title: Build the AWS lead pipeline
description: >
  Scrape Product Hunt, YC, LinkedIn and X into one DB, filter by ICP,
  outreach the next day.
owner: ranjeet            # member id, or "anyone"
priority: p0              # p0 | p1 | p2
theme: lead-generation    # id from themes.yaml
deadline:
  date: 2026-11-05
  kind: hard              # hard | soft
status: todo              # todo | doing | done | dropped
origin: 2026-11-03        # meeting id the task was born in; never changes
history:                  # append-only
  - at: 2026-11-03T18:20:00+05:30
    by: yogesh
    event: created
  - at: 2026-11-04T10:02:00+05:30
    by: ranjeet
    event: status
    to: doing
  - at: 2026-11-04T16:40:00+05:30
    by: ranjeet
    event: note
    text: API rate limits on X, switching to manual export for now.
  - at: 2026-11-04T16:41:00+05:30
    by: ranjeet
    event: deadline
    from: 2026-11-05
    to: 2026-11-07
```
Rules:
- `origin` is immutable.
- `history` is append-only. Existing entries are never edited or removed.
- `status: done` or `status: dropped` requires a matching history entry. That entry's timestamp
  is the completion or drop time.
- Changing the deadline appends a `deadline` history event. The first deadline is the one used
  for the "kept promises" metric, so moving a deadline cannot hide a miss.
- Tasks are never deleted. Wrong or abandoned tasks are `dropped` with a reason.
- Missing deadline at creation: Claude asks. If the user says they don't know, Claude sets a
  **soft deadline 2 days after the meeting** and records that it was a default.

### Decision (`decisions/D-0007.yaml`)
```yaml
id: D-0007
text: Plan work in 1-2 day sprints.
why: Long strategies block the team.   # optional
made: 2026-11-03                       # meeting id
theme: team-process
status: active                         # active | superseded | reversed
superseded_by: D-0012                  # set when status is superseded
history: [...]                         # append-only, same shape as tasks
```
Changing a decision means creating a new decision that supersedes it. The old one is kept.

### Assumption (`assumptions/A-0003.yaml`)
```yaml
id: A-0003
text: LinkedIn ads beat cold DMs for our ICP.
made: 2026-11-03
theme: outreach
status: untested                        # untested | confirmed | rejected
evidence: ""                            # filled when status changes
history: [...]
```

### Theme (`themes.yaml`)
```yaml
themes:
  - id: outreach
    name: Outreach
    created: 2026-11-03
```
A theme is shown as **archived** when it has had no open tasks for 14 days. This is computed
and not stored.

### Meeting (`meetings/2026-11-03.md`)
Markdown with YAML frontmatter, so it reads well on GitHub and stays machine-checkable.
```markdown
---
id: 2026-11-03
date: 2026-11-03
attendees: [yogesh, ranjeet, pranav]
notes_by: pranav
raw: raw/2026-11-03.md
principle: Avoid any strategy that blocks the team for a long time.   # optional
tasks_created: [T-0042, T-0043]
decisions_made: [D-0007]
assumptions_made: [A-0003]
---

## Discussion
- point (max 4)

## Decisions
- point (max 4)

## Tasks
- point (max 4)

## Assumptions
- point (max 4)
```
Sections:
- `Discussion` is required.
- `Decisions`, `Tasks` and `Assumptions` appear only when there is something to say.
- Every section has 1 to 4 bullets. No other headings are allowed.
- The full detail lives in the linked records. The TLDR bullets are summaries.

The "review of previous tasks" (done, slipped or dropped since the last meeting) is **not stored**.
The dashboard computes it for each meeting.

## 5. Derived metrics (computed, tested)

All computed from the data at build time. Today's date comes from the build clock in
Asia/Kolkata. The dashboard also recomputes "today" in the browser so a stale build still
shows correct overdue counts.

- **Overdue days:** `today - deadline.date` for open tasks (`todo` or `doing`) past their deadline.
- **Carry-over age:** `today - origin`, plus the number of meetings held since origin while
  the task stayed open.
- **Kept promises (per ISO week):** of the tasks whose *first* deadline fell in that week, the
  share done on or before that first deadline. Dropped tasks are excluded. Shown separately
  for hard deadlines and for all deadlines.
- **Workload:** open tasks per owner (including `anyone`), split by priority.
- **Theme progress:** done / (done + open) per theme, dropped excluded.
- **Previous-meeting review:** for each meeting, the tasks from earlier meetings that changed
  state between the previous meeting and this one.

## 6. Claude rule system

### `CLAUDE.md` (committed, loaded automatically by every teammate's Claude)
Holds the rules from section 4 in imperative form, plus:
- Only touch files under `data/` for data changes. Never edit `history` entries.
- Never invent an owner, deadline, or priority. Ask. The one exception is the 2-day soft default
  when the user says they don't know.
- Reuse an existing theme when one fits. Show the user before creating a new theme.
- Respect the "at most 4" rule and never pad.
- Write first names in prose and member ids in data. Never put emails into meeting or task text.
- Follow the commit workflow (section 7) for every change, without exception.

### Slash commands (`.claude/commands/`, shared via the repo)
- `/meeting`: paste raw notes. Claude saves them to `meetings/raw/`, drafts the meeting entry
  and every new task, decision and assumption, and walks through tasks from earlier meetings
  that are still open, asking what happened to each one. It then shows the whole draft,
  including anything it could not assign. **Nothing is written until the user confirms.**
- `/done <id> [note]`: mark a task done.
- `/drop <id> <reason>`: drop a task.
- `/note <id> <text>`: append a note.
- `/update <id>`: change owner, deadline, priority, status or theme, recorded in history.
- `/decide`: record or supersede a decision outside a meeting.
- `/today`: print today's view in the terminal. Read-only, no commit.

Small changes (`/done`, `/note`, and so on) do not need a confirmation step. `/meeting` always does.

### Hooks (`.claude/settings.json`, committed)
- PostToolUse on Write/Edit under `data/`: run the validator. If it fails, Claude sees the
  errors and fixes them before going on.

## 7. Commit workflow (every change)

1. Identify the user from git email.
2. Make the edits under `data/`.
3. Run `npm run validate`. It must pass.
4. Run `npm test`. It must pass.
5. Run `npm run check:dashboard`. This builds the site and loads it in a headless browser
   (Playwright, Chromium). It asserts that the page renders without console errors, and that
   every changed record appears where it should, with the right status, owner lane and overdue
   label. It then saves screenshots of Today and of the affected page to `.check/` (gitignored).
   Claude looks at those screenshots before going on. This is automatic, so `/done` and `/note`
   stay quick with no human step. After `/meeting`, Claude also gives the user the local
   preview link. (Builder's call on how "Claude checks the dashboard" works. It must run on
   Windows and macOS.)
6. `git fetch origin`, then `npm run fix-ids` (renumbers local records that clash with records
   fetched from origin, before the rebase can hit an add/add conflict), then
   `git rebase origin/main`. If anything came in, re-run steps 3 to 5.
7. Commit with a message in the form `<what> · <who>`, for example `T-0042 done · Ranjeet` or
   `meeting 2026-11-03 · Pranav`.
8. `git push origin main`. If the push is rejected, go back to step 6.

Safety nets: the git pre-commit hook runs the validator and tests. GitHub Actions runs the
validator, tests and build on every push to `main`, then deploys only if all of them pass.

## 8. Dashboard

Static site generated from `data/` at build time. Public URL on **Cloudflare Pages** (free tier).
It redeploys on every push to `main`, via a GitHub Actions deploy step that runs after the checks
pass. (Builder's call: Vercel's free Hobby plan is for non-commercial use only, and a private repo
under a GitHub org needs a paid Vercel team. Cloudflare Pages is free for commercial use and
works with private repos, including repos owned by an org.)

### Look
- Dark theme only, modelled on the Claude app: warm near-black background, off-white text,
  coral/clay accent used sparingly, muted warm greys for secondary text and borders, generous
  whitespace, soft rounded corners, no heavy shadows or gradients.
- Fonts: a serif for headings and a clean sans for body text, using open-source equivalents
  because Anthropic's own fonts are licensed. No Claude or Anthropic logo or name. This is the
  agency's tool.
- Colour reserved for meaning: red for overdue, amber for at risk, green for done. Hard
  deadlines are drawn ◆ solid and soft deadlines ○ dashed.
- Must stay usable at phone width (Ranjeet checks it on his phone in the morning).

### Pages / sections
1. **Today** (landing):
   - A lane per person plus an **Anyone** lane, each showing open tasks due today, overdue, or in
     progress.
   - Each task card shows the full title, a short description, priority, the deadline with its
     kind, owner (full name), theme, and an origin badge such as "from 14 Oct · 6d overdue".
   - Tapping a card expands its history.
2. **Trackers:**
   - Kept promises (weekly bars)
   - Deadline timeline (Gantt strip, ◆ hard / ○ soft, slipped deadlines in red)
   - Carry-over age (buckets plus the oldest open task)
   - Workload balance
   - Theme progress
3. **Decisions:** a timeline of decisions. Superseded decisions are shown linked to their replacements.
4. **Assumptions:** a board of assumptions grouped by untested, confirmed and rejected, with the
   age of each untested one.
5. **Meetings:** a list of meetings. Each one shows its TLDR sections and the computed
   previous-meeting review.
6. **All tasks:** a filterable table (owner, theme, status, priority).

## 9. Tooling (builder's call, stated defaults)

- Node 24 LTS, TypeScript, npm.
- Schemas in Zod. The validator CLI is `npm run validate`.
- Tests with Vitest. Fixture data sets cover every derived metric and every validator rule.
- Dashboard: Vite + React, prebuilt into static HTML/JS that reads a JSON bundle generated from `data/`.
- Pre-commit: a plain git hook installed by `npm install` (via a `prepare` script).
- CI: GitHub Actions running `npm ci`, validate, test and build.
- Hosting: Cloudflare Pages, deployed from GitHub Actions using `wrangler`. The repo can stay private while the dashboard is public.
- Visual check: Playwright with Chromium, installed as a dev dependency.

## 10. Open items for the team (not blocking the build)

- GitHub location (org or personal account) and repo name. The build works locally until a
  remote is added. Whoever owns the Cloudflare account adds the API token and account ID as
  GitHub repo secrets once.
- On the machine this was designed on, `C:\Projects\CLAUDE.md` (the personal-brand manual) also loads inside
  this repo, because it sits in a parent folder. The repo's own `CLAUDE.md` will state that it
  takes precedence. The cleaner fix is to clone this repo outside `C:\Projects`.
- Optional: a rule to keep money amounts out of public task text. Not requested yet.

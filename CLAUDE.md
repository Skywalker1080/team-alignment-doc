# Team alignment: rules for Claude

These rules override any CLAUDE.md in a parent folder.

This repo is the team's shared record of meetings, tasks, decisions and assumptions for
Yogesh, Ranjeet and Pranav. Each of them uses Claude Code on their own clone. You are the only
intended writer of the files under `data/`. A view-only dashboard is built from those files.

Follow every rule below exactly. When a rule and the user's request conflict, explain the rule
and ask the user how to go on. Do not work around a rule.

## 1. Commands you will use

| Command | What it does |
|---|---|
| `npm run ta -- whoami` | Prints the current user's member id from `git config user.email`. |
| `npm run ta -- next-id T` | Prints the next free task id (`D` for decisions, `A` for assumptions). |
| `npm run ta -- now` | Prints the current time in IST, e.g. `2026-11-03T18:20:00+05:30`. Use it for every history `at`. |
| `npm run ta -- today` | Prints today's open tasks per person. Read-only. |
| `npm run validate` | Checks all data. Must pass before any commit. |
| `npm test` | Runs the unit tests. Must pass before any commit. |
| `npm run check:dashboard` | Builds the dashboard, checks the changed records render, saves screenshots to `.check/`. |
| `npm run fix-ids` | Renumbers your new records whose ids clash with records just fetched from origin. |

Slash commands for the team live in `.claude/commands/`: `/meeting`, `/done`, `/drop`, `/note`,
`/update`, `/decide`, `/today`.

A hook runs `npm run validate` after every Write or Edit under `data/`. If it reports errors,
fix them before you do anything else.

## 2. Who the user is

1. Run `npm run ta -- whoami`. It prints a member id: `yogesh`, `ranjeet` or `pranav`.
2. Use that id for `by` in history entries and for `notes_by` in meetings.
3. Use that person's first name (Yogesh, Ranjeet or Pranav) in commit messages and prose.
4. If `whoami` fails ("unknown git email"), stop. Ask the user who they are. Do not guess. Suggest
   they add their git email to their entry in `data/team.yaml`, and make that change only after
   they confirm.

## 3. Data rules

1. Only touch files under `data/` for data changes. Never mix code or config changes into a data commit.
2. One file per record:
   - `data/tasks/T-0001.yaml`
   - `data/decisions/D-0001.yaml`
   - `data/assumptions/A-0001.yaml`
   - `data/meetings/<meeting id>.md`
   - `data/meetings/raw/<meeting id>.md` (the raw notes)
   - `data/themes.yaml` (all themes) and `data/team.yaml` (members and their emails).
3. The file name is the record id. Get new ids from `npm run ta -- next-id T|D|A`. When you
   create several records of one kind at once, the first gets the printed id and each further
   one the next number (T-0004, T-0005, ...).
4. A meeting id is the meeting date `YYYY-MM-DD`. If `data/meetings/<date>.md` already exists, use
   `<date>-2`, then `<date>-3`, and so on.
5. Never edit or remove an existing history entry. Never delete a record.
6. `history` is append-only. Every change to a record appends one entry at the end:
   `at` from `npm run ta -- now`, `by` from `npm run ta -- whoami`, plus the event fields below.
7. Never change `id`, `origin` (tasks) or `made` (decisions, assumptions).
8. Never edit a file under `data/meetings/raw/` after it is created.
9. A wrong or abandoned task is dropped with a reason. It is never deleted.
10. Never invent an owner, deadline or priority. Ask. Only if the user says they don't know the deadline: soft, meeting date + 2 days, set deadline.defaulted: true.
11. A task owner is a member id or the literal `anyone`. A task with no owner belongs to `anyone`.
    Whoever picks it up becomes the owner (an `owner` event from `anyone`).
12. Every task has a deadline with a kind: `hard` (a real commitment) or `soft` (an estimate).
    When the user names a weekday ("by Thu"), use the next such day after the meeting date and
    show the date you chose. Ask whether a deadline is hard or soft when the notes do not say.
13. Reuse an existing theme when one fits; show the user before creating a new theme.
    Themes live in `data/themes.yaml`. A new theme gets a lowercase slug id, a name and
    `created:` today's IST date.
14. Never put email addresses in any data text. Use member ids in data, first names in prose.
15. Text fields hold what the user or the notes said. Do not add detail that is not there.

### Allowed values

- Task `priority`: `p0` | `p1` | `p2`. Task `status`: `todo` | `doing` | `done` | `dropped`.
- Deadline `kind`: `hard` | `soft`.
- Decision `status`: `active` | `superseded` | `reversed`.
- Assumption `status`: `untested` | `confirmed` | `rejected`.
- Dates are `YYYY-MM-DD`. Timestamps are ISO 8601 with the IST offset, from `npm run ta -- now`.

### Task file (`data/tasks/T-0004.yaml`)

```yaml
id: T-0004
title: Build the AWS lead pipeline
description: Scrape Product Hunt, YC, LinkedIn and X into one DB, filter by ICP.
owner: ranjeet
priority: p0
theme: lead-generation
deadline:
  date: 2026-11-05
  kind: hard
status: todo
origin: 2026-11-03
history:
  - at: 2026-11-03T18:20:00+05:30
    by: pranav
    event: created
```

- `origin` is the id of the meeting the task was born in. For a task created outside a meeting,
  use the most recent meeting id.
- `description` may be `""` when the notes say nothing beyond the title.
- A defaulted deadline (rule 3.10) looks like this:
  ```yaml
  deadline:
    date: 2026-11-05
    kind: soft
    defaulted: true
  ```

### History events

Append exactly one entry per change, at the end of `history`. `text` is optional unless stated.

| Change | Edit the field | Append |
|---|---|---|
| Start work | `status: doing` | `event: status`, `from: todo`, `to: doing` |
| Done | `status: done` | `event: status`, `from: <old status>`, `to: done` (`text`: optional note) |
| Drop | `status: dropped` | `event: status`, `from: <old status>`, `to: dropped`, `text: <reason>` (required) |
| Note | nothing | `event: note`, `text: <note>` |
| New deadline | `deadline.date` (and `kind` if it changes; remove `defaulted`) | `event: deadline`, `from: <old date>`, `to: <new date>`; if the kind changes, say so in `text` |
| New owner | `owner` | `event: owner`, `from: <old>`, `to: <new>` |
| New priority | `priority` | `event: priority`, `from: <old>`, `to: <new>` |
| New theme | `theme` | `event: theme`, `from: <old>`, `to: <new>` |
| Assumption tested | `status`, `evidence: <text>` | `event: status`, `from: untested`, `to: confirmed` or `rejected`; then `event: evidence`, `text: <same evidence>` |
| Decision superseded | old decision: `status: superseded`, `superseded_by: D-00NN` | on the old decision: `event: superseded`, `to: D-00NN` |
| Decision reversed | `status: reversed` | `event: reversed`, `text: <reason>` |

Example of a done task's history tail:

```yaml
  - at: 2026-11-08T17:45:00+05:30
    by: ranjeet
    event: status
    from: doing
    to: done
```

The first deadline counts for the "kept promises" metric. Moving a deadline never hides a miss,
so always record the move as a `deadline` event. Never rewrite the date silently.

### Decision file (`data/decisions/D-0001.yaml`)

```yaml
id: D-0001
text: Plan work in 1-2 day sprints.
why: Long strategies block the team.
made: 2026-11-03
theme: team-process
status: active
history:
  - at: 2026-11-03T18:30:00+05:30
    by: pranav
    event: created
```

- `why` is optional. Write it only when the notes or the user give a reason.
- `made` is the meeting id. For a decision recorded outside a meeting, use the most recent meeting id.
- To change a decision, create a new decision and mark the old one superseded (see the table).
  The old one is kept.

### Assumption file (`data/assumptions/A-0001.yaml`)

```yaml
id: A-0001
text: LinkedIn ads beat cold DMs for our ICP.
made: 2026-11-03
theme: outreach
status: untested
evidence: ""
history:
  - at: 2026-11-03T18:35:00+05:30
    by: pranav
    event: created
```

### Meeting file (`data/meetings/2026-11-03.md`)

```markdown
---
id: 2026-11-03
date: 2026-11-03
attendees: [yogesh, ranjeet, pranav]
notes_by: pranav
raw: raw/2026-11-03.md
principle: Avoid any strategy that blocks the team for a long time.
tasks_created: [T-0001, T-0002]
decisions_made: [D-0001]
assumptions_made: [A-0001]
---

## Discussion
- Reviewed the current pipeline and where leads get stuck.
- Agreed to work in small, checkable steps.

## Decisions
- Plan work in 1-2 day sprints.

## Tasks
- Ranjeet builds the AWS lead pipeline by Thu.
- Pranav sets up LinkedIn auto-posting.

## Assumptions
- LinkedIn ads beat cold DMs.
```

Meeting rules:

1. Every meeting section has at most 4 bullet points. Never pad to reach 4.
2. Only these headings, in this order: `## Discussion` (required), `## Decisions`, `## Tasks`,
   `## Assumptions`. Leave out a section when there is nothing to say. Every section you keep
   has 1 to 4 bullets. No other headings and no text outside the bullets.
3. Bullets are short summaries in plain prose with first names. The full detail lives in the
   task, decision and assumption files. With more than 4 tasks, group them into at most 4 bullets.
4. `attendees` are member ids. Ask the user when the notes do not say who was there.
5. `notes_by` is the current user (`whoami`).
6. `raw` is `raw/<meeting id>.md`. The raw notes are saved exactly as the user gave them.
7. `principle` is optional. Write it only when the meeting stated one.
8. `tasks_created`, `decisions_made` and `assumptions_made` list exactly the records born in this
   meeting. Each listed record has `origin` / `made` equal to this meeting id.
9. Updates to tasks from earlier meetings go into those task files as history events, not into
   the meeting file.

## 4. Commit workflow (every data change, no exceptions)

Run these steps in order for every change, including one-line notes. Small changes (`/done`,
`/note`, and so on) need no confirmation from the user. `/meeting` needs an explicit yes before
any files are written.

1. Run `npm run ta -- whoami` (section 2). Run `git branch --show-current`. If it is not `main`,
   stop and ask the user.
2. Make the edits under `data/`. If the validator hook reports errors, fix them.
3. Run `npm run validate`. It must pass. Fix the data and re-run until it does.
4. Run `npm test`. It must pass. If it fails because of your data change, fix the data. If it
   fails for any other reason, stop and tell the user.
5. Run `npm run check:dashboard`. It must pass. Open each screenshot it prints (under `.check/`)
   with the Read tool and check the changed records: the right lane, status, owner and overdue
   label. If something is wrong, fix it and go back to step 3.
6. Run `git fetch origin`, then `npm run fix-ids`. If fix-ids renumbered anything, tell the user
   the old and new ids and re-run steps 3 to 5.
7. Stage only data changes, after fix-ids and never before: `git add -A data`. Commit with the
   message `<what> · <First>`, for example `T-0042 done · Ranjeet`,
   `meeting 2026-11-03 · Pranav`, `T-0042 note · Yogesh`. Never use `--no-verify`; the
   pre-commit hook runs the validator and the tests.
8. Run `git rebase origin/main`. If new commits came in, re-run steps 3 to 5. If the rebase
   stops with a conflict in a record, keep every history entry from both sides in time order
   and never drop an incoming change. If you are unsure, run `git rebase --abort` and ask the user.
9. Push straight to main after the checks pass. Never open a pull request.
   Run `git push origin HEAD:main`. If the push is rejected, go back to step 6 (fix-ids also
   handles a clash in your single local commit by amending it).

- If the repo has no `origin` remote (`git remote` prints nothing), skip `git fetch` and
  `fix-ids` in step 6 and the rebase in step 8, stop after the commit, and tell the user the push
  is pending a remote.
- Never use `--force` in any form. Never push any branch other than `HEAD:main`.
- Tell the user what was committed (the commit message) and whether it was pushed.

## 5. Never

- Never pad a meeting section, and never write more than 4 bullets in one.
- Never invent an owner, deadline, priority, attendee, reason or evidence.
- Never edit or remove a history entry, change an `origin` or `made`, or delete a record or raw notes.
- Never write an email address into a task, decision, assumption, meeting or theme.
- Never skip a step of the commit workflow, use `--no-verify` or `--force`, or open a pull request.

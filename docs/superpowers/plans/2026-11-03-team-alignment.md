# Team Alignment Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A git repo where three teammates' Claude Code instances log meetings, tasks, decisions and assumptions as validated YAML/Markdown files, plus a public, view-only, dark dashboard that turns that data into visuals.

**Architecture:**
- **Pure TypeScript core (`src/`):** schemas, loader, validator, metrics. Shared by the Node CLIs and the browser.
- **Build step:** turns `data/` into a sanitized `bundle.json` (no emails).
- **Vite + React dashboard (`dashboard/`):** reads the bundle and recomputes "today" metrics in the browser.
- **Claude rule system:** `CLAUDE.md`, `.claude/commands/`, a PostToolUse hook, a git pre-commit hook and CI keep every write honest.

**Tech Stack:** Node 24 LTS, TypeScript (ESM), Zod, `yaml`, `gray-matter`, `tsx`, Vitest, Vite + React 18, `@fontsource-variable/source-serif-4` + `@fontsource-variable/inter`, Playwright (Chromium), GitHub Actions, Cloudflare Pages via `cloudflare/wrangler-action`.

**Spec:** `docs/superpowers/specs/2026-11-03-team-alignment-design.md`

## Global Constraints

- Time zone for every date calculation: `Asia/Kolkata`. Dates are `YYYY-MM-DD` strings; timestamps are ISO 8601 with offset.
- Meeting TLDR sections: only `Discussion` (required), `Decisions`, `Tasks`, `Assumptions`, in that order. Each has 1 to 4 bullets ("at most 4", no padding).
- IDs: `T-0001`, `D-0001`, `A-0001` (prefix, dash, 4 digits). Meeting id = date, with an optional `-2`, `-3` suffix.
- Owner is a member id from `data/team.yaml` or the literal `anyone`. Priority `p0 | p1 | p2`. Deadline kind `hard | soft`. Task status `todo | doing | done | dropped`. Decision status `active | superseded | reversed`. Assumption status `untested | confirmed | rejected`.
- `origin` (task), `made` (decision/assumption) and existing `history` entries are immutable. History is append-only. Records are never deleted.
- Emails never appear in `bundle.json` or anywhere in the dashboard. Task cards show full names; lanes and axes show first names.
- Dashboard: dark only, warm near-black background, off-white text, coral/clay accent used sparingly; serif headings (Source Serif 4), sans body (Inter); no Claude/Anthropic name or logo; red = overdue, amber = at risk, green = done; ◆ solid = hard deadline, ○ dashed = soft; usable at 375px wide with no horizontal scroll.
- The dashboard is read-only: no forms, no write endpoints.
- Every script must run on Windows and macOS (no POSIX-only shell in npm scripts; use `tsx` scripts).

## Review Focus

- **Day boundary in IST:** a `done` event at `2026-11-05T00:30:00+05:30` counts as 5 Nov, not 4 Nov (UTC). A task due today is "due today" with 0 days overdue, not overdue. Tests: Task 4 `dates.test.ts`.
- **Empty repo:** day one has a `team.yaml`, an empty `themes.yaml` and no other records. The validator passes, every metric returns empty or null rates (no NaN, no divide by zero), and every dashboard page shows an empty state. Tests: Task 3 `validate.test.ts` "empty repo is valid"; Task 4 `metrics.test.ts` "empty inputs"; Task 10 e2e "empty data renders".
- **Windows line endings:** YAML and meeting Markdown saved with CRLF parse the same as LF. Tests: Task 2 `load.test.ts` "CRLF".
- **Moved deadline:** a task whose deadline moved from 5 Nov to 9 Nov and was done on 8 Nov is a missed promise for the week of 5 Nov. Tests: Task 4 `promises` cases.
- **Two meetings on one day:** `2026-11-03` and `2026-11-03-2` sort in that order, and the review of `-2` uses `2026-11-03` as its previous meeting. Tests: Task 2 (sort) and Task 4 (review).

---

## File Structure

```
package.json, tsconfig.json, vitest.config.ts, .gitignore, .githooks/pre-commit
CLAUDE.md                      # rules for every teammate's Claude
README.md                      # human setup (clone, npm i, git email, Cloudflare secrets)
.claude/settings.json          # PostToolUse hook
.claude/commands/{meeting,done,drop,note,update,decide,today}.md
data/team.yaml, data/themes.yaml   # seed; meetings/, tasks/, decisions/, assumptions/ start empty (.gitkeep)
src/model/schemas.ts           # Zod schemas + inferred types
src/model/meeting.ts           # meeting markdown parse
src/model/load.ts              # read a data dir (or a git ref) into RepoData
src/validate/rules.ts          # cross-record rules
src/validate/immutability.ts   # compare previous vs next RepoData
src/validate/cli.ts            # `npm run validate`
src/metrics/dates.ts           # IST date helpers
src/metrics/tasks.ts           # overdue, firstDeadline, completedOn, carryover, lanes
src/metrics/trackers.ts        # promises, workload, themes, meeting review
src/bundle/build.ts            # RepoData -> DashboardBundle
scripts/build-bundle.ts        # writes dashboard/src/generated/bundle.json
scripts/fix-ids.ts             # collision renumbering CLI
src/fixids/plan.ts             # pure renumber planning + file rewriting
scripts/ta.ts                  # `npm run ta -- whoami | next-id <T|D|A> | today`
scripts/hook-validate.ts       # PostToolUse hook entry
scripts/check-dashboard.ts     # build + Playwright check + screenshots
dashboard/index.html, dashboard/vite.config.ts
dashboard/src/{main.tsx,App.tsx,theme.css,format.ts}
dashboard/src/components/{TaskCard,Lane,EmptyState,Nav}.tsx
dashboard/src/charts/{PromisesChart,TimelineChart,CarryoverChart,WorkloadChart,ThemeProgress}.tsx
dashboard/src/pages/{Today,Trackers,Decisions,Assumptions,Meetings,Tasks}.tsx
tests/fixtures/{basic,empty,crlf}/...   # fixture data dirs
tests/unit/*.test.ts, tests/e2e/dashboard.spec.ts, playwright.config.ts
.github/workflows/ci.yml
```

---

### Task 1: Scaffold and schemas

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/model/schemas.ts`, `data/team.yaml`, `data/themes.yaml`, `data/{meetings/raw,tasks,decisions,assumptions}/.gitkeep`
- Test: `tests/unit/schemas.test.ts`

**Interfaces:**
- Produces (from `src/model/schemas.ts`, Zod schema + `z.infer` type for each):
  - `MemberSchema` / `Member {id, name, emails: string[]}`, `TeamSchema` / `Team {members: Member[]}`
  - `ThemeSchema` / `Theme {id, name, created}`, `ThemesSchema` / `{themes: Theme[]}`
  - `HistoryEventSchema` / `HistoryEvent {at, by, event: 'created'|'status'|'note'|'deadline'|'owner'|'priority'|'theme'|'superseded'|'reversed'|'evidence', from?, to?, text?}`
  - `TaskSchema` / `Task {id, title, description, owner, priority, theme, deadline: {date, kind, defaulted?: boolean}, status, origin, history}`
  - `DecisionSchema` / `Decision {id, text, why?, made, theme, status, superseded_by?, history}`
  - `AssumptionSchema` / `Assumption {id, text, made, theme, status, evidence, history}`
  - `MeetingFrontSchema` / `MeetingFront {id, date, attendees: string[], notes_by, raw, principle?, tasks_created, decisions_made, assumptions_made}` (the three arrays default to `[]`)
  - `ID_RE = { T: /^T-\d{4}$/, D: /^D-\d{4}$/, A: /^A-\d{4}$/ }`, `MEETING_ID_RE = /^\d{4}-\d{2}-\d{2}(-\d+)?$/`, `DATE_RE`, `SECTION_ORDER = ['Discussion','Decisions','Tasks','Assumptions'] as const`
- package.json scripts: `validate`, `test` (`vitest run`), `build:bundle`, `build` (bundle + `vite build dashboard`), `dev`, `check:dashboard`, `fix-ids`, `ta`, `prepare` (`git config core.hooksPath .githooks`). `"type": "module"`, `"engines": {"node": ">=24"}`.

- [ ] **Step 1:** Write `tests/unit/schemas.test.ts`:
  - `TaskSchema` accepts the spec's T-0042 example.
  - It rejects `priority: 'p3'`, `deadline.kind: 'firm'`, `status: 'cancelled'`, and the id `T-42`.
  - `MeetingFrontSchema` fills in `[]` for missing arrays.
  - `HistoryEventSchema` rejects an `at` with no offset (`2026-11-03T10:00:00`).
- [ ] **Step 2:** Run `npx vitest run tests/unit/schemas.test.ts`. Expect FAIL (module not found).
- [ ] **Step 3:** Create the scaffold files and the schemas. Use `.strict()` on every object so unknown keys are errors. `.gitignore`: `node_modules/`, `dashboard/dist/`, `dashboard/src/generated/`, `.check/`, `.superpowers/`, `test-results/`, `playwright-report/`. Seed `data/team.yaml` with the three members and emails from spec §4. Seed `data/themes.yaml` with `themes: []`.
- [ ] **Step 4:** Run the test again. Expect PASS.
- [ ] **Step 5:** Commit: `chore: scaffold repo and data schemas`.

### Task 2: Loader and meeting parser

**Files:**
- Create: `src/model/meeting.ts`, `src/model/load.ts`, `tests/fixtures/basic/**`, `tests/fixtures/empty/**`, `tests/fixtures/crlf/**`
- Test: `tests/unit/load.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas.
- Produces:
  - `type Section = { heading: string; bullets: string[] }`
  - `parseMeetingBody(md: string): { sections: Section[]; stray: string[] }`. `stray` collects non-blank lines that are neither an `## ` heading nor a `- ` bullet.
  - `type Meeting = MeetingFront & { sections: Section[]; stray: string[]; file: string }`
  - `interface ValidationError { file: string; rule: string; message: string }`
  - `interface RepoData { team: Team; themes: Theme[]; meetings: Meeting[]; tasks: Task[]; decisions: Decision[]; assumptions: Assumption[]; fileOf: Record<string,string> }`. `fileOf` maps a record id to its repo-relative path.
  - `loadRepo(dataDir: string): Promise<{ data: RepoData; errors: ValidationError[] }>`. Schema failures become errors with rule `schema`; they do not throw. Meetings are sorted by `compareMeetingIds`.
  - `loadRepoAtRef(repoRoot: string, ref: string): Promise<RepoData | null>`. Reads `data/` at a git ref through `git ls-tree -r --name-only` + `git show`. Returns `null` when the ref doesn't exist (first commit).
  - `compareMeetingIds(a: string, b: string): number`. Orders `2026-11-03` < `2026-11-03-2` < `2026-11-03-10` < `2026-11-04`.
- Fixture `basic` (dates around a fixed "today" of 2026-11-10) contains:
  - 3 members, 3 themes (`outreach`, `lead-generation`, `team-process`)
  - meetings `2026-11-03`, `2026-11-03-2`, `2026-11-06`
  - tasks T-0001…T-0008 covering every status, both deadline kinds, an `anyone` owner, one moved deadline (5 Nov → 9 Nov, done 8 Nov), one overdue p0 hard task from 3 Nov, and one task due exactly 2026-11-10
  - D-0001 superseded by D-0002
  - A-0001 untested, A-0002 confirmed

  The `empty` fixture is just team plus empty themes. The `crlf` fixture is `basic`'s meeting and one task with `\r\n` line endings.

- [ ] **Step 1:** Write `tests/unit/load.test.ts`:
  - `basic` loads with 0 errors, 8 tasks and 3 meetings in the order `['2026-11-03','2026-11-03-2','2026-11-06']`.
  - `parseMeetingBody` on the `2026-11-03` file gives `sections[0]` = `{heading:'Discussion', bullets: [...4 items]}`.
  - `crlf` loads with results deep-equal to the matching LF records.
  - A task file with an unknown key gives one error `{rule:'schema', file:'data/tasks/T-0099.yaml'}`.
  - `empty` gives 0 errors and empty arrays.
  - `compareMeetingIds` orders `-10` after `-2`.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement. Normalize `\r\n` → `\n` before parsing. Use `yaml`'s `parse` for YAML and `gray-matter` for meetings (pass `engines.yaml` using the `yaml` package so both parsers behave the same; YAML dates must stay strings, so use `parse(src, { schema: 'core' })`). Read raw notes paths but don't load their contents.
- [ ] **Step 4:** Run it. Expect PASS.
- [ ] **Step 5:** Commit: `feat: load data dir and parse meetings`.

### Task 3: Validator

**Files:**
- Create: `src/validate/rules.ts`, `src/validate/immutability.ts`, `src/validate/cli.ts`
- Test: `tests/unit/validate.test.ts`, `tests/unit/immutability.test.ts`

**Interfaces:**
- Consumes: `RepoData`, `ValidationError`, `loadRepo`, `loadRepoAtRef`.
- Produces:
  - `validateRepo(data: RepoData): ValidationError[]`
  - `checkImmutability(prev: RepoData, next: RepoData): ValidationError[]`
  - CLI `npm run validate [-- --base <ref>]` (data dir = `process.env.TA_DATA_DIR ?? 'data'`):
    - Base defaults to `HEAD`. It also compares against `origin/main` when that ref exists.
    - Prints one line per error in the form `file: [rule] message`.
    - Exits 1 if there are errors. Otherwise prints `✓ data valid (N tasks, N decisions, N assumptions, N meetings)` and exits 0.

Rules in `validateRepo` (rule name → condition):

| Rule | Condition |
|---|---|
| `id-file` | The file name equals `<id>.yaml` (or `<id>.md` for meetings). |
| `id-unique` | No duplicate ids within a kind. |
| `owner` | The owner is a team member id or `anyone`. History `by` is a member id. |
| `theme` | The theme exists in `themes.yaml`. |
| `origin` | The task origin and decision/assumption `made` are existing meeting ids. |
| `meeting-refs` | Every id in `tasks_created`/`decisions_made`/`assumptions_made` exists, and its origin/made equals this meeting id. |
| `sections` | Headings are a subsequence of `SECTION_ORDER`, `Discussion` is present, every section has 1–4 bullets, and `stray` is empty. |
| `history-first` | `history[0].event === 'created'`. |
| `history-order` | `at` never goes backward. |
| `status-history` | Status `done`/`dropped` has a last `status` event with that `to`. A dropped task's event has a non-empty `text` (the reason). |
| `superseded` | Status `superseded` ⇔ `superseded_by` is set and points to an existing decision. |
| `attendees` | Attendees and `notes_by` are member ids. |
| `no-email` | No string field in tasks, decisions, assumptions or meeting bullets matches an email regex. |

Rules in `checkImmutability`, for each record present in `prev`:
- `deleted`: the record still exists in `next`.
- `immutable`: `origin`/`made`/`id` are unchanged.
- `append-only`: `next.history` starts with exactly `prev.history`.
- `raw-notes`: `data/meetings/raw/*` files are unchanged (compare file contents through git).

- [ ] **Step 1:** Write the tests:
  - `basic` → `[]`.
  - `empty` → `[]` ("empty repo is valid").
  - One test per rule. Each clones `basic` in memory, breaks one thing, and asserts exactly one error with that `rule`. Include:
    - a 5-bullet `Decisions` section → `sections`
    - a `Risks` heading → `sections`
    - a `done` task with no status event → `status-history`
    - `description: 'mail ranjeet@x.com'` → `no-email`
  - Immutability:
    - removing T-0003 → `deleted`
    - editing `history[0].at` → `append-only`
    - changing `origin` → `immutable`
    - appending one event → `[]`
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement the rules and the CLI. The CLI runs `loadRepo('data')` errors + `validateRepo` + `checkImmutability(loadRepoAtRef(base))`, skipping the last one when the ref returns `null`.
- [ ] **Step 4:** Run the tests. Expect PASS. Then run `npm run validate` on the seed data. Expect the `✓ data valid (0 tasks…)` line.
- [ ] **Step 5:** Commit: `feat: data validator with immutability checks`.

### Task 4: Metrics

**Files:**
- Create: `src/metrics/dates.ts`, `src/metrics/tasks.ts`, `src/metrics/trackers.ts`
- Test: `tests/unit/dates.test.ts`, `tests/unit/metrics.test.ts`

**Interfaces** (all pure, no Node imports, so the browser can use them):
- `dates.ts`
  - `TZ = 'Asia/Kolkata'`
  - `dateInTz(isoOrDate: Date | string, tz = TZ): string` returns `YYYY-MM-DD`
  - `todayIso(now = new Date()): string`
  - `daysBetween(from: string, to: string): number` (to minus from, whole days)
  - `isoWeek(date: string): string` (`'2026-W45'`)
  - `weekRange(week: string): {start: string; end: string}` (Mon–Sun)
- `tasks.ts`
  - `isOpen(t: Task): boolean` (`todo|doing`)
  - `overdueDays(t: Task, today: string): number`. 0 when closed or when `deadline.date >= today`.
  - `firstDeadline(t: Task): string`. The `from` of the earliest `deadline` event, else `deadline.date`.
  - `closedOn(t: Task): string | null`. The IST date of the last status event to `done`/`dropped`.
  - `meetingsSince(t: Task, meetings: Meeting[], today: string): number`. The count of meetings with `compareMeetingIds(m.id, t.origin) > 0` and `m.date <= today` (only meaningful while the task is open).
  - `type LaneTask = Task & { overdue: number; ageDays: number; meetingsSince: number }`
  - `todayLanes(tasks: Task[], memberIds: string[], meetings: Meeting[], today: string): { owner: string; tasks: LaneTask[] }[]`
    - One lane per id in `memberIds` order, then `anyone`. Callers pass team order: `team.members.map(m => m.id)` in Node, `bundle.team.map(m => m.id)` in the browser.
    - Includes open tasks with `status==='doing'` or `deadline.date <= today`.
    - Sorted by overdue desc, then priority, then deadline.
- `trackers.ts`
  - `keptPromises(tasks: Task[], today: string): { week: string; hard: Rate; all: Rate }[]`
    - `type Rate = { kept: number; total: number; rate: number | null }`
    - Groups non-dropped tasks by `isoWeek(firstDeadline)`, only for weeks where `firstDeadline <= today`.
    - Kept = `closedOn <= firstDeadline` and status `done`.
    - Weeks are ascending. `rate` is null when total is 0.
  - `carryoverBuckets(tasks, meetings, today): { onTime: number; carried1: number; carried2plus: number; oldest: { id: string; ageDays: number } | null }`. Open tasks bucketed by `meetingsSince` 0 / 1 / ≥2.
  - `workload(tasks, memberIds: string[]): { owner: string; p0: number; p1: number; p2: number; total: number }[]`. Open tasks; members first, then `anyone`.
  - `themeProgress(tasks, themes, today): { theme: Theme; done: number; open: number; rate: number | null; archived: boolean }[]`. `archived` = no open tasks and no history event (or theme `created`) in the last 14 days.
  - `meetingReview(meeting: Meeting, prev: Meeting | null, tasks: Task[]): { done: string[]; dropped: string[]; slipped: string[] }`
    - Only tasks whose origin sorts before `meeting.id`.
    - `done`/`dropped`: `closedOn` in `(prev?.date ?? -∞, meeting.date]`.
    - `slipped`: open as of `meeting.date` (not closed on or before it) with `deadline.date < meeting.date`.
    - Ids are sorted.

- [ ] **Step 1:** Write `dates.test.ts`:
  - `dateInTz('2026-11-04T19:00:00Z')` → `'2026-11-05'`
  - `dateInTz('2026-11-05T00:30:00+05:30')` → `'2026-11-05'`
  - `daysBetween('2026-10-14','2026-11-03')` → `20`
  - `isoWeek('2026-11-03')` → `'2026-W45'`
  - `isoWeek('2027-01-01')` → `'2026-W53'`
  - `weekRange('2026-W45')` → `{start:'2026-11-02', end:'2026-11-08'}`
- [ ] **Step 2:** Write `metrics.test.ts` against `basic` with `today='2026-11-10'`. Assert exact values for:
  - each function
  - the moved-deadline task: `firstDeadline` = `'2026-11-05'`, counted as not kept in `2026-W45`
  - the task due 2026-11-10: `overdueDays` = 0, and it appears in its owner's lane
  - `meetingReview` of `2026-11-03-2` with prev `2026-11-03`
  - "empty inputs": every function on `[]` returns `[]` / zero counts / `oldest: null` / `rate: null` with no NaN.
- [ ] **Step 3:** Run them. Expect FAIL.
- [ ] **Step 4:** Implement. Do date math on `YYYY-MM-DD` strings through UTC-midnight `Date.UTC` to avoid DST/local-zone drift. Use `Intl.DateTimeFormat('en-CA', {timeZone})` for `dateInTz`.
- [ ] **Step 5:** Run them. Expect PASS.
- [ ] **Step 6:** Commit: `feat: alignment metrics`.

### Task 5: Bundle builder

**Files:**
- Create: `src/bundle/build.ts`, `scripts/build-bundle.ts`
- Test: `tests/unit/bundle.test.ts`

**Interfaces:**
- Consumes: `loadRepo`, `validateRepo`, `RepoData`.
- Produces:
  - `interface DashboardBundle { builtAt: string; team: { id: string; name: string; first: string }[]; themes: Theme[]; tasks: Task[]; decisions: Decision[]; assumptions: Assumption[]; meetings: Meeting[] }`. `first` = the first word of `name`. Meetings drop `file` and `stray`.
  - `buildBundle(data: RepoData, builtAt: string): DashboardBundle`
  - `scripts/build-bundle.ts [--data <dir>]`:
    - Loads and validates the data. Exits 1 on errors.
    - Writes `dashboard/src/generated/bundle.json`.
    - The data dir defaults to `data`, or `process.env.TA_DATA_DIR`.

- [ ] **Step 1:** Test:
  - Bundling `basic` gives `team[1]` = `{id:'ranjeet', name:'Ranjeet Ratan', first:'Ranjeet'}`.
  - `JSON.stringify(bundle)` does not match `/@/`.
  - Task count is 8.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expect PASS.
- [ ] **Step 5:** Commit: `feat: sanitized dashboard bundle`.

### Task 6: ID collision fixer

**Files:**
- Create: `src/fixids/plan.ts`, `scripts/fix-ids.ts`
- Test: `tests/unit/fixids.test.ts`

**Interfaces:**
- Produces:
  - `planRenumber(localNew: string[], remoteNew: string[], allExisting: string[]): Map<string, string>`
    - Every local id that also appears in `remoteNew` maps to the next free id of its kind, above the max of `allExisting ∪ remoteNew ∪ already-assigned`.
    - Meeting ids map to the next free `-N` suffix for that date.
    - Non-clashing ids are absent from the map.
  - `applyRenumber(dataDir: string, map: Map<string,string>): Promise<string[]>`
    - Renames files and rewrites references (`id`, meeting arrays, `superseded_by`, task `origin`, decision/assumption `made`, and meeting `raw` path plus the raw file name).
    - Returns the changed paths.
  - `scripts/fix-ids.ts`:
    - Computes `base = git merge-base HEAD origin/main`.
    - `localNew` = data files added in `base..HEAD` plus uncommitted added files.
    - `remoteNew` = data files added in `base..origin/main`.
    - Applies the plan. If committed files changed, runs `git commit --amend --no-edit` after staging.
    - Prints `renumbered T-0043 → T-0045` lines, or `no id clashes`.
    - Exits 0 when origin/main is missing.

- [ ] **Step 1:** Write the tests:
  - `planRenumber(['T-0043','D-0002'], ['T-0043','T-0044'], ['T-0001',…,'T-0042','D-0001'])` → `{T-0043 → T-0045}` (D-0002 doesn't clash)
  - Meetings: `planRenumber(['2026-11-03'], ['2026-11-03'], [])` → `{'2026-11-03' → '2026-11-03-2'}`
  - `applyRenumber` on a temp copy of `basic` with `{T-0008 → T-0010}` moves the file. The meeting `tasks_created` now lists `T-0010`. `validateRepo(loadRepo(tmp))` returns `[]`.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement. For git calls, use `execFileSync('git', [...])` (no shell, so it works the same on Windows).
- [ ] **Step 4:** Run them. Expect PASS.
- [ ] **Step 5:** Commit: `feat: fix-ids for concurrent record creation`.

### Task 7: Dashboard shell, design tokens, Today page

**Files:**
- Create: `dashboard/index.html`, `dashboard/vite.config.ts`, `dashboard/src/{main.tsx,App.tsx,theme.css,format.ts}`, `dashboard/src/components/{Nav,TaskCard,Lane,EmptyState}.tsx`, `dashboard/src/pages/Today.tsx`
- Test: covered by Task 10 e2e. Unit-test `format.ts` in `tests/unit/format.test.ts`.

**Interfaces:**
- Consumes: `DashboardBundle` (imported from `./generated/bundle.json`), `todayLanes`, `todayIso`, `overdueDays`, `daysBetween`.
- Produces:
  - `format.ts`:
    - `originBadge(t: LaneTask, today: string): string`, e.g. `"from 3 Nov · 7d overdue"`, `"from 3 Nov · due today"`, or `"due Thu"` when origin is today
    - `shortDate(d: string): string`, e.g. `"3 Nov"`
    - `fullName(bundle, ownerId): string` (`anyone` → `"Anyone"`)
  - Hash routes `#/today` (default), `#/trackers`, `#/decisions`, `#/assumptions`, `#/meetings`, `#/tasks`.
  - Every task card renders `data-id`, `data-status` and `data-owner` attributes (Task 10 depends on these).
- Design tokens in `theme.css` `:root`:
  - `--bg:#1f1e1d`, `--surface:#262624`, `--surface-2:#30302e`, `--border:#3d3d3a`
  - `--text:#f5f4ef`, `--text-muted:#a6a39b`, `--accent:#d97757`
  - `--danger:#e5534b`, `--warn:#e0a73c`, `--ok:#5fa86a`
  - `--radius:12px`
  - Headings in `'Source Serif 4 Variable'`, body in `'Inter Variable'`
  - Max content width 1120px, 16px side gutters
- Today page:
  - Header with the date (serif) and a one-line counts strip ("12 open · 3 overdue · 2 due today").
  - Then one lane per person, then Anyone.
  - Each card shows: title, description (2-line clamp, expandable), priority pill, ◆/○ deadline with date, owner full name, theme, and origin badge (red when overdue).
  - Tapping a card expands its history list.
  - Lanes stack vertically. Cards wrap in a grid of `minmax(260px,1fr)`.
- [ ] **Step 1:** Write `format.test.ts`, then run it and see it fail:
  - `originBadge` for an overdue task from 3 Nov on 10 Nov → `'from 3 Nov · 7d overdue'`
  - `originBadge` for a task due today → `'from 3 Nov · due today'`
- [ ] **Step 2:** Implement `format.ts`, then run it and see it pass.
- [ ] **Step 3:** Build the shell and the Today page. Load the dataviz skill and the frontend-design skill before styling. The "today" date is computed in the browser with `todayIso()`, not taken from `builtAt`.
- [ ] **Step 4:** Run `TA_DATA_DIR=tests/fixtures/basic npm run dev` (set the env var with `cross-env`, added as a dev dep). Open it, then check that it renders at 1280px and at 375px without horizontal scroll.
- [ ] **Step 5:** Commit: `feat: dashboard shell and Today view`.

### Task 8: Trackers page

**Files:**
- Create: `dashboard/src/charts/{PromisesChart,TimelineChart,CarryoverChart,WorkloadChart,ThemeProgress}.tsx`, `dashboard/src/pages/Trackers.tsx`

**Interfaces:**
- Consumes: `keptPromises`, `carryoverBuckets`, `workload`, `themeProgress`, `firstDeadline`, `overdueDays` from Task 4.
- Each chart is hand-rolled SVG (no chart library), uses the tokens, and has a `<title>` for accessibility and an empty state.

| Chart | What it shows |
|---|---|
| **PromisesChart** | Weekly bars for the last 8 weeks. Solid = hard, lighter = all, with the % label. |
| **TimelineChart** | A Gantt of open tasks plus tasks closed in the last 14 days. Window: today −14d to +21d, with a today line. Each task is a bar from origin to deadline: ◆ solid for hard, ○ dashed for soft. A slipped bar is red, extending from the first deadline to today. |
| **CarryoverChart** | Three buckets as a stacked bar and the oldest task callout. |
| **WorkloadChart** | Horizontal bars per owner, segmented p0/p1/p2. |
| **ThemeProgress** | A bar per active theme. Archived themes are collapsed under a "Show archived" toggle. |

- [ ] **Step 1:** Build the charts and the page against `basic`. Every chart root gets a `data-chart="<name>"` attribute (used by Task 10).
- [ ] **Step 2:** Check them visually at 1280px and 375px. On narrow screens the timeline scrolls inside its own container; the page never scrolls sideways.
- [ ] **Step 3:** Commit: `feat: tracker charts`.

### Task 9: Decisions, Assumptions, Meetings, All tasks pages

**Files:**
- Create: `dashboard/src/pages/{Decisions,Assumptions,Meetings,Tasks}.tsx`

**Interfaces:** Consumes the bundle and `meetingReview` from Task 4.

| Page | Contents |
|---|---|
| **Decisions** | A vertical timeline, newest first. Superseded decisions are dimmed and linked to their replacement ("→ D-0002"). |
| **Assumptions** | Three columns (untested / confirmed / rejected) that stack on mobile. Untested ones show their age in days. |
| **Meetings** | Newest first. Each meeting shows date, attendees, principle and its TLDR sections, plus a "Since last meeting" strip with chips for done, dropped and slipped from `meetingReview`. |
| **Tasks** | A filterable list with owner, theme, status and priority selects. Rows show the same fields as cards. Default filter: open tasks. |

Every row and card keeps `data-id`.

- [ ] **Step 1:** Build the four pages.
- [ ] **Step 2:** Check them visually at both widths.
- [ ] **Step 3:** Commit: `feat: decisions, assumptions, meetings and tasks views`.

### Task 10: Dashboard check and e2e tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/dashboard.spec.ts`, `scripts/check-dashboard.ts`

**Interfaces:**
- Consumes: `npm run build`, `TA_DATA_DIR`, and the `data-id` / `data-status` / `data-owner` / `data-chart` attributes.
- Produces `npm run check:dashboard [-- --ids T-0042,D-0003]`:
  - Without `--ids`, it uses records changed in `git diff --name-only HEAD` plus untracked files under `data/`.
  - Builds, then serves `dashboard/dist` with `vite preview` on a free port.
  - With Playwright Chromium, visits each route and fails if:
    - any console error or page error occurs
    - any changed task is missing on `#/tasks` (filter cleared through `#/tasks?all=1`)
    - a changed task's `data-status` / `data-owner` differ from the file
    - a changed open task that `todayLanes` says should appear on Today is missing there
  - Saves `.check/today.png`, `.check/trackers.png`, and one page per changed kind, at 1280×900 and 375×812.
  - Prints the screenshot paths and `✓ dashboard check passed`.
- [ ] **Step 1:** Write `tests/e2e/dashboard.spec.ts` (Playwright test, with a webServer that builds using `TA_DATA_DIR=tests/fixtures/basic` and freezes the clock with `page.clock.setFixedTime('2026-11-10T09:00:00+05:30')`):
  - Today shows a lane per member plus Anyone.
  - Card `T-0001` (the overdue p0) has text `from 3 Nov · 7d overdue`.
  - No email text anywhere on any route.
  - At 375px, `document.documentElement.scrollWidth <= 375` on every route.
  - "empty data renders": a second project with `tests/fixtures/empty` shows the empty state on every route and no console errors.
- [ ] **Step 2:** Run `npx playwright install chromium` and then `npx playwright test`. Expect FAIL first if anything is missing, then fix until it passes.
- [ ] **Step 3:** Implement `scripts/check-dashboard.ts`. Run it with `TA_DATA_DIR=tests/fixtures/basic` and `--ids T-0001`. Expect `✓` and the screenshots in `.check/`.
- [ ] **Step 4:** Commit: `test: dashboard e2e and check:dashboard`.

### Task 11: Claude rule system and local hooks

**Files:**
- Create: `CLAUDE.md`, `.claude/settings.json`, `.claude/commands/{meeting,done,drop,note,update,decide,today}.md`, `scripts/hook-validate.ts`, `scripts/ta.ts`, `.githooks/pre-commit`
- Test: `tests/unit/ta.test.ts`, `tests/unit/hook.test.ts`

**Interfaces:**
- Produces:
  - `scripts/ta.ts` subcommands:
    - `whoami`: matches `git config user.email` against team emails and prints the member id. Exits 1 with "unknown git email <x>; add it to data/team.yaml" if there's no match.
    - `next-id <T|D|A>`: prints the next free id.
    - `today`: prints today's lanes as plain text, using `todayLanes`.
    - `now`: prints the current timestamp in IST with offset, for history `at`.
  - Export `nextId(kind, existing: string[]): string` and `resolveMember(email: string, team: Team): string | null` for tests.
  - `scripts/hook-validate.ts`:
    - Reads the PostToolUse JSON from stdin.
    - If `tool_input.file_path` (normalized, either slash) is under `data/`, runs the validator.
    - On errors, writes them to stderr and exits 2, so Claude sees them and must fix them.
    - Otherwise exits 0.
  - `.claude/settings.json`: a `hooks.PostToolUse` matcher `Write|Edit|MultiEdit` that runs `npx tsx scripts/hook-validate.ts`.
  - `.githooks/pre-commit`: runs `npm run validate && npm test`. Use a `#!/bin/sh` script; Git for Windows runs it through its bundled sh.
- `CLAUDE.md` content: the rules from spec §4 and §6 and the full commit workflow from §7, as numbered, imperative steps. It must contain these lines verbatim:
  - `These rules override any CLAUDE.md in a parent folder.`
  - `Every meeting section has at most 4 bullet points. Never pad to reach 4.`
  - `Never invent an owner, deadline or priority. Ask. Only if the user says they don't know the deadline: soft, meeting date + 2 days, set deadline.defaulted: true.`
  - `Never edit or remove an existing history entry. Never delete a record.`
  - `Reuse an existing theme when one fits; show the user before creating a new theme.`
  - `Never put email addresses in any data text. Use member ids in data, first names in prose.`
  - `Push straight to main after the checks pass. Never open a pull request.`
- Commands:
  - **meeting.md:**
    1. Save the raw notes to `data/meetings/raw/<id>.md`.
    2. Run `npm run ta -- today` to list open tasks from earlier meetings and ask what happened to each.
    3. Draft the meeting file and every new record.
    4. Show the full draft: TLDR sections, a table of new tasks (title, owner, priority, deadline + kind, theme), decisions, assumptions, open questions.
    5. Wait for an explicit yes.
    6. Write the files, then run the §7 workflow with the commit message `meeting <id> · <First>`.
  - **done / drop / note / update / decide:** take `$ARGUMENTS`, append the right history event (`at` from `ta now`, `by` from `ta whoami`), then run the §7 workflow without asking for confirmation. `drop` requires a reason.
  - **today:** runs `npm run ta -- today`. Read-only.
- [ ] **Step 1:** Write the tests:
  - `nextId('T', ['T-0001','T-0007'])` → `'T-0008'`
  - `nextId('D', [])` → `'D-0001'`
  - `resolveMember('Pranav.Darekar1080@gmail.com', team)` → `'pranav'` (case-insensitive)
  - The hook script, spawned with stdin `{"tool_input":{"file_path":"C:\\x\\README.md"}}`, exits 0. With a path under `data/` and a broken `TA_DATA_DIR` fixture, it exits 2 and stderr contains `[sections]`.
- [ ] **Step 2:** Run them. Expect FAIL. Implement. Run again. Expect PASS.
- [ ] **Step 3:** Write `CLAUDE.md` and the commands. Run `npm install` (the `prepare` script sets `core.hooksPath`). Check with `git config core.hooksPath` → `.githooks`.
- [ ] **Step 4:** Smoke test: in a scratch clone, have Claude run `/meeting` with sample notes. Confirm the draft → confirm → validate → check:dashboard → commit sequence (don't push). Delete the scratch clone.
- [ ] **Step 5:** Commit: `feat: Claude rules, commands and hooks`.

### Task 12: CI, deploy, README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- `ci.yml`:
  - Triggers: `on: push` to `main`, plus `workflow_dispatch`.
  - Job `check` (ubuntu-latest, Node 24): `npm ci`, `npm run validate -- --base ${{ github.event.before }}` (skipped when it is the all-zero sha), `npm test`, `npx playwright install --with-deps chromium`, `npx playwright test`, `npm run build`. Uploads `dashboard/dist` as an artifact.
  - Job `deploy` (needs `check`, `if: secrets.CLOUDFLARE_API_TOKEN != ''` through an env check step): `cloudflare/wrangler-action@v3` with `command: pages deploy dashboard/dist --project-name=team-alignment --branch=main`.
- README: what it is; setup (clone outside any folder with its own CLAUDE.md, `npm install`, `npx playwright install chromium`, make sure `git config user.email` matches `data/team.yaml`); daily use (`/meeting`, `/done`, …); one-time Cloudflare setup (create the Pages project `team-alignment`, add the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets).
- [ ] **Step 1:** Write the workflow and README. Lint the workflow with `npx action-validator .github/workflows/ci.yml` if it's available; otherwise review the YAML by eye.
- [ ] **Step 2:** Run the full local gate: `npm run validate && npm test && npx playwright test && npm run build`. All must pass.
- [ ] **Step 3:** Commit: `ci: checks and Cloudflare Pages deploy`. Don't add a remote or push. The user picks the GitHub location.

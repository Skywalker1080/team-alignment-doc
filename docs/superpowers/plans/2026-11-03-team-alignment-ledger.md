# SDD ledger — plan: docs/superpowers/plans/2026-11-03-team-alignment.md

Branch: feat/v1-build · start commit e20fabb (docs only; main is unborn)

## Pre-flight scan

| Pair / task | Produces → consumes | Finding |
|---|---|---|
| T1 → T2 | Zod schemas + types → loader | consistent |
| T2 → T3 | RepoData, ValidationError, loadRepo, loadRepoAtRef → validator | consistent |
| T2 → T4 | Meeting, compareMeetingIds → meetingsSince, meetingReview | consistent |
| T3 → T5 | validateRepo → build-bundle | consistent |
| T3 → T6 | validateRepo, loadRepo → fixids test | consistent |
| T3 → T11 | validate CLI honours TA_DATA_DIR → hook test | consistent (fixed in self-review) |
| T4 → T7/T8/T9 | metrics (memberIds signatures) → dashboard | consistent (fixed in self-review) |
| T5 → T7 | dashboard/src/generated/bundle.json → import | consistent |
| T7/T8/T9 → T10 | data-id/status/owner/chart attrs → e2e + check | consistent |
| T2 fixture → T7/T10 | "overdue p0 from 3 Nov" → expects "from 3 Nov · 7d overdue" on 10 Nov | needs T-0001 deadline exactly 2026-11-03 → Ruling 2 |
| T1 self | .gitignore already exists | extend, don't overwrite |
| T1 self | engines node >=24 vs local node v22.18 | → Ruling 1 |
| T2 self | crlf fixture vs git autocrlf on Windows | → Ruling 3 |
| T3 self | rules table vs tests | consistent |
| T4 self | test values checked: daysBetween 20, 2027-01-01 = 2026-W53, W45 = 2–8 Nov | consistent |
| T5–T12 self | tests vs code specified | consistent |

Ruling 1: package.json engines ">=22"; CI uses Node 24 — local machine runs Node 22.18 and nothing in the stack needs 24 — if wrong, bump engines later, no code change.
Ruling 2: fixture `basic` T-0001 = p0, hard, owner ranjeet, origin 2026-11-03, deadline 2026-11-03, status todo — makes T7/T10 expectations ("7d overdue" on 2026-11-10) consistent — if wrong, only fixture values change.
Ruling 3: add `.gitattributes` with `* text=auto eol=lf` and `tests/fixtures/crlf/** -text` — keeps data LF across Windows/macOS while preserving the CRLF fixture bytes — if wrong, CRLF test could pass vacuously; the test asserts the fixture really contains \r\n.

## Progress
Task 1: complete (commits e20fabb..d955a8c, review clean)
Task 1: minor (deferred): DATE_RE/TIMESTAMP_RE shape-only (2026-13-45 passes) — carried into Task 3 as a calendar-validity rule
Task 1: minor (deferred): emails not shape-checked; Decision/Assumption/Theme/Team schemas untested; `prepare` fails outside a git work tree
Ruling 4: commit co-author trailers name the model that actually wrote the commit (subagents use their own) — accurate attribution — cost if wrong: cosmetic trailer text
Task 2: fix round 1/5 (1 addressed, 0 open — T-0003 status chain; commits 91b27aa..7298db3)
Task 2: complete (commits d955a8c..7298db3, review clean)
Task 2: minor (deferred): duplicate ids silently overwrite fileOf (Task 3 id-unique must still catch via record arrays); ls-tree without -z; parseYamlStrings duplication; redundant casts; CRLF equality only first records
Task 3: complete (commits 7298db3..99cb243, review clean)
Task 3: ⚠️ resolved: Task.deadline is required in schema (schemas.ts:80) — not a gap
Ruling 5: ⚠️ loader ignores stray files (.yml, subfolders) so a mis-saved record vanishes silently — real gap; add an `unknown-file` validator rule and the cli `path.resolve` data-dir comparison (Task 3 minor 1) as extras in Task 5's dispatch — cost if wrong: one more rule to maintain
Task 3: minor (deferred): raw-notes git show failure uncaught + ls-tree quoting + utf8 decode; append-only via JSON.stringify; no CRLF raw-notes test; cli untested; errors to stderr only; no RED evidence
Task 4: complete (commits 99cb243..cdc55c5, review clean)
Task 4: ⚠️ resolved: schemas.ts imports only zod, meeting.ts only types — browser-safe
Task 4: minor (deferred): meetingReview.slipped uses current deadline / ignores reopen (not strictly as-of); en-CA locale reliance; weekRange non-null assertion; lanes drop unknown owners
Task 5: complete (commits cdc55c5..ca2cf63, review clean; includes Ruling 5 extras)
Task 5: ⚠️ resolved: fixture README moved to tests/fixtures/README-basic.md (no references in plan/spec); bundle email risk covered by validator no-email rule which build-bundle runs
Task 5: minor (deferred): no build-time email regex on bundle; --data w/o value ignored; generated path cwd-relative; no error dedupe; hardcoded tsx cli path in test
Ruling 6: fix-ids multi-commit clash (clash added in an earlier unpushed commit) only warns — workflow (Task 11) will run fetch → fix-ids → commit → rebase so local records are normally uncommitted or in the single HEAD commit — cost if wrong: rare manual conflict resolution after a failed push
Task 6: complete (commits ca2cf63..14187ac, review clean)
Task 6: ⚠️ resolved: only id-valued fields are id/superseded_by/origin/made/meeting arrays (schemas.ts) — covered
Task 6: minor (deferred): staged-uncommitted clash leaves old path in index (Task 11 CLAUDE.md: stage with `git add -A data` only after fix-ids); amend sweeps other staged files; planRenumber no dedupe; unindented YAML arrays; ids in meeting prose not rewritten; untested quoted/CRLF/meeting-via-git cases
Task 7: complete (commits 14187ac..5e80e60, review clean)
Task 7: ⚠️ resolved: controller viewed fixture Today at 1280px and 375px (scrollWidth 375) — renders correctly
Task 7: minor (deferred): ?today= accepts impossible dates + no "viewing as" note; today frozen at mount; Meeting[] cast in Today.tsx (better: Pick<Meeting,'id'|'date'>); tsc needs generated bundle (CI order); STATUS_LABEL loose type
Note: .claude/launch.json added by controller (dashboard-fixture preview on 5179; server actually bound 5173) — untracked, decide in Task 11
Task 8: fix round 1/5 (1 addressed, 0 open — "all" series lighter, 9.42:1; commits d431651..2003fac)
Task 8: complete (commits 5e80e60..2003fac, review clean)
Task 8: minor (deferred): timeline blank rows when origin+deadline before window / no off-window cue; two "slipped" definitions (timeline first deadline vs meetingReview current); WorkloadChart label column fixed 76px; useWidth [] deps; CarryoverChart Meeting[] cast
Ruling 7: Workload P2 color #93523f (2.54:1) gets fixed inside Task 9 as an extra — same WCAG non-text contrast defect just fixed for promises — cost if wrong: a color tweak
Task 9: fix round 1/5 (3 addressed, 0 open — safe jump-to-id, separable workload ramp w/ hatch+counts, decisions honor ?id; commits 55c2d13..a6565ca)
Task 9: complete (commits 2003fac..a6565ca, review clean; includes Ruling 7)
Task 9: minor (deferred): p0/p2 adjacent when p1=0 (dE 11.5, hatch+counts compensate); same-id re-nav doesn't re-jump; JumpLink href always #/decisions; meetingReview same-day window empty for -2 meetings; SSR-only page tests; chip text contrast unverified
Task 10: complete (commits a6565ca..25a80ed, review clean)
Task 10: ⚠️ resolved: mismatch path judged by code (TaskCard renders attrs from the same bundle; check compares DOM attr to file and fails on null/mismatch) — a real mismatch only arises from a rendering bug, which is what it guards
Task 10: minor (deferred): email regex in e2e domain-limited; serve.ts exports FIXTURES with main() on import; no negative test of check-dashboard; Today check skips unknown owners
Ruling 8: check-dashboard data-dir prefix match (Task 10 minor 1) fixed inside Task 11 — Claude may run it with variant paths and a silent "no changed records" defeats the pre-push check — cost if wrong: small extra diff
Ruling 9: removed controller's untracked .claude/launch.json (preview scratch; npm run dev:fixture covers it) — cost if wrong: none
Ruling 10: Task 11 smoke test is done by following the command files by hand in a temp clone (a subagent cannot invoke slash commands) — cost if wrong: command prose bugs found later by real use
Task 11: note: smoke clone left at C:\Users\prana\AppData\Local\Temp\ta-smoke (subagent rm denied; surface to user, do not delete on its behalf)
Task 11: fix round 1/5 (5 addressed, 0 open — rebase merge rule, mid-batch write order, raw notes after yes, skip empty commit, cwd-safe hook; commits 361ce77..c6c344a)
Task 11: complete (commits 25a80ed..c6c344a, review clean; includes Ruling 8)
Task 11: ⚠️ resolved: out-of-meeting records (origin = latest meeting, not in its tasks_created) — validator only checks listed→origin; metrics use origin only for meetingsSince; meetings page lists tasks_created — acceptable
Task 11: minor (deferred): whoami loads full repo (fails on invalid data with load errors); whoami CLI paths untested; ta.ts imports dashboard/src/format; cd "" if CLAUDE_PROJECT_DIR unset
Task 12: fix round 1/5 (1 addressed, 0 open — deploy only from main; commits a30c120..65dfab3)
Task 12: complete (commits c6c344a..65dfab3, review clean)
Task 12: minor (deferred): unreachable --base sha silently skips comparison; README asserts team-alignment.pages.dev before project exists
Final review: Critical 1 (validate vs fetched-ahead origin/main blocks commits), Important 2 (rebase rule — already fixed in c6c344a except GIT_EDITOR), 3 (.DS_Store/Thumbs.db blocks all), 4 (today frozen in open tab); minors 5-10; triage: fix-before-ship T3 cli test, T11 whoami, T7 today, T4 en-CA
Ruling 11: final fix wave = Critical 1, Important 2 (GIT_EDITOR=true only), 3, 4, en-CA formatToParts, minor 5 (no-meeting guard), minor 6 (tsc in CI), T12 explicit --base must fail if unreachable — the rest stays deferred — cost if wrong: deferred minors surface later
Final review: fix wave 65dfab3..08a37fa re-reviewed clean

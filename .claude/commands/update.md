---
description: Change a task's owner, deadline, priority, status or theme (or test an assumption, reverse a decision)
argument-hint: <id> <what to change>
---

Update a record. Arguments: `$ARGUMENTS` (an id such as `T-0042`, followed by what to change).

1. If the record file does not exist, say so and stop. If it is not clear what to change or to
   what value, ask and stop. Never guess a new owner, deadline or priority.
2. Run `npm run ta -- whoami` and `npm run ta -- now`.
3. For each change, edit the field and append one history event to the end of `history`,
   exactly as in the "History events" table in CLAUDE.md:
   - owner: `event: owner`, `from`, `to` (a member id or `anyone`).
   - deadline: set `deadline.date` (and `kind` if it changes) and remove `defaulted`; append
     `event: deadline`, `from: <old date>`, `to: <new date>`, and mention a kind change in `text`.
   - priority: `event: priority`, `from`, `to` (`p0`, `p1` or `p2`).
   - status: `event: status`, `from`, `to`. Dropping needs a reason in `text`; ask if it is missing.
   - theme: `event: theme`, `from`, `to`. Reuse an existing theme; show the user before
     creating a new one in `data/themes.yaml`.
   - assumption tested: set `status` and `evidence`; append `event: status` (`from`, `to`), then
     `event: evidence` with the evidence in `text`.
   - decision reversed: set `status: reversed`; append `event: reversed` with the reason in `text`.
     To replace a decision with a new one, use `/decide` instead.
   Every event uses `at: <now>` and `by: <whoami>`. Never edit `id`, `origin`, `made` or any
   existing history entry.
4. Run the commit workflow in CLAUDE.md section 4 without asking for confirmation. Commit
   message: `<id> <what changed> · <First>`, for example `T-0042 deadline · Ranjeet`.

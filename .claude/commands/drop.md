---
description: Drop a task, with a reason
argument-hint: <task id> <reason>
---

Drop a task. Arguments: `$ARGUMENTS` (a task id such as `T-0042`, followed by the reason).

1. A reason is required. If there is no reason after the id, ask for one and stop until the user
   gives it. Never write a reason yourself.
2. If `data/tasks/<id>.yaml` does not exist, or the task is already `done` or `dropped`, say so and stop.
3. Run `npm run ta -- whoami` and `npm run ta -- now`.
4. In `data/tasks/<id>.yaml` set `status: dropped` and append this to the end of `history`:
   ```yaml
     - at: <now>
       by: <whoami>
       event: status
       from: <old status>
       to: dropped
       text: <reason>
   ```
   Change nothing else. Never delete the file.
5. Run the commit workflow in CLAUDE.md section 4 without asking for confirmation. Commit
   message: `<id> dropped · <First>`.

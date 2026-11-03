---
description: Mark a task done
argument-hint: <task id> [note]
---

Mark a task done. Arguments: `$ARGUMENTS` (a task id such as `T-0042`, optionally followed by a note).

1. If no task id was given, or `data/tasks/<id>.yaml` does not exist, say so and stop.
   If the task is already `done` or `dropped`, say so and stop.
2. Run `npm run ta -- whoami` and `npm run ta -- now`.
3. In `data/tasks/<id>.yaml` set `status: done` and append this to the end of `history`
   (the `text` line only if a note was given):
   ```yaml
     - at: <now>
       by: <whoami>
       event: status
       from: <old status>
       to: done
       text: <note>
   ```
   Change nothing else.
4. Run the commit workflow in CLAUDE.md section 4 without asking for confirmation. Commit
   message: `<id> done · <First>`.

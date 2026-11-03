---
description: Append a note to a task, decision or assumption
argument-hint: <id> <text>
---

Append a note. Arguments: `$ARGUMENTS` (an id such as `T-0042`, `D-0003` or `A-0002`, followed by the note).

1. If there is no note text, ask for it and stop. If the record file does not exist under
   `data/tasks/`, `data/decisions/` or `data/assumptions/`, say so and stop.
2. Run `npm run ta -- whoami` and `npm run ta -- now`.
3. Append this to the end of the record's `history`, changing nothing else:
   ```yaml
     - at: <now>
       by: <whoami>
       event: note
       text: <the note as the user wrote it, with no email addresses>
   ```
4. Run the commit workflow in CLAUDE.md section 4 without asking for confirmation. Commit
   message: `<id> note · <First>`.

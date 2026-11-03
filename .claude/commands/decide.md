---
description: Record a decision outside a meeting, or supersede an existing one
argument-hint: <decision text> [supersedes D-00NN]
---

Record a decision. Arguments: `$ARGUMENTS` (the decision, and optionally the id it supersedes).

1. If there is no decision text, ask for it and stop. If there is no meeting in
   `data/meetings/` yet, tell the user to log one with `/meeting` first and stop.
2. Run `npm run ta -- whoami`, `npm run ta -- now` and `npm run ta -- next-id D`.
3. Create `data/decisions/<new id>.yaml` (format in CLAUDE.md): `text` from the user, `why` only
   if the user gave a reason, `made:` the most recent meeting id, a theme (reuse one; show the
   user before creating a new one), `status: active`, and a `created` history event.
4. If it supersedes an existing decision, in that old file set `status: superseded` and
   `superseded_by: <new id>`, and append `event: superseded`, `to: <new id>` to its history.
   Never delete or rewrite the old decision. Write the new decision file first and the old one
   second (and a new theme in `data/themes.yaml` before both). Until both are written the hook
   may report `[superseded]` or `[theme]` errors about the file not yet written; that is
   expected. Finish both, then fix whatever `npm run validate` still reports.
5. Run the commit workflow in CLAUDE.md section 4 without asking for confirmation. Commit
   message: `<new id> decided · <First>`, or `<new id> supersedes <old id> · <First>`.

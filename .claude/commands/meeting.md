---
description: Log a meeting from raw notes (drafts everything, writes only after you confirm)
argument-hint: <raw meeting notes>
---

Log a meeting from these raw notes. Follow CLAUDE.md exactly, especially sections 3 and 4.

Raw notes:

$ARGUMENTS

If the raw notes above are empty, ask the user to paste them and stop.

1. Run `npm run ta -- whoami` (stop and ask if it fails). Work out the meeting date from the
   notes (ask if it is not clear) and the meeting id (CLAUDE.md 3.4). The raw notes will be
   saved to `data/meetings/raw/<id>.md` in step 6. Write no file before step 6.
2. Run `npm run ta -- today` to list open tasks from earlier meetings and ask what happened to each.
   Also look at every other task in `data/tasks/` with `status: todo` or `status: doing` and ask
   about those in one short list. Record nothing yet: the answers become history events in step 6.
3. Draft the meeting file and every new record:
   - Get ids from `npm run ta -- next-id T` (and `D`, `A`), counting up for several of one kind.
   - Tasks: title, description, owner, priority, deadline with kind, theme. Never invent an
     owner, deadline or priority. Anything the notes do not give goes into open questions.
     Only if the user says they don't know a deadline: soft, meeting date + 2 days,
     `defaulted: true`.
   - Themes: read `data/themes.yaml` and reuse a theme when one fits. Mark any new theme as new.
   - Meeting sections: at most 4 bullets each, never padded, only Discussion, Decisions, Tasks,
     Assumptions, in that order. Discussion is required: if the notes have no discussion
     beyond the decisions and tasks, write one bullet saying what the meeting covered.
   - Attendees: ask if the notes do not say.
4. Show the full draft in one message:
   - The meeting date and id, and the raw notes path `data/meetings/raw/<id>.md`.
   - The TLDR sections exactly as they will be written.
   - A table of new tasks: id, title, owner, priority, deadline + kind, theme.
   - Decisions (id, text, why if given, theme).
   - Assumptions (id, text, theme).
   - New themes, if any.
   - Changes to earlier tasks from step 2, as the history events you will append.
   - Open questions: everything you could not fill in (owner, priority, deadline, kind,
     attendees, unclear items).
   Ask the open questions in the same message. After the user answers, show the updated draft again.
5. Wait for an explicit yes. Do not write any file before it. If the user abandons the
   meeting, nothing has been written and nothing needs undoing.
6. Write the files in this order (CLAUDE.md section 1):
   1. the raw notes to `data/meetings/raw/<id>.md`, exactly as given, with nothing added or changed
   2. new themes in `data/themes.yaml`
   3. the meeting file
   4. the new task, decision and assumption files
   5. the history events on earlier tasks
   Use `npm run ta -- now` for every `at` and the `whoami` id for every `by`. Until the last
   file is written, the hook will report `[origin]`, `[meeting-refs]` and `[theme]` errors about
   records not written yet; that is expected. Finish all files, then fix whatever
   `npm run validate` still reports. Then run the commit workflow in CLAUDE.md section 4
   with the commit message `meeting <id> · <First>`.
7. After the push (or the commit, if there is no remote), start `npm run dev` in the background
   and give the user the local preview URL it prints.

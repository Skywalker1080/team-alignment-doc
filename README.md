# Team alignment

The shared record of our meetings, tasks, decisions and assumptions (Yogesh, Ranjeet, Pranav).
You talk to Claude Code; Claude writes the files under `data/`; every push to `main` is checked
and published to a view-only dashboard.

Dashboard: https://team-alignment.vercel.app

## One-time setup (each teammate)

1. Install Node 22 or newer and Git.
2. Clone the repo **outside any folder that has its own `CLAUDE.md`** (for example not inside
   `C:\Projects`), because Claude reads every `CLAUDE.md` in parent folders and they would mix
   with ours.
3. In the clone: `npm install`, then `npx playwright install chromium`.
4. Check that `git config user.email` is the email listed for you in `data/team.yaml`.
   Claude uses it to know who you are.
5. Open Claude Code in the clone.

## Daily use

Type these in Claude Code. The rules behind them are in [CLAUDE.md](CLAUDE.md).

| Command | What it does |
|---|---|
| `/meeting <raw notes>` | Turns your notes into a meeting summary, tasks, decisions and assumptions. Shows a draft first and writes nothing until you say yes. |
| `/done T-0042 [note]` | Marks a task done. |
| `/drop T-0042 <reason>` | Drops a task. A reason is required. |
| `/note T-0042 <text>` | Adds a note to a task, decision or assumption. |
| `/update T-0042 <change>` | Changes owner, deadline, priority, status or theme. |
| `/decide <text>` | Records a decision outside a meeting, or replaces an older one. |
| `/today` | Shows today's open tasks per person. |

Example:

```
/meeting 3 Nov, all three of us. Agreed to work in 1-2 day sprints. Ranjeet builds the
AWS lead pipeline by Thursday (hard). Pranav sets up LinkedIn auto-posting.
```

Claude asks about anything missing (deadline kind, priority, open tasks from earlier meetings),
shows the draft, and saves it after you confirm.

## What Claude does on every change

1. Checks who you are and that you are on `main`.
2. Edits only files under `data/`.
3. Validates the data (formats, ids, history never rewritten).
4. Runs the tests.
5. Builds the dashboard and looks at screenshots of the records it changed.
6. Commits and pushes straight to `main`. GitHub then repeats the checks and, if they pass,
   publishes the dashboard.

## Local preview

- `npm run dev`: dashboard from the real `data/`.
- `npm run dev:fixture`: dashboard from sample data.

## Hosting setup (whoever owns the repo, once)

The dashboard is the Vercel project `team-alignment`. GitHub Actions deploys it to production
only after every check passes (the Vercel Git integration is deliberately not connected, so a
failing push never goes live).

1. Create a Vercel access token (Vercel, Account Settings, Tokens).
2. In the GitHub repo, go to Settings, Secrets and variables, Actions, and add the secrets
   `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. The two ids are in
   `.vercel/project.json` after running `npx vercel link` in a clone (`orgId`, `projectId`).
3. Push to `main` (or run the CI workflow by hand). Without `VERCEL_TOKEN`, CI still checks
   everything and just skips the deploy.
4. To deploy by hand from a clone: `npx vercel deploy --prod`.

Note: Vercel's free Hobby plan is for non-commercial use; an agency project may need Pro.

## Troubleshooting

- **"unknown git email"**: your `git config user.email` is not in `data/team.yaml`. Fix the
  email in git, or ask Claude to add it to your entry (it asks you to confirm first).
- **Validator errors**: Claude fixes them before committing. If you see them yourself, run
  `npm run validate`; each line names the file and the rule. Never edit old history entries to
  silence one.
- **Ids renumbered**: if a teammate used the same id at the same time, Claude renumbers yours
  before pushing (`npm run fix-ids`) and tells you the old and new ids. Nothing is lost.

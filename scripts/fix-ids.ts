import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { applyRenumber, planRenumber, recordIdOfPath } from '../src/fixids/plan';

const DATA_DIR = 'data';

const git = (...args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const lines = (out: string): string[] =>
  out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function refExists(ref: string): boolean {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

/** Record ids (from file names) among repo-relative paths. */
const idsOf = (paths: string[]): string[] =>
  paths
    .map((p) => (p.startsWith(`${DATA_DIR}/`) ? recordIdOfPath(p.slice(DATA_DIR.length + 1)) : null))
    .filter((x): x is string => x !== null);

function idsInWorkingTree(): string[] {
  const out: string[] = [];
  for (const dir of ['tasks', 'decisions', 'assumptions', 'meetings']) {
    let names: string[] = [];
    try {
      names = readdirSync(`${DATA_DIR}/${dir}`);
    } catch {
      continue;
    }
    for (const n of names) {
      const id = recordIdOfPath(`${dir}/${n}`);
      if (id) out.push(id);
    }
  }
  return out;
}

async function main(): Promise<number> {
  if (!refExists('origin/main')) {
    console.log('origin/main not found; nothing to fix');
    return 0;
  }
  if (!refExists('HEAD')) {
    console.log('no commits yet; nothing to fix');
    return 0;
  }
  const base = git('merge-base', 'HEAD', 'origin/main').trim();

  const addedIn = (range: string) =>
    lines(git('diff', '--name-only', '--no-renames', '--diff-filter=A', range, '--', DATA_DIR));
  const committedLocal = idsOf(addedIn(`${base}..HEAD`));
  const stagedLocal = idsOf(
    lines(git('diff', '--cached', '--name-only', '--no-renames', '--diff-filter=A', '--', DATA_DIR)),
  );
  const untrackedLocal = idsOf(
    lines(git('ls-files', '--others', '--exclude-standard', '--', DATA_DIR)),
  );
  const localNew = [...new Set([...committedLocal, ...stagedLocal, ...untrackedLocal])];
  const remoteNew = [...new Set(idsOf(addedIn(`${base}..origin/main`)))];

  const plan = planRenumber(localNew, remoteNew, idsInWorkingTree());
  if (plan.size === 0) {
    console.log('no id clashes');
    return 0;
  }

  const changed = await applyRenumber(DATA_DIR, plan);
  for (const [from, to] of plan) console.log(`renumbered ${from} → ${to}`);

  const committed = new Set(committedLocal);
  const touchedCommitted = [...plan.keys()].filter((id) => committed.has(id));
  if (touchedCommitted.length === 0) {
    console.log('renamed uncommitted files in the working tree; nothing to amend');
    return 0;
  }

  // Amending HEAD only avoids the conflict if HEAD is the commit that added the clashing files.
  const head = git('rev-parse', 'HEAD').trim();
  for (const id of touchedCommitted) {
    const adders = lines(
      git('log', '--format=%H', '--diff-filter=A', '--no-renames', `${base}..HEAD`, '--', `${DATA_DIR}/*/${id}.*`),
    );
    if (adders.some((h) => h !== head)) {
      console.warn(
        `warning: ${id} was added by an earlier local commit than HEAD, so the rebase may still conflict. ` +
          `Squash your local commits first (git reset --soft ${base} && git commit).`,
      );
    }
  }

  git('add', '-A', '--', ...changed);
  git('commit', '--amend', '--no-edit');
  console.log('amended HEAD commit with the renumbered files');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);

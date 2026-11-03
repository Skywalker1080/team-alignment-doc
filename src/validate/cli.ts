import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { loadRepo, loadRepoAtRef, type ValidationError } from '../model/load';
import { validateRepo } from './rules';
import { checkImmutability, checkRawNotes } from './immutability';

const execFileAsync = promisify(execFile);

async function refExists(ref: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** The explicit `--base <ref>` argument, or null when none was given. */
function parseBase(argv: string[]): string | null {
  const i = argv.indexOf('--base');
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
}

async function git(...args: string[]): Promise<string | null> {
  try {
    return (await execFileAsync('git', args)).stdout.trim();
  } catch {
    return null;
  }
}

/**
 * The refs whose data must still hold in the working tree: the base (HEAD unless
 * `--base` is given) and origin/main. When the branch is behind origin/main (after
 * `git fetch`, before the rebase), origin/main holds teammates' newer records the
 * tree does not have yet, so compare against the merge base instead: that history
 * is shared by both sides and still immutable.
 */
async function comparisonRefs(base: string): Promise<string[]> {
  const refs = [base];
  if (!(await refExists('origin/main'))) return refs;
  const ancestor = (await git('merge-base', '--is-ancestor', 'origin/main', 'HEAD')) !== null;
  const ref = ancestor ? 'origin/main' : await git('merge-base', 'HEAD', 'origin/main');
  if (ref && !refs.includes(ref)) refs.push(ref);
  return refs;
}

async function main(): Promise<number> {
  const explicitBase = parseBase(process.argv.slice(2));
  if (explicitBase !== null && !(await refExists(explicitBase))) {
    console.error(`validate: --base ${explicitBase} cannot be resolved to a commit`);
    return 1;
  }
  const dataDir = process.env.TA_DATA_DIR ?? 'data';
  const { data, errors } = await loadRepo(dataDir);
  const all: ValidationError[] = [...errors, ...validateRepo(data)];

  // Git-ref comparison reads `data/` at the ref, so it only applies to the default
  // data dir; a custom TA_DATA_DIR (e.g. a fixture) skips it. The implicit refs
  // (HEAD, origin/main) are skipped silently when missing (no commits, no remote).
  if (resolve(dataDir) === resolve('data')) {
    for (const ref of await comparisonRefs(explicitBase ?? 'HEAD')) {
      const prev = await loadRepoAtRef('.', ref);
      if (!prev) continue;
      all.push(...checkImmutability(prev, data), ...(await checkRawNotes('.', ref)));
    }
  }

  const seen = new Set<string>();
  const unique = all.filter((e) => {
    const key = `${e.file}|${e.rule}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length > 0) {
    for (const e of unique) console.error(`${e.file}: [${e.rule}] ${e.message}`);
    return 1;
  }
  console.log(
    `✓ data valid (${data.tasks.length} tasks, ${data.decisions.length} decisions, ${data.assumptions.length} assumptions, ${data.meetings.length} meetings)`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

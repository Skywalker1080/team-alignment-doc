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

function parseBase(argv: string[]): string {
  const i = argv.indexOf('--base');
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : 'HEAD';
}

async function main(): Promise<number> {
  const dataDir = process.env.TA_DATA_DIR ?? 'data';
  const { data, errors } = await loadRepo(dataDir);
  const all: ValidationError[] = [...errors, ...validateRepo(data)];

  // Git-ref comparison reads `data/` at the ref, so it only applies to the default
  // data dir; a custom TA_DATA_DIR (e.g. a fixture) skips it. Missing refs (no
  // commits yet, no origin/main) are skipped silently.
  if (resolve(dataDir) === resolve('data')) {
    const refs = [parseBase(process.argv.slice(2))];
    if (!refs.includes('origin/main') && (await refExists('origin/main'))) refs.push('origin/main');
    for (const ref of refs) {
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

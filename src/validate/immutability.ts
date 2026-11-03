import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, posix } from 'node:path';
import type { RepoData, ValidationError } from '../model/load';

const execFileAsync = promisify(execFile);

type Rec = { id: string; history: unknown[]; origin?: string; made?: string };

/** Compares two snapshots of the data: nothing deleted, origin/made fixed, history append-only. */
export function checkImmutability(prev: RepoData, next: RepoData): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (file: string, rule: string, message: string) => errors.push({ file, rule, message });

  const groups: [Rec[], Rec[]][] = [
    [prev.tasks, next.tasks],
    [prev.decisions, next.decisions],
    [prev.assumptions, next.assumptions],
  ];
  for (const [before, after] of groups) {
    const byId = new Map(after.map((r) => [r.id, r]));
    for (const p of before) {
      const file = prev.fileOf[p.id] ?? p.id;
      const n = byId.get(p.id);
      if (!n) {
        err(file, 'deleted', `${p.id} was deleted; records are never removed`);
        continue;
      }
      for (const field of ['origin', 'made'] as const) {
        if (p[field] !== n[field]) err(file, 'immutable', `${p.id}: ${field} changed from "${p[field]}" to "${n[field]}"`);
      }
      const same = p.history.every((h, i) => JSON.stringify(h) === JSON.stringify(n.history[i]));
      if (n.history.length < p.history.length || !same) {
        err(file, 'append-only', `${p.id}: existing history entries were changed or removed`);
      }
    }
  }
  const nextMeetings = new Set(next.meetings.map((m) => m.id));
  for (const m of prev.meetings) {
    if (!nextMeetings.has(m.id)) err(m.file, 'deleted', `meeting ${m.id} was deleted; records are never removed`);
  }
  return errors;
}

const lf = (s: string) => s.replace(/\r\n/g, '\n');

/**
 * Raw meeting notes must never change after creation. Compares every file under
 * data/meetings/raw at `ref` with the working tree (line endings ignored); a
 * deleted file counts too. Returns [] when the ref does not exist.
 */
export async function checkRawNotes(repoRoot: string, ref: string): Promise<ValidationError[]> {
  const git = (...args: string[]) => execFileAsync('git', args, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  let listing: string;
  try {
    await git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
    listing = (await git('ls-tree', '-r', '--name-only', ref, '--', 'data/meetings/raw')).stdout;
  } catch {
    return [];
  }
  const errors: ValidationError[] = [];
  for (const path of listing.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (posix.basename(path) === '.gitkeep') continue;
    const before = lf((await git('show', `${ref}:${path}`)).stdout);
    let now: string | null;
    try {
      now = lf(await readFile(join(repoRoot, path), 'utf8'));
    } catch {
      now = null;
    }
    if (now === null) errors.push({ file: path, rule: 'raw-notes', message: `raw notes file deleted (compared with ${ref})` });
    else if (now !== before) errors.push({ file: path, rule: 'raw-notes', message: `raw notes file changed (compared with ${ref})` });
  }
  return errors;
}

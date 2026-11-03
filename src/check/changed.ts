import { isAbsolute, relative, resolve } from 'node:path';

export type Kind = 'tasks' | 'decisions' | 'assumptions' | 'meetings';
export type Changed = { id: string; kind: Kind };

/**
 * The data dir as a repo-relative POSIX prefix ending in '/', so `./data`, `data/`
 * and an absolute path all match git's repo-relative file names.
 */
export function dataDirPrefix(repoRoot: string, dataDir: string, cwd: string = process.cwd()): string {
  const abs = isAbsolute(dataDir) ? dataDir : resolve(cwd, dataDir);
  const rel = relative(resolve(repoRoot), abs).replace(/\\/g, '/').replace(/\/+$/, '');
  return rel === '' ? '' : `${rel}/`;
}

/**
 * Record ids among repo-relative changed files under the data dir, plus whether
 * team.yaml / themes.yaml changed. Raw notes and files outside the data dir are ignored.
 */
export function changedRecords(
  files: string[],
  repoRoot: string,
  dataDir: string,
  cwd: string = process.cwd(),
): { changed: Changed[]; configChanged: boolean } {
  const prefix = dataDirPrefix(repoRoot, dataDir, cwd);
  const seen = new Map<string, Changed>();
  let configChanged = false;
  for (const raw of files) {
    const f = raw.replace(/\\/g, '/');
    if (!f.startsWith(prefix)) continue;
    const rel = f.slice(prefix.length);
    if (/^(team|themes)\.yaml$/.test(rel)) {
      configChanged = true;
      continue;
    }
    const m = /^(tasks|decisions|assumptions|meetings)\/([^/]+)\.(yaml|md)$/.exec(rel);
    if (m) seen.set(m[2]!, { id: m[2]!, kind: m[1] as Kind });
  }
  return { changed: [...seen.values()], configChanged };
}

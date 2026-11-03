import { readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const KIND_RE = {
  T: /^T-(\d{4})$/,
  D: /^D-(\d{4})$/,
  A: /^A-(\d{4})$/,
} as const;
const MEETING_RE = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/;

/** Record directory and file extension for each renumberable record type. */
const DIRS = [
  { dir: 'tasks', ext: '.yaml' },
  { dir: 'decisions', ext: '.yaml' },
  { dir: 'assumptions', ext: '.yaml' },
  { dir: 'meetings', ext: '.md' },
] as const;

/** Record id for a data-dir-relative path such as `tasks/T-0043.yaml`, or null for any other file. */
export function recordIdOfPath(rel: string): string | null {
  const m = /^(tasks|decisions|assumptions|meetings)\/([^/]+)$/.exec(rel.replace(/\\/g, '/'));
  if (!m) return null;
  const spec = DIRS.find((d) => d.dir === m[1])!;
  if (!m[2]!.endsWith(spec.ext)) return null;
  const id = m[2]!.slice(0, -spec.ext.length);
  return KIND_RE.T.test(id) || KIND_RE.D.test(id) || KIND_RE.A.test(id) || MEETING_RE.test(id)
    ? id
    : null;
}

/**
 * Plans new ids for local records whose ids were also created upstream.
 * Only ids present in both `localNew` and `remoteNew` are renumbered; each gets
 * the next free id of its kind, above everything already known.
 */
export function planRenumber(
  localNew: string[],
  remoteNew: string[],
  allExisting: string[],
): Map<string, string> {
  const remote = new Set(remoteNew);
  const known = new Set([...allExisting, ...remoteNew, ...localNew]);
  const plan = new Map<string, string>();
  const clashes = localNew.filter((id) => remote.has(id)).sort();

  for (const id of clashes) {
    let next: string | null = null;
    for (const prefix of ['T', 'D', 'A'] as const) {
      if (!KIND_RE[prefix].test(id)) continue;
      let max = 0;
      for (const k of known) {
        const m = KIND_RE[prefix].exec(k);
        if (m) max = Math.max(max, Number(m[1]));
      }
      next = `${prefix}-${String(max + 1).padStart(4, '0')}`;
    }
    const mm = MEETING_RE.exec(id);
    if (next === null && mm) {
      let max = 1; // the bare date counts as suffix 1
      for (const k of known) {
        const o = MEETING_RE.exec(k);
        if (o && o[1] === mm[1]) max = Math.max(max, o[2] ? Number(o[2]) : 1);
      }
      next = `${mm[1]}-${max + 1}`;
    }
    if (next === null) continue; // not a record id; leave alone
    known.add(next);
    plan.set(id, next);
  }
  return plan;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces whole-token occurrences of any mapped id inside `text`. */
function replaceTokens(text: string, map: Map<string, string>): string {
  const alt = [...map.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  return text.replace(new RegExp(`(?<![\\w-])(?:${alt})(?![\\w-])`, 'g'), (t) => map.get(t)!);
}

/** Top-level `key: value` lines whose value is a single mapped id. */
function replaceScalarKeys(text: string, keys: string[], map: Map<string, string>): string {
  const re = new RegExp(`^((?:${keys.join('|')}):[ \\t]*["']?)([^\\s"'#]+)`, 'gm');
  return text.replace(re, (_m, head: string, val: string) => head + (map.get(val) ?? val));
}

function rewriteRecordYaml(text: string, map: Map<string, string>): string {
  return replaceScalarKeys(text, ['id', 'superseded_by', 'origin', 'made'], map);
}

function rewriteMeeting(text: string, map: Map<string, string>): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---/.exec(text);
  if (!m) return text;
  let front = m[0];
  front = replaceScalarKeys(front, ['id'], map);
  // raw: raw/<meeting id>.md
  front = front.replace(
    /^(raw:[ \t]*["']?raw\/)([^\s"'#]+?)(\.md)/m,
    (_m, a: string, id: string, c: string) => a + (map.get(id) ?? id) + c,
  );
  // id arrays, inline or block style (continuation lines are indented)
  front = front.replace(
    /^(?:tasks_created|decisions_made|assumptions_made):[^\n]*(?:\n[ \t]+[^\n]*)*/gm,
    (block) => replaceTokens(block, map),
  );
  return front + text.slice(m[0].length);
}

/**
 * Renames record files and rewrites references according to `map`
 * (`id`, meeting id arrays, `superseded_by`, `origin`, `made`, meeting `raw`
 * and the raw note's file name). History `text` notes are left alone.
 * Returns every path touched (new names and removed old names), data dir joined with `/`.
 */
export async function applyRenumber(dataDir: string, map: Map<string, string>): Promise<string[]> {
  if (map.size === 0) return [];
  const changed: string[] = [];
  const shown = (rel: string) => `${dataDir.replace(/\\/g, '/').replace(/\/$/, '')}/${rel}`;

  for (const { dir, ext } of DIRS) {
    const names = await readdir(join(dataDir, dir)).catch(() => [] as string[]);
    for (const name of names.sort()) {
      if (!name.endsWith(ext)) continue;
      const id = name.slice(0, -ext.length);
      const text = await readFile(join(dataDir, dir, name), 'utf8');
      const next = dir === 'meetings' ? rewriteMeeting(text, map) : rewriteRecordYaml(text, map);
      const newName = `${map.get(id) ?? id}${ext}`;
      if (next === text && newName === name) continue;
      await writeFile(join(dataDir, dir, newName), next);
      if (newName !== name) {
        await unlink(join(dataDir, dir, name));
        changed.push(shown(`${dir}/${name}`));
      }
      changed.push(shown(`${dir}/${newName}`));
    }
  }

  // Raw notes belong to meetings and are only renamed, never edited.
  for (const [from, to] of map) {
    if (!MEETING_RE.test(from)) continue;
    const src = join(dataDir, 'meetings', 'raw', `${from}.md`);
    if (!existsSync(src)) continue;
    await rename(src, join(dataDir, 'meetings', 'raw', `${to}.md`));
    changed.push(shown(`meetings/raw/${from}.md`), shown(`meetings/raw/${to}.md`));
  }
  return changed;
}

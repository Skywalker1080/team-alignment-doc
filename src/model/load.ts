import { readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, posix } from 'node:path';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import type { ZodTypeAny, z } from 'zod';
import {
  TeamSchema,
  ThemesSchema,
  TaskSchema,
  DecisionSchema,
  AssumptionSchema,
  MeetingFrontSchema,
  type Team,
  type Theme,
  type Task,
  type Decision,
  type Assumption,
} from './schemas';
import { parseMeetingBody, compareMeetingIds, type Meeting } from './meeting';

export { parseMeetingBody, compareMeetingIds } from './meeting';
export type { Meeting, Section } from './meeting';

export interface ValidationError {
  file: string;
  rule: string;
  message: string;
}

export interface RepoData {
  team: Team;
  themes: Theme[];
  meetings: Meeting[];
  tasks: Task[];
  decisions: Decision[];
  assumptions: Assumption[];
  /** Record id (task, decision, assumption, meeting) to its repo-relative path. */
  fileOf: Record<string, string>;
  /**
   * One entry per loaded task/decision/assumption file, so duplicate ids and
   * id/file-name mismatches stay detectable (fileOf keeps only one path per id).
   */
  recordFiles: { id: string; file: string }[];
}

const execFileAsync = promisify(execFile);

/**
 * The 'core' YAML schema keeps unquoted dates and timestamps as strings
 * (the default gray-matter engine would turn them into Date objects).
 */
const parseYamlStrings = (src: string): object => parseYaml(src, { schema: 'core' }) ?? {};

const normalize = (s: string) => s.replace(/\r\n/g, '\n');

/** Files keyed by path relative to the data dir, using forward slashes. */
type Source = Map<string, string>;

function describeIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

function parseWith<S extends ZodTypeAny>(
  schema: S,
  value: unknown,
  file: string,
  errors: ValidationError[],
): z.infer<S> | null {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  errors.push({ file, rule: 'schema', message: describeIssues(r.error) });
  return null;
}

function parseYamlFile(text: string, file: string, errors: ValidationError[]): unknown {
  try {
    return parseYaml(normalize(text), { schema: 'core' });
  } catch (e) {
    errors.push({ file, rule: 'parse', message: (e as Error).message });
    return undefined;
  }
}

function loadFromSource(src: Source): { data: RepoData; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const fileOf: Record<string, string> = {};
  const recordFiles: { id: string; file: string }[] = [];
  const repoPath = (rel: string) => `data/${rel}`;

  let team: Team = { members: [] };
  const teamText = src.get('team.yaml');
  if (teamText === undefined) {
    errors.push({ file: repoPath('team.yaml'), rule: 'schema', message: 'file not found' });
  } else {
    const raw = parseYamlFile(teamText, repoPath('team.yaml'), errors);
    if (raw !== undefined) team = parseWith(TeamSchema, raw, repoPath('team.yaml'), errors) ?? team;
  }

  let themes: Theme[] = [];
  const themesText = src.get('themes.yaml');
  if (themesText === undefined) {
    errors.push({ file: repoPath('themes.yaml'), rule: 'schema', message: 'file not found' });
  } else {
    const raw = parseYamlFile(themesText, repoPath('themes.yaml'), errors);
    if (raw !== undefined) {
      themes = parseWith(ThemesSchema, raw, repoPath('themes.yaml'), errors)?.themes ?? [];
    }
  }

  const rels = [...src.keys()].sort();

  const loadRecords = <S extends ZodTypeAny>(dir: string, schema: S): z.infer<S>[] => {
    const out: z.infer<S>[] = [];
    for (const rel of rels) {
      if (!rel.startsWith(`${dir}/`) || rel.slice(dir.length + 1).includes('/')) continue;
      if (!rel.endsWith('.yaml')) continue;
      const file = repoPath(rel);
      const raw = parseYamlFile(src.get(rel)!, file, errors);
      if (raw === undefined) continue;
      const rec = parseWith(schema, raw, file, errors);
      if (rec) {
        out.push(rec);
        fileOf[rec.id] = file;
        recordFiles.push({ id: rec.id, file });
      }
    }
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  };

  const tasks = loadRecords('tasks', TaskSchema) as Task[];
  const decisions = loadRecords('decisions', DecisionSchema) as Decision[];
  const assumptions = loadRecords('assumptions', AssumptionSchema) as Assumption[];

  const meetings: Meeting[] = [];
  for (const rel of rels) {
    if (!rel.startsWith('meetings/') || rel.slice('meetings/'.length).includes('/')) continue;
    if (!rel.endsWith('.md')) continue;
    const file = repoPath(rel);
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(normalize(src.get(rel)!), { engines: { yaml: parseYamlStrings } });
    } catch (e) {
      errors.push({ file, rule: 'parse', message: (e as Error).message });
      continue;
    }
    const front = parseWith(MeetingFrontSchema, parsed.data, file, errors);
    if (!front) continue;
    const { sections, stray } = parseMeetingBody(parsed.content);
    meetings.push({ ...front, sections, stray, file });
    fileOf[front.id] = file;
  }
  meetings.sort((a, b) => compareMeetingIds(a.id, b.id));

  return { data: { team, themes, meetings, tasks, decisions, assumptions, fileOf, recordFiles }, errors };
}

async function readDirSource(dataDir: string): Promise<Source> {
  const src: Source = new Map();
  const walk = async (rel: string) => {
    const entries = await readdir(join(dataDir, rel), { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (childRel === 'meetings/raw') continue; // raw notes are never loaded, only referenced
        await walk(childRel);
      } else if (/\.(ya?ml|md)$/.test(e.name)) {
        src.set(childRel, await readFile(join(dataDir, childRel), 'utf8'));
      }
    }
  };
  await walk('');
  return src;
}

/** Loads a data directory. Schema and parse failures become `errors`; nothing throws. */
export async function loadRepo(
  dataDir: string,
): Promise<{ data: RepoData; errors: ValidationError[] }> {
  return loadFromSource(await readDirSource(dataDir));
}

/**
 * Loads `data/` as it was at a git ref. Returns null when the ref does not
 * exist (for example before the first commit).
 */
export async function loadRepoAtRef(repoRoot: string, ref: string): Promise<RepoData | null> {
  const git = (...args: string[]) =>
    execFileAsync('git', args, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  try {
    await git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  } catch {
    return null;
  }
  const { stdout } = await git('ls-tree', '-r', '--name-only', ref, '--', 'data');
  const src: Source = new Map();
  for (const path of stdout.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const rel = posix.relative('data', path);
    if (rel.startsWith('meetings/raw/') || !/\.(ya?ml|md)$/.test(rel)) continue;
    const { stdout: text } = await git('show', `${ref}:${path}`);
    src.set(rel, text);
  }
  return loadFromSource(src).data;
}

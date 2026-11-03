// Team-alignment helper for Claude's rules. Usage: npm run ta -- <command>
//   whoami            member id for `git config user.email` (exit 1 if unknown)
//   next-id <T|D|A>   next free task / decision / assumption id
//   today             today's lanes as plain text (read-only)
//   now               current time in IST with offset, for history `at`
// Reads TA_DATA_DIR (default: data).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { loadRepo, type RepoData } from '../src/model/load';
import { TeamSchema, type Team } from '../src/model/schemas';
import { TZ, todayIso } from '../src/metrics/dates';
import { todayLanes } from '../src/metrics/tasks';
import { originBadge } from '../dashboard/src/format';

export type IdKind = 'T' | 'D' | 'A';

const DIR_OF: Record<IdKind, string> = { T: 'tasks', D: 'decisions', A: 'assumptions' };

/** One above the highest `<kind>-NNNN` in `existing`, zero-padded to 4 digits. */
export function nextId(kind: IdKind, existing: string[]): string {
  const re = new RegExp(`^${kind}-(\\d+)$`);
  let max = 0;
  for (const id of existing) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${kind}-${String(max + 1).padStart(4, '0')}`;
}

/** Member id whose emails include `email` (case-insensitive), or null. */
export function resolveMember(email: string, team: Team): string | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return team.members.find((m) => m.emails.some((x) => x.trim().toLowerCase() === e))?.id ?? null;
}

/** e.g. 2026-11-03T18:20:00+05:30 */
export function nowIst(now: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

const firstName = (data: RepoData, owner: string): string =>
  owner === 'anyone' ? 'Anyone' : (data.team.members.find((m) => m.id === owner)?.name.split(/\s+/)[0] ?? owner);

/** Plain-text Today view: one block per lane (first name), one line per task. */
export function formatToday(data: RepoData, today: string): string {
  const lanes = todayLanes(data.tasks, data.team.members.map((m) => m.id), data.meetings, today);
  const out = [`Today, ${today}`, ''];
  for (const lane of lanes) {
    out.push(firstName(data, lane.owner));
    if (lane.tasks.length === 0) out.push('  nothing due');
    for (const t of lane.tasks) {
      const mark = t.deadline.kind === 'hard' ? '◆' : '○';
      const parts = [t.id, t.title, t.priority, `${mark} ${t.deadline.kind} ${t.deadline.date}`];
      if (t.status === 'doing') parts.push('doing');
      parts.push(originBadge(t, today));
      out.push(`  ${parts.join('  ')}`);
    }
    out.push('');
  }
  return out.join('\n');
}

function idsInDir(dataDir: string, kind: IdKind): string[] {
  try {
    return readdirSync(join(dataDir, DIR_OF[kind]))
      .filter((n) => n.endsWith('.yaml'))
      .map((n) => n.slice(0, -'.yaml'.length));
  } catch {
    return [];
  }
}

/** Reads only team.yaml, so broken records elsewhere never block identification. */
function loadTeam(dataDir: string): Team {
  const file = join(dataDir, 'team.yaml');
  const r = TeamSchema.safeParse(parseYaml(readFileSync(file, 'utf8'), { schema: 'core' }));
  if (!r.success) throw new Error(`${file} is invalid: ${r.error.issues.map((i) => i.message).join('; ')}`);
  return r.data;
}

async function loadOrFail(dataDir: string): Promise<RepoData> {
  const { data, errors } = await loadRepo(dataDir);
  if (errors.length) {
    for (const e of errors) console.error(`${e.file}: [${e.rule}] ${e.message}`);
    throw new Error('data does not load; run npm run validate and fix the errors');
  }
  return data;
}

async function main(argv: string[]): Promise<number> {
  const dataDir = process.env.TA_DATA_DIR ?? 'data';
  const [cmd, arg] = argv;
  switch (cmd) {
    case 'whoami': {
      let email = '';
      try {
        email = execFileSync('git', ['config', 'user.email'], { encoding: 'utf8' }).trim();
      } catch {
        // not set
      }
      const id = resolveMember(email, loadTeam(dataDir));
      if (!id) {
        console.error(`unknown git email ${email || '(not set)'}; add it to data/team.yaml`);
        return 1;
      }
      console.log(id);
      return 0;
    }
    case 'next-id': {
      if (arg !== 'T' && arg !== 'D' && arg !== 'A') {
        console.error('usage: ta next-id <T|D|A>');
        return 1;
      }
      console.log(nextId(arg, idsInDir(dataDir, arg)));
      return 0;
    }
    case 'today':
      console.log(formatToday(await loadOrFail(dataDir), todayIso()));
      return 0;
    case 'now':
      console.log(nowIst());
      return 0;
    default:
      console.error('usage: ta <whoami | next-id <T|D|A> | today | now>');
      return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}

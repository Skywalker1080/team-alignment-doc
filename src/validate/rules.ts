import { SECTION_ORDER } from '../model/schemas';
import type { RepoData, ValidationError } from '../model/load';

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** True when `s` starts with YYYY-MM-DD naming a real calendar day. */
export function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** True when `s` is an ISO timestamp with a real date, a valid time and a valid offset. */
export function isRealTimestamp(s: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(s);
  if (!m) return false;
  if (!isRealDate(m[1]!)) return false;
  if (Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4] ?? 0) > 59) return false;
  return m[5] === 'Z' || (Number(m[6]) <= 23 && Number(m[7]) <= 59);
}

/** Every string leaf of a value, with a dotted path. */
function* stringLeaves(v: unknown, path = ''): Generator<[string, string]> {
  if (typeof v === 'string') yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* stringLeaves(v[i], `${path}[${i}]`);
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) yield* stringLeaves(x, path ? `${path}.${k}` : k);
  }
}

/** Cross-record rules. loadRepo has already reported schema and parse errors. */
export function validateRepo(data: RepoData): ValidationError[] {
  const errors: ValidationError[] = [];
  const err = (file: string, rule: string, message: string) => errors.push({ file, rule, message });
  const fileFor = (id: string) => data.fileOf[id] ?? id;

  const members = new Set(data.team.members.map((m) => m.id));
  const themeIds = new Set(data.themes.map((t) => t.id));
  const meetingIds = new Set(data.meetings.map((m) => m.id));
  const taskById = new Map(data.tasks.map((t) => [t.id, t]));
  const decisionById = new Map(data.decisions.map((d) => [d.id, d]));
  const assumptionById = new Map(data.assumptions.map((a) => [a.id, a]));

  // id-file
  for (const { id, file } of data.recordFiles) {
    if (file.split('/').pop() !== `${id}.yaml`) err(file, 'id-file', `file name must be ${id}.yaml`);
  }
  for (const m of data.meetings) {
    if (m.file.split('/').pop() !== `${m.id}.md`) err(m.file, 'id-file', `file name must be ${m.id}.md`);
  }

  // id-unique (from the record arrays; fileOf keeps only one path per id)
  const dupes = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(fileFor(id), 'id-unique', `duplicate ${kind} id ${id}`);
      seen.add(id);
    }
  };
  dupes('task', data.tasks.map((t) => t.id));
  dupes('decision', data.decisions.map((d) => d.id));
  dupes('assumption', data.assumptions.map((a) => a.id));
  dupes('meeting', data.meetings.map((m) => m.id));

  for (const r of [...data.tasks, ...data.decisions, ...data.assumptions]) {
    const file = fileFor(r.id);

    if (!themeIds.has(r.theme)) err(file, 'theme', `${r.id}: unknown theme "${r.theme}"`);

    if (r.history[0]?.event !== 'created') err(file, 'history-first', `${r.id}: history must start with a created event`);
    for (let i = 1; i < r.history.length; i++) {
      const a = Date.parse(r.history[i - 1]!.at);
      const b = Date.parse(r.history[i]!.at);
      if (!Number.isNaN(a) && !Number.isNaN(b) && b < a) {
        err(file, 'history-order', `${r.id}: history[${i}] is earlier than history[${i - 1}]`);
        break;
      }
    }
    for (const [i, h] of r.history.entries()) {
      if (!members.has(h.by)) err(file, 'owner', `${r.id}: history[${i}].by "${h.by}" is not a team member`);
      if (!isRealTimestamp(h.at)) err(file, 'date-valid', `${r.id}: history[${i}].at "${h.at}" is not a real date/time`);
    }

    for (const [path, s] of stringLeaves(r)) {
      if (EMAIL_RE.test(s)) err(file, 'no-email', `${r.id}: ${path} contains an email address`);
    }
  }

  for (const t of data.tasks) {
    const file = fileFor(t.id);
    if (t.owner !== 'anyone' && !members.has(t.owner)) {
      err(file, 'owner', `${t.id}: owner "${t.owner}" is not a team member or "anyone"`);
    }
    if (!meetingIds.has(t.origin)) err(file, 'origin', `${t.id}: origin "${t.origin}" is not an existing meeting`);
    if (!isRealDate(t.deadline.date)) err(file, 'date-valid', `${t.id}: deadline.date "${t.deadline.date}" is not a real date`);
    if (!isRealDate(t.origin)) err(file, 'date-valid', `${t.id}: origin "${t.origin}" is not a real date`);
    if (t.status === 'done' || t.status === 'dropped') {
      const last = [...t.history].reverse().find((h) => h.event === 'status');
      if (!last || last.to !== t.status) {
        err(file, 'status-history', `${t.id}: status ${t.status} needs a last status event with to: ${t.status}`);
      } else if (t.status === 'dropped' && !last.text?.trim()) {
        err(file, 'status-history', `${t.id}: dropped status event needs a reason in text`);
      }
    }
  }

  for (const r of [...data.decisions, ...data.assumptions]) {
    const file = fileFor(r.id);
    if (!meetingIds.has(r.made)) err(file, 'origin', `${r.id}: made "${r.made}" is not an existing meeting`);
    if (!isRealDate(r.made)) err(file, 'date-valid', `${r.id}: made "${r.made}" is not a real date`);
  }

  for (const d of data.decisions) {
    const file = fileFor(d.id);
    if ((d.status === 'superseded') !== (d.superseded_by !== undefined)) {
      err(file, 'superseded', `${d.id}: status superseded and superseded_by must be set together`);
    } else if (d.superseded_by !== undefined && !decisionById.has(d.superseded_by)) {
      err(file, 'superseded', `${d.id}: superseded_by ${d.superseded_by} does not exist`);
    }
  }

  for (const th of data.themes) {
    if (!isRealDate(th.created)) {
      err('data/themes.yaml', 'date-valid', `theme ${th.id}: created "${th.created}" is not a real date`);
    }
  }

  for (const m of data.meetings) {
    const file = m.file;
    if (!isRealDate(m.date)) err(file, 'date-valid', `${m.id}: date "${m.date}" is not a real date`);

    for (const a of m.attendees) {
      if (!members.has(a)) err(file, 'attendees', `${m.id}: attendee "${a}" is not a team member`);
    }
    if (!members.has(m.notes_by)) err(file, 'attendees', `${m.id}: notes_by "${m.notes_by}" is not a team member`);

    const refs: [string[], Map<string, { origin?: string; made?: string }>, 'origin' | 'made'][] = [
      [m.tasks_created, taskById, 'origin'],
      [m.decisions_made, decisionById, 'made'],
      [m.assumptions_made, assumptionById, 'made'],
    ];
    for (const [ids, byId, field] of refs) {
      for (const id of ids) {
        const rec = byId.get(id);
        if (!rec) err(file, 'meeting-refs', `${m.id}: references missing record ${id}`);
        else if (rec[field] !== m.id) {
          err(file, 'meeting-refs', `${m.id}: ${id} has ${field} "${rec[field]}", expected "${m.id}"`);
        }
      }
    }

    let last = -1;
    for (const s of m.sections) {
      const idx = (SECTION_ORDER as readonly string[]).indexOf(s.heading);
      if (idx < 0) err(file, 'sections', `${m.id}: unknown section "${s.heading}"`);
      else if (idx <= last) err(file, 'sections', `${m.id}: section "${s.heading}" is out of order or repeated`);
      else last = idx;
      if (s.bullets.length < 1 || s.bullets.length > 4) {
        err(file, 'sections', `${m.id}: section "${s.heading}" has ${s.bullets.length} bullets, expected 1-4`);
      }
    }
    if (!m.sections.some((s) => s.heading === 'Discussion')) err(file, 'sections', `${m.id}: Discussion section is required`);
    if (m.stray.length > 0) err(file, 'sections', `${m.id}: text outside sections: "${m.stray[0]}"`);

    for (const s of m.sections) {
      for (const b of s.bullets) {
        if (EMAIL_RE.test(b)) err(file, 'no-email', `${m.id}: bullet in "${s.heading}" contains an email address`);
      }
    }
    if (m.principle && EMAIL_RE.test(m.principle)) err(file, 'no-email', `${m.id}: principle contains an email address`);
  }

  return errors;
}

import { describe, it, expect } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadRepo } from '../../src/model/load';
import { validateRepo } from '../../src/validate/rules';
import { applyRenumber, planRenumber } from '../../src/fixids/plan';

const root = join(__dirname, '..', '..');
const fx = (name: string) => join(__dirname, '..', 'fixtures', name);
const tmp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

const range = (prefix: string, to: number) =>
  Array.from({ length: to }, (_, i) => `${prefix}-${String(i + 1).padStart(4, '0')}`);

describe('planRenumber', () => {
  it('renumbers only the clashing id, above the max of everything known', () => {
    const existing = [...range('T', 42), 'D-0001'];
    const plan = planRenumber(['T-0043', 'D-0002'], ['T-0043', 'T-0044'], existing);
    expect(Object.fromEntries(plan)).toEqual({ 'T-0043': 'T-0045' });
  });

  it('assigns consecutive free ids to several clashes of one kind', () => {
    const plan = planRenumber(['T-0005', 'T-0006'], ['T-0005', 'T-0006', 'T-0007'], range('T', 4));
    expect(Object.fromEntries(plan)).toEqual({ 'T-0005': 'T-0008', 'T-0006': 'T-0009' });
  });

  it('handles decisions and assumptions independently', () => {
    const plan = planRenumber(['D-0003', 'A-0002'], ['D-0003', 'A-0002'], ['D-0003', 'A-0002']);
    expect(Object.fromEntries(plan)).toEqual({ 'D-0003': 'D-0004', 'A-0002': 'A-0003' });
  });

  it('gives a clashing meeting the next free suffix for its date', () => {
    expect(Object.fromEntries(planRenumber(['2026-11-03'], ['2026-11-03'], []))).toEqual({
      '2026-11-03': '2026-11-03-2',
    });
    expect(
      Object.fromEntries(
        planRenumber(['2026-11-03-2'], ['2026-11-03-2'], ['2026-11-03', '2026-11-03-2', '2026-11-04']),
      ),
    ).toEqual({ '2026-11-03-2': '2026-11-03-3' });
  });

  it('is empty when nothing clashes', () => {
    expect(planRenumber(['T-0009'], ['T-0010'], ['T-0008']).size).toBe(0);
  });
});

describe('applyRenumber', () => {
  it('moves a task file and fixes the meeting that lists it', async () => {
    const dir = tmp('ta-fixids-');
    cpSync(fx('basic'), dir, { recursive: true });
    const changed = await applyRenumber(dir, new Map([['T-0008', 'T-0010']]));

    expect(existsSync(join(dir, 'tasks', 'T-0008.yaml'))).toBe(false);
    expect(readFileSync(join(dir, 'tasks', 'T-0010.yaml'), 'utf8')).toMatch(/^id: T-0010$/m);
    expect(readFileSync(join(dir, 'meetings', '2026-11-06.md'), 'utf8')).toMatch(
      /^tasks_created: \[T-0007, T-0010\]$/m,
    );
    expect(changed.sort()).toEqual([
      `${dir.replace(/\\/g, '/')}/meetings/2026-11-06.md`,
      `${dir.replace(/\\/g, '/')}/tasks/T-0008.yaml`,
      `${dir.replace(/\\/g, '/')}/tasks/T-0010.yaml`,
    ]);

    const { data, errors } = await loadRepo(dir);
    expect(errors).toEqual([]);
    expect(validateRepo(data)).toEqual([]);
  });

  it('rewrites superseded_by when a decision is renumbered', async () => {
    const dir = tmp('ta-fixids-');
    cpSync(fx('basic'), dir, { recursive: true });
    await applyRenumber(dir, new Map([['D-0002', 'D-0005']]));
    expect(readFileSync(join(dir, 'decisions', 'D-0001.yaml'), 'utf8')).toMatch(
      /^superseded_by: D-0005$/m,
    );
    expect(readFileSync(join(dir, 'meetings', '2026-11-06.md'), 'utf8')).toMatch(
      /^decisions_made: \[D-0005\]$/m,
    );
    const { data, errors } = await loadRepo(dir);
    expect(errors).toEqual([]);
    expect(validateRepo(data)).toEqual([]);
  });

  it('renames a meeting, its raw note, and the origin/made references to it', async () => {
    const dir = tmp('ta-fixids-');
    cpSync(fx('basic'), dir, { recursive: true });
    await applyRenumber(dir, new Map([['2026-11-03-2', '2026-11-03-3']]));

    expect(existsSync(join(dir, 'meetings', '2026-11-03-2.md'))).toBe(false);
    expect(existsSync(join(dir, 'meetings', 'raw', '2026-11-03-2.md'))).toBe(false);
    expect(existsSync(join(dir, 'meetings', 'raw', '2026-11-03-3.md'))).toBe(true);
    const meeting = readFileSync(join(dir, 'meetings', '2026-11-03-3.md'), 'utf8');
    expect(meeting).toMatch(/^id: 2026-11-03-3$/m);
    expect(meeting).toMatch(/^date: 2026-11-03$/m);
    expect(meeting).toMatch(/^raw: raw\/2026-11-03-3\.md$/m);
    expect(readFileSync(join(dir, 'tasks', 'T-0004.yaml'), 'utf8')).toMatch(/^origin: 2026-11-03-3$/m);
    expect(readFileSync(join(dir, 'assumptions', 'A-0002.yaml'), 'utf8')).toMatch(
      /^made: 2026-11-03-3$/m,
    );
    // the other meeting of that day is untouched
    expect(readFileSync(join(dir, 'tasks', 'T-0001.yaml'), 'utf8')).toMatch(/^origin: 2026-11-03$/m);

    const { data, errors } = await loadRepo(dir);
    expect(errors).toEqual([]);
    expect(validateRepo(data)).toEqual([]);
  });

  it('does nothing for an empty map', async () => {
    const dir = tmp('ta-fixids-');
    cpSync(fx('basic'), dir, { recursive: true });
    expect(await applyRenumber(dir, new Map())).toEqual([]);
  });
});

describe('scripts/fix-ids.ts in real git repos', () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const fixIds = (cwd: string) =>
    execFileSync(
      process.execPath,
      [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'scripts', 'fix-ids.ts')],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  const configure = (cwd: string, name: string) => {
    git(cwd, 'config', 'user.email', `${name}@example.com`);
    git(cwd, 'config', 'user.name', name);
    git(cwd, 'config', 'core.autocrlf', 'false');
  };
  const write = (cwd: string, rel: string, text: string) => {
    mkdirSync(join(cwd, rel, '..'), { recursive: true });
    writeFileSync(join(cwd, rel), text);
  };
  const taskYaml = (id: string, title: string, origin: string) =>
    `id: ${id}\ntitle: ${title}\ndescription: ${title} details.\nowner: anyone\npriority: p1\ntheme: ops\n` +
    `deadline:\n  date: 2026-11-20\n  kind: soft\nstatus: todo\norigin: ${origin}\nhistory:\n` +
    `  - at: 2026-11-04T10:00:00+05:30\n    by: ana\n    event: created\n`;
  const meetingMd = (id: string, taskId: string) =>
    `---\nid: ${id}\ndate: ${id}\nattendees: [ana]\nnotes_by: ana\nraw: raw/${id}.md\ntasks_created: [${taskId}]\n---\n\n` +
    `## Discussion\n- Talked about ${taskId}.\n\n## Tasks\n- Do the thing.\n`;

  /** Bare origin plus a seeded main; returns clones. */
  function setup() {
    const base = tmp('ta-fixids-git-');
    const origin = join(base, 'origin.git');
    execFileSync('git', ['init', '--bare', '-b', 'main', origin]);
    const seed = join(base, 'seed');
    execFileSync('git', ['init', '-b', 'main', seed]);
    configure(seed, 'seed');
    write(seed, 'data/team.yaml', 'members:\n  - id: ana\n    name: Ana Test\n    emails: [ana@example.com]\n');
    write(seed, 'data/themes.yaml', 'themes:\n  - id: ops\n    name: Ops\n    created: 2026-11-01\n');
    for (const d of ['tasks', 'decisions', 'assumptions', 'meetings/raw']) write(seed, `data/${d}/.gitkeep`, '');
    write(seed, 'data/tasks/T-0008.yaml', taskYaml('T-0008', 'Existing task', '2026-11-01'));
    write(seed, 'data/meetings/2026-11-01.md', meetingMd('2026-11-01', 'T-0008'));
    write(seed, 'data/meetings/raw/2026-11-01.md', 'raw\n');
    git(seed, 'add', '-A');
    git(seed, 'commit', '-m', 'seed');
    git(seed, 'remote', 'add', 'origin', origin);
    git(seed, 'push', 'origin', 'main');
    const clone = (name: string) => {
      const dir = join(base, name);
      execFileSync('git', ['clone', origin, dir], { stdio: 'ignore' });
      configure(dir, name);
      return dir;
    };
    return { a: clone('a'), b: clone('b') };
  }

  const addLocalTask = (cwd: string, meeting: string, title: string) => {
    write(cwd, 'data/tasks/T-0009.yaml', taskYaml('T-0009', title, meeting));
    write(cwd, `data/meetings/${meeting}.md`, meetingMd(meeting, 'T-0009'));
    write(cwd, `data/meetings/raw/${meeting}.md`, `raw ${title}\n`);
  };

  it('renumbers a committed local clash so the rebase has no conflict', async () => {
    const { a, b } = setup();
    addLocalTask(b, '2026-11-05', 'Remote task');
    git(b, 'add', '-A');
    git(b, 'commit', '-m', 'T-0009 from b');
    git(b, 'push', 'origin', 'main');

    addLocalTask(a, '2026-11-04', 'Local task');
    git(a, 'add', '-A');
    git(a, 'commit', '-m', 'T-0009 from a');

    git(a, 'fetch', 'origin');
    const out = fixIds(a);
    expect(out).toContain('renumbered T-0009 → T-0010');
    expect(out).toContain('amended');

    git(a, 'rebase', 'origin/main');
    expect(git(a, 'status', '--porcelain')).toBe('');
    expect(readFileSync(join(a, 'data/tasks/T-0009.yaml'), 'utf8')).toContain('title: Remote task');
    const mine = readFileSync(join(a, 'data/tasks/T-0010.yaml'), 'utf8');
    expect(mine).toMatch(/^id: T-0010$/m);
    expect(mine).toContain('title: Local task');
    expect(readFileSync(join(a, 'data/meetings/2026-11-04.md'), 'utf8')).toMatch(
      /^tasks_created: \[T-0010\]$/m,
    );

    const { data, errors } = await loadRepo(join(a, 'data'));
    expect(errors).toEqual([]);
    expect(validateRepo(data)).toEqual([]);
    expect(data.tasks.map((t) => t.id)).toEqual(['T-0008', 'T-0009', 'T-0010']);
  }, 60_000);

  it('renames uncommitted new files without amending', () => {
    const { a, b } = setup();
    addLocalTask(b, '2026-11-05', 'Remote task');
    git(b, 'add', '-A');
    git(b, 'commit', '-m', 'T-0009 from b');
    git(b, 'push', 'origin', 'main');

    addLocalTask(a, '2026-11-04', 'Local task');
    const headBefore = git(a, 'rev-parse', 'HEAD');
    git(a, 'fetch', 'origin');
    const out = fixIds(a);
    expect(out).toContain('renumbered T-0009 → T-0010');
    expect(out).toContain('nothing to amend');
    expect(git(a, 'rev-parse', 'HEAD')).toBe(headBefore);
    expect(existsSync(join(a, 'data/tasks/T-0010.yaml'))).toBe(true);
    expect(existsSync(join(a, 'data/tasks/T-0009.yaml'))).toBe(false);
  }, 60_000);

  it('reports no id clashes, and exits 0 without origin/main', () => {
    const { a, b } = setup();
    git(b, 'fetch', 'origin');
    expect(fixIds(a)).toContain('no id clashes');

    const lonely = tmp('ta-fixids-lonely-');
    execFileSync('git', ['init', '-b', 'main', lonely], { stdio: 'ignore' });
    expect(fixIds(lonely)).toContain('nothing to fix');
  }, 60_000);
});

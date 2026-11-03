import { describe, it, expect } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadRepo, loadRepoAtRef } from '../../src/model/load';
import { parseMeetingBody, compareMeetingIds } from '../../src/model/meeting';

const fx = (name: string) => join(__dirname, '..', 'fixtures', name);

describe('loadRepo basic', () => {
  it('loads with no errors, 8 tasks, ordered meetings', async () => {
    const { data, errors } = await loadRepo(fx('basic'));
    expect(errors).toEqual([]);
    expect(data.tasks).toHaveLength(8);
    expect(data.meetings.map((m) => m.id)).toEqual(['2026-11-03', '2026-11-03-2', '2026-11-06']);
    expect(data.team.members).toHaveLength(3);
    expect(data.themes).toHaveLength(3);
    expect(data.decisions).toHaveLength(2);
    expect(data.assumptions).toHaveLength(2);
    expect(data.fileOf['T-0001']).toBe('data/tasks/T-0001.yaml');
    expect(data.fileOf['2026-11-03']).toBe('data/meetings/2026-11-03.md');
    expect(data.meetings[0]!.file).toBe('data/meetings/2026-11-03.md');
  });

  it('keeps YAML dates as strings', async () => {
    const { data } = await loadRepo(fx('basic'));
    const t3 = data.tasks.find((t) => t.id === 'T-0003')!;
    expect(t3.deadline.date).toBe('2026-11-09');
    expect(t3.history[1]!.from).toBe('2026-11-05');
  });

  it('parses the meeting body sections', async () => {
    const md = readFileSync(join(fx('basic'), 'meetings', '2026-11-03.md'), 'utf8');
    const { sections, stray } = parseMeetingBody(md);
    expect(sections[0]!.heading).toBe('Discussion');
    expect(sections[0]!.bullets).toHaveLength(4);
    expect(sections.map((s) => s.heading)).toEqual(['Discussion', 'Decisions', 'Tasks', 'Assumptions']);
    expect(stray).toEqual([]);
  });
});

describe('parseMeetingBody', () => {
  it('collects stray lines', () => {
    const { sections, stray } = parseMeetingBody('intro\n## Discussion\n- a\nnot a bullet\n\n- b\n');
    expect(sections).toEqual([{ heading: 'Discussion', bullets: ['a', 'b'] }]);
    expect(stray).toEqual(['intro', 'not a bullet']);
  });
});

describe('loadRepo crlf', () => {
  it('fixture really contains CRLF bytes', () => {
    for (const f of ['team.yaml', 'themes.yaml', 'meetings/2026-11-03.md', 'tasks/T-0001.yaml']) {
      expect(readFileSync(join(fx('crlf'), f)).includes('\r\n')).toBe(true);
    }
  });

  it('loads equal to the LF records', async () => {
    const lf = await loadRepo(fx('basic'));
    const crlf = await loadRepo(fx('crlf'));
    expect(crlf.errors).toEqual([]);
    expect(crlf.data.meetings).toEqual([lf.data.meetings[0]]);
    expect(crlf.data.tasks).toEqual([lf.data.tasks[0]]);
    expect(crlf.data.team).toEqual(lf.data.team);
    expect(crlf.data.themes).toEqual(lf.data.themes);
  });
});

describe('loadRepo errors and empty', () => {
  it('reports a schema error for an unknown key without throwing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ta-load-'));
    try {
      cpSync(fx('basic'), dir, { recursive: true });
      const t = readFileSync(join(dir, 'tasks', 'T-0001.yaml'), 'utf8')
        .replace('id: T-0001', 'id: T-0099')
        .replace('title:', 'surprise: 1\ntitle:');
      writeFileSync(join(dir, 'tasks', 'T-0099.yaml'), t);
      const { data, errors } = await loadRepo(dir);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ rule: 'schema', file: 'data/tasks/T-0099.yaml' });
      expect(data.tasks).toHaveLength(8);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads the empty fixture', async () => {
    const { data, errors } = await loadRepo(fx('empty'));
    expect(errors).toEqual([]);
    expect(data.themes).toEqual([]);
    expect(data.tasks).toEqual([]);
    expect(data.meetings).toEqual([]);
    expect(data.decisions).toEqual([]);
    expect(data.assumptions).toEqual([]);
  });
});

describe('compareMeetingIds', () => {
  it('orders suffixes numerically', () => {
    const ids = ['2026-11-04', '2026-11-03-10', '2026-11-03-2', '2026-11-03'];
    expect(ids.sort(compareMeetingIds)).toEqual([
      '2026-11-03',
      '2026-11-03-2',
      '2026-11-03-10',
      '2026-11-04',
    ]);
  });
});

describe('loadRepoAtRef', () => {
  it('reads data at a ref and returns null for a missing ref', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ta-git-'));
    try {
      const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
      git('init', '-q');
      mkdirSync(join(dir, 'data'));
      cpSync(fx('basic'), join(dir, 'data'), { recursive: true });
      expect(await loadRepoAtRef(dir, 'HEAD')).toBeNull();
      git('add', '.');
      git('-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-q', '-m', 'x');
      const data = await loadRepoAtRef(dir, 'HEAD');
      expect(data).not.toBeNull();
      expect(data!.tasks).toHaveLength(8);
      expect(data!.meetings.map((m) => m.id)).toEqual(['2026-11-03', '2026-11-03-2', '2026-11-06']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

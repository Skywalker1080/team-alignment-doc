import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadRepo } from '../../src/model/load';
import type { RepoData } from '../../src/model/load';
import { checkImmutability, checkRawNotes } from '../../src/validate/immutability';

const fx = (name: string) => join(__dirname, '..', 'fixtures', name);

let basic: RepoData;
beforeAll(async () => {
  basic = (await loadRepo(fx('basic'))).data;
});

const task = (d: RepoData, id: string) => d.tasks.find((t) => t.id === id)!;
const rules = (prev: RepoData, next: RepoData) => checkImmutability(prev, next).map((e) => e.rule);

describe('checkImmutability', () => {
  it('identical data passes', () => {
    expect(checkImmutability(basic, structuredClone(basic))).toEqual([]);
  });

  it('removing a record is deleted', () => {
    const next = structuredClone(basic);
    next.tasks = next.tasks.filter((t) => t.id !== 'T-0003');
    expect(rules(basic, next)).toEqual(['deleted']);
  });

  it('editing history[0].at is append-only', () => {
    const next = structuredClone(basic);
    task(next, 'T-0001').history[0]!.at = '2026-11-03T10:00:00+05:30';
    expect(rules(basic, next)).toEqual(['append-only']);
  });

  it('changing origin is immutable', () => {
    const next = structuredClone(basic);
    task(next, 'T-0001').origin = '2026-11-06';
    expect(rules(basic, next)).toEqual(['immutable']);
  });

  it('changing made is immutable', () => {
    const next = structuredClone(basic);
    next.decisions[0]!.made = '2026-11-06';
    expect(rules(basic, next)).toEqual(['immutable']);
  });

  it('appending one event passes', () => {
    const next = structuredClone(basic);
    task(next, 'T-0001').history.push({ at: '2026-11-10T09:00:00+05:30', by: 'ranjeet', event: 'note', text: 'ok' });
    expect(checkImmutability(basic, next)).toEqual([]);
  });

  it('new records pass', () => {
    const next = structuredClone(basic);
    const t = structuredClone(task(next, 'T-0001'));
    t.id = 'T-0009';
    next.tasks.push(t);
    expect(checkImmutability(basic, next)).toEqual([]);
  });
});

describe('checkRawNotes', () => {
  const root = mkdtempSync(join(tmpdir(), 'ta-raw-'));
  const git = (...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'core.autocrlf=false', ...a], {
      cwd: root,
      stdio: 'pipe',
    });
  const rawFile = join(root, 'data', 'meetings', 'raw', '2026-11-03.md');

  beforeAll(() => {
    mkdirSync(join(root, 'data'), { recursive: true });
    cpSync(fx('basic'), join(root, 'data'), { recursive: true });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('unchanged raw notes pass', async () => {
    expect(await checkRawNotes(root, 'HEAD')).toEqual([]);
  });

  it('missing ref is skipped', async () => {
    expect(await checkRawNotes(root, 'origin/main')).toEqual([]);
  });

  it('edited raw notes fail, then deleted raw notes fail', async () => {
    writeFileSync(rawFile, 'tampered\n');
    expect((await checkRawNotes(root, 'HEAD')).map((e) => e.rule)).toEqual(['raw-notes']);
    rmSync(rawFile);
    const errs = await checkRawNotes(root, 'HEAD');
    expect(errs.map((e) => e.rule)).toEqual(['raw-notes']);
    expect(errs[0]!.file).toBe('data/meetings/raw/2026-11-03.md');
  });
});

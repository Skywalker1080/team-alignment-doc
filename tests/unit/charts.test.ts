import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { loadRepo } from '../../src/model/load';
import type { Task } from '../../src/model/schemas';
import { addDays, countTicks, stackSegments } from '../../dashboard/src/charts/kit';
import { promiseWeeks } from '../../dashboard/src/charts/PromisesChart';
import { timelineRows, timelineWindow } from '../../dashboard/src/charts/TimelineChart';

const TODAY = '2026-11-10';
let tasks: Task[];

beforeAll(async () => {
  const r = await loadRepo(join(__dirname, '..', 'fixtures', 'basic', ''));
  expect(r.errors).toEqual([]);
  tasks = r.data.tasks;
});

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-11-10', -14)).toBe('2026-10-27');
    expect(addDays('2026-11-10', 21)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('stackSegments', () => {
  it('skips zero parts and leaves a 2px gap between the rest', () => {
    const s = stackSegments(
      [
        { key: 'a', value: 1 },
        { key: 'b', value: 0 },
        { key: 'c', value: 1 },
      ],
      2,
      102,
    );
    expect(s.map((x) => x.key)).toEqual(['a', 'c']);
    expect(s[0]).toMatchObject({ x: 0, width: 50 });
    expect(s[1]).toMatchObject({ x: 52, width: 50 });
  });

  it('returns nothing (never NaN) for empty input', () => {
    expect(stackSegments([{ key: 'a', value: 0 }], 0, 300)).toEqual([]);
    expect(stackSegments([], 5, 300)).toEqual([]);
    expect(stackSegments([{ key: 'a', value: 2 }], 4, 0)).toEqual([]);
  });
});

describe('countTicks', () => {
  it('uses unit steps for small counts and covers the max', () => {
    expect(countTicks(0)).toEqual([0]);
    expect(countTicks(2)).toEqual([0, 1, 2]);
    expect(countTicks(9)).toEqual([0, 3, 6, 9]);
    expect(countTicks(10).at(-1)).toBeGreaterThanOrEqual(10);
  });
});

describe('promiseWeeks', () => {
  it('returns the last 8 ISO weeks ending with the current one, gaps filled', () => {
    const w = promiseWeeks(tasks, TODAY);
    expect(w).toHaveLength(8);
    expect(w[0]!.week).toBe('2026-W39');
    expect(w.at(-1)!.week).toBe('2026-W46');
    expect(w.at(-1)!.start).toBe('2026-11-09');
    const w45 = w.find((x) => x.week === '2026-W45')!;
    expect(w45.hard).toEqual({ kept: 1, total: 3, rate: 1 / 3 });
    expect(w45.all).toEqual({ kept: 1, total: 3, rate: 1 / 3 });
    const w46 = w.at(-1)!;
    expect(w46.hard.rate).toBeNull();
    expect(w46.all).toEqual({ kept: 0, total: 1, rate: 0 });
    expect(w[0]!.all).toEqual({ kept: 0, total: 0, rate: null });
  });

  it('is all-empty with no tasks', () => {
    const w = promiseWeeks([], TODAY);
    expect(w).toHaveLength(8);
    expect(w.every((x) => x.all.total === 0 && x.hard.rate === null)).toBe(true);
  });
});

describe('timelineRows', () => {
  it('spans today -14d to +21d', () => {
    expect(timelineWindow(TODAY)).toEqual({ start: '2026-10-27', end: '2026-12-01', days: 36 });
  });

  it('includes open tasks and tasks closed in the last 14 days', () => {
    const rows = timelineRows(tasks, TODAY);
    expect(rows.map((r) => r.task.id).sort()).toEqual([
      'T-0001',
      'T-0002',
      'T-0003',
      'T-0004',
      'T-0005',
      'T-0006',
      'T-0007',
      'T-0008',
    ]);
    const old = timelineRows(tasks, '2026-11-25').map((r) => r.task.id);
    expect(old).not.toContain('T-0003'); // closed 8 Nov, more than 14 days before 25 Nov
    expect(old).toContain('T-0001'); // still open
  });

  it('marks slipped spans from the first deadline to today, or to the close date', () => {
    const rows = timelineRows(tasks, TODAY);
    const by = (id: string) => rows.find((r) => r.task.id === id)!;
    expect(by('T-0001')).toMatchObject({ start: '2026-11-03', end: '2026-11-03', state: 'open' });
    expect(by('T-0001').slip).toEqual({ from: '2026-11-03', to: '2026-11-10' });
    expect(by('T-0003').slip).toEqual({ from: '2026-11-05', to: '2026-11-08' });
    expect(by('T-0003').state).toBe('done');
    expect(by('T-0004').slip).toBeNull(); // due today is not slipped yet
    expect(by('T-0005').slip).toBeNull(); // done before its deadline
    expect(by('T-0006').state).toBe('dropped');
    expect(by('T-0004').start).toBe('2026-11-03'); // origin meeting id 2026-11-03-2 → its date
  });

  it('is empty with no tasks', () => {
    expect(timelineRows([], TODAY)).toEqual([]);
  });
});

describe('Trackers page rendering', () => {
  const render = async (fixture: string) => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { buildBundle } = await import('../../src/bundle/build');
    const { Trackers } = await import('../../dashboard/src/pages/Trackers');
    const r = await loadRepo(join(__dirname, '..', 'fixtures', fixture, ''));
    expect(r.errors).toEqual([]);
    const bundle = buildBundle(r.data, '2026-11-10T03:00:00Z');
    return renderToStaticMarkup(createElement(Trackers, { bundle, today: TODAY }));
  };
  const charts = ['promises', 'timeline', 'carryover', 'workload', 'themes'];

  it('renders every chart with data and no NaN', async () => {
    const html = await render('basic');
    for (const c of charts) expect(html).toContain(`data-chart="${c}"`);
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
    expect(html.match(/<svg/g)!.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain('Build the AWS lead pipeline'); // oldest open task callout
  });

  it('shows an empty state for every chart on an empty repo', async () => {
    const html = await render('empty');
    for (const c of charts) expect(html).toContain(`data-chart="${c}"`);
    expect(html.match(/class="empty"/g)!.length).toBe(5);
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { loadRepo, type RepoData } from '../../src/model/load';
import type { Task, Theme } from '../../src/model/schemas';
import {
  isOpen,
  overdueDays,
  firstDeadline,
  closedOn,
  meetingsSince,
  todayLanes,
} from '../../src/metrics/tasks';
import {
  keptPromises,
  carryoverBuckets,
  workload,
  themeProgress,
  meetingReview,
} from '../../src/metrics/trackers';

const TODAY = '2026-11-10';
const MEMBERS = ['yogesh', 'ranjeet', 'pranav'];
let d: RepoData;
const task = (id: string): Task => d.tasks.find((t) => t.id === id)!;
const meeting = (id: string) => d.meetings.find((m) => m.id === id)!;

beforeAll(async () => {
  const r = await loadRepo(join(__dirname, '..', 'fixtures', 'basic', ''));
  expect(r.errors).toEqual([]);
  d = r.data;
});

describe('task metrics', () => {
  it('isOpen', () => {
    expect(d.tasks.filter(isOpen).map((t) => t.id)).toEqual(['T-0001', 'T-0002', 'T-0004', 'T-0007', 'T-0008']);
  });

  it('overdueDays', () => {
    expect(overdueDays(task('T-0001'), TODAY)).toBe(7);
    expect(overdueDays(task('T-0004'), TODAY)).toBe(0); // due exactly today
    expect(overdueDays(task('T-0003'), TODAY)).toBe(0); // closed
    expect(overdueDays(task('T-0007'), TODAY)).toBe(0); // future
  });

  it('firstDeadline uses the from of the first deadline event', () => {
    expect(firstDeadline(task('T-0003'))).toBe('2026-11-05');
    expect(firstDeadline(task('T-0001'))).toBe('2026-11-03');
  });

  it('closedOn', () => {
    expect(closedOn(task('T-0003'))).toBe('2026-11-08');
    expect(closedOn(task('T-0005'))).toBe('2026-11-06');
    expect(closedOn(task('T-0006'))).toBe('2026-11-07');
    expect(closedOn(task('T-0001'))).toBeNull();
  });

  it('closedOn converts the offset to the IST date', () => {
    const t: Task = {
      ...task('T-0005'),
      history: [
        task('T-0005').history[0]!,
        { at: '2026-11-07T20:00:00Z', by: 'yogesh', event: 'status', from: 'todo', to: 'done' },
      ],
    };
    expect(closedOn(t)).toBe('2026-11-08');
  });

  it('meetingsSince counts later meetings up to today', () => {
    expect(meetingsSince(task('T-0001'), d.meetings, TODAY)).toBe(2);
    expect(meetingsSince(task('T-0004'), d.meetings, TODAY)).toBe(1);
    expect(meetingsSince(task('T-0008'), d.meetings, TODAY)).toBe(0);
    expect(meetingsSince(task('T-0001'), d.meetings, '2026-11-05')).toBe(1);
  });

  it('todayLanes', () => {
    const lanes = todayLanes(d.tasks, MEMBERS, d.meetings, TODAY);
    expect(lanes.map((l) => l.owner)).toEqual(['yogesh', 'ranjeet', 'pranav', 'anyone']);
    expect(lanes.map((l) => l.tasks.map((t) => t.id))).toEqual([
      [],
      ['T-0001'],
      ['T-0008', 'T-0002'], // same overdue, p0 before p1
      ['T-0004'],
    ]);
    const t1 = lanes[1]!.tasks[0]!;
    expect([t1.overdue, t1.ageDays, t1.meetingsSince]).toEqual([7, 7, 2]);
    const t8 = lanes[2]!.tasks[0]!;
    expect([t8.overdue, t8.ageDays, t8.meetingsSince]).toEqual([0, 4, 0]);
    const t4 = lanes[3]!.tasks[0]!;
    expect([t4.overdue, t4.ageDays, t4.meetingsSince]).toEqual([0, 7, 1]);
  });
});

describe('tracker metrics', () => {
  it('keptPromises', () => {
    const r = keptPromises(d.tasks, TODAY);
    expect(r.map((w) => w.week)).toEqual(['2026-W45', '2026-W46']);
    // W45: T-0001 (open), T-0003 (moved deadline, closed 11-08 > 11-05), T-0005 (kept); all hard
    expect(r[0]!.hard.kept).toBe(1);
    expect(r[0]!.hard.total).toBe(3);
    expect(r[0]!.hard.rate).toBeCloseTo(1 / 3);
    expect(r[0]!.all.kept).toBe(1);
    expect(r[0]!.all.total).toBe(3);
    // W46: only T-0004 (soft, open)
    expect(r[1]!.hard).toEqual({ kept: 0, total: 0, rate: null });
    expect(r[1]!.all).toEqual({ kept: 0, total: 1, rate: 0 });
  });

  it('keptPromises ignores weeks whose first deadline is in the future', () => {
    expect(keptPromises(d.tasks, '2026-11-04')).toEqual([
      {
        week: '2026-W45',
        hard: { kept: 0, total: 1, rate: 0 },
        all: { kept: 0, total: 1, rate: 0 },
      },
    ]);
  });

  it('carryoverBuckets', () => {
    expect(carryoverBuckets(d.tasks, d.meetings, TODAY)).toEqual({
      onTime: 2, // T-0007, T-0008
      carried1: 1, // T-0004
      carried2plus: 2, // T-0001, T-0002
      oldest: { id: 'T-0001', ageDays: 7 }, // ties with T-0002, T-0004: lowest id
    });
  });

  it('workload', () => {
    expect(workload(d.tasks, MEMBERS)).toEqual([
      { owner: 'yogesh', p0: 0, p1: 1, p2: 0, total: 1 },
      { owner: 'ranjeet', p0: 1, p1: 0, p2: 0, total: 1 },
      { owner: 'pranav', p0: 1, p1: 1, p2: 0, total: 2 },
      { owner: 'anyone', p0: 0, p1: 0, p2: 1, total: 1 },
    ]);
  });

  it('themeProgress', () => {
    const r = themeProgress(d.tasks, d.themes, TODAY);
    expect(r.map((x) => [x.theme.id, x.done, x.open, x.archived])).toEqual([
      ['outreach', 0, 2, false],
      ['lead-generation', 1, 2, false],
      ['team-process', 1, 1, false],
    ]);
    expect(r[0]!.rate).toBe(0);
    expect(r[1]!.rate).toBeCloseTo(1 / 3);
    expect(r[2]!.rate).toBe(0.5);
  });

  it('themeProgress archives a quiet theme with no open tasks', () => {
    const themes: Theme[] = [{ id: 'old', name: 'Old', created: '2026-10-01' }];
    const t: Task = {
      ...task('T-0005'),
      theme: 'old',
      history: [
        { at: '2026-10-01T10:00:00+05:30', by: 'yogesh', event: 'created' },
        { at: '2026-10-05T10:00:00+05:30', by: 'yogesh', event: 'status', from: 'todo', to: 'done' },
      ],
    };
    expect(themeProgress([t], themes, TODAY)).toEqual([
      { theme: themes[0], done: 1, open: 0, rate: 1, archived: true },
    ]);
    // an event 13 days ago keeps it active
    const recent: Task = {
      ...t,
      history: [t.history[0]!, { ...t.history[1]!, at: '2026-10-28T10:00:00+05:30' }],
    };
    expect(themeProgress([recent], themes, TODAY)[0]!.archived).toBe(false);
  });

  it('meetingReview of 2026-11-03-2 with prev 2026-11-03', () => {
    // window (11-03, 11-03] is empty; nothing was due before 11-03
    expect(meetingReview(meeting('2026-11-03-2'), meeting('2026-11-03'), d.tasks)).toEqual({
      done: [],
      dropped: [],
      slipped: [],
    });
  });

  it('meetingReview of 2026-11-06 with prev 2026-11-03-2', () => {
    expect(meetingReview(meeting('2026-11-06'), meeting('2026-11-03-2'), d.tasks)).toEqual({
      done: ['T-0005'],
      dropped: [],
      slipped: ['T-0001'],
    });
  });

  it('meetingReview of a later meeting sees done, dropped and slipped', () => {
    const later = { ...meeting('2026-11-06'), id: '2026-11-10', date: '2026-11-10' };
    expect(meetingReview(later, meeting('2026-11-06'), d.tasks)).toEqual({
      done: ['T-0003'],
      dropped: ['T-0006'],
      slipped: ['T-0001'],
    });
  });

  it('meetingReview without a prev meeting has an open-ended window', () => {
    const later = { ...meeting('2026-11-06'), id: '2026-11-10', date: '2026-11-10' };
    expect(meetingReview(later, null, d.tasks)).toEqual({
      done: ['T-0003', 'T-0005'],
      dropped: ['T-0006'],
      slipped: ['T-0001'],
    });
  });
});

describe('empty inputs', () => {
  it('return empty or zero values without NaN', () => {
    expect(todayLanes([], MEMBERS, [], TODAY)).toEqual([
      { owner: 'yogesh', tasks: [] },
      { owner: 'ranjeet', tasks: [] },
      { owner: 'pranav', tasks: [] },
      { owner: 'anyone', tasks: [] },
    ]);
    expect(keptPromises([], TODAY)).toEqual([]);
    expect(carryoverBuckets([], [], TODAY)).toEqual({
      onTime: 0,
      carried1: 0,
      carried2plus: 0,
      oldest: null,
    });
    expect(workload([], MEMBERS)).toEqual([
      { owner: 'yogesh', p0: 0, p1: 0, p2: 0, total: 0 },
      { owner: 'ranjeet', p0: 0, p1: 0, p2: 0, total: 0 },
      { owner: 'pranav', p0: 0, p1: 0, p2: 0, total: 0 },
      { owner: 'anyone', p0: 0, p1: 0, p2: 0, total: 0 },
    ]);
    const themes: Theme[] = [{ id: 'x', name: 'X', created: '2026-11-03' }];
    expect(themeProgress([], themes, TODAY)).toEqual([
      { theme: themes[0], done: 0, open: 0, rate: null, archived: false },
    ]);
    expect(themeProgress([], [], TODAY)).toEqual([]);
    expect(meetingReview(meeting('2026-11-06'), null, [])).toEqual({ done: [], dropped: [], slipped: [] });
  });
});

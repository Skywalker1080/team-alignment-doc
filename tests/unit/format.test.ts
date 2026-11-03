import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { loadRepo } from '../../src/model/load';
import { buildBundle, type DashboardBundle } from '../../src/bundle/build';
import { todayLanes, type LaneTask } from '../../src/metrics/tasks';
import { originBadge, shortDate, fullName, historyText } from '../../dashboard/src/format';

const TODAY = '2026-11-10';
let bundle: DashboardBundle;
let lane: LaneTask[];
const laneTask = (id: string): LaneTask => lane.find((t) => t.id === id)!;

beforeAll(async () => {
  const r = await loadRepo(join(__dirname, '..', 'fixtures', 'basic', ''));
  expect(r.errors).toEqual([]);
  bundle = buildBundle(r.data, '2026-11-10T03:00:00Z');
  lane = todayLanes(r.data.tasks, ['yogesh', 'ranjeet', 'pranav'], r.data.meetings, TODAY).flatMap(
    (l) => l.tasks,
  );
});

describe('shortDate', () => {
  it('formats a date as day and short month', () => {
    expect(shortDate('2026-11-03')).toBe('3 Nov');
    expect(shortDate('2026-01-21')).toBe('21 Jan');
  });
});

describe('originBadge', () => {
  it('shows origin and days overdue', () => {
    expect(originBadge(laneTask('T-0001'), TODAY)).toBe('from 3 Nov · 7d overdue');
  });

  it('shows origin and due today', () => {
    expect(originBadge(laneTask('T-0004'), TODAY)).toBe('from 3 Nov · due today');
  });

  it('uses the date part of a suffixed meeting id and names a near deadline by weekday', () => {
    const t: LaneTask = { ...laneTask('T-0004'), origin: '2026-11-03-2', deadline: { date: '2026-11-12', kind: 'soft' } };
    expect(originBadge(t, TODAY)).toBe('from 3 Nov · due Thu');
  });

  it('says tomorrow for a deadline one day out', () => {
    const t: LaneTask = { ...laneTask('T-0004'), deadline: { date: '2026-11-11', kind: 'soft' } };
    expect(originBadge(t, TODAY)).toBe('from 3 Nov · due tomorrow');
  });

  it('drops the origin when the task was created today', () => {
    const t: LaneTask = { ...laneTask('T-0004'), origin: TODAY, deadline: { date: '2026-11-12', kind: 'soft' } };
    expect(originBadge(t, TODAY)).toBe('due Thu');
  });

  it('shows a far deadline as a date', () => {
    const t: LaneTask = { ...laneTask('T-0004'), deadline: { date: '2026-11-24', kind: 'hard' } };
    expect(originBadge(t, TODAY)).toBe('from 3 Nov · due 24 Nov');
  });
});

describe('fullName', () => {
  it('maps member ids to full names and anyone to Anyone', () => {
    expect(fullName(bundle, 'ranjeet')).toBe('Ranjeet Ratan');
    expect(fullName(bundle, 'anyone')).toBe('Anyone');
  });

  it('falls back to the id for an unknown owner', () => {
    expect(fullName(bundle, 'ghost')).toBe('ghost');
  });
});

describe('historyText', () => {
  it('describes created, deadline and status events in plain words', () => {
    const t3 = bundle.tasks.find((t) => t.id === 'T-0003')!;
    const lines = t3.history.map((h) => historyText(bundle, h));
    expect(lines[0]).toBe('Created by Ranjeet');
    expect(lines).toContain('Ranjeet moved the deadline from 5 Nov to 9 Nov: Rate limits forced a slower export.');
    expect(lines).toContain('Ranjeet set it to done');
  });
});

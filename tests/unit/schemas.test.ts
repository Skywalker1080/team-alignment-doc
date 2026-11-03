import { describe, it, expect } from 'vitest';
import { TaskSchema, MeetingFrontSchema, HistoryEventSchema } from '../../src/model/schemas';

const t0042 = {
  id: 'T-0042',
  title: 'Build the AWS lead pipeline',
  description:
    'Scrape Product Hunt, YC, LinkedIn and X into one DB, filter by ICP, outreach the next day.',
  owner: 'ranjeet',
  priority: 'p0',
  theme: 'lead-generation',
  deadline: { date: '2026-11-05', kind: 'hard' },
  status: 'todo',
  origin: '2026-11-03',
  history: [
    { at: '2026-11-03T18:20:00+05:30', by: 'yogesh', event: 'created' },
    { at: '2026-11-04T10:02:00+05:30', by: 'ranjeet', event: 'status', to: 'doing' },
    {
      at: '2026-11-04T16:40:00+05:30',
      by: 'ranjeet',
      event: 'note',
      text: 'API rate limits on X, switching to manual export for now.',
    },
    {
      at: '2026-11-04T16:41:00+05:30',
      by: 'ranjeet',
      event: 'deadline',
      from: '2026-11-05',
      to: '2026-11-07',
    },
  ],
};

describe('TaskSchema', () => {
  it('accepts the spec T-0042 example', () => {
    expect(TaskSchema.safeParse(t0042).success).toBe(true);
  });

  it.each([
    ['priority p3', { ...t0042, priority: 'p3' }],
    ['deadline kind firm', { ...t0042, deadline: { date: '2026-11-05', kind: 'firm' } }],
    ['status cancelled', { ...t0042, status: 'cancelled' }],
    ['id T-42', { ...t0042, id: 'T-42' }],
  ])('rejects %s', (_name, value) => {
    expect(TaskSchema.safeParse(value).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(TaskSchema.safeParse({ ...t0042, extra: 1 }).success).toBe(false);
  });
});

describe('MeetingFrontSchema', () => {
  it('fills in [] for missing arrays', () => {
    const m = MeetingFrontSchema.parse({
      id: '2026-11-03',
      date: '2026-11-03',
      attendees: ['yogesh', 'ranjeet', 'pranav'],
      notes_by: 'pranav',
      raw: 'raw/2026-11-03.md',
    });
    expect(m.tasks_created).toEqual([]);
    expect(m.decisions_made).toEqual([]);
    expect(m.assumptions_made).toEqual([]);
  });
});

describe('HistoryEventSchema', () => {
  it('rejects an at with no offset', () => {
    const r = HistoryEventSchema.safeParse({
      at: '2026-11-03T10:00:00',
      by: 'yogesh',
      event: 'created',
    });
    expect(r.success).toBe(false);
  });
});

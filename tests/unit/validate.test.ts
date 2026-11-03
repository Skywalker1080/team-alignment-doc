import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { loadRepo } from '../../src/model/load';
import type { RepoData } from '../../src/model/load';
import { validateRepo } from '../../src/validate/rules';

const fx = (name: string) => join(__dirname, '..', 'fixtures', name);

let basic: RepoData;
beforeAll(async () => {
  basic = (await loadRepo(fx('basic'))).data;
});

/** Clone basic, apply one breaking change, and expect exactly one error with `rule`. */
function breaks(rule: string, mutate: (d: RepoData) => void) {
  const d = structuredClone(basic);
  mutate(d);
  expect(validateRepo(d).map((e) => e.rule)).toEqual([rule]);
}

const task = (d: RepoData, id: string) => d.tasks.find((t) => t.id === id)!;
const decision = (d: RepoData, id: string) => d.decisions.find((x) => x.id === id)!;

describe('validateRepo', () => {
  it('basic fixture is valid', () => {
    expect(validateRepo(basic)).toEqual([]);
  });

  it('empty repo is valid', async () => {
    const { data, errors } = await loadRepo(fx('empty'));
    expect(errors).toEqual([]);
    expect(validateRepo(data)).toEqual([]);
  });

  it('id-file', () =>
    breaks('id-file', (d) => {
      d.recordFiles.find((r) => r.id === 'T-0001')!.file = 'data/tasks/T-9999.yaml';
    }));

  it('id-unique', () =>
    breaks('id-unique', (d) => {
      d.tasks.push(structuredClone(task(d, 'T-0001')));
    }));

  it('owner: unknown owner', () =>
    breaks('owner', (d) => {
      task(d, 'T-0002').owner = 'nobody';
    }));

  it('owner: history by must be a member', () =>
    breaks('owner', (d) => {
      task(d, 'T-0002').history[0]!.by = 'ghost';
    }));

  it('theme', () =>
    breaks('theme', (d) => {
      task(d, 'T-0002').theme = 'nope';
    }));

  it('origin', () =>
    breaks('origin', (d) => {
      const t = structuredClone(task(d, 'T-0001'));
      t.id = 'T-0009';
      t.origin = '2026-12-01';
      d.tasks.push(t);
    }));

  it('meeting-refs', () =>
    breaks('meeting-refs', (d) => {
      d.meetings[0]!.tasks_created.push('T-0099');
    }));

  it('sections: 5 bullets', () =>
    breaks('sections', (d) => {
      d.meetings[0]!.sections.find((x) => x.heading === 'Decisions')!.bullets = ['a', 'b', 'c', 'd', 'e'];
    }));

  it('sections: unknown heading', () =>
    breaks('sections', (d) => {
      d.meetings[0]!.sections.push({ heading: 'Risks', bullets: ['x'] });
    }));

  it('sections: missing Discussion', () =>
    breaks('sections', (d) => {
      d.meetings[0]!.sections = d.meetings[0]!.sections.filter((s) => s.heading !== 'Discussion');
    }));

  it('sections: stray text', () =>
    breaks('sections', (d) => {
      d.meetings[0]!.stray = ['loose line'];
    }));

  it('history-first', () =>
    breaks('history-first', (d) => {
      task(d, 'T-0002').history[0]!.event = 'note';
    }));

  it('history-order', () =>
    breaks('history-order', (d) => {
      task(d, 'T-0002').history[1]!.at = '2026-11-01T00:00:00+05:30';
    }));

  it('status-history: done without status event', () =>
    breaks('status-history', (d) => {
      const t = task(d, 'T-0005');
      t.history = [t.history[0]!];
    }));

  it('status-history: dropped without reason', () =>
    breaks('status-history', (d) => {
      delete task(d, 'T-0006').history.at(-1)!.text;
    }));

  it('superseded: missing target', () =>
    breaks('superseded', (d) => {
      decision(d, 'D-0001').superseded_by = 'D-0009';
    }));

  it('superseded: status without superseded_by', () =>
    breaks('superseded', (d) => {
      decision(d, 'D-0002').status = 'superseded';
    }));

  it('attendees', () =>
    breaks('attendees', (d) => {
      d.meetings[0]!.attendees.push('ghost');
    }));

  it('attendees: notes_by', () =>
    breaks('attendees', (d) => {
      d.meetings[0]!.notes_by = 'ghost';
    }));

  it('no-email: task description', () =>
    breaks('no-email', (d) => {
      task(d, 'T-0002').description = 'mail ranjeet@x.com';
    }));

  it('no-email: meeting bullet', () =>
    breaks('no-email', (d) => {
      d.meetings[0]!.sections[0]!.bullets[0] = 'write to a@b.io';
    }));

  it('date-valid: deadline date', () =>
    breaks('date-valid', (d) => {
      task(d, 'T-0001').deadline.date = '2026-02-30';
    }));

  it('date-valid: history timestamp', () =>
    breaks('date-valid', (d) => {
      task(d, 'T-0002').history[1]!.at = '2026-13-45T10:00:00+05:30';
    }));

  it('date-valid: theme created', () =>
    breaks('date-valid', (d) => {
      d.themes[0]!.created = '2026-13-01';
    }));
});

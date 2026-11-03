import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadRepo } from '../../src/model/load';

const TODAY = '2026-11-10';

const render = async (fixture: string, page: 'Decisions' | 'Assumptions' | 'Meetings' | 'Tasks') => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildBundle } = await import('../../src/bundle/build');
  const r = await loadRepo(join(__dirname, '..', 'fixtures', fixture, ''));
  expect(r.errors).toEqual([]);
  const bundle = buildBundle(r.data, '2026-11-10T03:00:00Z');
  const loaders = {
    Decisions: async () => (await import('../../dashboard/src/pages/Decisions')).Decisions,
    Assumptions: async () => (await import('../../dashboard/src/pages/Assumptions')).Assumptions,
    Meetings: async () => (await import('../../dashboard/src/pages/Meetings')).Meetings,
    Tasks: async () => (await import('../../dashboard/src/pages/Tasks')).Tasks,
  };
  const Page = (await loaders[page]()) as React.ComponentType<{ bundle: typeof bundle; today: string }>;
  return renderToStaticMarkup(createElement(Page, { bundle, today: TODAY }));
};

const pages = ['Decisions', 'Assumptions', 'Meetings', 'Tasks'] as const;

describe('record pages', () => {
  it('render fixture data with data-id and no NaN', async () => {
    const decisions = await render('basic', 'Decisions');
    expect(decisions).toContain('data-id="D-0001"');
    expect(decisions).toContain('→ D-0002');
    expect(decisions.indexOf('D-0002')).toBeLessThan(decisions.indexOf('data-id="D-0001"'));

    const assumptions = await render('basic', 'Assumptions');
    expect(assumptions).toContain('data-id="A-0001"');
    expect(assumptions).toMatch(/7d untested/);

    const meetings = await render('basic', 'Meetings');
    expect(meetings).toContain('data-id="2026-11-06"');
    expect(meetings).toContain('Since last meeting');

    const tasks = await render('basic', 'Tasks');
    expect(tasks).toContain('data-id="T-0001"');

    for (const html of [decisions, assumptions, meetings, tasks]) expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });

  it.each(pages)('%s renders an empty state on an empty repo', async (page) => {
    const html = await render('empty', page);
    expect(html).toContain('class="empty"');
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
  });
});

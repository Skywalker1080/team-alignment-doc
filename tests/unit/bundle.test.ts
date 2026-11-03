import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadRepo } from '../../src/model/load';
import { buildBundle } from '../../src/bundle/build';

const fx = (name: string) => join(__dirname, '..', 'fixtures', name);

describe('buildBundle', () => {
  it('strips emails, file paths and stray text', async () => {
    const { data } = await loadRepo(fx('basic'));
    const bundle = buildBundle(data, '2026-11-10T00:00:00.000Z');
    expect(bundle.builtAt).toBe('2026-11-10T00:00:00.000Z');
    expect(bundle.team[1]).toEqual({ id: 'ranjeet', name: 'Ranjeet Ratan', first: 'Ranjeet' });
    expect(bundle.tasks).toHaveLength(8);
    expect(bundle.meetings).toHaveLength(3);
    expect(bundle.meetings[0]).not.toHaveProperty('file');
    expect(bundle.meetings[0]).not.toHaveProperty('stray');
    const json = JSON.stringify(bundle);
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/recordFiles|fileOf|"file"|data\//);
  });
});

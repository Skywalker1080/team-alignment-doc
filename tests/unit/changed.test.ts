import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { changedRecords, dataDirPrefix } from '../../src/check/changed';

const repo = join(__dirname, '..', '..');
const files = [
  'data/tasks/T-0042.yaml',
  'data/meetings/2026-11-03.md',
  'data/meetings/raw/2026-11-03.md',
  'data/themes.yaml',
  'README.md',
];

describe('dataDirPrefix', () => {
  it('normalises ./data, data/, data and an absolute path to the same prefix', () => {
    for (const d of ['data', './data', 'data/', join(repo, 'data')]) {
      expect(dataDirPrefix(repo, d, repo)).toBe('data/');
    }
  });

  it('resolves a relative dir against cwd, not the repo root', () => {
    expect(dataDirPrefix(repo, 'basic', join(repo, 'tests', 'fixtures'))).toBe('tests/fixtures/basic/');
  });
});

describe('changedRecords', () => {
  it('finds records whatever spelling of the data dir is used', () => {
    for (const d of ['data', './data', 'data/', join(repo, 'data')]) {
      const r = changedRecords(files, repo, d, repo);
      expect(r.changed).toEqual([
        { id: 'T-0042', kind: 'tasks' },
        { id: '2026-11-03', kind: 'meetings' },
      ]);
      expect(r.configChanged).toBe(true);
    }
  });

  it('accepts backslash file names and a nested data dir', () => {
    const r = changedRecords(['tests\\fixtures\\basic\\decisions\\D-0002.yaml'], repo, 'tests/fixtures/basic/', repo);
    expect(r.changed).toEqual([{ id: 'D-0002', kind: 'decisions' }]);
    expect(r.configChanged).toBe(false);
  });

  it('ignores files outside the data dir', () => {
    expect(changedRecords(['other/tasks/T-0001.yaml'], repo, 'data', repo).changed).toEqual([]);
  });
});

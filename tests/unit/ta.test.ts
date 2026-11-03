import { describe, it, expect } from 'vitest';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { formatToday, nextId, nowIst, resolveMember } from '../../scripts/ta';
import { loadRepo } from '../../src/model/load';
import type { Team } from '../../src/model/schemas';

const root = join(__dirname, '..', '..');
const fx = (name: string) => join(__dirname, '..', 'fixtures', name);

const team: Team = {
  members: [
    { id: 'yogesh', name: 'Yogesh Sahu', emails: ['yogesh.sahu@cryptoprism.io'] },
    { id: 'ranjeet', name: 'Ranjeet Ratan', emails: ['rratanranjeet790395@gmail.com'] },
    { id: 'pranav', name: 'Pranav Darekar', emails: ['pranav.darekar1080@gmail.com'] },
  ],
};

describe('nextId', () => {
  it('is one above the highest existing id of that kind', () => {
    expect(nextId('T', ['T-0001', 'T-0007'])).toBe('T-0008');
  });

  it('starts at 0001 when there are none', () => {
    expect(nextId('D', [])).toBe('D-0001');
  });

  it('ignores ids of other kinds', () => {
    expect(nextId('A', ['T-0009', 'A-0002', 'D-0004'])).toBe('A-0003');
  });
});

describe('resolveMember', () => {
  it('matches a team email case-insensitively', () => {
    expect(resolveMember('Pranav.Darekar1080@gmail.com', team)).toBe('pranav');
  });

  it('ignores surrounding whitespace', () => {
    expect(resolveMember('  yogesh.sahu@cryptoprism.io\n', team)).toBe('yogesh');
  });

  it('returns null for an unknown email', () => {
    expect(resolveMember('someone@else.test', team)).toBeNull();
  });
});

describe('nowIst', () => {
  it('prints the instant in IST with offset, to the second', () => {
    expect(nowIst(new Date('2026-11-03T12:50:00Z'))).toBe('2026-11-03T18:20:00+05:30');
  });

  it('rolls the date over at IST midnight', () => {
    expect(nowIst(new Date('2026-11-03T18:45:07Z'))).toBe('2026-11-04T00:15:07+05:30');
  });
});

describe('formatToday', () => {
  it('groups open tasks by lane with priority, deadline kind and origin badge', async () => {
    const { data } = await loadRepo(fx('basic'));
    const out = formatToday(data, '2026-11-10');
    expect(out).toBe(
      [
        'Today, 2026-11-10',
        '',
        'Yogesh',
        '  nothing due',
        '',
        'Ranjeet',
        '  T-0001  Build the AWS lead pipeline  p0  ◆ hard 2026-11-03  from 3 Nov · 7d overdue',
        '',
        'Pranav',
        '  T-0008  Send the first outreach batch  p0  ○ soft 2026-11-11  doing  from 6 Nov · due tomorrow',
        '  T-0002  Draft the outreach target list  p1  ○ soft 2026-11-12  doing  from 3 Nov · due Thu',
        '',
        'Anyone',
        '  T-0004  Clean up the weekly notes  p2  ○ soft 2026-11-10  from 3 Nov · due today',
        '',
      ].join('\n'),
    );
  });
});

describe('ta CLI', () => {
  const ta = (args: string[], env: Record<string, string> = {}) =>
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/ta.ts', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

  it('next-id reads the data dir', () => {
    expect(ta(['next-id', 'T'], { TA_DATA_DIR: fx('basic') }).trim()).toBe('T-0009');
    expect(ta(['next-id', 'A'], { TA_DATA_DIR: fx('basic') }).trim()).toBe('A-0003');
  });

  it('whoami reads only team.yaml, so broken data elsewhere does not block it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ta-whoami-'));
    cpSync(fx('basic'), dir, { recursive: true });
    writeFileSync(join(dir, 'tasks', 'T-0001.yaml'), 'id: [broken');
    writeFileSync(join(dir, 'stray.txt'), 'unknown file');
    const gitEmail = (email: string) => ({
      TA_DATA_DIR: dir,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.email',
      GIT_CONFIG_VALUE_0: email,
    });
    expect(ta(['whoami'], gitEmail('Ranjeet@Example.test')).trim()).toBe('ranjeet');
    expect(() => ta(['whoami'], gitEmail('nobody@example.test'))).toThrow(/unknown git email/);
  });

  it('now prints an IST timestamp', () => {
    expect(ta(['now']).trim()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/);
  });
});

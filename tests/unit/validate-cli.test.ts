import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = join(__dirname, '..', '..');
const tmp = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const configure = (cwd: string, name: string) => {
  git(cwd, 'config', 'user.email', `${name}@example.com`);
  git(cwd, 'config', 'user.name', name);
  git(cwd, 'config', 'core.autocrlf', 'false');
};
const write = (cwd: string, rel: string, text: string) => {
  mkdirSync(join(cwd, rel, '..'), { recursive: true });
  writeFileSync(join(cwd, rel), text);
};
const append = (cwd: string, rel: string, text: string) =>
  writeFileSync(join(cwd, rel), readFileSync(join(cwd, rel), 'utf8') + text);

/** Runs the validate CLI in `cwd`; returns the exit code and combined output. */
function validate(cwd: string, ...args: string[]) {
  const env = { ...process.env };
  delete env.TA_DATA_DIR;
  const r = spawnSync(
    process.execPath,
    [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'src', 'validate', 'cli.ts'), ...args],
    { cwd, encoding: 'utf8', env },
  );
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const taskYaml = (id: string, title: string, origin: string) =>
  `id: ${id}\ntitle: ${title}\ndescription: ""\nowner: anyone\npriority: p1\ntheme: ops\n` +
  `deadline:\n  date: 2026-11-20\n  kind: soft\nstatus: todo\norigin: ${origin}\nhistory:\n` +
  `  - at: 2026-11-04T10:00:00+05:30\n    by: ana\n    event: created\n`;
const note = (at: string, text: string) => `  - at: ${at}\n    by: ana\n    event: note\n    text: ${text}\n`;
const meetingMd = (id: string, taskIds: string[]) =>
  `---\nid: ${id}\ndate: ${id}\nattendees: [ana]\nnotes_by: ana\nraw: raw/${id}.md\ntasks_created: [${taskIds.join(', ')}]\n---\n\n` +
  `## Discussion\n- Talked about the work.\n`;

/** Bare origin plus a seeded main with T-0008; returns two clones. */
function setup() {
  const base = tmp('ta-validate-git-');
  const origin = join(base, 'origin.git');
  execFileSync('git', ['init', '--bare', '-b', 'main', origin], { stdio: 'ignore' });
  const seed = join(base, 'seed');
  execFileSync('git', ['init', '-b', 'main', seed], { stdio: 'ignore' });
  configure(seed, 'seed');
  write(seed, 'data/team.yaml', 'members:\n  - id: ana\n    name: Ana Test\n    emails: [ana@example.com]\n');
  write(seed, 'data/themes.yaml', 'themes:\n  - id: ops\n    name: Ops\n    created: 2026-11-01\n');
  for (const d of ['tasks', 'decisions', 'assumptions', 'meetings/raw']) write(seed, `data/${d}/.gitkeep`, '');
  write(seed, 'data/tasks/T-0008.yaml', taskYaml('T-0008', 'Shared task', '2026-11-01'));
  write(seed, 'data/meetings/2026-11-01.md', meetingMd('2026-11-01', ['T-0008']));
  write(seed, 'data/meetings/raw/2026-11-01.md', 'raw\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', origin);
  git(seed, 'push', 'origin', 'main');
  const clone = (name: string) => {
    const dir = join(base, name);
    execFileSync('git', ['clone', '-c', 'core.autocrlf=false', origin, dir], { stdio: 'ignore' });
    configure(dir, name);
    return dir;
  };
  return { a: clone('a'), b: clone('b') };
}

/** B pushes a new task (with its meeting) and a history append to the shared T-0008. */
function teammatePushes(b: string) {
  write(b, 'data/tasks/T-0009.yaml', taskYaml('T-0009', 'Remote task', '2026-11-05'));
  write(b, 'data/meetings/2026-11-05.md', meetingMd('2026-11-05', ['T-0009']));
  write(b, 'data/meetings/raw/2026-11-05.md', 'raw b\n');
  append(b, 'data/tasks/T-0008.yaml', note('2026-11-05T09:00:00+05:30', 'From b.'));
  git(b, 'add', '-A');
  git(b, 'commit', '-m', 'T-0009 and T-0008 note from b');
  git(b, 'push', 'origin', 'main');
}

describe('validate CLI against git refs', () => {
  it('passes when the branch is behind origin/main with local edits, and still catches violations', () => {
    const { a, b } = setup();
    teammatePushes(b);

    // A has its own local edit (a note on the shared task), then fetches (CLAUDE.md §4 step 6).
    append(a, 'data/tasks/T-0008.yaml', note('2026-11-04T12:00:00+05:30', 'From a.'));
    git(a, 'fetch', 'origin');
    const ok = validate(a);
    expect(ok.out).toContain('data valid');
    expect(ok.code).toBe(0);

    // Committing (pre-commit hook path) leaves HEAD behind origin/main too.
    git(a, 'commit', '-am', 'T-0008 note from a');
    expect(validate(a).code).toBe(0);

    // A genuine violation: editing an existing history entry still fails.
    const file = join(a, 'data/tasks/T-0008.yaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace('2026-11-04T10:00:00+05:30', '2026-11-04T10:30:00+05:30'));
    const bad = validate(a);
    expect(bad.code).toBe(1);
    expect(bad.out).toContain('[append-only]');
  }, 60_000);

  it('still compares against origin/main when it is an ancestor of HEAD', () => {
    const { a, b } = setup();
    teammatePushes(b);
    git(a, 'fetch', 'origin');
    git(a, 'rebase', 'origin/main');
    // Rewriting B's appended entry is caught (HEAD and origin/main both contain it).
    const file = join(a, 'data/tasks/T-0008.yaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace('From b.', 'Changed.'));
    const bad = validate(a);
    expect(bad.code).toBe(1);
    expect(bad.out).toContain('[append-only]');
  }, 60_000);

  it('fails with a clear error when an explicit --base cannot be resolved', () => {
    const { a } = setup();
    const r = validate(a, '--base', 'no-such-ref');
    expect(r.code).toBe(1);
    expect(r.out).toContain('--base no-such-ref');
    expect(r.out).toMatch(/cannot be resolved/);
  }, 60_000);

  it('accepts an explicit --base that resolves', () => {
    const { a } = setup();
    const r = validate(a, '--base', 'HEAD');
    expect(r.code).toBe(0);
  }, 60_000);
});

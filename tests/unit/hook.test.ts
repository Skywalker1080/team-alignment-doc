import { describe, it, expect } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(__dirname, '..', '..');
const fx = (name: string) => join(__dirname, '..', 'fixtures', name);

function runHook(input: unknown, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/hook-validate.ts'], {
    cwd: root,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

/** The basic fixture with a five-bullet Discussion section. */
function brokenSectionsFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ta-hook-'));
  cpSync(fx('basic'), dir, { recursive: true });
  const file = join(dir, 'meetings', '2026-11-06.md');
  const text = readFileSync(file, 'utf8').replace(
    '## Discussion\n',
    '## Discussion\n- one\n- two\n- three\n- four\n',
  );
  writeFileSync(file, text);
  return dir;
}

describe('hook-validate', () => {
  it('exits 0 for a file outside data/', () => {
    const r = runHook({ tool_input: { file_path: 'C:\\x\\README.md' } });
    expect(r.status).toBe(0);
  });

  it('exits 0 for input without a file path', () => {
    expect(runHook({ tool_input: { command: 'ls' } }).status).toBe(0);
    expect(runHook('not json').status).toBe(0);
  });

  it('exits 2 with the validator errors for a data/ file when the data is broken', () => {
    const r = runHook(
      { tool_input: { file_path: join(root, 'data', 'meetings', '2026-11-06.md') } },
      { TA_DATA_DIR: brokenSectionsFixture() },
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('[sections]');
  });

  it('accepts a relative data/ path with backslashes', () => {
    const r = runHook(
      { tool_input: { file_path: 'data\\meetings\\2026-11-06.md' } },
      { TA_DATA_DIR: brokenSectionsFixture() },
    );
    expect(r.status).toBe(2);
  });

  const hasSh = spawnSync('sh', ['-c', 'exit 0']).status === 0;
  it.skipIf(!hasSh)('settings.json hook command works from any cwd via CLAUDE_PROJECT_DIR', () => {
    const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
    const command: string = settings.hooks.PostToolUse[0].hooks[0].command;
    expect(command).toContain('"$CLAUDE_PROJECT_DIR"');
    const r = spawnSync('sh', ['-c', command], {
      cwd: tmpdir(),
      input: JSON.stringify({ tool_input: { file_path: join(root, 'data', 'meetings', '2026-11-06.md') } }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: root, TA_DATA_DIR: brokenSectionsFixture() },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('[sections]');
  });

  it('exits 0 for a data/ file when the data is valid', () => {
    const r = runHook(
      { tool_input: { file_path: join(root, 'data', 'tasks', 'T-0001.yaml') } },
      { TA_DATA_DIR: fx('basic') },
    );
    expect(r.status).toBe(0);
  });
});

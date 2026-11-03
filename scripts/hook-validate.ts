// Claude Code PostToolUse hook (see .claude/settings.json). Reads the hook JSON on
// stdin; when the written file is under data/, runs the validator. On errors it
// prints them to stderr and exits 2, which Claude Code feeds back to Claude.
// The validator honours TA_DATA_DIR.
import { spawnSync } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** True when `filePath` (absolute or project-relative, either slash) is under the project's data/. */
function isDataPath(filePath: string, root: string = projectDir): boolean {
  const p = filePath.replace(/\\/g, '/');
  const abs = isAbsolute(p) || /^[A-Za-z]:\//.test(p) ? p : resolve(root, p);
  const rel = relative(resolve(root), resolve(abs)).replace(/\\/g, '/');
  return rel === 'data' || rel.startsWith('data/');
}

function readStdin(): Promise<string> {
  return new Promise((res) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (s += c));
    process.stdin.on('end', () => res(s));
    process.stdin.on('error', () => res(s));
  });
}

async function main(): Promise<number> {
  let filePath: unknown;
  try {
    filePath = JSON.parse(await readStdin())?.tool_input?.file_path;
  } catch {
    return 0;
  }
  if (typeof filePath !== 'string' || !isDataPath(filePath)) return 0;

  const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/validate/cli.ts'], {
    cwd: projectDir,
    encoding: 'utf8',
    env: process.env,
  });
  if (r.status === 0) return 0;
  process.stderr.write(
    `npm run validate failed after editing ${filePath}. Fix these before going on:\n${r.stderr || r.stdout}`,
  );
  return 2;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(2);
  },
);

// Usage: npm run check:dashboard [-- --ids T-0042,D-0003]
// Builds the dashboard from TA_DATA_DIR (default: data), serves it, and checks that
// the records changed in the working tree show up on the right pages. Screenshots
// go to .check/. Exits 1 with a message on any failure.
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { build, preview } from 'vite';
import { loadRepo, type RepoData } from '../src/model/load';
import { todayIso } from '../src/metrics/dates';
import { todayLanes } from '../src/metrics/tasks';

type Kind = 'tasks' | 'decisions' | 'assumptions' | 'meetings';
type Changed = { id: string; kind: Kind };

const SIZES = [
  { suffix: '', width: 1280, height: 900 },
  { suffix: '-375', width: 375, height: 812 },
];
const ROUTES = ['today', 'trackers', 'decisions', 'assumptions', 'meetings', 'tasks'];
const SHOT_DIR = '.check';

function fail(msg: string): never {
  throw new Error(msg);
}

function kindOf(id: string): Kind {
  if (/^T-\d+$/.test(id)) return 'tasks';
  if (/^D-\d+$/.test(id)) return 'decisions';
  if (/^A-\d+$/.test(id)) return 'assumptions';
  if (/^\d{4}-\d{2}-\d{2}(-\d+)?$/.test(id)) return 'meetings';
  return fail(`cannot tell what kind of record "${id}" is (expected T-0001, D-0001, A-0001 or a meeting date)`);
}

const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split(/\r?\n/)
    .filter(Boolean);

/** Record ids touched under the data dir, plus whether team.yaml / themes.yaml changed. */
function changedFromGit(dataDir: string): { changed: Changed[]; configChanged: boolean } {
  const files = [
    ...git('diff', '--name-only', 'HEAD', '--', dataDir),
    ...git('ls-files', '--others', '--exclude-standard', '--', dataDir),
  ].map((f) => f.replace(/\\/g, '/'));
  const prefix = dataDir.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
  const seen = new Map<string, Changed>();
  let configChanged = false;
  for (const f of files) {
    const rel = f.startsWith(prefix) ? f.slice(prefix.length) : f;
    if (/^(team|themes)\.yaml$/.test(rel)) {
      configChanged = true;
      continue;
    }
    // meetings/raw/* and anything else is ignored by this pattern.
    const m = /^(tasks|decisions|assumptions|meetings)\/([^/]+)\.(yaml|md)$/.exec(rel);
    if (m) seen.set(m[2]!, { id: m[2]!, kind: m[1] as Kind });
  }
  return { changed: [...seen.values()], configChanged };
}

function parseIds(argv: string[]): string[] | null {
  const i = argv.indexOf('--ids');
  if (i < 0) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) fail('--ids needs a comma-separated list, e.g. --ids T-0042,D-0003');
  return v!.split(',').map((s) => s.trim()).filter(Boolean);
}

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => res(port));
    });
  });
}

function hasRecord(data: RepoData, c: Changed): boolean {
  return (data[c.kind] as { id: string }[]).some((r) => r.id === c.id);
}

/** Content checks for one route, run once at desktop width. */
async function verify(
  page: Page,
  route: string,
  changed: Changed[],
  tasks: RepoData['tasks'],
  onToday: Set<string>,
  problems: string[],
) {
  if (route === 'tasks') {
    for (const t of tasks) {
      const card = page.locator(`[data-id="${t.id}"]`).first();
      if ((await card.count()) === 0) {
        problems.push(`${t.id} is missing on #/tasks`);
        continue;
      }
      const status = await card.getAttribute('data-status');
      const owner = await card.getAttribute('data-owner');
      if (status !== t.status) problems.push(`${t.id}: dashboard status "${status}" but file says "${t.status}"`);
      if (owner !== t.owner) problems.push(`${t.id}: dashboard owner "${owner}" but file says "${t.owner}"`);
    }
  } else if (route === 'today') {
    for (const t of tasks) {
      if (!onToday.has(`${t.owner}/${t.id}`)) continue;
      const n = await page.locator(`[data-lane="${t.owner}"] [data-id="${t.id}"]`).count();
      if (n === 0) problems.push(`${t.id} should be in ${t.owner}'s lane on Today but is not`);
    }
  } else if (route === 'decisions' || route === 'assumptions' || route === 'meetings') {
    for (const c of changed.filter((x) => x.kind === route)) {
      if ((await page.locator(`[data-id="${c.id}"]`).count()) === 0) problems.push(`${c.id} is missing on #/${route}`);
    }
  }
}

async function run(): Promise<void> {
  const dataDir = process.env.TA_DATA_DIR ?? 'data';
  const explicit = parseIds(process.argv.slice(2));
  const { changed, configChanged } = explicit
    ? { changed: explicit.map((id) => ({ id, kind: kindOf(id) })), configChanged: false }
    : changedFromGit(dataDir);

  const { data, errors: loadErrors } = await loadRepo(dataDir);
  if (loadErrors.length) {
    fail('data does not load:\n' + loadErrors.map((e) => `  ${e.file}: [${e.rule}] ${e.message}`).join('\n'));
  }
  const missing = changed.filter((c) => !hasRecord(data, c));
  if (missing.length) fail(`not found in ${dataDir}: ${missing.map((c) => c.id).join(', ')}`);

  console.log(
    changed.length
      ? `checking ${changed.map((c) => c.id).join(', ')}`
      : `no changed records${configChanged ? ' (team/themes changed)' : ''}; running general route checks`,
  );

  console.log('building dashboard...');
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/build-bundle.ts', '--data', dataDir], {
    stdio: 'inherit',
  });
  await build({ configFile: resolve('dashboard/vite.config.ts'), logLevel: 'warn' });

  const port = await freePort();
  const server = await preview({
    configFile: resolve('dashboard/vite.config.ts'),
    preview: { port, strictPort: true, host: '127.0.0.1' },
  });
  const base = `http://127.0.0.1:${port}`;
  const problems: string[] = [];
  const shots: string[] = [];
  let browser;
  try {
    browser = await chromium.launch();
    const kinds = [...new Set(changed.map((c) => c.kind))];
    const shotRoutes = new Set<string>(['today', 'trackers', ...kinds]);
    const tasks = changed.filter((c) => c.kind === 'tasks').map((c) => data.tasks.find((t) => t.id === c.id)!);
    const lanes = todayLanes(
      data.tasks,
      data.team.members.map((m) => m.id),
      data.meetings,
      todayIso(),
    );
    const onToday = new Set(lanes.flatMap((l) => l.tasks.map((t) => `${l.owner}/${t.id}`)));

    for (const size of SIZES) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
      try {
        for (const route of ROUTES) {
          // A fresh page per route: Tasks reads its ?all=1 filter only on first load.
          const page = await context.newPage();
          page.on('console', (m) => m.type() === 'error' && problems.push(`${size.width}px #/${route}: console error: ${m.text()}`));
          page.on('pageerror', (e) => problems.push(`${size.width}px #/${route}: page error: ${e.message}`));
          await page.goto(`${base}/#/${route === 'tasks' ? 'tasks?all=1' : route}`);
          await page.waitForSelector('main.page');
          if (size.suffix === '') await verify(page, route, changed, tasks, onToday, problems);
          if (shotRoutes.has(route)) {
            const file = `${SHOT_DIR}/${route}${size.suffix}.png`;
            await page.screenshot({ path: file, fullPage: true });
            shots.push(file);
          }
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await server.close();
  }

  if (problems.length) fail([...new Set(problems)].map((p) => `  - ${p}`).join('\n'));
  console.log('screenshots:');
  for (const s of shots) console.log(`  ${s}`);
  console.log('✓ dashboard check passed');
}

mkdir(SHOT_DIR, { recursive: true })
  .then(run)
  .then(
    () => process.exit(0),
    (e) => {
      console.error(`✗ dashboard check failed\n${e instanceof Error ? e.message : e}`);
      process.exit(1);
    },
  );

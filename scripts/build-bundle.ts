import { mkdir, writeFile } from 'node:fs/promises';
import { loadRepo } from '../src/model/load';
import { validateRepo } from '../src/validate/rules';
import { buildBundle } from '../src/bundle/build';

function parseDataDir(argv: string[]): string {
  const i = argv.indexOf('--data');
  if (i >= 0 && argv[i + 1]) return argv[i + 1]!;
  return process.env.TA_DATA_DIR ?? 'data';
}

async function main(): Promise<number> {
  const dataDir = parseDataDir(process.argv.slice(2));
  const { data, errors } = await loadRepo(dataDir);
  const all = [...errors, ...validateRepo(data)];
  if (all.length > 0) {
    for (const e of all) console.error(`${e.file}: [${e.rule}] ${e.message}`);
    return 1;
  }
  const bundle = buildBundle(data, new Date().toISOString());
  const outDir = 'dashboard/src/generated';
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/bundle.json`, JSON.stringify(bundle, null, 2) + '\n');
  console.log(
    `bundle written to ${outDir}/bundle.json (${bundle.tasks.length} tasks, ${bundle.decisions.length} decisions, ${bundle.assumptions.length} assumptions, ${bundle.meetings.length} meetings)`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

// Builds the dashboard for each e2e fixture (sequentially: build:bundle writes one shared
// bundle.json) into its own outDir, then serves each with vite preview on a fixed port.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { build, preview } from 'vite';

export const FIXTURES = [
  { name: 'empty', data: 'tests/fixtures/empty', port: 4174 },
  { name: 'basic', data: 'tests/fixtures/basic', port: 4173 },
] as const;

async function main() {
  const servers: Awaited<ReturnType<typeof preview>>[] = [];
  for (const f of FIXTURES) {
    const outDir = resolve('.e2e', f.name);
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/build-bundle.ts', '--data', f.data], {
      stdio: 'inherit',
    });
    await build({ configFile: resolve('dashboard/vite.config.ts'), logLevel: 'warn', build: { outDir } });
    servers.push(
      await preview({
        configFile: resolve('dashboard/vite.config.ts'),
        build: { outDir },
        preview: { port: f.port, strictPort: true, host: '127.0.0.1' },
      }),
    );
  }
  // Playwright waits on the last port (basic); both servers are up by then.
  const stop = async () => {
    await Promise.all(servers.map((s) => s.close()));
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

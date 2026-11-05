import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import './sites-env.mjs';

// The generated Wrangler config lives in dist/server. Resolve the local secrets
// from the project root explicitly so builds never have to copy the API key.
const child = spawn(process.execPath, [
  '--import', './scripts/sites-env.mjs',
  './node_modules/wrangler/bin/wrangler.js', 'dev',
  '--config', 'dist/server/wrangler.json',
  '--env-file', fileURLToPath(new URL('../.env', import.meta.url)),
  '--local', '--persist-to', '.wrangler/state',
  '--ip', '127.0.0.1', '--inspector-port', '0',
  ...process.argv.slice(2),
], { stdio: 'inherit' });
child.on('error', () => { console.error('Không thể khởi động Wrangler.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

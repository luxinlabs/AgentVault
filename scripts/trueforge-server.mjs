import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('.trueforge', { recursive: true });
const child = spawn(process.execPath, ['node_modules/@truefoundry/trueforge/dist/cli.js', '--port', process.env.TRUEFORGE_PORT || '8790'], {
  stdio: 'inherit',
  env: { ...process.env, HOST: '127.0.0.1', STANDALONE: 'true', SQLITE_PATH: resolve('.trueforge/agentvault.sqlite') },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
child.on('error', error => { console.error(error.message); process.exit(1); });

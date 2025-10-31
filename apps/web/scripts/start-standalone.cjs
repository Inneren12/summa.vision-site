// apps/web/scripts/start-standalone.cjs
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');           // <= apps/web
const standalone = path.join(root, '.next', 'standalone');

function findServerJs(dir) {
  const a = path.join(dir, 'server.js');
  const b = path.join(dir, 'apps', 'web', 'server.js');
  if (fs.existsSync(a)) return a;
  if (fs.existsSync(b)) return b;
  throw new Error('server.js not found under ' + dir);
}

const serverJs = findServerJs(standalone);

const child = spawn(process.execPath, [serverJs], {
  cwd: root,                    // <<< ВАЖНО: рабочая директория = apps/web
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '3000',
    HOSTNAME: process.env.HOSTNAME || '127.0.0.1',
  },
});

child.on('exit', (code, signal) => {
  console.error('[standalone] server exited', { code, signal });
  process.exit(code ?? 0);
});
child.on('error', (err) => {
  console.error('[standalone] spawn error', err);
  process.exit(1);
});

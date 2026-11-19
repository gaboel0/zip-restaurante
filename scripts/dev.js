// Sobe a API (porta 3000) e o Vite com hot reload (porta 5173) juntos.
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const procs = [
  spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'inherit', env: { ...process.env, DEV: '1' } }),
  spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: root, stdio: 'inherit' }),
];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', stop));

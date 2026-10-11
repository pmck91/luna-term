import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
if (existsSync('.env')) process.loadEnvFile('.env');
const children = [spawn('node', ['node_modules/tsx/dist/cli.mjs', 'watch', 'server/index.ts'], { stdio: 'inherit', env: process.env }), spawn('node', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit', env: process.env })];
let closing = false;
function close(code = 0) { if (closing) return; closing = true; children.forEach(child => child.kill('SIGTERM')); setTimeout(() => process.exit(code), 300).unref(); }
children.forEach(child => { child.on('error', error => { console.error(error.message); close(1); }); child.on('exit', code => close(code || 0)); });
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());

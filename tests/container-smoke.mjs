// Isolated deployment verification. Creates and removes only its own Compose project.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const exec = promisify(execFile);
const suffix = randomBytes(4).toString('hex');
const project = `luna-smoke-${suffix}`, network = `${project}-proxy`;
const env = { ...process.env, PUBLIC_ORIGIN: 'https://term.pmck.ie', SESSION_SECRET: randomBytes(32).toString('hex'), ADMIN_SETUP_TOKEN: randomBytes(32).toString('hex'), TRUST_PROXY: '127.0.0.1', REVERSE_PROXY_NETWORK: network };
async function docker(...args) { return (await exec('docker', args, { env, maxBuffer: 1024 * 1024 })).stdout.trim(); }
async function compose(...args) { return docker('compose', '-p', project, ...args); }
let id;
async function inside(source) {
  return new Promise((resolve, reject) => {
    const child = import('node:child_process').then(({ spawn }) => {
      const process = spawn('docker', ['exec', '-i', id, 'node', '--input-type=module'], { env });
      let out = '', err = ''; process.stdout.on('data', c => out += c); process.stderr.on('data', c => err += c);
      process.on('error', reject); process.on('close', code => code ? reject(new Error(err || out)) : resolve(JSON.parse(out)));
      process.stdin.end(source);
    });
    child.catch(reject);
  });
}
try {
  await docker('network', 'create', network); await compose('up', '-d', '--no-build'); id = await compose('ps', '-q', 'luna');
  assert.equal(await docker('exec', id, 'id', '-u'), '1000');
  let healthy = false;
  for (let i = 0; i < 40; i++) { if (await docker('inspect', '--format', '{{.State.Health.Status}}', id) === 'healthy') { healthy = true; break; } await new Promise(r => setTimeout(r, 1000)); }
  assert(healthy, 'Container must become healthy');
  const checks = await inside(`
    import assert from 'node:assert/strict';
    import { randomUUID } from 'node:crypto';
    import fs from 'node:fs';
    const base = 'http://127.0.0.1:3000';
    let cookie = '';
    const headers = () => ({ Origin: process.env.PUBLIC_ORIGIN, 'X-Forwarded-Proto': 'https', ...(cookie ? { Cookie: cookie } : {}) });
    const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...headers(), ...options.headers }, redirect: 'manual' });
    assert.equal((await request('/')).status, 200);
    assert.equal((await request('/api/admin/contacts')).status, 401);
    assert.equal((await request('/admin')).headers.get('location'), '/admin/setup');
    const status = await request('/api/auth/status'); cookie = status.headers.get('set-cookie').split(';')[0]; const csrf = (await status.json()).csrf;
    const signup = await request('/api/auth/setup', { method:'POST', headers: {'Content-Type':'application/json', 'X-CSRF-Token':csrf}, body: JSON.stringify({token:process.env.ADMIN_SETUP_TOKEN, username:'smoke-owner', password:'container-test-password'}) });
    assert.equal(signup.status,201); const sessionCookie = signup.headers.get('set-cookie'); assert.match(sessionCookie, /Secure/); assert.match(sessionCookie, /HttpOnly/); assert.match(sessionCookie, /SameSite=Strict/);
    cookie=sessionCookie.split(';')[0]; const newCsrf=(await signup.json()).csrf;
    assert.equal((await request('/api/admin/entries')).status,200);
    const message={submissionId:randomUUID(),name:'Smoke test',email:'test@example.com',subject:'Persistence test',message:'Persisted after restart'};
    assert.equal((await request('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)})).status,201);
    fs.writeFileSync('/app/uploads/persistence-check.txt','volume persistence');
    console.log(JSON.stringify({static:true,routeProtection:true,secureSession:true,privateMessage:true}));
  `);
  await compose('restart', 'luna');
  const persisted = await inside(`
    import Database from 'better-sqlite3'; import fs from 'node:fs';
    const db=new Database(process.env.DATABASE_PATH); const admins=db.prepare('SELECT count(*) AS n FROM admins').get().n; const contacts=db.prepare('SELECT count(*) AS n FROM contacts').get().n; db.close();
    console.log(JSON.stringify({admins,contacts,media:fs.readFileSync('/app/uploads/persistence-check.txt','utf8')}));
  `);
  assert.deepEqual(persisted, { admins: 1, contacts: 1, media: 'volume persistence' });
  console.log(JSON.stringify({ health: true, nonRoot: true, ...checks, databasePersistence: true, mediaPersistence: true }));
} finally {
  await compose('down', '--volumes', '--remove-orphans').catch(() => {});
  await docker('network', 'rm', network).catch(() => {});
}

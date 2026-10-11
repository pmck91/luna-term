import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../server/app';

test('first-run setup uses one initial session request and can submit after the session expires', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'luna-browser-setup-'));
  const token = 'browser-setup-token-abcdefghijklmnopqrstuvwxyz';
  const env = createApp({ port: 3000, production: false, databasePath: join(dir, 'db.sqlite'), mediaPath: join(dir, 'media'), origin: 'http://localhost:5187', sessionSecret: 'browser-session-secret-abcdefghijklmnopqrstuvwxyz', setupToken: token, repositoryUrl: null, trustProxy: [], contactLimit: 5 });
  const server = env.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let statusRequests = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/status') statusRequests++;
    const response = await route.fetch({ url: base + path });
    await route.fulfill({ response });
  });
  try {
    await page.goto('/admin/setup');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    // Allow any duplicate Strict Mode request to arrive before checking the count.
    await page.waitForTimeout(200);
    expect(statusRequests).toBe(1);
    await page.getByLabel('Setup token').fill(token);
    await page.getByLabel('Username', { exact: true }).fill('browser-owner');
    await page.getByLabel('Password', { exact: true }).fill('browser-password-with-length');
    env.db.prepare('DELETE FROM sessions').run();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('button', { name: 'Create entry' })).toBeVisible();
    expect(env.db.prepare('SELECT username FROM admins').get()).toEqual({ username: 'browser-owner' });
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await page.getByLabel('Username', { exact: true }).fill('browser-owner');
    await page.getByLabel('Password', { exact: true }).fill('browser-password-with-length');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create entry' })).toBeVisible();
  } finally {
    await page.unroute('**/api/**');
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    env.db.close(); rmSync(dir, { recursive: true, force: true });
  }
});

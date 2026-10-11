import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { CAT } from '../../src/logo';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const origin = 'http://localhost:5187';
async function login(page: Page, username = 'guest') {
  await page.goto('/'); const input = page.getByRole('textbox', { name: 'Username, suggested guest' });
  await expect(input).toBeVisible(); await input.fill(username); await input.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Terminal command' })).toBeFocused();
}
async function command(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'Terminal command' }); await input.fill(text); await input.press('Enter');
}
async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const prompt = document.querySelector('.command-line')!.getBoundingClientRect();
    const windowRect = document.querySelector('.terminal-window')!.getBoundingClientRect();
    return { vertical: document.documentElement.scrollHeight <= innerHeight + 1, horizontal: document.documentElement.scrollWidth <= innerWidth + 1, visible: prompt.bottom <= innerHeight && prompt.top >= 0 && prompt.bottom <= windowRect.bottom };
  })).toEqual({ vertical: true, horizontal: true, visible: true });
}
async function auth(api: APIRequestContext) {
  const status = await (await api.get('/api/auth/status')).json();
  const response = await api.post(`/api/auth/${status.setupRequired ? 'setup' : 'login'}`, { headers: { Origin: origin, 'X-CSRF-Token': status.csrf }, data: { username: 'tester', password: 'test-password-with-length', ...(status.setupRequired ? { token: 'test-setup-token-abcdefghijklmnopqrstuvwxyz' } : {}) } });
  expect(response.ok()).toBe(true); return (await response.json()).csrf as string;
}
test('boot, cat artwork, selectable login, and terminal-only layout', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const start = Date.now(); await page.goto('/'); await expect(page.locator('#terminal-input')).toHaveCount(0);
  await page.keyboard.press('Enter'); await expect(page.locator('#terminal-input')).toHaveCount(0);
  await expect(page.locator('#terminal-input')).toBeVisible(); expect(Date.now() - start).toBeGreaterThanOrEqual(1900);
  await page.locator('#terminal-input').press('Enter'); await expect(page.getByText('Enter a username. Try guest.')).toBeVisible();
  await page.locator('#terminal-input').fill('luna'); await page.locator('#terminal-input').press('Enter');
  await expect(page.locator('.cat-logo')).toHaveText(CAT); await expect(page.locator('.login-output')).toContainText('Welcome to Luna 0.5.22'); await expect(page.locator('.login-output')).toContainText('(simulated)');
  await expect(page.locator('nav, .card, .hero, aside')).toHaveCount(0); await expect(page.locator('.public-page > *')).toHaveCount(2); await noOverflow(page);
  await page.locator('.terminal-output').evaluate(el => { el.scrollTop = (el.querySelector('.login-output') as HTMLElement).offsetTop - (el as HTMLElement).offsetTop; });
  await page.screenshot({ path: `artifacts/${info.project.name}-login.png` });
  expect(errors).toEqual([]);
});
test('completion, history, themes, cancellation, and clearing', async ({ page }) => {
  await login(page); const input = page.locator('#terminal-input');
  await input.fill('cd pro'); await input.press('Tab'); await expect(input).toHaveValue('cd projects/'); await input.press('Enter'); await expect(page.locator('.command-line .prompt')).toHaveText('guest@term.pmck.ie:~/projects$');
  await command(page, 'ls'); await expect(page.locator('.text-output').last()).toContainText('portfolio.luna');
  await input.press('ArrowUp'); await expect(input).toHaveValue('ls'); await input.press('ArrowUp'); await expect(input).toHaveValue('cd projects/'); await input.press('ArrowDown'); await expect(input).toHaveValue('ls'); await input.press('ArrowDown'); await expect(input).toHaveValue('');
  await command(page, 'theme nord'); await expect(page.locator('.public-page')).toHaveAttribute('data-theme', 'nord');
  await page.reload(); await expect(page.locator('.public-page')).toHaveAttribute('data-theme', 'nord'); await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
  await input.fill('unfinished'); await input.press('Control+c'); await expect(input).toHaveValue(''); await expect(page.locator('.command-echo').last()).toContainText('^C');
  await command(page, 'clear'); await expect(page.locator('.terminal-output')).toBeEmpty(); await expect(input).toBeFocused();
  await command(page, 'help'); await input.press('Control+l'); await expect(page.locator('.terminal-output')).toBeEmpty(); await expect(input).toBeFocused();
});
test('entry rendering, private content, and invalid paths', async ({ page }) => {
  await login(page); await command(page, './projects/portfolio.luna'); await expect(page.locator('.entry-output h1')).toHaveText('Luna terminal portfolio');
  await command(page, 'ls documents'); await expect(page.locator('.text-output').last()).not.toContainText('first-post');
  await command(page, 'cd ../../etc'); await expect(page.locator('.text-output').last()).toContainText('No such file');
  await command(page, 'cat "'); await expect(page.locator('.text-output').last()).toContainText('Close'); await noOverflow(page);
});
test('scrollback, selection, focus, and a smaller mobile keyboard viewport', async ({ page }) => {
  await login(page); await command(page, 'clear'); for (let i = 0; i < 8; i++) await command(page, 'help');
  const output = page.locator('.terminal-output'), input = page.locator('#terminal-input');
  const before = await output.evaluate(el => el.scrollTop); await input.press('PageUp'); expect(await output.evaluate(el => el.scrollTop)).toBeLessThan(before); await input.press('PageDown');
  await output.evaluate(el => { const node = el.querySelector('.text-output')!; const range = document.createRange(); range.selectNodeContents(node); const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range); });
  const selected = await page.evaluate(() => getSelection()!.toString()); expect(selected).toContain('Luna virtual shell');
  await page.keyboard.press('Control+c'); expect(await page.evaluate(() => getSelection()!.toString())).toBe(selected);
  await page.keyboard.press('Escape'); await expect(input).toBeFocused();
  const size = page.viewportSize()!; await page.setViewportSize({ width: size.width, height: 330 }); await noOverflow(page); await expect(input).toBeVisible(); await command(page, 'pwd'); await expect(input).toBeFocused();
});
test('sequential multiline contact, validation, review, editing, submission, cancellation', async ({ page, playwright }) => {
  await login(page); await command(page, './messaging/contact.sh'); const input = page.locator('#terminal-input');
  await expect(page.locator('.command-line .prompt')).toHaveText('name:'); await input.fill('Visitor'); await input.press('Enter');
  await expect(page.locator('.command-line .prompt')).toHaveText('email:'); await input.fill('invalid'); await input.press('Enter'); await expect(page.locator('.command-line .prompt')).toHaveText('email:');
  await input.fill('visitor@example.com'); await input.press('Enter'); await expect(page.locator('.command-line .prompt')).toHaveText('subject:');
  const subject = 'Browser test ' + randomUUID(); await input.fill(subject); await input.press('Enter'); await expect(page.locator('.command-line .prompt')).toHaveText('message:');
  for (const line of ['First line', 'Second line', '.']) { await input.fill(line); await input.press('Enter'); }
  await expect(page.locator('.command-line .prompt')).toHaveText('send / edit / cancel:'); await expect(page.locator('.text-output').last()).toContainText('First line\nSecond line');
  await input.fill('edit'); await input.press('Enter'); await expect(input).toHaveValue('Visitor'); await input.press('Enter'); await input.press('Enter'); await input.press('Enter');
  await input.fill('Edited message'); await input.press('Enter'); await input.fill('.'); await input.press('Enter'); await input.fill('send'); await input.press('Enter');
  await expect(page.getByText('Message received. Thank you.')).toBeVisible(); await expect(input).toBeFocused();
  const admin = await playwright.request.newContext({ baseURL: origin }); const csrf = await auth(admin); const contacts = await (await admin.get('/api/admin/contacts')).json(); const saved = contacts.find((c: { subject: string }) => c.subject === subject); expect(saved.message).toBe('Edited message'); await admin.delete(`/api/admin/contacts/${saved.id}`, { headers: { Origin: origin, 'X-CSRF-Token': csrf } }); await admin.dispose();
  await command(page, './messaging/contact.sh'); await input.fill('Unsent'); await input.press('Control+c'); await expect(page.locator('.command-line .prompt')).toHaveText('guest@term.pmck.ie:~$');
});
test('inline images and video stay inside the terminal', async ({ page, playwright }, info) => {
  const admin = await playwright.request.newContext({ baseURL: origin }); const csrf = await auth(admin); const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  const image = await (await admin.post('/api/admin/media', { headers, multipart: { file: { name: 'sample.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/sample.png') } } })).json();
  const video = await (await admin.post('/api/admin/media', { headers, multipart: { file: { name: 'sample.mp4', mimeType: 'video/mp4', buffer: readFileSync('tests/fixtures/sample.mp4') } } })).json();
  const entry = await (await admin.post('/api/admin/entries', { headers, data: { kind: 'project', slug: 'media-' + randomUUID(), title: 'Media fixture', markdown: `# Inline media\n\n![Test image](${image.url})\n\n\`\`\`video\n${video.url}\nTest video\n\`\`\``, published: true } })).json();
  try {
    await login(page); await command(page, 'clear'); await command(page, `./projects/${entry.slug}.luna`);
    await expect(page.locator('.entry-output img')).toBeVisible(); await expect(page.locator('video')).toHaveAttribute('controls', '');
    await page.waitForFunction(() => { const image = document.querySelector('img'); return image?.complete && image.naturalWidth > 0; });
    const metrics = await page.locator('.terminal-output').evaluate(el => { const box = el.getBoundingClientRect(); return [...el.querySelectorAll('img,video')].every(media => { const r = media.getBoundingClientRect(); return r.width <= box.width && r.left >= box.left && r.right <= box.right; }); }); expect(metrics).toBe(true); await noOverflow(page);
    await page.locator('#terminal-input').press('Shift+Tab'); await expect(page.locator('video')).toBeFocused(); await page.locator('video').press('Space'); await expect.poll(() => page.locator('video').evaluate((el: HTMLVideoElement) => !el.paused)).toBe(true); await page.locator('video').press('Space'); await page.keyboard.press('Escape'); await expect(page.locator('#terminal-input')).toBeFocused();
    await page.screenshot({ path: `artifacts/${info.project.name}-media.png` });
  } finally { await admin.delete(`/api/admin/entries/${entry.id}`, { headers }); await admin.dispose(); }
});
test('admin editor previews drafts in the terminal and manages content', async ({ page }) => {
  await page.goto('/admin'); await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('tester'); await page.getByLabel('Password', { exact: true }).fill('test-password-with-length'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Create entry' }).click(); await page.getByLabel('Title', { exact: true }).fill('Editor ' + randomUUID()); await page.getByLabel('Markdown', { exact: true }).fill('# Preview heading\n\nA draft paragraph.');
  await expect(page.locator('.preview-terminal')).toContainText('preview@term.pmck.ie:~$'); await expect(page.locator('.preview-terminal h1')).toHaveText('Preview heading');
  await page.getByRole('button', { name: 'Save entry' }).click(); await expect(page.getByText('Entry saved.', { exact: true })).toBeVisible();
  const row = page.locator('.admin-list-row').filter({ hasText: 'Editor ' }); await expect(row).toContainText('Draft');
  page.once('dialog', d => d.accept()); await row.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(page.getByText('Entry deleted.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});

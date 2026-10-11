import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const origin = 'http://localhost:5187';
async function authenticate(api: APIRequestContext) {
  const status = await (await api.get('/api/auth/status')).json();
  const response = await api.post(`/api/auth/${status.setupRequired ? 'setup' : 'login'}`, { headers: { Origin: origin, 'X-CSRF-Token': status.csrf }, data: { username: 'tester', password: 'test-password-with-length', ...(status.setupRequired ? { token: 'test-setup-token-abcdefghijklmnopqrstuvwxyz' } : {}) } });
  expect(response.ok()).toBe(true); return { Origin: origin, 'X-CSRF-Token': (await response.json()).csrf };
}
async function command(page: Page, text: string) { const input = page.locator('#terminal-input'); await input.fill(text); await input.press('Enter'); }
async function login(page: Page) { await page.goto('/'); const input = page.locator('#terminal-input'); await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter'); await expect(input).toHaveAttribute('aria-label', 'Terminal command'); }
async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const output = document.querySelector('.terminal-output')!, prompt = document.querySelector('.command-line')!.getBoundingClientRect(), box = output.getBoundingClientRect();
    return { page: document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
      output: output.scrollWidth <= output.clientWidth + 1, prompt: prompt.top >= 0 && prompt.bottom <= innerHeight,
      focused: document.activeElement?.id === 'terminal-input', onlyTerminal: [...document.querySelector('.public-page')!.children].map(element => element.tagName).join(',') === 'SECTION,FOOTER',
      images: [...output.querySelectorAll('img')].every(image => { const bounds = image.getBoundingClientRect(); return bounds.left >= box.left && bounds.right <= box.right; }) };
  })).toEqual({ page: true, output: true, prompt: true, focused: true, onlyTerminal: true, images: true });
}

test('admin creates nested albums, names and previews pictures, moves them, and deletes empty albums', async ({ page }, info) => {
  const headers = await authenticate(page.request), rootName = 'album-' + randomUUID().slice(0, 8);
  const ids: string[] = []; let pictureId: string | undefined;
  page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto('/admin/pictures'); await expect(page.getByRole('heading', { name: 'Pictures', exact: true })).toBeVisible();
    const albumForm = page.getByRole('form', { name: 'Album editor' });
    await albumForm.getByLabel('Directory name').fill(rootName); await albumForm.getByRole('button', { name: 'Create album', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Album saved.');
    let data = await (await page.request.get('/api/admin/pictures')).json(); const parent = data.albums.find((album: { name: string }) => album.name === rootName); ids.push(parent.id);
    await albumForm.getByLabel('Directory name').fill('cats'); await albumForm.getByLabel('Parent directory').selectOption(parent.id);
    await albumForm.getByRole('button', { name: 'Create album', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('Album saved.');
    data = await (await page.request.get('/api/admin/pictures')).json(); const child = data.albums.find((album: { name: string; parentId: string }) => album.name === 'cats' && album.parentId === parent.id); ids.unshift(child.id);
    await page.getByLabel('Browse album').selectOption(child.id);
    const pictureForm = page.getByRole('form', { name: 'Picture editor' });
    await pictureForm.getByLabel('Picture name').fill('Luna at the window'); await pictureForm.getByLabel('Image file').setInputFiles('tests/fixtures/sample.png');
    await pictureForm.getByRole('button', { name: 'Upload picture' }).click(); await expect(page.getByRole('status')).toHaveText('Picture saved.');
    data = await (await page.request.get('/api/admin/pictures')).json(); const picture = data.pictures.find((p: { albumId: string }) => p.albumId === child.id); pictureId = picture.id;
    expect(picture.filename).toBe('luna-at-the-window.png');
    const preview = page.getByRole('region', { name: 'Terminal picture preview' });
    await expect(preview).toContainText(`view ~/pictures/${rootName}/cats/luna-at-the-window.png`); await expect(preview.getByAltText('Luna at the window')).toBeVisible();
    await page.screenshot({ path: `artifacts/${info.project.name}-pictures-admin.png` });
    await page.locator('.admin-list-row').filter({ hasText: `~/pictures/${rootName}/` }).filter({ has: page.getByRole('button', { name: 'Edit album' }) }).first().getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Only empty albums');
    await pictureForm.getByLabel('Picture name').fill('Luna asleep'); await pictureForm.getByRole('combobox', { name: 'Album', exact: true }).selectOption({ value: '' });
    await pictureForm.getByRole('button', { name: 'Save picture' }).click(); await expect(page.getByRole('status')).toHaveText('Picture saved.');
    await expect(preview).toContainText('view ~/pictures/luna-asleep.png');
    await page.reload(); await expect(page.getByRole('heading', { name: 'Pictures', exact: true })).toBeVisible();
    const pictureRow = page.locator('.admin-list-row').filter({ hasText: 'luna-asleep.png' });
    await expect(pictureRow).toContainText('Luna asleep'); await pictureRow.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Picture deleted.');
    for (const path of [`~/pictures/${rootName}/cats/`, `~/pictures/${rootName}/`]) {
      await page.locator('.admin-list-row').filter({ has: page.locator('code', { hasText: path }) }).filter({ has: page.getByRole('button', { name: 'Edit album' }) }).last().getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Album deleted.');
    }
    expect((await page.request.get(picture.url)).status()).toBe(404);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally {
    test.setTimeout(test.info().timeout + 10000);
    if (pictureId) await page.request.delete(`/api/admin/pictures/${pictureId}`, { headers });
    for (const id of ids) await page.request.delete(`/api/admin/picture-albums/${id}`, { headers });
  }
});

test('visitors browse pictures with keyboard commands and inline images stay within the terminal', async ({ page, request }, info) => {
  const headers = await authenticate(request), rootName = 'pictures-' + randomUUID().slice(0, 8), pictures: string[] = [];
  const parent = await (await request.post('/api/admin/picture-albums', { headers, data: { name: rootName } })).json();
  const child = await (await request.post('/api/admin/picture-albums', { headers, data: { name: 'cats', parentId: parent.id } })).json();
  try {
    for (let index = 1; index <= 6; index++) {
      const response = await request.post('/api/admin/pictures', { headers, multipart: { name: `Luna ${index}`, albumId: child.id, file: { name: 'camera.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/sample.png') } } });
      expect(response.status()).toBe(201); pictures.push((await response.json()).id);
    }
    await login(page); const input = page.locator('#terminal-input');
    await command(page, 'ls'); await expect(page.locator('.text-output').last()).toContainText('pictures/');
    await input.fill(`cd ~/pictures/${rootName.slice(0, -1)}`); await input.press('Tab'); await expect(input).toHaveValue(`cd ~/pictures/${rootName}/`); await input.press('Enter');
    await command(page, 'ls'); await expect(page.locator('.text-output').last()).toHaveText('cats/');
    await command(page, 'cd cats'); await input.fill('view luna-1'); await input.press('Tab'); await expect(input).toHaveValue('view luna-1.png '); await input.press('Enter');
    await expect(page.getByAltText('Luna 1')).toBeVisible(); await fits(page);
    await command(page, 'clear'); await command(page, '~/pictures/view'); await expect(page.locator('.picture-output')).toHaveCount(6);
    await expect.poll(() => page.locator('.terminal-output').evaluate(output => output.scrollHeight > output.clientHeight)).toBe(true);
    await fits(page); await page.screenshot({ path: `artifacts/${info.project.name}-pictures-terminal.png` });
    const output = page.locator('.terminal-output'), before = await output.evaluate(element => element.scrollTop);
    await input.press('PageUp'); expect(await output.evaluate(element => element.scrollTop)).toBeLessThan(before); await input.press('PageDown');
    const caption = page.locator('.picture-output figcaption').last(); await caption.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
    await input.press('Control+c'); expect(await page.evaluate(() => getSelection()!.toString())).toBe('Luna 6');
    await input.press('Escape'); await expect(input).toBeFocused();
    await input.press('Control+l'); await expect(page.locator('.picture-output')).toHaveCount(0);
    await command(page, 'pwd'); await expect(page.locator('.text-output').last()).toHaveText(`/pictures/${rootName}/cats`);
    await command(page, 'view'); await expect(page.locator('.picture-output')).toHaveCount(6);
    for (const directory of ['messaging', 'games']) {
      await command(page, `cd ~/${directory}`); await command(page, 'view');
      await expect(page.locator('.text-output').last()).toContainText('Use view ~/pictures');
      await expect(page.locator('.picture-output')).toHaveCount(6);
    }
    await command(page, `view ~/pictures/${rootName}/cats`); await expect(page.locator('.picture-output')).toHaveCount(12);
    await command(page, `cd ~/pictures/${rootName}/cats`); await command(page, 'clear');
    await command(page, 'mkdir new'); await expect(page.locator('.text-output').last()).toContainText('command not found');
    await page.setViewportSize({ width: 320, height: 330 }); await command(page, 'view luna-1.png'); await fits(page);
    await page.screenshot({ path: `artifacts/${info.project.name}-pictures-short.png` });
    await request.delete(`/api/admin/pictures/${pictures[0]}`, { headers });
    await page.reload(); await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
    await command(page, `view ~/pictures/${rootName}/cats/luna-1.png`); await expect(page.locator('.text-output').last()).toContainText('No such file'); await fits(page);
  } finally {
    for (const id of pictures) await request.delete(`/api/admin/pictures/${id}`, { headers });
    await request.delete(`/api/admin/picture-albums/${child.id}`, { headers }); await request.delete(`/api/admin/picture-albums/${parent.id}`, { headers });
  }
});

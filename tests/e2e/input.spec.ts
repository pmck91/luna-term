import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/'); const input = page.locator('#terminal-input');
  await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
  await expect(input).toHaveAttribute('aria-label', 'Terminal command');
}
async function command(page: Page, text: string) {
  const input = page.locator('#terminal-input'); await input.fill(text); await input.press('Enter');
}
async function pauseFrames(page: Page) {
  const time = new Date(); await page.clock.install({ time }); await page.clock.pauseAt(new Date(time.getTime() + 1000));
}
const selection = (page: Page) => page.locator('#terminal-input').evaluate(element => {
  const input = element as HTMLInputElement; return [input.selectionStart, input.selectionEnd];
});

for (const mode of ['shell', 'adventure'] as const) {
  test(`${mode} completion and history preserve later selection and cursor movement`, async ({ page }) => {
    await login(page);
    if (mode === 'adventure') await command(page, '~/games/lunas-adventure.game');
    await pauseFrames(page); const input = page.locator('#terminal-input');
    const prefix = mode === 'shell' ? 'vi' : 'lo', completed = mode === 'shell' ? 'view ' : 'look ', replacement = mode === 'shell' ? 'pwd' : 'map';
    await input.fill(prefix); await input.press('Tab'); await expect(input).toHaveValue(completed);
    await input.press('Control+a'); expect(await selection(page)).toEqual([0, completed.length]);
    await page.clock.runFor(32); expect(await selection(page)).toEqual([0, completed.length]);
    await input.pressSequentially(replacement); await expect(input).toHaveValue(replacement); await input.press('Enter');
    await expect(page.locator('.command-echo').last()).toContainText(replacement);
    await input.press('ArrowUp'); await expect(input).toHaveValue(replacement);
    await input.press('Home'); expect(await selection(page)).toEqual([0, 0]);
    await page.clock.runFor(32); expect(await selection(page)).toEqual([0, 0]);
    await input.pressSequentially('x'); await expect(input).toHaveValue('x' + replacement);

    // The browser's editing operation can start before its input event fires.
    // A paused frame previously interrupted selection between those two steps.
    await input.fill(prefix); await input.press('Tab');
    await input.evaluate(element => { const input = element as HTMLInputElement; input.select(); });
    await page.clock.runFor(32); expect(await selection(page)).toEqual([0, completed.length]);
    await input.fill(replacement); await expect(input).toHaveValue(replacement);
  });

  test(`${mode} mid-line completion places the cursor correctly and rapid history restores the draft`, async ({ page }) => {
    await login(page);
    if (mode === 'adventure') await command(page, '~/games/lunas-adventure.game');
    await pauseFrames(page); const input = page.locator('#terminal-input');
    const prefix = mode === 'shell' ? 'cd pro' : 'inspect sho', completed = mode === 'shell' ? 'cd projects/' : 'inspect shoes ';
    await input.fill(prefix + ' tail'); await input.evaluate((element, position) => (element as HTMLInputElement).setSelectionRange(position, position), prefix.length);
    await input.press('Tab'); await expect(input).toHaveValue(completed + ' tail');
    expect(await selection(page)).toEqual([completed.length, completed.length]);
    await page.clock.runFor(32); expect(await selection(page)).toEqual([completed.length, completed.length]);
    await input.pressSequentially('x'); await expect(input).toHaveValue(completed + 'x tail');
    const first = mode === 'shell' ? 'pwd' : 'inventory', second = mode === 'shell' ? 'ls' : 'goals';
    await command(page, first); await command(page, second); await input.fill('draft');
    await input.press('ArrowUp'); await expect(input).toHaveValue(second);
    await input.press('ArrowUp'); await expect(input).toHaveValue(first);
    await input.press('ArrowDown'); await expect(input).toHaveValue(second);
    await input.press('ArrowDown'); await expect(input).toHaveValue('draft');
    await input.press('Home'); await page.clock.runFor(32); expect(await selection(page)).toEqual([0, 0]);
    await input.pressSequentially('x'); await expect(input).toHaveValue('xdraft');
  });
}

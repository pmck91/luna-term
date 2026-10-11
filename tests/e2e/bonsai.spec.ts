import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/'); const input = page.locator('#terminal-input');
  await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
  await expect(input).toHaveAttribute('aria-label', 'Terminal command');
}
async function command(page: Page, value: string) {
  const input = page.locator('#terminal-input'); await input.fill(value); await input.press('Enter');
}
async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const input = document.querySelector('.command-line')!.getBoundingClientRect();
    const output = document.querySelector('.terminal-output')!.getBoundingClientRect();
    const tree = document.querySelector('.bonsai-output[data-seed] .bonsai-tree')!.getBoundingClientRect();
    return {
      pageFits: document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
      inputVisible: input.top >= 0 && input.bottom <= innerHeight + 1,
      treeFits: tree.left >= output.left && tree.right <= output.right + 1 && tree.top >= output.top - 1 && tree.bottom <= output.bottom + 1,
    };
  })).toEqual({ pageFits: true, inputVisible: true, treeFits: true });
}

test('bonsai growth, keyboard pause, selection, deterministic seeds, and shell return', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page); await page.clock.install(); const input = page.locator('#terminal-input');
  await command(page, 'cd games'); await command(page, 'ls');
  await expect(page.locator('.text-output').last()).toContainText('2048-readme.txt');
  await expect(page.locator('.text-output').last()).toContainText('bonsai.game');
  await command(page, 'cat bonsai-readme.txt'); await expect(page.locator('.text-output').last()).toContainText('Selecting text pauses growth');
  await input.fill('bon'); await input.press('Tab'); await expect(input).toHaveValue('bonsai ');
  await input.fill('bonsai --see');
  // A previous completion's animation frame must not move the caret in new input.
  await page.clock.runFor(32); expect(await input.evaluate(el => (el as HTMLInputElement).selectionStart)).toBe('bonsai --see'.length);
  await input.press('Tab'); await expect(input).toHaveValue('bonsai --seed ');
  await input.pressSequentially('42'); await input.press('Enter');
  const active = page.locator('.bonsai-output[data-seed]'), art = active.locator('.bonsai-tree');
  await expect(input).toHaveAttribute('aria-label', 'Bonsai input'); await expect(input).toBeFocused();
  await expect(page.locator('.command-line .prompt')).toHaveText('bonsai>');
  await expect(active).toHaveAttribute('data-seed', '42');
  await expect(page.locator('.text-output').last()).toContainText('cbonsai by John Allbritten');
  await expect(page.locator('.text-output').last().getByRole('link', { name: 'https://gitlab.com/jallbrit/cbonsai', exact: true })).toHaveAttribute('href', 'https://gitlab.com/jallbrit/cbonsai');
  const echoCount = await page.locator('.command-echo').count();
  await page.clock.runFor(500); expect(Number(await active.getAttribute('data-progress'))).toBeGreaterThan(0);
  await input.press('Space'); await expect(active).toHaveAttribute('data-paused', 'true');
  const paused = await active.getAttribute('data-progress'); await page.clock.runFor(500);
  await expect(active).toHaveAttribute('data-progress', paused!);
  await input.press('Space'); await expect(active).toHaveAttribute('data-paused', 'false'); await page.clock.runFor(300); expect(Number(await active.getAttribute('data-progress'))).toBeGreaterThan(Number(paused));
  await art.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await expect(active).toHaveAttribute('data-paused', 'true');
  const selected = await page.evaluate(() => getSelection()!.toString()), selectedProgress = await active.getAttribute('data-progress');
  await input.press('Control+c'); await page.clock.runFor(500);
  expect(await page.evaluate(() => getSelection()!.toString())).toBe(selected); await expect(active).toHaveAttribute('data-progress', selectedProgress!);
  await input.press('Escape'); await expect(input).toBeFocused(); await expect(active).toHaveAttribute('data-paused', 'false'); await page.clock.runFor(300);
  expect(Number(await active.getAttribute('data-progress'))).toBeGreaterThan(Number(selectedProgress));
  await command(page, 'pause'); await expect(active).toHaveAttribute('data-paused', 'true');
  await command(page, 'resume'); await expect(active).toHaveAttribute('data-paused', 'false');
  expect(await page.locator('.command-echo').count()).toBe(echoCount);
  await input.press('Control+l'); await expect(page.locator('.command-echo')).toHaveCount(0); await expect(active).toHaveAttribute('data-seed', '42');
  await page.clock.runFor(10000); await expect(active).toHaveAttribute('data-complete', 'true');
  const fullTree = await art.textContent(); await fits(page);
  await page.screenshot({ path: `artifacts/${info.project.name}-bonsai.png` });
  await command(page, 'q'); await expect(active).toHaveCount(0); await expect(input).toHaveAttribute('aria-label', 'Terminal command');
  await expect(page.locator('.command-line .prompt')).toHaveText('guest@term.pmck.ie:~/games$');
  expect(await page.locator('.bonsai-tree').last().textContent()).toBe(fullTree);
  await input.press('ArrowUp'); await expect(input).toHaveValue('bonsai --seed 42'); await input.press('Enter');
  await page.clock.runFor(10000); expect(await art.textContent()).toBe(fullTree);
  await command(page, 'r'); await expect(active).not.toHaveAttribute('data-seed', '42'); await expect(active).toHaveAttribute('data-complete', 'false');
  await input.press('Control+c'); await expect(input).toHaveAttribute('aria-label', 'Terminal command');
  await expect(page.locator('.text-output').last()).toContainText('^C Seed:');
  await expect(page.locator('.public-page > *')).toHaveCount(2); expect(errors).toEqual([]);
});

test('bonsai fits mobile keyboard viewports and follows all terminal palettes', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page);
  await command(page, 'clear'); await command(page, '~/games/bonsai.game --seed 42');
  const active = page.locator('.bonsai-output[data-seed]'); await expect(active).toHaveAttribute('data-complete', 'true');
  await fits(page); const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: 330 }); await fits(page);
  await page.screenshot({ path: `artifacts/${info.project.name}-bonsai-short.png` });
  await page.setViewportSize({ width: 320, height: 330 }); await fits(page); await expect(active).toHaveAttribute('data-seed', '42');
  await page.screenshot({ path: `artifacts/${info.project.name}-bonsai-narrow.png` }); await page.setViewportSize(size);
  const palettes: string[][] = [];
  for (const theme of ['mocha', 'dracula', 'nord', 'solarized-dark']) {
    await command(page, 'q'); await command(page, `theme ${theme}`); await command(page, 'clear'); await command(page, 'bonsai --seed 42');
    const colours = await active.evaluate(el => ['wood', 'wood-light', 'leaf', 'leaf-light', 'pot'].map(tone => getComputedStyle(el.querySelector(`.bonsai-${tone}`)!).color));
    expect(new Set(colours).size).toBe(5); palettes.push(colours); await fits(page);
  }
  expect(new Set(palettes.map(p => p.join(','))).size).toBe(4);
});

test('screensaver cycles, preserves selection for copying, and consumes its exit key', async ({ page }) => {
  await login(page); await page.clock.install(); await command(page, 'bonsai --screensaver --seed 42');
  const active = page.locator('.bonsai-output[data-seed]'), input = page.locator('#terminal-input');
  await page.clock.runFor(12000); await expect(active).not.toHaveAttribute('data-seed', '42');
  await active.locator('.bonsai-tree').evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await expect(active).toHaveAttribute('data-paused', 'true');
  const seed = await active.getAttribute('data-seed'), progress = await active.getAttribute('data-progress');
  await input.press('Control+c'); await page.clock.runFor(3000); await expect(active).toHaveAttribute('data-seed', seed!); await expect(active).toHaveAttribute('data-progress', progress!);
  await input.press('Escape'); await expect(active).toHaveCount(0); await expect(input).toHaveAttribute('aria-label', 'Terminal command'); await expect(input).toBeFocused(); await expect(input).toHaveValue('');
  await command(page, 'bonsai --screensaver --seed 42'); await input.press('x'); await expect(active).toHaveCount(0); await expect(input).toHaveValue('');
  await command(page, 'bonsai --screensaver'); await input.evaluate(el => (el as HTMLInputElement).blur()); await page.keyboard.press('ArrowRight'); await expect(active).toHaveCount(0); await expect(input).toBeFocused();
  await command(page, 'bonsai --screensaver'); await input.press('Control+l'); await expect(active).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await command(page, 'bonsai --screensaver --seed 42');
  await expect(active).toHaveAttribute('data-complete', 'true'); await page.clock.runFor(15000); await expect(active).toHaveAttribute('data-seed', '42');
  await input.press('Enter'); await expect(active).toHaveCount(0);
});

test('growth stops in a hidden tab and resumes when visible', async ({ page }) => {
  await login(page); await page.clock.install(); await command(page, 'bonsai --seed 42'); const active = page.locator('.bonsai-output[data-seed]');
  await page.clock.runFor(300);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const progress = await active.getAttribute('data-progress'); await page.clock.runFor(1000); await expect(active).toHaveAttribute('data-progress', progress!);
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(300); expect(Number(await active.getAttribute('data-progress'))).toBeGreaterThan(Number(progress));
});

import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');
  const input = page.locator('#terminal-input'); await expect(input).toBeVisible();
  await input.fill('guest'); await input.press('Enter');
  await expect(input).toHaveAttribute('aria-label', 'Terminal command');
}
async function command(page: Page, text: string) {
  const input = page.locator('#terminal-input'); await input.fill(text); await input.press('Enter');
}
async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const prompt = document.querySelector('.command-line')!.getBoundingClientRect();
    const board = document.querySelector('.game-output[data-finished="false"] .game-board')!.getBoundingClientRect();
    const terminal = document.querySelector('.terminal-output')!.getBoundingClientRect();
    return {
      pageFits: document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
      promptVisible: prompt.bottom <= innerHeight && prompt.top >= 0,
      boardFits: board.width <= terminal.width && board.left >= terminal.left && board.right <= terminal.right,
    };
  })).toEqual({ pageFits: true, promptVisible: true, boardFits: true });
}

test('ASCII game discovery, movement, scrolling, selection, restart, and shell return', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page); const input = page.locator('#terminal-input');
  await command(page, 'ls'); await expect(page.locator('.text-output').last()).toContainText('games/');
  await input.fill('cd ga'); await input.press('Tab'); await expect(input).toHaveValue('cd games/'); await input.press('Enter');
  await command(page, 'ls'); await expect(page.locator('.text-output').last()).toContainText('2048-readme.txt  2048.game  bonsai-readme.txt  bonsai.game');
  await command(page, 'cat 2048-readme.txt'); await expect(page.locator('.text-output').last()).toContainText('W/A/S/D then Enter');
  for (let i = 0; i < 4; i++) await command(page, 'help');
  await page.evaluate(() => { Math.random = () => 0; });
  await input.fill('./2048.g'); await input.press('Tab'); await expect(input).toHaveValue('./2048.game '); await input.press('Enter');
  const game = page.locator('.game-output[data-finished="false"]'), board = game.locator('.game-board');
  await expect(input).toHaveAttribute('aria-label', '2048 game input'); await expect(input).toBeFocused();
  await expect(page.locator('.command-line .prompt')).toHaveText('2048>');
  expect(await game.locator('.game-tile[data-value]').count()).toBe(2);
  const echoCount = await page.locator('.command-echo').count();
  await board.evaluate(el => el.setAttribute('data-identity', 'original-board'));
  await input.press('ArrowLeft'); await expect(game.locator('.game-score')).toContainText('Score: 4');
  await expect(board).toHaveAttribute('data-identity', 'original-board');
  expect(await page.locator('.command-echo').count()).toBe(echoCount);
  const colours = await game.locator('.game-tile[data-value]').evaluateAll(els => els.map(el => getComputedStyle(el).color));
  expect(new Set(colours).size).toBe(2);
  await expect(input).toHaveValue('');
  const output = page.locator('.terminal-output'); const bottom = await output.evaluate(el => el.scrollTop);
  await input.press('PageUp'); const earlier = await output.evaluate(el => el.scrollTop); expect(earlier).toBeLessThan(bottom);
  await input.press('ArrowDown'); expect(await output.evaluate(el => el.scrollTop)).toBe(earlier);
  await input.press('PageDown'); await input.press('PageDown');
  await input.fill('d'); await input.press('Enter'); await expect(input).toHaveValue('');
  if (info.project.name === 'desktop') { const before = await board.textContent(); await input.press('w'); expect(await board.textContent()).not.toBe(before); await expect(input).toHaveValue(''); }
  for (const key of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) await input.press(key);
  const beforeRestart = await board.textContent();
  await input.fill('r'); await input.press('Enter'); await expect(game.locator('.game-status')).toContainText('Restart?');
  await input.press('ArrowLeft'); expect(await board.textContent()).toBe(beforeRestart);
  await input.fill('n'); await input.press('Enter'); expect(await board.textContent()).toBe(beforeRestart);
  let savedBest = await page.evaluate(() => localStorage.getItem('luna-2048-best')); expect(Number(savedBest)).toBeGreaterThan(0);
  await game.locator('.game-heading').evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await page.keyboard.press('Control+c'); expect(await page.evaluate(() => getSelection()!.toString())).toBe('Luna 2048');
  await expect(game).toBeVisible(); await page.keyboard.press('Escape'); await expect(input).toBeFocused();
  await input.press('Control+l'); await expect(page.locator('.command-echo')).toHaveCount(0); expect(await board.textContent()).toBe(beforeRestart);
  await fits(page); await page.screenshot({ path: `artifacts/${info.project.name}-2048.png` });
  const size = page.viewportSize()!; await page.setViewportSize({ width: size.width, height: 330 }); await fits(page);
  await input.fill('a'); await input.press('Enter'); await expect(input).toBeFocused();
  savedBest = await page.evaluate(() => localStorage.getItem('luna-2048-best'));
  expect(await board.evaluate(el => { const grid = el.getBoundingClientRect(); const output = el.closest('.terminal-output')!.getBoundingClientRect(); return grid.top >= output.top && grid.bottom <= output.bottom; })).toBe(true);
  await page.screenshot({ path: `artifacts/${info.project.name}-2048-short.png` }); await page.setViewportSize(size);
  await input.fill('r'); await input.press('Enter'); await input.fill('y'); await input.press('Enter');
  await expect(game.locator('.game-score')).toContainText('Score: 0'); expect(await game.locator('.game-tile[data-value]').count()).toBe(2);
  await expect(game.locator('.game-score')).toContainText(`Best: ${savedBest}`);
  await input.fill('q'); await input.press('Enter'); await expect(game).toHaveCount(0);
  await expect(page.locator('.game-output[data-finished="true"]')).toHaveCount(1);
  await expect(page.locator('.command-line .prompt')).toHaveText('guest@term.pmck.ie:~/games$');
  await input.press('ArrowUp'); await expect(input).toHaveValue('./2048.game '); await input.press('Enter');
  await input.press('Control+c'); await expect(input).toHaveAttribute('aria-label', 'Terminal command');
  await expect(page.locator('.text-output').last()).toContainText('^C Final score:');
  await page.reload(); await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
  await command(page, '~/games/2048.game'); await expect(page.locator('.game-output[data-finished="false"] .game-score')).toContainText(`Best: ${savedBest}`);
  expect(errors).toEqual([]);
});

test('all tile colours follow the selected terminal theme', async ({ page }) => {
  await login(page); const input = page.locator('#terminal-input'); const palettes: string[][] = [];
  for (const theme of ['mocha', 'dracula', 'nord', 'solarized-dark']) {
    await command(page, `theme ${theme}`); await command(page, 'clear'); await command(page, '~/games/2048.game');
    const colours = await page.locator('.public-page').evaluate(el => [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].map(value => getComputedStyle(el).getPropertyValue(`--tile-${value}`).trim()));
    expect(colours.every(value => /^#[a-f\d]{6}$/i.test(value))).toBe(true); expect(new Set(colours).size).toBe(11); palettes.push(colours);
    const surface = await page.locator('.public-page').evaluate(el => getComputedStyle(el).getPropertyValue('--surface').trim());
    const luminance = (hex: string) => {
      const linear = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    for (const colour of colours) expect((luminance(colour) + 0.05) / (luminance(surface) + 0.05)).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator('.public-page')).toHaveAttribute('data-theme', theme);
    await fits(page); await input.press('Control+c');
  }
  expect(new Set(palettes.map(colours => colours.join(','))).size).toBe(4);
});

test('game works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('Storage blocked'); }; Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; });
  await login(page); await page.evaluate(() => { Math.random = () => 0; });
  await command(page, './games/2048.game'); const input = page.locator('#terminal-input');
  await input.press('ArrowLeft'); await expect(page.locator('.game-output[data-finished="false"] .game-score')).toContainText('Score: 4   Best: 4');
  await input.press('Control+c'); await expect(input).toHaveAttribute('aria-label', 'Terminal command');
});

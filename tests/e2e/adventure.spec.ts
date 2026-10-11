import { test, expect, type Page } from '@playwright/test';
import { copy } from '../../shared/adventure-content';
const saveKey = 'luna-adventure-save';
async function login(page: Page) {
  await page.goto('/'); const input = page.locator('#terminal-input');
  await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
  await expect(input).toHaveAttribute('aria-label', 'Terminal command');
}
async function command(page: Page, text: string) {
  const input = page.locator('#terminal-input'); await input.fill(text); await input.press('Enter');
}
async function commands(page: Page, lines: string[]) { for (const line of lines) await command(page, line); }
async function findNote(page: Page) { await commands(page, ['up', 'scratch door', 'climb shelf', 'knock book', 'go upstairs hallway', 'down']); }
async function saved(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey); }
async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const prompt = document.querySelector('.command-line')!.getBoundingClientRect(), output = document.querySelector('.terminal-output')!;
    return { pageFits: document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
      promptFits: prompt.top >= 0 && prompt.bottom <= innerHeight && prompt.right <= innerWidth,
      outputFits: output.scrollWidth <= output.clientWidth + 1,
      focused: document.activeElement?.id === 'terminal-input',
      onlyTerminalAndFooter: [...document.querySelector('.public-page')!.children].map(el => el.tagName).join(',') === 'SECTION,FOOTER' };
  })).toEqual({ pageFits: true, promptFits: true, outputFits: true, focused: true, onlyTerminalAndFooter: true });
}

test('optional puzzles, sink resume, office door, ball treats, and the fox stay inside the terminal', async ({ page }, info) => {
  await login(page); const input = page.locator('#terminal-input');
  await commands(page, ['~/games/lunas-adventure.game', 'up', 'go bedroom']);
  await input.fill('paw dr'); await input.press('Tab'); await expect(input).toHaveValue('paw dr');
  await command(page, 'inspect wardrobe');
  await expect(page.locator('.adventure-output').last()).toContainText('dressing gown');
  await input.fill('paw dr'); await input.press('Tab'); await expect(input).toHaveValue('paw dressing gown '); await input.press('Enter');
  await commands(page, ['push wardrobe door', 'hide wardrobe']);
  await expect(page.locator('.adventure-output').last()).toContainText('Optional puzzle complete: wardrobe den');
  expect((await saved(page)).completed).toBe(false);
  await fits(page); await page.screenshot({ path: `artifacts/${info.project.name}-adventure-den.png` });
  await commands(page, ['go upstairs hallway', 'go bathroom']);
  await input.fill('take ba'); await input.press('Tab'); await expect(input).toHaveValue('take ba');
  await commands(page, ['inspect sink', 'climb sink', 'paw ball']);
  await expect(page.locator('.adventure-output').last()).toContainText('spins in the recess');
  await command(page, 'paw tap'); expect((await saved(page)).basinFilled).toBe(false);
  await input.fill('push pl'); await input.press('Tab'); await expect(input).toHaveValue('push plug '); await input.press('Enter');
  await command(page, 'paw tap'); await expect(page.locator('.adventure-output').last()).toContainText('knock the tap shut');
  await page.reload(); await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
  await command(page, '~/games/lunas-adventure.game');
  await expect(page.locator('.adventure-output').last()).toContainText('ball floats in the sink');
  expect((await saved(page)).position).toBe('sink'); expect((await saved(page)).denClaimed).toBe(true);
  await input.fill('paw ba'); await input.press('Tab'); await expect(input).toHaveValue('paw ball '); await input.press('Enter');
  await expect(page.locator('.adventure-output').last()).toContainText('ping-pong ball rescued');
  await commands(page, ['take ball', 'go upstairs hallway', 'go office']);
  await expect(page.locator('.adventure-output').last()).toContainText('office door is shut');
  await command(page, 'scratch door'); await expect(page.locator('.adventure-output').last()).toContainText('He goes back to his desk');
  await commands(page, ['meow', 'go upstairs hallway', 'down', 'go sitting room', 'go kitchen', 'purr', 'play ball', 'eat']);
  expect((await saved(page)).treatEarned).toBe(true); expect((await saved(page)).completed).toBe(false);
  await input.fill('look at back d'); await input.press('Tab'); await expect(input).toHaveValue('look at back door '); await input.press('Enter');
  await expect(page.locator('.adventure-output').last()).toContainText('Your tail puffs up');
  await fits(page); await page.screenshot({ path: `artifacts/${info.project.name}-adventure-fox.png` });
  const size = page.viewportSize()!; await page.setViewportSize({ width: 320, height: 330 });
  await commands(page, ['goals', 'hint bathroom']); await fits(page);
  await expect(page.locator('.adventure-output').last()).toContainText('already out');
  await input.press('Control+l'); await expect(page.locator('.adventure-output').last()).toContainText('glass back door');
  await command(page, 'goals'); await page.screenshot({ path: `artifacts/${info.project.name}-adventure-optional-short.png` });
  await page.setViewportSize(size);
  await commands(page, ['drop ball', 'take ball', 'quit', '~/games/lunas-adventure.game', 'inventory']);
  await expect(page.locator('.adventure-output').last()).toContainText('ping-pong ball');
  expect((await saved(page)).foxSeen).toBe(true); await fits(page);
});

test('version-one browser saves resume with an open office and fresh optional puzzles', async ({ page }) => {
  const legacy = { version: 1, room: 'office', position: 'shelf', bowlFilled: false, fed: false, jarReady: false, treatEarned: false, bookDown: true, noteFound: true, cushionMoved: false, mouseFound: false, completed: false, items: { sock: 'bedroom', mouse: null }, done: ['paw:tap'], hints: Object.fromEntries(['food-find', 'food-eat', 'treats-find', 'treats-purr', 'treats-play', 'toy-shelf', 'toy-book', 'toy-couch', 'toy-cushion', 'toy-take'].map(step => [step, 1])) };
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: saveKey, state: legacy });
  await login(page); await command(page, '~/games/lunas-adventure.game');
  await expect(page.locator('.adventure-output').last()).toContainText('Resuming');
  await expect(page.locator('.adventure-output').last()).toContainText('note is on the shelf');
  await command(page, 'look');
  expect(await saved(page)).toMatchObject({ version: 2, officeDoorOpen: true, noteFound: true, position: 'shelf', denClaimed: false, ballRescued: false });
  await commands(page, ['go upstairs hallway', 'go office']);
  await expect(page.locator('.adventure-output').last()).toContainText('Office');
  await fits(page);
});

test('complete adventure, items, keyboard controls, saving, and terminal-only layout', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page); const input = page.locator('#terminal-input');
  await commands(page, ['cd games', 'ls']); await expect(page.locator('.text-output').last()).toContainText('lunas-adventure.game');
  await command(page, 'cat lunas-adventure-readme.txt'); await expect(page.locator('.text-output').last()).toContainText('Every interaction');
  await input.fill('./lunas-adventure.g'); await input.press('Tab'); await expect(input).toHaveValue('./lunas-adventure.game '); await input.press('Enter');
  await expect(input).toHaveAttribute('aria-label', 'Luna adventure input'); await expect(input).toBeFocused();
  await expect(page.locator('.command-line .prompt')).toHaveText('luna>');
  await expect(page.locator('.adventure-output').last()).toContainText('Downstairs hallway');
  await commands(page, ['sniff shoes', 'paw doormat', 'scratch doormat', 'hide coat', 'roll doormat', 'up']);
  await input.fill('go of'); await input.press('Tab'); await expect(input).toHaveValue('go office '); await input.press('Enter');
  await expect(page.locator('.adventure-output').last()).toContainText('office door is shut');
  await input.fill('scratch of'); await input.press('Tab'); await expect(input).toHaveValue('scratch office door '); await input.press('Enter');
  await expect(page.locator('.adventure-output').last()).toContainText('He goes back to his desk');
  await commands(page, ['paw keyboard', 'meow', 'climb shelf', 'knock book']);
  await expect(page.locator('.adventure-output').last()).toContainText('blue couch cushion');
  await fits(page); await page.screenshot({ path: `artifacts/${info.project.name}-adventure-office.png` });
  await commands(page, ['climb down', 'go upstairs hall', 'go bedroom', 'hide duvet', 'take sock', 'push sock', 'take sock', 'go upstairs hallway', 'go bathroom', 'paw tap', 'paw toilet paper', 'sit bathmat', 'go upstairs hallway', 'sniff rug', 'roll rug', 'sit sun patch', 'down', 'go sitting room', 'scratch post', 'inspect cushion']);
  await command(page, 'push cushion'); await expect(page.locator('.adventure-output').last()).toContainText("paw doesn't reach");
  await commands(page, ['climb couch', 'push cushion']);
  await input.fill('take mo'); await input.press('Tab'); await expect(input).toHaveValue('take mouse '); await input.press('Enter');
  await commands(page, ['go kitchen', 'read shopping list', 'sniff cupboard', 'purr', 'play sock', 'eat']);
  await expect(page.locator('.adventure-output').last()).toContainText(copy.ending);
  await expect.poll(async () => (await saved(page)).completed).toBe(true);
  await command(page, 'goals'); await expect(page.locator('.adventure-output').last()).toContainText('[x] Mouse found');
  await command(page, 'inventory'); await expect(page.locator('.adventure-output').last()).toContainText('sock, yellow mouse');

  // History belongs to the adventure and restores the unsubmitted draft.
  await input.fill('draft'); await input.press('ArrowUp'); await expect(input).toHaveValue('inventory');
  await input.press('ArrowUp'); await expect(input).toHaveValue('goals');
  await input.press('ArrowDown'); await input.press('ArrowDown'); await expect(input).toHaveValue('draft'); await input.fill('');
  const output = page.locator('.terminal-output'); const before = await output.evaluate(el => el.scrollTop);
  await input.press('PageUp'); expect(await output.evaluate(el => el.scrollTop)).toBeLessThan(before);
  await input.press('PageDown');
  await input.press('Control+l'); await expect(page.locator('.command-echo')).toHaveCount(0);
  await expect(page.locator('.adventure-output').last()).toContainText('Kitchen'); expect((await saved(page)).completed).toBe(true);
  await command(page, 'map'); const map = page.locator('.adventure-map').last();
  await map.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await input.press('Control+c'); await expect(input).toHaveAttribute('aria-label', 'Luna adventure input'); expect(await page.evaluate(() => getSelection()!.toString())).toContain('Bathroom');
  await input.press('Escape'); await fits(page); await command(page, 'goals');
  await page.screenshot({ path: `artifacts/${info.project.name}-adventure.png` });
  const size = page.viewportSize()!; await page.setViewportSize({ width: 320, height: 330 }); await fits(page);
  await command(page, 'look'); await expect(input).toBeFocused(); await command(page, 'map'); await fits(page);
  await page.screenshot({ path: `artifacts/${info.project.name}-adventure-short.png` }); await page.setViewportSize(size);
  await command(page, 'quit'); await expect(input).toHaveAttribute('aria-label', 'Terminal command');
  await expect(page.locator('.command-line .prompt')).toHaveText('guest@term.pmck.ie:~/games$');
  await input.press('ArrowUp'); await expect(input).toHaveValue('./lunas-adventure.game '); await input.press('Enter');
  await expect(page.locator('.adventure-output').last()).toContainText('Resuming'); await input.press('ArrowUp'); await expect(input).toHaveValue('');
  await command(page, 'restart'); await expect(page.locator('.command-line .prompt')).toHaveText('restart? [yes/no]:');
  await input.press('Tab'); await expect(input).toHaveValue(''); await expect(page.locator('.adventure-output').last()).toContainText('yes  no');
  await command(page, 'no'); expect((await saved(page)).completed).toBe(true);
  await command(page, 'restart'); await command(page, 'maybe'); await expect(page.locator('.text-output').last()).toContainText('Type yes');
  await input.fill('y'); await input.press('Tab'); await expect(input).toHaveValue('yes '); await input.press('Enter');
  await expect(page.locator('.adventure-output').last()).toContainText('New adventure'); expect((await saved(page)).completed).toBe(false);
  await command(page, 'up'); await input.press('Control+c'); await expect(input).toHaveAttribute('aria-label', 'Terminal command');
  await page.reload(); await expect(input).toBeVisible(); await input.fill('guest'); await input.press('Enter');
  await command(page, '~/games/lunas-adventure.game'); await expect(page.locator('.adventure-output').last()).toContainText('Upstairs hallway');
  expect(errors).toEqual([]);
});

test('hints, cushion discovery after the note, dropped items, and theme colours', async ({ page }) => {
  await login(page); const input = page.locator('#terminal-input');
  await command(page, '~/games/lunas-adventure.game');
  for (const clue of ['closed office door', 'scratches', 'scratch door']) { await command(page, 'hint toy'); await expect(page.locator('.adventure-output').last()).toContainText(clue); }
  await command(page, 'go sitting room');
  await expect(page.locator('.adventure-output').last()).not.toContainText('cushion');
  await command(page, 'inspect couch'); await expect(page.locator('.adventure-output').last()).not.toContainText('cushion');
  await input.fill('inspect cu'); await input.press('Tab'); await expect(input).toHaveValue('inspect cu');
  await input.press('Enter'); await expect(page.locator('.adventure-output').last()).toContainText("You can't inspect cu here");
  await commands(page, ['climb couch', 'paw cushion']);
  expect((await saved(page)).cushionMoved).toBe(false);
  await command(page, 'go downstairs hallway'); await findNote(page);
  await command(page, 'go sitting room');
  await expect(page.locator('.adventure-output').last()).toContainText('blue cushion');
  await input.fill('inspect cu'); await input.press('Tab'); await expect(input).toHaveValue('inspect cushion '); await input.press('Enter');
  await expect(page.locator('.adventure-output').last()).toContainText('small lump');
  await commands(page, ['climb couch', 'paw cushion', 'take toy']);
  expect((await saved(page)).noteFound).toBe(true);
  await command(page, 'hint toy'); await expect(page.locator('.adventure-output').last()).toContainText('found your mouse');
  await commands(page, ['go downstairs hallway', 'up', 'go bedroom', 'drop mouse', 'inventory']);
  await expect(page.locator('.adventure-output').last()).toContainText('not carrying');
  await commands(page, ['look', 'take mouse', 'take sock', 'go upstairs hallway', 'go office', 'meow', 'go upstairs hallway', 'down', 'go sitting room', 'go kitchen', 'purr', 'play mouse', 'eat', 'drop mouse']);
  expect((await saved(page)).completed).toBe(true); expect((await saved(page)).items.mouse).toBe('kitchen');
  await command(page, 'quit');
  const colours: string[] = [];
  for (const theme of ['mocha', 'dracula', 'nord', 'solarized-dark']) {
    await commands(page, [`theme ${theme}`, 'clear', '~/games/lunas-adventure.game']);
    await expect(page.locator('.public-page')).toHaveAttribute('data-theme', theme);
    colours.push(await page.locator('.adventure-heading').last().evaluate(el => getComputedStyle(el).color));
    await fits(page); await input.press('Control+c');
  }
  expect(new Set(colours).size).toBe(4);
});

test('blocked storage keeps the adventure playable and resumable during the visit', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('Blocked'); }; Storage.prototype.setItem = () => { throw new Error('Blocked'); }; });
  await login(page); await command(page, './games/lunas-adventure.game');
  await expect(page.locator('.adventure-output').last()).toContainText('this visit only');
  await findNote(page);
  await commands(page, ['go sitting room', 'climb couch', 'push cushion', 'take mouse', 'quit', './games/lunas-adventure.game']);
  await expect(page.locator('.adventure-output').last()).toContainText('Resuming');
  await command(page, 'inventory'); await expect(page.locator('.adventure-output').last()).toContainText('yellow mouse');
  await fits(page);
});

test('invalid saves are explained and safely replaced', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ version: 99, completed: true, room: 'cellar' })), saveKey);
  await login(page); await command(page, './games/lunas-adventure.game');
  await expect(page.locator('.adventure-output').last()).toContainText('could not be read. Starting fresh');
  expect((await saved(page)).room).toBe('downstairs hallway');
  await command(page, 'up'); expect((await saved(page)).room).toBe('upstairs hallway');
});

test('a save failure reports once and retains newer in-memory progress', async ({ page }) => {
  await login(page); await command(page, './games/lunas-adventure.game');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); }; });
  await findNote(page);
  await commands(page, ['go sitting room', 'climb couch', 'push cushion', 'take mouse']);
  await expect(page.getByText('Progress could not be saved. It will last for this visit only.', { exact: true })).toHaveCount(1);
  expect((await saved(page)).room).toBe('downstairs hallway');
  await commands(page, ['quit', './games/lunas-adventure.game', 'inventory']);
  await expect(page.locator('.adventure-output').last()).toContainText('yellow mouse');
  await expect(page.locator('#terminal-input')).toBeFocused();
});

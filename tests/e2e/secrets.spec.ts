import { test, expect, type Page } from '@playwright/test';
import { fortunes, incidentReport, meowResponses } from '../../shared/secrets';
async function login(page: Page, username: string) {
  await page.goto('/'); const input = page.locator('#terminal-input'); await expect(input).toBeVisible();
  await input.fill(username); await input.press('Enter'); await expect(input).toHaveAttribute('aria-label', 'Terminal command');
}
async function command(page: Page, text: string) {
  const input = page.locator('#terminal-input'); await input.fill(text); await input.press('Enter');
}
async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const output = document.querySelector('.terminal-output')!, prompt = document.querySelector('.command-line')!.getBoundingClientRect();
    return { page: document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
      output: output.scrollWidth <= output.clientWidth + 1, prompt: prompt.top >= 0 && prompt.bottom <= innerHeight,
      focus: document.activeElement?.id === 'terminal-input', chrome: [...document.querySelector('.public-page')!.children].map(element => element.tagName).join(',') };
  })).toEqual({ page: true, output: true, prompt: true, focus: true, chrome: 'SECTION,FOOTER' });
}
test('cat secrets use the login name and work through ordinary terminal commands', async ({ page }, info) => {
  await login(page, 'visitor'); await command(page, 'clear'); await command(page, 'ls');
  const input = page.locator('#terminal-input'), output = page.locator('.text-output');
  await expect(output.last()).not.toContainText('.config'); await command(page, 'ls -a'); await expect(output.last()).toContainText('.config/');
  await input.fill('cat ~/.c'); await input.press('Tab'); await expect(input).toHaveValue('cat ~/.config/');
  await input.pressSequentially('lu'); await input.press('Tab'); await expect(input).toHaveValue('cat ~/.config/luna.conf '); await input.press('Enter');
  await expect(output.last()).toContainText('respect_closed_doors=false');
  await command(page, 'ps'); await expect(output.last()).toContainText('Luna processes (simulated)'); await expect(output.last()).toContainText('napd');
  await command(page, 'sudo rm -rf /'); await expect(output.last()).toHaveText('visitor is not in the sudoers file. This incident will be ignored.');
  await command(page, 'pwd'); await expect(output.last()).toHaveText('/');
  for (const response of meowResponses.slice(0, 2)) { await command(page, 'meow'); await expect(output.last()).toHaveText(response); }
  await command(page, 'cd games'); await command(page, './2048.game'); await command(page, 'q');
  await command(page, 'clear'); await command(page, 'meow'); await expect(output.last()).toHaveText(meowResponses[2]);
  await command(page, 'meow'); await expect(output.last()).toHaveText('Peter has heard you.');
  await command(page, 'fortune'); const first = await output.last().textContent(); expect(fortunes).toContain(first);
  await command(page, 'fortune'); const second = await output.last().textContent(); expect(fortunes).toContain(second); expect(second).not.toBe(first);
  await input.fill('man lu'); await input.press('Tab'); await expect(input).toHaveValue('man luna '); await input.press('Enter');
  await expect(output.last()).toContainText('PREFERRED SLEEP LOCATIONS'); await expect(output.last()).toContainText('and forgets why.');
  const selectedText = output.last(); await selectedText.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await input.press('Control+c'); expect(await page.evaluate(() => getSelection()!.toString())).toContain('LUNA(1)');
  await input.press('Escape'); await fits(page); await page.screenshot({ path: `artifacts/${info.project.name}-secrets.png` });
  await page.setViewportSize({ width: 320, height: 330 }); await input.press('Control+l'); await command(page, 'ps'); await fits(page);
  await page.screenshot({ path: `artifacts/${info.project.name}-secrets-short.png` });
  await page.reload(); await expect(input).toBeVisible(); await input.fill('another-visitor'); await input.press('Enter');
  await command(page, 'meow'); await expect(output.last()).toHaveText(meowResponses[0]);
  await command(page, 'sudo'); await expect(output.last()).toContainText('another-visitor is not in the sudoers file'); await fits(page);
});
test('sudo renders a supplied username as text and never executes its arguments', async ({ page }) => {
  const username = '<img src=x onerror=alert(1)>';
  await login(page, username); await command(page, 'clear'); await command(page, 'sudo $(id)');
  await expect(page.locator('.text-output').last()).toHaveText(`${username} is not in the sudoers file. This incident will be ignored.`);
  await expect(page.locator('.terminal-output img, .terminal-output script')).toHaveCount(0);
  await command(page, 'ls'); await expect(page.locator('.text-output').last()).toContainText('projects/'); await fits(page);
});

test('hidden incident report is discoverable, selectable and fits the terminal', async ({ page }, info) => {
  await login(page, 'visitor'); await command(page, 'clear'); await command(page, 'cd documents');
  const input = page.locator('#terminal-input'), output = page.locator('.text-output');
  await command(page, 'ls'); await expect(output.last()).not.toContainText('.incident-report.txt');
  await command(page, 'ls -a'); await expect(output.last()).toContainText('.incident-report.txt');
  await input.fill('cat .inc'); await input.press('Tab'); await expect(input).toHaveValue('cat .incident-report.txt '); await input.press('Enter');
  await expect(output.last()).toHaveText(incidentReport);
  await output.last().evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await input.press('Control+c'); expect(await page.evaluate(() => getSelection()!.toString())).toBe(incidentReport);
  await input.press('Escape'); await fits(page);
  await page.screenshot({ path: `artifacts/${info.project.name}-incident-report.png` });
  await command(page, 'clear'); await command(page, 'cd ~/games'); await command(page, 'cat ~/documents/.incident-report.txt');
  await expect(output.last()).toHaveText(incidentReport); await fits(page);
  await page.setViewportSize({ width: 320, height: 330 }); await fits(page);
  await expect.poll(() => page.locator('.terminal-output').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
});

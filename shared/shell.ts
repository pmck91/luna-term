import { entryPath, isTheme, themes, type Catalog, type Entry, type Theme } from './models';
import { bonsaiAttribution, type BonsaiOptions } from './bonsai';
import { adventureInstructions } from './adventure-content';

export type Output = { type: 'text'; text: string; tone?: 'normal' | 'dim' | 'error' | 'success' } | { type: 'entry'; entry: Entry };
export type ShellResult = { output: Output[]; cwd?: string; action?: 'clear' | 'contact' | 'theme' | 'game2048' | 'bonsai' | 'adventure'; theme?: Theme; bonsai?: BonsaiOptions };
export const commands = ['help', 'pwd', 'ls', 'cd', 'cat', 'clear', 'theme', 'bonsai'];
type Node = { kind: 'directory' } | { kind: 'text'; text: string } | { kind: 'contact' } | { kind: 'game2048' } | { kind: 'bonsai' } | { kind: 'adventure' } | { kind: 'entry'; entry: Entry };
const gameInstructions = 'Luna 2048\n\nRun ~/games/2048.game, or ./2048.game from ~/games.\nMerge equal numbers to reach 2048.\nArrows or WASD move; on an on-screen keyboard type W/A/S/D then Enter.\nR requests a restart (confirm with Y or cancel with N).\nC continues after reaching 2048. Q or Ctrl+C quits.\nCtrl+L clears scrollback while keeping the game.\nYour personal best is saved in this browser only.';
const bonsaiInstructions = 'Luna bonsai\n\nWatch an ASCII bonsai grow inside the terminal.\n\nUsage: bonsai [--seed <0-4294967295>] [--screensaver]\n       ~/games/bonsai.game [options]\n\nSpace pauses or resumes. R grows a new tree. Q or Ctrl+C quits.\nOn an on-screen keyboard, type pause, resume, r, or q, then Enter.\nSelecting text pauses growth until the selection is cleared.\nScreensaver mode grows successive trees and exits on a keypress.\nReduced-motion preferences show a finished tree without animation.\nSeeds reproduce the tree shape. Resizing fits it to the terminal.\n\n' + bonsaiAttribution;
export function filesystem(catalog: Catalog): Map<string, Node> {
  const fs = new Map<string, Node>(['/', '/projects', '/documents', '/messaging', '/games'].map(p => [p, { kind: 'directory' }]));
  fs.set('/games/2048-readme.txt', { kind: 'text', text: gameInstructions });
  fs.set('/games/2048.game', { kind: 'game2048' });
  fs.set('/games/bonsai-readme.txt', { kind: 'text', text: bonsaiInstructions });
  fs.set('/games/bonsai.game', { kind: 'bonsai' });
  fs.set('/games/lunas-adventure-readme.txt', { kind: 'text', text: adventureInstructions });
  fs.set('/games/lunas-adventure.game', { kind: 'adventure' });
  fs.set('/messaging/contact.sh', { kind: 'contact' });
  fs.set('/messaging/socials.txt', { kind: 'text', text: catalog.socials.length ? catalog.socials.map(s => `${s.label}: ${s.url}`).join('\n') : 'No social links configured. Use ./contact.sh to leave a message.' });
  for (const entry of catalog.entries) if (entry.published) fs.set(entryPath(entry), { kind: 'entry', entry });
  return fs;
}
export function resolvePath(path: string, cwd = '/'): string {
  const input = path === '~' ? '/' : path.startsWith('~/') ? path.slice(1) : path;
  const parts: string[] = [];
  for (const part of (input.startsWith('/') ? input : `${cwd}/${input}`).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return '/' + parts.join('/');
}
export const displayPath = (path: string) => path === '/' ? '~' : '~' + path;
export function parseCommand(input: string): string[] {
  const words: string[] = []; let word = ''; let quote = ''; let started = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '\\' && quote !== "'") { if (i + 1 === input.length) throw new Error('Incomplete escape.'); word += input[++i]; started = true; }
    else if (quote) { if (c === quote) quote = ''; else word += c; }
    else if (c === '"' || c === "'") { quote = c; started = true; }
    else if (/\s/.test(c)) { if (started) { words.push(word); word = ''; started = false; } }
    else { word += c; started = true; }
  }
  if (quote) throw new Error(`Close the ${quote} quote before pressing Enter.`);
  if (started) words.push(word);
  return words;
}
const text = (s: string, tone?: 'error' | 'dim' | 'success'): ShellResult => ({ output: [{ type: 'text', text: s, tone }] });
function startBonsai(args: string[]): ShellResult {
  if (args.length === 1 && args[0] === '--help') return text(bonsaiInstructions);
  let seed: number | undefined; let screensaver = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && seed === undefined) {
      const value = args[++i];
      if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 4294967295) return text('bonsai: --seed requires a whole number from 0 to 4294967295.', 'error');
      seed = Number(value);
    } else if (args[i] === '--screensaver' && !screensaver) screensaver = true;
    else return text(`bonsai: unexpected option ${args[i]}. Type bonsai --help for usage.`, 'error');
  }
  return { output: [], action: 'bonsai', bonsai: { seed, screensaver } };
}
export function execute(input: string, cwd: string, catalog: Catalog): ShellResult {
  let args: string[];
  try { args = parseCommand(input); } catch (e) { return text((e as Error).message, 'error'); }
  if (!args.length) return { output: [] };
  const [cmd, ...rest] = args; const fs = filesystem(catalog);
  if (cmd === 'bonsai') return startBonsai(rest);
  if (cmd === 'help') return rest.length ? text('Usage: help', 'error') : text(`Luna virtual shell\n\nhelp             Show this help\npwd              Print the virtual working directory\nls [path]        List filenames\ncd [path]        Change directory (no path returns home)\ncat <path>       Read a file as text\nclear            Clear scrollback\ntheme [name]     List or select a colour scheme\nbonsai [options] Grow an ASCII tree (bonsai --help for options)\n\nRun entries by typing their path:\n  ./projects/portfolio.luna\n  ./documents/<post>.ldoc\n  ./messaging/contact.sh\n  ./games/2048.game\n  ./games/lunas-adventure.game\nRead adventure instructions: cat ~/games/lunas-adventure-readme.txt\nRead game instructions: cat ~/games/2048-readme.txt\nRead bonsai instructions: cat ~/games/bonsai-readme.txt\nRead social links: cat ~/messaging/socials.txt\n\n.luna: projects  .ldoc: blog documents  .sh: virtual contact script  .game: built-in games\nAll commands run inside this browser's virtual filesystem.\n\nTab: complete    Up/Down: history    Ctrl+L: clear\nCtrl+C: copy selected text, otherwise cancel\nCtrl+Shift+C: copy selected text\nPage Up/Down: scroll output    Shift+Tab: links and media\nEscape: focus prompt\nContact: enter message lines, then a single dot; review before send.`);
  if (cmd === 'pwd') return rest.length ? text('Usage: pwd', 'error') : text(cwd);
  if (cmd === 'clear') return rest.length ? text('Usage: clear', 'error') : { output: [], action: 'clear' };
  if (cmd === 'theme') {
    if (!rest.length) return text(`Colour schemes: ${themes.join(', ')}\nUsage: theme <name>`);
    if (rest.length !== 1) return text('Usage: theme [name]', 'error');
    return isTheme(rest[0]) ? { ...text(`Theme: ${rest[0]}`, 'success'), action: 'theme', theme: rest[0] } : text(`Unknown theme: ${rest[0]}. Available: ${themes.join(', ')}`, 'error');
  }
  if (['ls', 'cd', 'cat'].includes(cmd)) {
    if (rest.length > 1 || (cmd === 'cat' && !rest.length)) return text(`Usage: ${cmd} ${cmd === 'cat' ? '<path>' : '[path]'}`, 'error');
    const path = resolvePath(rest[0] ?? (cmd === 'cd' ? '/' : cwd), cwd); const node = fs.get(path);
    if (!node) return text(`${cmd}: ${rest[0]}: No such file or directory`, 'error');
    if (cmd === 'cd') return node.kind === 'directory' ? { output: [], cwd: path } : text(`cd: ${rest[0]}: Not a directory`, 'error');
    if (cmd === 'ls') {
      if (node.kind !== 'directory') return text(path.split('/').pop()!);
      const prefix = path === '/' ? '/' : path + '/';
      const names = [...fs].filter(([p]) => p.startsWith(prefix) && p !== path && !p.slice(prefix.length).includes('/')).map(([p, n]) => p.slice(prefix.length) + (n.kind === 'directory' ? '/' : '')).sort();
      return text(names.join('  ') || '(empty directory)');
    }
    if (node.kind === 'directory') return text(`cat: ${rest[0]}: Is a directory`, 'error');
    return text(node.kind === 'entry' ? node.entry.markdown : node.kind === 'text' ? node.text : node.kind === 'game2048' ? gameInstructions : node.kind === 'bonsai' ? bonsaiInstructions : node.kind === 'adventure' ? adventureInstructions : 'Luna contact script. Run ./contact.sh from ~/messaging, or ~/messaging/contact.sh.');
  }
  if (cmd.includes('/') || cmd.startsWith('.')) {
    const node = fs.get(resolvePath(cmd, cwd));
    if (!node) return text(`${cmd}: No such file or directory`, 'error');
    if (node.kind === 'bonsai') return startBonsai(rest);
    if (rest.length) return text('Entries do not accept arguments.', 'error');
    if (node.kind === 'contact') return { output: [], action: 'contact' };
    if (node.kind === 'game2048') return { output: [], action: 'game2048' };
    if (node.kind === 'adventure') return { output: [], action: 'adventure' };
    if (node.kind === 'entry') return { output: [{ type: 'entry', entry: node.entry }] };
    return text(`${cmd}: ${node.kind === 'directory' ? 'Is a directory' : 'Not a runnable entry'}`, 'error');
  }
  return text(`${cmd}: command not found. Type help for commands.`, 'error');
}
export function complete(input: string, cwd: string, catalog: Catalog): { input: string; candidates: string[] } {
  const match = input.match(/^(.*\s)?([^\s]*)$/); if (!match) return { input, candidates: [] };
  const before = match[1] ?? ''; const token = match[2]; const cmd = before.trim().split(/\s+/)[0];
  let candidates: string[] = [];
  if (!before && !token.includes('/') && !token.startsWith('~')) candidates = commands.filter(s => s.startsWith(token));
  else if (cmd === 'theme') candidates = [...themes].filter(s => s.startsWith(token));
  else if (cmd === 'bonsai' || (cmd && resolvePath(cmd, cwd) === '/games/bonsai.game')) candidates = token.startsWith('--') ? ['--help', '--screensaver', '--seed'].filter(s => s.startsWith(token)) : [];
  else if (!before || ['ls', 'cd', 'cat'].includes(cmd)) {
    const slash = token.lastIndexOf('/'); const parent = slash >= 0 ? token.slice(0, slash + 1) : ''; const partial = token.slice(slash + 1);
    const dir = resolvePath(parent || '.', cwd); const prefix = dir === '/' ? '/' : dir + '/';
    candidates = [...filesystem(catalog)].filter(([p, node]) => p.startsWith(prefix) && p !== dir && !p.slice(prefix.length).includes('/') && p.slice(prefix.length).startsWith(partial) && (cmd !== 'cd' || node.kind === 'directory')).map(([p, node]) => parent + p.slice(prefix.length) + (node.kind === 'directory' ? '/' : '')).sort();
  }
  if (!candidates.length) return { input, candidates };
  let common = candidates[0]; for (const c of candidates.slice(1)) while (!c.startsWith(common)) common = common.slice(0, -1);
  return { input: before + common + (candidates.length === 1 && !common.endsWith('/') ? ' ' : ''), candidates };
}

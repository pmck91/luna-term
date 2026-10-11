import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { execute, complete, displayPath, type Output } from '../shared/shell';
import { contactSchema, entryPath, isTheme, type Catalog, type Entry, type Picture, type Theme } from '../shared/models';
import { CAT } from './logo';
import { EntryOutput } from './EntryOutput';
import { api } from './api';
import { systemInfo, type SystemInfo } from './login';
import { continueGame, createGame, moveGame, type Direction } from '../shared/game2048';
import { Game2048, readBest, type GameSession } from './Game2048';
import { Bonsai, BonsaiOutput, type BonsaiHandle } from './Bonsai';
import { bonsaiAttribution, type BonsaiOptions, type BonsaiSnapshot } from '../shared/bonsai';
import { adventureInput, completeAdventure, createAdventure, describeRoom, type AdventureLine, type AdventureState } from '../shared/adventure';
import { copy as adventureCopy } from '../shared/adventure-content';
import { AdventureOutput } from './AdventureOutput';
import { PictureOutput } from './PictureOutput';
import { loadAdventure, saveAdventure } from './adventure-storage';

type Block = Output | { type: 'command'; prompt: string; text: string } | { type: 'login'; info: SystemInfo; date: string; repositoryUrl: string | null } | { type: 'game'; session: GameSession } | { type: 'bonsai'; snapshot: BonsaiSnapshot } | { type: 'adventure'; lines: AdventureLine[] };
type ContactState = { step: 'name' | 'email' | 'subject' | 'message' | 'review'; name: string; email: string; subject: string; lines: string[]; submissionId: string; editing: boolean };
const emptyCatalog: Catalog = { entries: [], socials: [], repositoryUrl: null, albums: [], pictures: [] };
function LoginOutput({ info, date, repositoryUrl }: { info: SystemInfo; date: string; repositoryUrl: string | null }) {
  return <div className="login-output">
    <p>Welcome to Luna 0.5.22 (GNU/Linux 6.8.0-146-generic x86_64)</p>
    <p className="muted">System information as of {date} <span className="simulated">(simulated)</span></p>
    <div className="system-banner">
      <pre className="cat-logo" aria-label="Luna cat ASCII logo">{CAT}</pre>
      <div className="system-details">
        <div className="metrics">
          <span>System load: <b>{info.load}</b></span><span>Temperature: <b>{info.temperature} C</b></span>
          <span>Usage of /: <b>{info.diskPercent}% of 456.34GB</b></span><span>Processes: <b>{info.processes}</b></span>
          <span>Memory usage: <b>{info.memory}%</b></span><span>Users logged in: <b>{info.users}</b></span>
          <span>Swap usage: <b>{info.swap}%</b></span><span>IPv4 address for enp1s0: <b>{info.address}</b></span>
        </div>
        <p className="warning"> =&gt; {info.zombies === 1 ? 'There is 1 zombie process.' : info.zombies ? `There are ${info.zombies} zombie processes.` : 'There are no zombie processes.'}</p>
      </div>
    </div>
    <p>Luna portfolio is developed by Peter McKinney as an experimental interactive portfolio.<br />
      Read the code: {repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">{repositoryUrl}</a> : <span className="muted">[set GITHUB_REPOSITORY_URL]</span>}<br />
      Not a nerd? View the regular portfolio <a href="https://pmck.ie" target="_blank" rel="noopener noreferrer">pmck.ie</a><br />
      Please type <span className="accent">help</span> for a list of commands.</p>
    <p className="muted">Last login: {new Date(info.lastTime).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'medium' })} from {info.lastAddress}</p>
  </div>;
}
function outputTextLinks(text: string) {
  return text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part);
}
export function WindowChrome({ title = 'guest@term.pmck.ie: ~' }: { title?: string }) {
  return <div className="window-chrome"><div className="window-lights" aria-hidden="true"><span /><span /><span /></div><span className="window-title">{title}</span><span className="window-meta" aria-hidden="true">Luna</span></div>;
}
export function TerminalPreview({ entry }: { entry: Entry }) {
  const path = entryPath(entry);
  return <section className="terminal-window preview-terminal" data-theme="mocha" aria-label="Terminal entry preview"><WindowChrome title="preview@term.pmck.ie: ~" /><div className="terminal-output"><div className="command-echo"><span className="prompt">preview@term.pmck.ie:~$ </span>{'.' + path}</div><EntryOutput entry={entry} /></div><div className="preview-prompt"><span className="prompt">preview@term.pmck.ie:~$</span><span className="static-cursor" /></div></section>;
}
export function TerminalPicturePreview({ picture, path }: { picture: Picture; path: string }) {
  return <section className="terminal-window preview-terminal" data-theme="mocha" aria-label="Terminal picture preview"><WindowChrome title="preview@term.pmck.ie: ~" /><div className="terminal-output"><div className="command-echo"><span className="prompt">preview@term.pmck.ie:~$ </span>view ~{path}</div><PictureOutput picture={picture} path={path} /></div><div className="preview-prompt"><span className="prompt">preview@term.pmck.ie:~$</span><span className="static-cursor" /></div></section>;
}
export function Terminal() {
  const [phase, setPhase] = useState<'boot' | 'login' | 'shell'>('boot');
  const [blocks, setBlocks] = useState<Block[]>([{ type: 'text', text: 'Connecting to term.pmck.ie...', tone: 'dim' }]);
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog); const [catalogError, setCatalogError] = useState(false);
  const [username, setUsername] = useState(''); const [cwd, setCwd] = useState('/'); const [value, setValue] = useState('');
  const [theme, setTheme] = useState<Theme>(() => { try { const saved = localStorage.getItem('luna-theme'); return saved && isTheme(saved) ? saved : 'mocha'; } catch { return 'mocha'; } });
  const [contact, setContact] = useState<ContactState | null>(null); const [sending, setSending] = useState(false);
  const [game, setGame] = useState<GameSession | null>(null);
  const [bonsai, setBonsai] = useState<BonsaiOptions | null>(null);
  const bonsaiInput = useRef<BonsaiHandle>(null);
  const [adventure, setAdventure] = useState<{ state: AdventureState; confirmRestart: boolean; canSave: boolean } | null>(null);
  const adventureMemory = useRef<AdventureState | null>(null);
  const adventureHistory = useRef<{ lines: string[]; index: number; draft: string }>({ lines: [], index: 0, draft: '' });
  const [focused, setFocused] = useState(false); const [caret, setCaret] = useState({ left: 0, selected: false });
  const input = useRef<HTMLInputElement>(null); const output = useRef<HTMLDivElement>(null);
  const pendingSelection = useRef<{ text: string; position: number } | null>(null);
  const outputSize = useRef({ width: 0, height: 0 });
  const history = useRef<string[]>([]); const historyIndex = useRef(0); const draft = useRef(''); const followOutput = useRef(true); const mounted = useRef(true);
  const prompt = phase === 'login' ? 'term.pmck.ie login:' : adventure ? adventure.confirmRestart ? 'restart? [yes/no]:' : 'luna>' : bonsai ? 'bonsai>' : game ? game.confirmRestart ? 'restart? [y/n]:' : '2048>' : contact ? `${contact.step === 'review' ? 'send / edit / cancel' : contact.step}:` : `${username}@term.pmck.ie:${displayPath(cwd)}$`;
  const append = (...items: Block[]) => { followOutput.current = true; setBlocks(b => [...b, ...items]); };
  const focus = () => { if (!window.getSelection()?.toString()) input.current?.focus({ preventScroll: true }); };
  const updateCaret = () => {
    const el = input.current; if (!el) return;
    const ctx = document.createElement('canvas').getContext('2d'); if (!ctx) return;
    ctx.font = getComputedStyle(el).font;
    setCaret({ left: Math.max(0, ctx.measureText(el.value.slice(0, el.selectionStart ?? el.value.length)).width - el.scrollLeft), selected: el.selectionStart !== el.selectionEnd });
  };
  const replaceInput = (text: string, position = text.length) => {
    // Place the cursor with the controlled value's commit, before another
    // keypress or selection can arrive. No later animation frame moves it.
    pendingSelection.current = { text, position };
    if (input.current?.value === text) {
      pendingSelection.current = null;
      input.current.setSelectionRange(position, position); updateCaret();
    }
    setValue(text);
  };
  useEffect(() => {
    mounted.current = true; const controller = new AbortController();
    api<Catalog>('/api/public/catalog', { signal: controller.signal }).then(setCatalog).catch(e => { if (e.name !== 'AbortError') setCatalogError(true); });
    const timers = [
      setTimeout(() => append({ type: 'text', text: 'Connection established.\nLuna 0.5.22 / virtual console', tone: 'dim' }), 550),
      setTimeout(() => append({ type: 'text', text: '[  OK  ] Mounted portfolio filesystem.\n[  OK  ] Started virtual login service.', tone: 'dim' }), 1300),
      setTimeout(() => { append({ type: 'text', text: 'Username suggestion: guest', tone: 'dim' }); setPhase('login'); }, 2000),
    ];
    const viewport = () => { document.documentElement.style.setProperty('--viewport-height', `${window.visualViewport?.height ?? window.innerHeight}px`); document.documentElement.style.setProperty('--viewport-top', `${window.visualViewport?.offsetTop ?? 0}px`); };
    document.body.classList.add('public-body'); viewport(); window.visualViewport?.addEventListener('resize', viewport); window.visualViewport?.addEventListener('scroll', viewport); window.addEventListener('resize', viewport);
    return () => { mounted.current = false; controller.abort(); timers.forEach(clearTimeout); document.body.classList.remove('public-body'); window.visualViewport?.removeEventListener('resize', viewport); window.visualViewport?.removeEventListener('scroll', viewport); window.removeEventListener('resize', viewport); };
  }, []);
  useEffect(() => { if (phase !== 'boot') focus(); }, [phase]);
  const follow = () => { if (followOutput.current && !window.getSelection()?.toString() && output.current) output.current.scrollTop = output.current.scrollHeight; };
  useLayoutEffect(follow, [blocks, game, bonsai]);
  useLayoutEffect(() => {
    const selection = pendingSelection.current; pendingSelection.current = null;
    if (selection && input.current?.value === selection.text) input.current.setSelectionRange(selection.position, selection.position);
    updateCaret();
  }, [value, focused, prompt]);
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (phase === 'boot' || event.isComposing) return;
      const copying = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && (event.shiftKey || !!window.getSelection()?.toString() || input.current?.selectionStart !== input.current?.selectionEnd);
      if (bonsai?.screensaver && !event.defaultPrevented && !copying && bonsaiInput.current?.key(event)) { event.preventDefault(); return; }
      if (event.key === 'Escape') { window.getSelection()?.removeAllRanges(); focus(); return; }
      const el = event.target as HTMLElement; if (el.tagName === 'VIDEO' && !(event.ctrlKey || event.metaKey)) return;
      if ((event.key === 'PageUp' || event.key === 'PageDown') && output.current) { event.preventDefault(); followOutput.current = false; output.current.scrollBy({ top: output.current.clientHeight * (event.key === 'PageUp' ? -0.85 : 0.85) }); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && event.shiftKey) {
        const selected = window.getSelection()?.toString() || input.current?.value.slice(input.current.selectionStart ?? 0, input.current.selectionEnd ?? 0);
        if (selected) { event.preventDefault(); void navigator.clipboard?.writeText(selected).catch(() => {}); }
      }
    }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [phase, bonsai]);
  const cancel = () => {
    if (adventure) { append({ type: 'command', prompt, text: value + '^C' }); quitAdventure(); return; }
    if (bonsai) { bonsaiInput.current?.quit('^C'); return; }
    if (game) { quitGame('^C'); return; }
    if (sending) { append({ type: 'text', text: 'Submission is being confirmed. Please wait.', tone: 'dim' }); return; }
    append({ type: 'command', prompt, text: value + '^C' }); setValue(''); setContact(null); historyIndex.current = history.current.length; focus();
  };
  function startAdventure() {
    const loaded = adventureMemory.current ? { state: adventureMemory.current, status: 'resumed' as const } : loadAdventure();
    const canSave = loaded.status !== 'unavailable' && saveAdventure(loaded.state);
    adventureMemory.current = loaded.state;
    adventureHistory.current = { lines: [], index: 0, draft: '' };
    setAdventure({ state: loaded.state, confirmRestart: false, canSave });
    append({ type: 'adventure', lines: [
      { text: 'lunas-adventure', tone: 'heading' },
      { text: loaded.status === 'resumed' ? 'Resuming Luna\'s adventure.' : adventureCopy.opening },
      ...(loaded.status === 'invalid' ? [{ text: 'The saved adventure could not be read. Starting fresh.', tone: 'dim' as const }] : []),
      ...(!canSave ? [{ text: 'Browser storage is unavailable. Progress will last for this visit only.', tone: 'dim' as const }] : []),
      ...describeRoom(loaded.state),
      { text: 'Type help for commands, or hint if you\'re stuck.', tone: 'dim' },
    ] });
  }
  function quitAdventure() {
    if (!adventure) return;
    adventureMemory.current = adventure.state;
    const saved = adventure.canSave && saveAdventure(adventure.state);
    append({ type: 'text', text: saved ? 'Adventure saved. Back to the shell.' : 'Back to the shell. Progress is kept for this visit only.', tone: 'dim' });
    setAdventure(null); setValue(''); historyIndex.current = history.current.length; requestAnimationFrame(focus);
  }
  function adventureCommand(line: string) {
    if (!adventure || !line.trim()) return;
    append({ type: 'command', prompt, text: line }); setValue('');
    const h = adventureHistory.current; h.lines.push(line); h.index = h.lines.length; h.draft = '';
    const key = line.trim().toLowerCase();
    if (adventure.confirmRestart && !['quit', 'q'].includes(key)) {
      if (['no', 'n'].includes(key)) { setAdventure({ ...adventure, confirmRestart: false }); append({ type: 'text', text: 'Restart cancelled.', tone: 'dim' }); return; }
      if (!['yes', 'y'].includes(key)) { append({ type: 'text', text: 'Type yes to restart or no to keep playing.', tone: 'error' }); return; }
      const state = createAdventure(); adventureMemory.current = state;
      const canSave = adventure.canSave && saveAdventure(state);
      setAdventure({ state, confirmRestart: false, canSave });
      append({ type: 'adventure', lines: [{ text: 'New adventure.', tone: 'heading' }, { text: adventureCopy.opening }, ...describeRoom(state), ...(!canSave && adventure.canSave ? [{ text: 'Progress could not be saved. It will last for this visit only.', tone: 'dim' as const }] : [])] });
      return;
    }
    const result = adventureInput(adventure.state, line);
    if (result.action === 'quit') { quitAdventure(); return; }
    const canSave = adventure.canSave && (result.state === adventure.state || saveAdventure(result.state));
    adventureMemory.current = result.state;
    setAdventure({ state: result.state, confirmRestart: result.action === 'restart', canSave });
    if (result.output.length) append({ type: 'adventure', lines: result.output });
    if (!canSave && adventure.canSave) append({ type: 'text', text: 'Progress could not be saved. It will last for this visit only.', tone: 'dim' });
  }
  function quitBonsai(snapshot: BonsaiSnapshot, reason: string) {
    window.getSelection()?.removeAllRanges();
    append({ type: 'bonsai', snapshot }, { type: 'text', text: `${reason} Seed: ${snapshot.tree.seed}.`, tone: 'dim' });
    setBonsai(null); setValue(''); historyIndex.current = history.current.length; requestAnimationFrame(focus);
  }
  function quitGame(reason = 'Game exited.') {
    if (!game) return;
    append({ type: 'game', session: game }, { type: 'text', text: `${reason} Final score: ${game.state.score}.`, tone: 'dim' });
    setGame(null); setValue(''); historyIndex.current = history.current.length; requestAnimationFrame(focus);
  }
  function gameInput(line: string) {
    if (!game) return;
    const key = line.trim().toLowerCase();
    setValue('');
    if (key === 'q' || key === 'quit') { quitGame(); return; }
    if (game.confirmRestart) {
      if (key === 'y' || key === 'yes') setGame({ ...game, state: createGame(), confirmRestart: false, message: 'New game. Merge equal tiles to reach 2048.' });
      else if (key === 'n' || key === 'no') setGame({ ...game, confirmRestart: false, message: 'Restart cancelled.' });
      else setGame({ ...game, message: 'Type Y to restart or N to keep playing.' });
      return;
    }
    if (key === 'r' || key === 'restart') { setGame({ ...game, confirmRestart: true, message: 'Restart?' }); return; }
    if ((key === 'c' || key === 'continue') && game.state.status === 'won') { setGame({ ...game, state: continueGame(game.state), message: 'Keep going. The next goal is 4096.' }); return; }
    const directions: Record<string, Direction> = { w: 'up', up: 'up', s: 'down', down: 'down', a: 'left', left: 'left', d: 'right', right: 'right' };
    const direction = directions[key];
    if (!direction) { setGame({ ...game, message: 'Use arrows or W/A/S/D. R: restart. Q: quit.' }); return; }
    const state = moveGame(game.state, direction);
    const best = Math.max(game.best, state.score);
    if (best > game.best) { try { localStorage.setItem('luna-2048-best', String(best)); } catch { /* Optional personal best. */ } }
    setGame({ ...game, state, best, message: state === game.state ? 'No change. Try another direction.' : `Moved ${direction}.${state.score > game.state.score ? ` +${state.score - game.state.score} points.` : ''}` });
  }
  async function submitContact(line: string) {
    if (!contact) return;
    const c = contact;
    if (line.trim() === 'cancel' && c.step === 'review') { append({ type: 'text', text: 'Message cancelled.', tone: 'dim' }); setContact(null); return; }
    if (c.step === 'review') {
      if (line.trim() === 'edit') { setContact({ ...c, step: 'name', editing: true }); setValue(c.name); return; }
      if (line.trim() !== 'send') { append({ type: 'text', text: 'Type send, edit, or cancel.', tone: 'error' }); return; }
      setSending(true);
      try { await api('/api/contact', { method: 'POST', body: JSON.stringify({ name: c.name, email: c.email, subject: c.subject, message: c.lines.join('\n'), submissionId: c.submissionId }) }); if (mounted.current) { append({ type: 'text', text: 'Message received. Thank you.', tone: 'success' }); setContact(null); } }
      catch (e) { if (mounted.current) append({ type: 'text', text: `${(e as Error).message}\nType send to retry, edit, or cancel.`, tone: 'error' }); }
      finally { if (mounted.current) { setSending(false); requestAnimationFrame(focus); } } return;
    }
    if (c.step === 'message') {
      if (line !== '.') { if (c.lines.join('\n').length + line.length + 1 > 10000) { append({ type: 'text', text: 'Message limit: 10,000 characters.', tone: 'error' }); return; } setContact({ ...c, lines: [...c.lines, line] }); return; }
      if (!c.lines.join('\n').trim()) { append({ type: 'text', text: 'Enter a message before finishing with a dot.', tone: 'error' }); return; }
      append({ type: 'text', text: `Review your message\n\nName: ${c.name}\nEmail: ${c.email}\nSubject: ${c.subject}\n\n${c.lines.join('\n')}\n\nType send to submit, edit to change it, or cancel.\nMessages are private and visible only to the admin.` }); setContact({ ...c, step: 'review' }); return;
    }
    const valid = contactSchema.shape[c.step].safeParse(c.step === 'email' ? line.trim() : line);
    if (!valid.success) { append({ type: 'text', text: valid.error.issues[0].message, tone: 'error' }); setValue(line); return; }
    const next = c.step === 'name' ? 'email' : c.step === 'email' ? 'subject' : 'message';
    setContact({ ...c, [c.step]: valid.data, step: next, ...(next === 'message' ? { lines: [] } : {}) });
    if (c.editing && next !== 'message') setValue(c[next]);
    if (next === 'message') { if (c.editing && c.lines.length) append({ type: 'text', text: `Previous message:\n${c.lines.join('\n')}`, tone: 'dim' }); append({ type: 'text', text: 'Enter message lines. Finish with a single . on its own line.', tone: 'dim' }); }
  }
  async function submit() {
    if (phase === 'boot' || sending) return;
    if (adventure) { adventureCommand(value); return; }
    if (bonsai) { bonsaiInput.current?.command(value); setValue(''); return; }
    if (game) { gameInput(value); return; }
    const line = value; setValue(''); append({ type: 'command', prompt, text: line });
    if (phase === 'login') {
      if (!line.trim()) { append({ type: 'text', text: 'Enter a username. Try guest.', tone: 'error' }); return; }
      setUsername(line.trim()); append({ type: 'login', info: systemInfo(), date: new Date().toLocaleString('en-IE', { dateStyle: 'full', timeStyle: 'medium' }), repositoryUrl: catalog.repositoryUrl });
      if (catalogError) append({ type: 'text', text: 'Content could not be loaded. Reload to reconnect. Shell commands remain available.', tone: 'error' });
      setPhase('shell'); return;
    }
    if (contact) { await submitContact(line); return; }
    if (line.trim()) { history.current.push(line); historyIndex.current = history.current.length; draft.current = ''; }
    const result = execute(line, cwd, catalog);
    if (result.action === 'clear') setBlocks([]); else append(...result.output);
    if (result.cwd !== undefined) setCwd(result.cwd);
    if (result.theme) { setTheme(result.theme); try { localStorage.setItem('luna-theme', result.theme); } catch { /* Optional persistence. */ } }
    if (result.action === 'contact') { setContact({ step: 'name', name: '', email: '', subject: '', lines: [], submissionId: crypto.randomUUID(), editing: false }); append({ type: 'text', text: 'Leave a private message. Ctrl+C cancels.\nEnter your name, email, subject, then message.', tone: 'dim' }); }
    if (result.action === 'game2048') setGame({ state: createGame(), best: readBest(), confirmRestart: false, message: 'Merge equal tiles to reach 2048.' });
    if (result.bonsai) { append({ type: 'text', text: bonsaiAttribution, tone: 'dim' }); setBonsai(result.bonsai); }
    if (result.action === 'adventure') startAdventure();
    requestAnimationFrame(focus);
  }
  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    pendingSelection.current = null;
    if (event.nativeEvent.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && !event.shiftKey) {
      if (window.getSelection()?.toString() || input.current?.selectionStart !== input.current?.selectionEnd) return;
      event.preventDefault(); cancel(); return;
    }
    if (bonsai?.screensaver && bonsaiInput.current?.key(event)) { event.preventDefault(); setValue(''); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); followOutput.current = true; setBlocks(adventure ? [{ type: 'adventure', lines: [...describeRoom(adventure.state), ...(adventure.confirmRestart ? [{ text: 'Type yes to restart or no to keep playing.', tone: 'dim' as const }] : [])] }] : []); return; }
    if (event.key === 'Enter') { event.preventDefault(); void submit(); return; }
    if (bonsai) {
      if ((bonsai.screensaver || !value) && bonsaiInput.current?.key(event)) { event.preventDefault(); setValue(''); }
      else if (event.key === 'Tab' && !event.shiftKey) event.preventDefault();
      return;
    }
    if (game) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const arrows: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (arrows[event.key]) { event.preventDefault(); gameInput(arrows[event.key]); return; }
      // Soft keyboards generally emit input events instead of useful keydown events.
      // Keep typed commands available on touch devices; desktop keys act immediately.
      if (!window.matchMedia('(pointer: coarse)').matches && !value && /^[wasdrqync]$/i.test(event.key)) { event.preventDefault(); gameInput(event.key); }
      else if (event.key === 'Tab' && !event.shiftKey) event.preventDefault();
      return;
    }
    if (adventure) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault(); const el = input.current!; const pos = el.selectionStart ?? value.length;
        const prefix = value.slice(0, pos);
        const answers = ['yes', 'no'].filter(answer => answer.startsWith(prefix.toLowerCase().trim()));
        const result = adventure.confirmRestart
          ? { input: answers.length === 1 ? `${answers[0]} ` : prefix, candidates: answers }
          : completeAdventure(prefix, adventure.state);
        const completed = result.input + value.slice(pos);
        replaceInput(completed, result.input.length);
        if (result.candidates.length > 1) append({ type: 'adventure', lines: [{ text: result.candidates.join('  '), tone: 'dim' }] });
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault(); const h = adventureHistory.current;
        if (h.index === h.lines.length) h.draft = value;
        h.index = Math.max(0, Math.min(h.lines.length, h.index + (event.key === 'ArrowUp' ? -1 : 1)));
        replaceInput(h.index === h.lines.length ? h.draft : h.lines[h.index]);
      }
      return;
    }
    if (contact || phase !== 'shell') return;
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault(); const el = input.current!; const pos = el.selectionStart ?? value.length; const result = complete(value.slice(0, pos), cwd, catalog);
      const completed = result.input + value.slice(pos);
      replaceInput(completed, result.input.length); if (result.candidates.length > 1) append({ type: 'text', text: result.candidates.join('  '), tone: 'dim' });
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); if (historyIndex.current === history.current.length) draft.current = value;
      historyIndex.current = Math.max(0, Math.min(history.current.length, historyIndex.current + (event.key === 'ArrowUp' ? -1 : 1)));
      replaceInput(historyIndex.current === history.current.length ? draft.current : history.current[historyIndex.current]);
    }
  }
  return <main className="public-page" data-theme={theme}>
    <section className="terminal-window" aria-label="Luna virtual terminal">
      <WindowChrome title={`${username || 'login'}@term.pmck.ie: ${displayPath(cwd)}`} />
      <div className={`terminal-output${game ? ' has-game' : ''}${bonsai ? ' has-bonsai' : ''}`} ref={output} tabIndex={-1} role="log" aria-live="polite" aria-relevant="additions" onScroll={() => {
        const el = output.current!, size = outputSize.current;
        const resized = size.width !== el.clientWidth || size.height !== el.clientHeight;
        outputSize.current = { width: el.clientWidth, height: el.clientHeight };
        // Reflow can move scrollback away from the bottom without a visitor scrolling.
        if (resized) { follow(); return; }
        followOutput.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
      }} onMouseDown={() => { followOutput.current = false; }}>
        {blocks.map((b, i) => b.type === 'command' ? <div className="command-echo" key={i}><span className="prompt">{b.prompt} </span>{b.text}</div> : b.type === 'login' ? <LoginOutput key={i} {...b} /> : b.type === 'entry' ? <EntryOutput key={i} entry={b.entry} /> : b.type === 'picture' ? <PictureOutput key={i} picture={b.picture} path={b.path} onLoad={follow} /> : b.type === 'game' ? <Game2048 key={i} session={b.session} finished /> : b.type === 'bonsai' ? <BonsaiOutput key={i} snapshot={b.snapshot} /> : b.type === 'adventure' ? <AdventureOutput key={i} lines={b.lines} /> : <div key={i} className={`text-output ${b.tone || ''}`}>{outputTextLinks(b.text)}</div>)}
        {game && <Game2048 session={game} />}
        {bonsai && <Bonsai ref={bonsaiInput} options={bonsai} onExit={quitBonsai} onLayout={follow} />}
      </div>
      {/* This virtual console needs password-manager ignore hints as well as autocomplete off. */}
      <form className="command-line" onSubmit={e => { e.preventDefault(); void submit(); }} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="other">
        {phase === 'boot' ? <span className="muted boot-status">Connecting<span className="static-cursor" /></span> : <><label className="prompt" htmlFor="terminal-input">{prompt}</label><div className="input-wrap"><input id="terminal-input" name="terminal-command" type="text" autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" data-form-type="other" ref={input} value={value} onChange={e => { pendingSelection.current = null; setValue(e.target.value); }} onKeyDown={onKey} onKeyUp={updateCaret} onSelect={updateCaret} onPointerDown={() => { pendingSelection.current = null; }} onFocus={() => setFocused(true)} onBlur={() => { pendingSelection.current = null; setFocused(false); }} onScroll={updateCaret} readOnly={sending} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="send" aria-label={phase === 'login' ? 'Username, suggested guest' : adventure ? 'Luna adventure input' : bonsai ? 'Bonsai input' : game ? '2048 game input' : contact ? `${contact.step} input` : 'Terminal command'} /><span aria-hidden="true" className={`block-cursor ${focused && !caret.selected && !sending ? 'visible' : ''}`} style={{ left: caret.left }} /></div>{sending && <span className="muted">sending…</span>}</>}
      </form>
    </section>
    <footer>© pmck {new Date().getFullYear()}</footer>
  </main>;
}

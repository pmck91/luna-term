import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { generateBonsai, renderBonsai, treeDimensions, type BonsaiOptions, type BonsaiSnapshot, type TreeTone } from '../shared/bonsai';

export type BonsaiHandle = { command: (line: string) => void; key: (event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }) => boolean; quit: (reason?: string) => void };
function randomSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }

export function BonsaiArt({ snapshot }: { snapshot: BonsaiSnapshot }) {
  const grid = renderBonsai(snapshot);
  return <pre className="bonsai-tree" role="img" aria-label={`ASCII bonsai tree, seed ${snapshot.tree.seed}`} style={{ '--tree-columns': grid[0].length } as CSSProperties}>
    {grid.map((row, r) => {
      const runs: { text: string; tone: TreeTone | undefined }[] = [];
      for (const cell of row) {
        const tone = cell?.tone, char = cell?.char ?? ' ';
        const last = runs[runs.length - 1];
        if (last && last.tone === tone) last.text += char; else runs.push({ text: char, tone });
      }
      return <span className="bonsai-row" key={r}>{runs.map((run, i) => <span key={i} className={run.tone ? `bonsai-${run.tone}` : undefined}>{run.text}</span>)}{r < grid.length - 1 ? '\n' : ''}</span>;
    })}
  </pre>;
}
export function BonsaiOutput({ snapshot }: { snapshot: BonsaiSnapshot }) {
  return <div className="bonsai-output" aria-live="off"><div className="accent bonsai-heading">Luna bonsai</div><div className="muted bonsai-seed">Seed: {snapshot.tree.seed}</div><BonsaiArt snapshot={snapshot} /></div>;
}

export const Bonsai = forwardRef<BonsaiHandle, { options: BonsaiOptions; onExit: (snapshot: BonsaiSnapshot, reason: string) => void; onLayout: () => void }>(function Bonsai({ options, onExit, onLayout }, ref) {
  const [seed, setSeed] = useState(() => options.seed ?? randomSeed());
  const tree = useMemo(() => generateBonsai(seed), [seed]);
  const [revealed, setRevealed] = useState(0), [paused, setPaused] = useState(false), [selected, setSelected] = useState(false), [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [message, setMessage] = useState('');
  const [dimensions, setDimensions] = useState({ columns: 49, rows: 22 });
  const root = useRef<HTMLDivElement>(null), measure = useRef<HTMLSpanElement>(null), exited = useRef(false);
  const visible = reduced ? tree.strokes.length : revealed;
  const complete = visible >= tree.strokes.length;
  const snapshot: BonsaiSnapshot = { tree, revealed: visible, ...dimensions };
  const status = message || (selected ? 'Paused for text selection.' : paused ? 'Paused.' : complete ? options.screensaver && !reduced ? 'Fully grown. Another tree follows.' : 'Fully grown.' : 'Growing.');
  function quit(reason = 'Bonsai exited.') { if (!exited.current) { exited.current = true; onExit(snapshot, reason); } }
  function restart() { const next = randomSeed(); setSeed(next === seed ? (seed + 1) >>> 0 : next); setRevealed(0); setPaused(false); setMessage(''); }
  function toggle() { setPaused(p => !p); setMessage(''); }
  function command(line: string) {
    if (options.screensaver) { quit(); return; }
    const key = line.trim().toLowerCase();
    if (key === 'q' || key === 'quit') quit();
    else if (key === 'r' || key === 'restart') restart();
    else if (!key || key === 'p' || key === 'pause') toggle();
    else if (key === 'resume') { setPaused(false); setMessage(''); }
    else setMessage('Type pause, resume, r, or q.');
  }
  useImperativeHandle(ref, () => ({ command, quit, key: event => {
    const copy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && (event.shiftKey || !!window.getSelection()?.toString());
    if (copy || ['Control', 'Meta', 'Alt', 'Shift', 'CapsLock'].includes(event.key)) return false;
    if (options.screensaver) { quit(); return true; }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === ' ') { toggle(); return true; }
    if (!window.matchMedia('(pointer: coarse)').matches && /^[prq]$/i.test(event.key)) { command(event.key); return true; }
    return false;
  } }));
  useLayoutEffect(() => {
    const output = root.current?.closest('.terminal-output'); if (!output || !measure.current) return;
    const resize = () => {
      const style = getComputedStyle(output), letter = measure.current!.getBoundingClientRect().width;
      const line = parseFloat(getComputedStyle(measure.current!).lineHeight);
      const width = output.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = output.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const next = treeDimensions(width / Math.max(1, letter), (height - (height < 300 ? 62 : 120)) / line);
      setDimensions(old => old.columns === next.columns && old.rows === next.rows ? old : next);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(output); observer.observe(measure.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => { onLayout(); }, [dimensions]);
  useEffect(() => {
    const selection = () => setSelected(!!window.getSelection()?.toString());
    const visibility = () => setHidden(document.hidden);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(motion.matches);
    document.addEventListener('selectionchange', selection); document.addEventListener('visibilitychange', visibility); motion.addEventListener('change', changed); selection();
    return () => { document.removeEventListener('selectionchange', selection); document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', changed); };
  }, []);
  useEffect(() => {
    if (paused || selected || hidden || reduced || complete) return;
    const timer = setInterval(() => { if (!window.getSelection()?.toString() && !document.hidden) setRevealed(count => Math.min(tree.strokes.length, count + Math.max(1, Math.ceil(tree.strokes.length / 140)))); }, 60);
    return () => clearInterval(timer);
  }, [seed, paused, selected, hidden, reduced, complete, tree.strokes.length]);
  useEffect(() => {
    if (!options.screensaver || !complete || paused || selected || hidden || reduced) return;
    const timer = setTimeout(() => { if (!window.getSelection()?.toString() && !document.hidden) restart(); }, 2000);
    return () => clearTimeout(timer);
  }, [seed, complete, paused, selected, hidden, reduced, options.screensaver]);
  return <div className="bonsai-output" ref={root} aria-live="off" data-seed={seed} data-progress={visible} data-complete={complete} data-paused={paused || selected}>
    <span className="bonsai-measure" ref={measure} aria-hidden="true">0</span>
    <div className="accent bonsai-heading">Luna bonsai</div><div className="muted bonsai-seed">Seed: {seed}</div>
    <BonsaiArt snapshot={snapshot} />
    <div className="bonsai-controls muted">{options.screensaver ? 'Screensaver: press any key to return.' : 'Space: pause · R: new tree · Q: quit'}</div>
    {!options.screensaver && <div className="bonsai-mobile-hint muted">Mobile: type pause / r / q, then Enter.</div>}
    <div className="bonsai-status muted" role="status" aria-live="polite">{status}</div>
  </div>;
});

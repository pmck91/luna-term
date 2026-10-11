import type { CSSProperties } from 'react';
import type { GameState } from '../shared/game2048';

export type GameSession = { state: GameState; best: number; message: string; confirmRestart: boolean };
export function readBest(): number {
  try { const score = Number(localStorage.getItem('luna-2048-best')); return Number.isSafeInteger(score) && score >= 0 ? score : 0; }
  catch { return 0; }
}

export function Game2048({ session, finished = false }: { session: GameSession; finished?: boolean }) {
  const { state, best, message, confirmRestart } = session;
  const width = Math.max(6, ...state.board.flat().map(value => String(value).length + 2));
  const border = '+' + Array(4).fill('-'.repeat(width)).join('+') + '+';
  const status = confirmRestart ? 'Restart? Y: yes / N: keep playing' : state.status === 'won' ? '2048 reached! C: continue / R: restart / Q: quit' : state.status === 'over' ? 'No moves left. R: restart / Q: quit' : message;
  return <div className="game-output" aria-live="off" data-finished={finished ? 'true' : 'false'}>
    <div className="game-heading accent">Luna 2048</div>
    <div className="game-score">Score: <span>{state.score}</span>   Best: <span>{best}</span></div>
    <pre className="game-board" aria-label="2048 board, four rows from top to bottom" style={{ '--board-columns': 4 * (width + 1) + 1 } as CSSProperties}>
      <span className="game-border">{border + '\n'}</span>
      {state.board.map((row, r) => <span className="game-row" key={r}>
        <span className="game-border">|</span>{row.map((value, c) => <span key={c}>
          <span className="game-tile" data-value={value || undefined} style={value ? { color: `var(--tile-${Math.min(value, 2048)})` } : undefined}>{(value ? String(value) : '').padStart(width - 1) + ' '}</span><span className="game-border">|</span>
        </span>)}{'\n'}<span className="game-border">{border + (r < 3 ? '\n' : '')}</span>
      </span>)}
    </pre>
    {!finished && <>
      <div className="game-controls muted">Arrows / WASD: move · R: restart · Q: quit</div>
      <div className="game-mobile-hint muted">On-screen keyboard: type W/A/S/D, then Enter.</div>
      <div className={`game-status ${confirmRestart || state.status !== 'playing' ? 'warning' : 'muted'}`}>{status}</div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status} Score: {state.score}.</span>
    </>}
  </div>;
}

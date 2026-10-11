export type Board = readonly (readonly number[])[];
export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameState = { board: Board; score: number; status: 'playing' | 'won' | 'over'; continued: boolean };
type Random = () => number;

export function slideBoard(board: Board, direction: Direction): { board: Board; gain: number; changed: boolean } {
  const next = board.map(row => [...row]);
  let gain = 0;
  for (let line = 0; line < 4; line++) {
    const positions = Array.from({ length: 4 }, (_, index) => {
      if (direction === 'left') return [line, index];
      if (direction === 'right') return [line, 3 - index];
      if (direction === 'up') return [index, line];
      return [3 - index, line];
    });
    const values = positions.map(([r, c]) => board[r][c]).filter(Boolean);
    const merged: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) { const value = values[i] * 2; merged.push(value); gain += value; i++; }
      else merged.push(values[i]);
    }
    positions.forEach(([r, c], i) => { next[r][c] = merged[i] ?? 0; });
  }
  return { board: next, gain, changed: next.some((row, r) => row.some((value, c) => value !== board[r][c])) };
}

export function spawnTile(board: Board, random: Random = Math.random): Board {
  const empty = board.flatMap((row, r) => row.flatMap((value, c) => value ? [] : [[r, c]]));
  if (!empty.length) return board;
  const [r, c] = empty[Math.floor(random() * empty.length)];
  const next = board.map(row => [...row]);
  next[r][c] = random() < 0.9 ? 2 : 4;
  return next;
}

export function hasMoves(board: Board): boolean {
  return board.some((row, r) => row.some((value, c) => !value || (r < 3 && value === board[r + 1][c]) || (c < 3 && value === row[c + 1])));
}

export function createGame(random: Random = Math.random): GameState {
  const empty = Array.from({ length: 4 }, () => Array<number>(4).fill(0));
  return { board: spawnTile(spawnTile(empty, random), random), score: 0, status: 'playing', continued: false };
}

export function moveGame(state: GameState, direction: Direction, random: Random = Math.random): GameState {
  if (state.status !== 'playing') return state;
  const moved = slideBoard(state.board, direction);
  if (!moved.changed) return hasMoves(state.board) ? state : { ...state, status: 'over' };
  const board = spawnTile(moved.board, random);
  const status = !state.continued && board.some(row => row.some(value => value >= 2048)) ? 'won' : hasMoves(board) ? 'playing' : 'over';
  return { ...state, board, score: state.score + moved.gain, status };
}

export function continueGame(state: GameState): GameState {
  return state.status === 'won' ? { ...state, continued: true, status: hasMoves(state.board) ? 'playing' : 'over' } : state;
}

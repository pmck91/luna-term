import { describe, expect, it, vi } from 'vitest';
import { continueGame, createGame, hasMoves, moveGame, slideBoard, spawnTile, type Board, type GameState } from '../shared/game2048';

const board = (row: number[]): Board => [row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
const state = (grid: Board): GameState => ({ board: grid, score: 0, status: 'playing', continued: false });
const blocked: Board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];

describe('2048 moves', () => {
  it.each([
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[2, 2, 4, 0], [4, 4, 0, 0], 4],
    [[4, 0, 4, 4], [8, 4, 0, 0], 8],
    [[0, 2, 0, 2], [4, 0, 0, 0], 4],
    [[2, 4, 8, 16], [2, 4, 8, 16], 0],
  ])('slides %j left, merging each tile only once', (input, expected, gain) => {
    const original = board(input);
    const result = slideBoard(original, 'left');
    expect(result.board[0]).toEqual(expected); expect(result.gain).toBe(gain);
    expect(original[0]).toEqual(input);
  });
  it('merges in the movement direction on both axes', () => {
    expect(slideBoard(board([2, 2, 2, 0]), 'right').board[0]).toEqual([0, 0, 2, 4]);
    const vertical: Board = [[2, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0]];
    expect(slideBoard(vertical, 'up').board.map(row => row[0])).toEqual([4, 2, 0, 0]);
    expect(slideBoard(vertical, 'down').board.map(row => row[0])).toEqual([0, 0, 2, 4]);
  });
  it('scores all merges and adds exactly one tile after a changed move', () => {
    const game = { ...state(board([2, 2, 4, 4])), score: 12 };
    const random = vi.fn(() => 0);
    const result = moveGame(game, 'left', random);
    expect(result.score).toBe(24); expect(result.board[0]).toEqual([4, 8, 2, 0]);
    expect(random).toHaveBeenCalledTimes(2);
    expect(game.board[0]).toEqual([2, 2, 4, 4]);
  });
  it('does not spawn, score, or consume randomness on an unchanged move', () => {
    const game = state(board([2, 4, 0, 0])); const random = vi.fn(() => 0);
    expect(moveGame(game, 'left', random)).toBe(game); expect(random).not.toHaveBeenCalled();
  });
});
describe('2048 spawning and lifecycle', () => {
  it('starts with exactly two tiles in separate cells', () => {
    const game = createGame(() => 0);
    expect(game.board.flat().filter(Boolean)).toEqual([2, 2]);
    expect(game.score).toBe(0); expect(game.status).toBe('playing');
  });
  it('places a tile only in an empty cell and applies the 90/10 threshold', () => {
    const grid = board([2, 0, 0, 0]);
    const two = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.899);
    const four = vi.fn().mockReturnValueOnce(0.999).mockReturnValueOnce(0.9);
    expect(spawnTile(grid, two)[0]).toEqual([2, 2, 0, 0]);
    expect(spawnTile(grid, four)[3][3]).toBe(4);
    const random = vi.fn(); expect(spawnTile(blocked, random)).toBe(blocked); expect(random).not.toHaveBeenCalled();
  });
  it('recognizes available moves, including vertical merges on a full board', () => {
    expect(hasMoves(blocked)).toBe(false);
    expect(hasMoves(board([2, 4, 8, 16]))).toBe(true);
    expect(hasMoves([[2, 2, 4, 2], ...blocked.slice(1)])).toBe(true);
    expect(hasMoves([[4, 2, 4, 2], [4, 2, 4, 2], ...blocked.slice(2)])).toBe(true);
  });
  it('stops a blocked board without consuming randomness', () => {
    const random = vi.fn(); const result = moveGame(state(blocked), 'left', random);
    expect(result.status).toBe('over'); expect(result.score).toBe(0); expect(random).not.toHaveBeenCalled();
  });
  it('detects loss immediately after the final spawned tile', () => {
    const grid: Board = [[2, 2, 8, 16], [8, 16, 32, 64], [16, 32, 64, 128], [32, 64, 128, 256]];
    const result = moveGame(state(grid), 'left', () => 0);
    expect(result.status).toBe('over'); expect(result.score).toBe(4); expect(hasMoves(result.board)).toBe(false);
  });
  it('pauses at 2048 and permits continued play without repeated win prompts', () => {
    const won = moveGame(state(board([1024, 1024, 0, 0])), 'left', () => 0);
    expect(won.status).toBe('won'); expect(won.score).toBe(2048);
    expect(moveGame(won, 'right')).toBe(won);
    const continued = continueGame(won);
    expect(continued.continued).toBe(true); expect(continued.status).toBe('playing');
    expect(moveGame(continued, 'right', () => 0).status).toBe('playing');
    expect(continueGame(state(blocked)).continued).toBe(false);
  });
  it('continuing a won but blocked board ends the game', () => {
    expect(continueGame({ ...state([[2048, 4, 2, 4], ...blocked.slice(1)]), status: 'won' }).status).toBe('over');
  });
});

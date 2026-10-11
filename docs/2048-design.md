# 2048 design

2048 is a 4×4 number-merging game displayed as an ASCII board. Rules are independent of React; the terminal supplies controls, session state, and persistence for the personal best. See the [shared games architecture](games-design.md) for terminal behaviour common to all games.

## Source map

| File | Responsibility |
| --- | --- |
| [shared/game2048.ts](../shared/game2048.ts) | Board movement, spawning, scoring, available moves, win/loss, continued play |
| [src/Game2048.tsx](../src/Game2048.tsx) | ASCII board, tile colours, status, best-score validation |
| [src/Terminal.tsx](../src/Terminal.tsx) | `GameSession`, input interpretation, restart confirmation, best-score writes, exit snapshot |
| [shared/shell.ts](../shared/shell.ts) | Virtual entry, instructions, and launch result |
| [src/styles.css](../src/styles.css), [src/themes.css](../src/themes.css) | Responsive typography and per-theme tile colours |

## State and lifecycle

`Board` is a readonly array of readonly numeric rows. Zero represents an empty cell. The algorithms assume four rows and four columns; the type alone does not enforce those dimensions.

`GameState` contains `board`, `score`, `status` (`playing`, `won`, or `over`), and `continued`. `GameSession` adds the personal best, a transient message, and a restart-confirmation flag. The transient UI fields stay outside the rules engine.

`createGame()` creates an empty board, spawns two tiles in separate cells, and starts at score zero. `moveGame()` accepts a move only while playing. Reaching a tile of at least 2048 pauses the game with status `won`; `continueGame()` sets `continued` and resumes, or reports `over` if no move is possible. The continuation flag prevents another win prompt on every later move.

Restart creates a new board after confirmation and retains the personal best. Quit appends the board and final score to scrollback, removes live controls, and restores the shell.

## Movement algorithm

`slideBoard()` reads four lines in movement order. Left and right read rows; up and down read columns. Reversing the coordinates handles right/down without a second merge algorithm.

For each line it removes zeros, scans adjacent values, merges equal neighbours, skips both merged inputs, and pads the remainder with zeros. Every tile merges at most once per move. For example:

```text
left: [2, 2, 2, 2] -> [4, 4, 0, 0], gain 8
left: [2, 2, 4, 0] -> [4, 4, 0, 0], gain 4
```

The newly created 4 in the second example does not merge again. Score gain is the sum of merged output values. The function returns a copied board, gain, and whether any cell changed; it does not mutate its input.

`moveGame()` then performs these steps:

1. If the board did not change, keep it and consume no randomness. If it is blocked, set status `over`.
2. Otherwise spawn exactly one tile in an empty cell.
3. Add merge gain to the score.
4. Detect the first win, or check whether the resulting board still has a move.

`hasMoves()` recognises an empty cell or equal horizontally/vertically adjacent cells. `spawnTile()` chooses uniformly among empty cells, then chooses 2 with probability 90% or 4 with probability 10%. Both spawning and full moves accept an injected random function, so tests can control cell and tile choices. The normal default is `Math.random`.

## Input and rendering

`gameInput()` in `Terminal.tsx` maps W/A/S/D and direction words to engine directions. Arrow keys move immediately. Desktop letter shortcuts act immediately when the input is empty; coarse-pointer devices can type a command and press Enter. R requests restart, Y/N answers it, C continues after winning, and Q quits.

`Game2048` renders `+`, `-`, and `|` borders in a `<pre>`, with tile values in coloured text spans. Cell width expands for longer numbers. `--board-columns` lets CSS reduce font size to fit the actual output width. Short-height container queries tighten spacing when the mobile keyboard leaves little room.

Tile colours use `--tile-2` through `--tile-2048` from the current theme. Higher tiles reuse the 2048 colour. A separate polite status announcement reports changes without announcing the whole board on each render. The board remains selectable text.

## Persistence and extension points

Only the personal best is saved, under `luna-2048-best`. `readBest()` accepts a non-negative safe integer and falls back to zero for invalid or inaccessible storage. The terminal writes a new best when the score increases. Board, restart confirmation, and continuation are not restored after reload.

Changing board dimensions requires edits to the engine's fixed loops, edge checks, renderer, width calculation, and tests. Changing the target requires coordinating win detection, continuation copy, and colour handling. Adding saved boards would require a versioned validator for dimensions, tile values, score, and status; do not reuse the best-score number as a board format.

## Verification

[tests/game2048.test.ts](../tests/game2048.test.ts) covers single merges, movement direction, score, spawning, randomness consumption, blocked boards, win/loss, and continuation. [tests/game-rendering.test.tsx](../tests/game-rendering.test.tsx) covers text output, large values, restart/win messages, and best-score validation. [tests/e2e/games.spec.ts](../tests/e2e/games.spec.ts) exercises keyboard controls, theme colours, copying, scrollback, short viewports, restart/exit, and blocked storage.

```bash
npx vitest run tests/game2048.test.ts tests/game-rendering.test.tsx
npx playwright test tests/e2e/games.spec.ts
```

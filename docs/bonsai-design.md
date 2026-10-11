# Bonsai design

Bonsai is a seeded ASCII tree generator with progressive growth and an optional screensaver mode. Its tree logic is independent of the component's timers and viewport measurements. See the [shared games architecture](games-design.md) for terminal integration.

The browser implementation is original TypeScript inspired by **cbonsai by John Allbritten**, available at [the original repository](https://gitlab.com/jallbrit/cbonsai), and [the GitHub fork by jakobrees](https://github.com/jakobrees/cbonsai). It does not execute or compile cbonsai's C program. `bonsaiAttribution` supplies those credits in launch output, help, and the virtual readme; retain them when extending the game.

## Source map

| File | Responsibility |
| --- | --- |
| [shared/bonsai.ts](../shared/bonsai.ts) | Seeded generator, stroke types, projection, pot, plain-text rendering, attribution |
| [src/Bonsai.tsx](../src/Bonsai.tsx) | Growth timers, pause/selection/visibility, sizing, screensaver lifecycle, text renderer |
| [shared/shell.ts](../shared/shell.ts) | `bonsai` command, virtual entry, option validation, instructions, completion |
| [src/Terminal.tsx](../src/Terminal.tsx) | Launch, prompt, key delegation, copying/cancellation, exit snapshot |
| [src/styles.css](../src/styles.css) | Tree typography, tone classes, compact layouts |

## Generation model

`generateBonsai(seed)` returns a `BonsaiTree`: the seed normalised to an unsigned 32-bit integer and an ordered list of strokes. Each stroke has an `x`, `y`, ASCII character, and tone (`wood`, `wood-light`, `leaf`, `leaf-light`, or `pot`). Generation uses a local seeded integer random stream; it does not share `Math.random` or browser state.

The canonical drawing surface is 77 columns by 24 rows. The generator draws a short curved trunk, a lower branch, and two upper branches. Recursive branches use bounded depth, shortened lengths, clamped angles, and interpolated points so connecting segments do not leave large gaps. Terminal branch tips receive elliptical leaf clusters, drawn from the centre outward. Drawing rounds coordinates and drops points outside the canonical surface.

The result is a drawing sequence, not a prebuilt string for every animation frame. A seed reproduces the sequence for the current generator implementation. Algorithm changes can change the tree produced by an old seed; there is no versioned seed compatibility promise.

## Projection and text rendering

`BonsaiSnapshot` combines a tree, revealed stroke count, columns, and rows. `treeDimensions()` clamps the grid to 23–79 columns and 9–28 rows. `renderBonsai()` projects only the revealed prefix into that grid, then draws a centred four-line pot at the bottom. A leaf stroke cannot overwrite wood already present at a projected cell. The pot appears even before the first branch is revealed.

The generator's strokes do not change when the viewport changes. Projection is recalculated at the new dimensions, preserving the seed and growth progress. The minimum width accommodates the pot. CSS can further reduce text size to fit the terminal.

`BonsaiArt` groups adjacent cells with the same tone into text spans within each row of a `<pre>`. This reduces DOM elements while retaining selectable characters. `treeText()` produces plain text from the same projection for tests and comparisons. The UI uses the semantic tones through CSS classes, so colours follow the terminal theme.

## Component lifecycle

`Bonsai` owns seed, revealed count, manual pause, selection pause, page visibility, reduced-motion preference, measured dimensions, and status text. `BonsaiHandle` exposes `command()`, `key()`, and `quit()` to the terminal.

Normal growth runs on a 60 ms interval, revealing `max(1, ceil(strokeCount / 140))` strokes per tick. It stops when complete, manually paused, text is selected, the document is hidden, or reduced motion is enabled. Selection and visibility are checked again inside timer callbacks to avoid advancing between an event and React's next render.

Reduced motion renders the complete tree immediately and disables screensaver cycling. Manual pause remains separate from selection pause: clearing a selection resumes growth only if it was not manually paused.

Screensaver mode waits two seconds after a tree completes, then generates a fresh seed and resets growth. Hidden tabs, selection, manual pause, and reduced motion also prevent this transition. Fresh seeds come from `crypto.getRandomValues`; a repeated seed is adjusted to avoid immediately repeating the same tree. `quit()` has an `exited` guard so overlapping event handlers cannot append two snapshots. Effects clean up intervals, timeouts, listeners, and observers when the component unmounts or dependencies change.

## Viewport and input handling

A `ResizeObserver` watches the terminal output and a hidden monospace measurement character. The component measures available width/height, subtracts padding and room for status text, derives rows/columns, and clamps them through `treeDimensions()`. Short-height CSS rules reduce controls and typography. Resizing calls the terminal's layout callback so following scrollback remains correct.

The shell accepts `--seed` as a whole number from 0 through 4294967295 and `--screensaver`; it rejects unknown or repeated options. `bonsai --help` prints instructions rather than launching. The virtual game entry accepts the same options.

In normal mode Space toggles pause, R starts a new tree, and Q quits. Typed `pause`, `resume`, `r`, and `q` work with Enter; `pause` is a toggle rather than a one-way pause operation. Desktop P is another pause toggle. Screensaver mode exits on non-copy keypresses and consumes the exit key so it does not enter the restored shell prompt. Modifier keys by themselves and selected-text copying do not exit it.

On exit, the terminal stores the current snapshot as a static `BonsaiOutput` block. Only the active component has timers. Later trees cannot animate or mutate earlier scrollback snapshots. There is no saved bonsai state or backend request.

## Extending bonsai

Change branch shape, leaf distribution, or trunk parameters in `generateBonsai()` and retain a bounded drawing workload. Change pot geometry in `renderBonsai()` alongside minimum dimensions and vertical space reserved for it. Add tones through `TreeTone`, renderer classes, and theme-aware CSS. Keep generator and projection deterministic; time should control how much is revealed, not the shape.

A new option needs changes to `BonsaiOptions`, `startBonsai()` validation and completion in the shell, help/readme copy, and the component if it affects playback. Check restart, reduced motion, hidden tabs, and selection together when changing animation. Never add timers to the static snapshot renderer.

## Verification

[tests/bonsai.test.ts](../tests/bonsai.test.ts) covers deterministic generation, bounds/workload, projection, pot visibility, options, attribution, and shell completion. [tests/bonsai-rendering.test.tsx](../tests/bonsai-rendering.test.tsx) covers selectable text and tone classes. [tests/e2e/bonsai.spec.ts](../tests/e2e/bonsai.spec.ts) covers growth, copying, pause, seed reproduction, screensaver exits/cycling, hidden tabs, reduced motion, palettes, and viewport fitting.

```bash
npx vitest run tests/bonsai.test.ts tests/bonsai-rendering.test.tsx
npx playwright test tests/e2e/bonsai.spec.ts
```

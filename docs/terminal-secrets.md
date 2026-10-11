# Terminal secrets

These are browser-only easter eggs in the virtual shell. They use ordinary selectable output and the existing prompt. The standard `help` list keeps them unadvertised; command completion and `ls -a` make them discoverable.

| Command | Behaviour |
| --- | --- |
| `ps` | Fictional process table, labelled simulated; `napd` takes most of the CPU |
| `ls -a` | Shows hidden virtual entries, including `~/.config/` |
| `cat ~/.config/luna.conf` | Reads Luna's household settings |
| `cat ~/documents/.incident-report.txt` | Peter's report of Luna's desk incident; discover it with `ls -a ~/documents` |
| `sudo [anything]` | Uses the visitor's login name in the sudoers joke; arguments remain inert |
| `meow` | Cycles through four responses, then repeats `Peter has heard you.` |
| `man luna` | Mock manual with actions, sleeping locations, and known bugs |
| `fortune` | Random cat advice; consecutive fortunes differ |

Copy lives in [shared/secrets.ts](../shared/secrets.ts). [shared/shell.ts](../shared/shell.ts) registers commands and the fake config file. Hidden filenames stay out of ordinary listings and completion until explicitly requested with a dot prefix or `ls -a`/`ls --all`. The config file is virtual text and has no connection to the host's configuration or secrets.

`ShellSession` holds the visitor's username, meow count, and previous fortune index. `execute()` accepts that state and returns a replacement state for commands that change it. [src/Terminal.tsx](../src/Terminal.tsx) owns the state in a ref. Login creates a fresh session; clearing, changing directories, and entering or exiting a game preserve it. Reloading starts fresh. No server, database, storage, game-save, or admin changes are involved.

For editable copy, change the strings and arrays in `shared/secrets.ts`. For new stateful behaviour, extend `ShellSession` and its defaults, then return a new session without mutating the input. Fortune randomness is injected into `execute()` for deterministic tests.

[tests/secrets.test.ts](../tests/secrets.test.ts) covers execution, hidden paths, completion, repetition, usernames, immutable state, and invalid arguments. [tests/e2e/secrets.spec.ts](../tests/e2e/secrets.spec.ts) covers the full desktop/mobile interaction, selection, game transitions, reset on reload, escaped usernames, incident-report discovery, and viewport containment.

```bash
npx vitest run tests/secrets.test.ts tests/shell.test.ts
npx playwright test tests/e2e/secrets.spec.ts
```

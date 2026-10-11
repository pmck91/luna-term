# Luna terminal portfolio

A browser-only virtual terminal for **term.pmck.ie**, developed by Peter McKinney. Luna is named after his cat. The public page contains a terminal window and copyright footer. Content management lives at `/admin`.

Built with [Codex](https://openai.com/codex/).

## Run locally

Use Node 24 LTS and npm. From this directory:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

Put those two different random values in `SESSION_SECRET` and `ADMIN_SETUP_TOKEN`. Leave `PUBLIC_ORIGIN=http://localhost:5173` for development. Keep `.env` private; it is ignored by Git and Docker.

```bash
npm ci
npm run dev
```

Open **http://localhost:5173**. Visit **http://localhost:5173/admin** to create the first account using `ADMIN_SETUP_TOKEN`. Choose a username and a password of at least 12 characters. Setup closes permanently once an account exists. The setup token is never sent to the public frontend.

If those ports are occupied, set `PORT` to a free API port, `VITE_PORT` to a free frontend port, and `PUBLIC_ORIGIN` to that frontend origin. Both servers fail rather than silently switching ports. To pass the values from `.env` to both development processes, the development command loads the environment before launching them.

If npm 12 asks about install scripts, approve the pinned `argon2`, `better-sqlite3`, and `esbuild` packages and run `npm rebuild`. The repository already records those approvals. Node 24's npm runs their build scripts during installation.

For a local production build, run `npm run build`, change `PUBLIC_ORIGIN` to `http://localhost:3000`, and run `npm start`. This local run uses development cookie settings unless `NODE_ENV=production` is set. Production requires an HTTPS origin.

## Terminal

Startup takes approximately two seconds. Any non-empty login name is accepted; `guest` is suggested. The shell and all system information are simulated. No SSH connection or real command execution occurs, and no visitor IP is shown.

```text
help
ls
cd projects
./portfolio.luna
cd ~/documents
ls
~/messaging/contact.sh
cat ~/messaging/socials.txt
~/games/2048.game
theme nord
clear
```

Projects use `.luna`, blog documents `.ldoc`, the contact interaction `contact.sh`, and built-in games `.game`. These are virtual filenames. `cat` reads Markdown as source; running an entry renders it inside scrollback. `/` is the virtual home root, also shown as `~` in prompts.

Tab completes commands and paths. Up/Down navigate command history. Ctrl+C cancels input or an active contact form unless text is selected, in which case it copies. Ctrl+Shift+C also copies selected text in browsers that permit clipboard access. Ctrl+L clears output. Page Up/Down scroll output. Shift+Tab accesses output links and native video controls; Escape returns to the command line. Text and the cat artwork can be selected with the pointer. Browser and OS shortcuts may take precedence outside input.

The contact script prompts for name, email, subject, then message. Enter successive message lines; a single `.` ends the message. Review with `send`, `edit`, or `cancel`. Messages are stored privately for the admin; no email is sent. Submitting retries use the same identifier to prevent duplicate messages. Once a submission is in flight, wait for confirmation before cancelling.

The page never scrolls; terminal output scrolls internally. Mobile input is focused after startup. Some mobile browsers require a direct tap on the input before opening their keyboard. The layout follows the visible viewport when the keyboard appears. A multiline prompt is supported for long login names.

### Games

`games/` contains 2048, bonsai, and Luna's adventure, each with its own readme. Run `~/games/2048.game`, or `cd games` followed by `./2048.game`. The selectable ASCII board redraws in place, with a different number colour for each power of two through 2048, using the current theme. Higher tiles share the 2048 colour. A compact layout follows the actual output height when the mobile keyboard leaves less space.

Arrow keys or WASD move tiles. With an on-screen keyboard, type W/A/S/D and press Enter; direction names (`up`, `left`, `down`, `right`) also work. R requests a restart, Y confirms, and N keeps the current game. At 2048, C continues playing. Q or Ctrl+C exits and leaves the final board and score in scrollback, restoring the shell directory and command history. Selecting text keeps the existing Ctrl+C copy behaviour. Ctrl+L clears previous output while preserving the active board; Page Up/Down still navigate scrollback. Escape returns focus to the input.

The rules use a 4×4 board, two starting tiles, one merge per tile per move, and a new tile after each move that changes the board (90% 2, 10% 4). The personal best is stored under `luna-2048-best` in this browser's local storage; no game data is sent to the server. If storage is unavailable, the game still works. Games are built into the application, rather than editable admin content; no database migration or additional configuration is needed.

### Bonsai

`bonsai` grows a coloured ASCII tree inside the terminal. Run `bonsai --seed 42` to reproduce a tree, or `bonsai --screensaver` to grow successive trees until a keypress returns to the shell. The runnable virtual entry is `~/games/bonsai.game`; it accepts the same options. Read `~/games/bonsai-readme.txt` or run `bonsai --help` for instructions. The 2048 instructions are now `~/games/2048-readme.txt`.

Space pauses/resumes, R grows a new tree, and Q or Ctrl+C exits, leaving the current tree and its seed in scrollback. On an on-screen keyboard, type `pause`, `resume`, `r`, or `q` and press Enter. Selecting text temporarily pauses growth so it can be copied; clearing the selection resumes unless manually paused. Copying selected text also works in screensaver mode. Ctrl+L clears earlier output while preserving a normal bonsai session. Page Up/Down navigate scrollback; Escape refocuses the prompt. In screensaver mode, other keypresses exit and are consumed rather than inserted into the restored shell input.

The tree fits the actual output width and height, including a shorter mobile keyboard viewport. Growth stops while the tab is hidden, and reduced-motion preferences show a finished tree without animation or screensaver cycling. The TypeScript generator is an original browser implementation inspired by [cbonsai by John Allbritten](https://gitlab.com/jallbrit/cbonsai) and the [GitHub fork by jakobrees](https://github.com/jakobrees/cbonsai). Both are credited with links when bonsai launches, in `bonsai --help`, and in `~/games/bonsai-readme.txt`. It uses deterministic seeds and bounded drawing work; no C binary, operating-system command, server process, or new database table is involved.

### Luna's adventure

Run `~/games/lunas-adventure.game`, or `./lunas-adventure.game` from `~/games`. Read `~/games/lunas-adventure-readme.txt` for instructions. Play Luna, Peter's small black cat, in a seven-room house: get breakfast, earn a treat, and find the missing yellow mouse. The quests can be completed in any order. There is no time limit or losing, and every interaction has a reachable target.

Use `look`, `inspect <item>`, `go <room>`, and cat actions such as `sniff shoes`, `meow`, `purr`, `climb shelf`, or `play sock`. `inventory`, `goals`, and `map` show carried items, progress, and the house connections. `hint`, or `hint food`, `hint treats`, and `hint toy`, gives increasingly specific help for the current step. The sock and mouse can be carried, dropped, and retrieved in other rooms; dropping the mouse does not undo finding it. `help` lists all actions. Objects shown in room descriptions and inspection responses share the engine's action definitions with Tab completion.

Each command and response appears as selectable terminal text in scrollback, with a persistent `luna>` prompt. Tab completes verbs, connected rooms, and visible or carried targets, including multiword names and aliases. Up/Down navigate a separate adventure history. Ctrl+L clears scrollback and shows the current room without resetting progress. Ctrl+C saves and exits unless text is selected for copying; `quit` also returns to the shell. Escape refocuses the input, and Page Up/Down scroll output. Quitting restores the previous shell directory and history.

Progress is saved after changes under `luna-adventure-save` in local storage, including room, furniture position, carried/dropped item locations, quest flags, repeated interactions, and hint progress. Saves are versioned and validated before restoring; corrupt or incompatible saves start fresh with a brief message. `restart` requires a `yes`/`no` confirmation before replacing progress. If browser storage is blocked or fills up, play continues and progress can be resumed during the same visit; the terminal explains that it will not survive a reload. No adventure data is sent to the server. This is built-in content and needs no database migration, admin setup, or additional configuration. Room and item copy lives in `shared/adventure-content.ts`; the pure game engine lives in `shared/adventure.ts`.

## Content management

The first database initializes with a published project about this portfolio and one unpublished example blog post. Social links initially contain no entries.

An optional [Night Watch example](examples/night-watch/README.md) includes an illustration, a feature list, and a locally hosted video. After initializing the database, run `npm run example:night-watch` to add it as a draft, or `npm run example:night-watch -- --publish` to make it runnable as `~/projects/night-watch.luna`. Repeat imports preserve existing entries. In Docker, use `docker compose -p luna exec luna node scripts/import-example.mjs --publish`.

At `/admin`, create projects or blog posts, edit Markdown, preview, publish/unpublish, or delete them. Slugs use lowercase letters, numbers, and single hyphens; filenames are generated from the slug and entry type. The preview shares the public renderer, including virtual path, prompt, links, and media. Checking **Published** and saving makes the entry visible publicly. Unchecking it and saving removes it from the virtual filesystem.

Images use normal Markdown:

```markdown
![Useful image description](/media/upload-id)
```

Videos use a fenced block:

````markdown
```video
/media/upload-id
Useful video description
```
````

Upload an image or video in the editor to insert the correct syntax. Replace generated image descriptions with useful alt text. Accepted types are JPEG, PNG, GIF, WebP, MP4, and WebM, checked by file signature. Images are limited to 10 MB; video to 50 MB. Native video controls support keyboard interaction. HTTPS media URLs are also supported; HTML embeds and iframes are disabled. Markdown raw HTML and unsafe URL schemes are not rendered.

Uploaded files stay private until referenced in a published entry. Unpublishing or deleting the final published reference makes the upload private again. Files remain on disk for reuse; entry deletion does not destroy uploaded originals. Database and filesystem directories must not be served directly by the reverse proxy.

Edit social links in their admin section. Review, mark read/unread, and delete private messages in **Messages**. The application does not provide introduction or avatar editing.

## Docker deployment

Configure `.env`:

| Variable | Value |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://term.pmck.ie`, without a trailing slash |
| `SESSION_SECRET` | At least 32 random characters; use the generated secret |
| `ADMIN_SETUP_TOKEN` | A different random value of at least 32 characters |
| `GITHUB_REPOSITORY_URL` | Optional HTTPS source URL; blank displays an editable placeholder |
| `TRUST_PROXY` | Exact IPs or CIDRs of your reverse proxy, comma-separated |
| `REVERSE_PROXY_NETWORK` | Existing Docker network shared with your reverse proxy, default `proxy` |

`PORT`, `DATABASE_PATH`, and `MEDIA_PATH` are available for local runs. Compose fixes these to port 3000 and the mounted `/app/data` and `/app/uploads` directories.

Connect your reverse proxy to the configured network, then run:

```bash
docker compose -p luna config --quiet
docker compose -p luna up -d --build
docker compose -p luna ps
```

The service is available as **http://luna:3000** on that network. It publishes no host port. Named volumes **luna_database** and **luna_media** persist across container replacement. Run one application instance. Request rate limits are held in memory and reset on restart.

For example, in an Nginx reverse proxy attached to the network:

```nginx
server {
    listen 443 ssl;
    server_name term.pmck.ie;
    # Configure your certificate and key here.
    client_max_body_size 51m;
    location / {
        proxy_pass http://luna:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Add an HTTP-to-HTTPS redirect. Set `TRUST_PROXY` to the proxy's fixed network IP or a dedicated proxy subnet with no untrusted containers. The proxy must overwrite forwarded headers. Correct proxy trust is required for secure cookies and per-client rate limits. Do not use unconditional proxy trust.

`GET /healthz` verifies database access. Docker checks it every 30 seconds. Startup fails on missing secrets or an invalid production origin. Migrations apply transactionally before serving requests. Production sessions use Secure, HttpOnly, SameSite=Strict cookies, SQLite storage, and an eight-hour absolute authentication lifetime. Admin writes require CSRF tokens and a matching origin. Passwords use Argon2id.

## Account recovery

With access to the deployment host:

```bash
docker compose -p luna exec luna node dist/server/recover.js
```

Enter and confirm the new password interactively. The input is hidden, the new password is hashed, and every existing admin session is invalidated. Content and messages are preserved. For local development use `npm run recover`. Recovery requires an interactive TTY and an existing account; a fresh installation uses `/admin/setup` instead. Passwords are not passed in command arguments or written to logs.

## Backups and upgrades

Use the `-p luna` project name consistently so the volume names below match. To back up a consistent database and media snapshot:

```bash
mkdir -p backups
docker compose -p luna stop luna
docker run --rm -v luna_database:/data:ro -v luna_media:/uploads:ro \
  -v "$PWD/backups:/backup" alpine \
  tar -czf /backup/luna.tar.gz -C / data uploads
docker compose -p luna start luna
```

The backup contains private messages and account hashes. Keep it private and store `.env` separately in your secret store. Copy or rename each backup before making another.

To restore, stop the service and restore into empty volumes:

```bash
docker compose -p luna stop luna
docker run --rm -v luna_database:/data -v luna_media:/uploads \
  -v "$PWD/backups:/backup:ro" alpine \
  tar -xzf /backup/luna.tar.gz -C /
docker compose -p luna start luna
```

Back up before upgrading, then run `docker compose -p luna up -d --build`. Keep the matching database backup when rolling back migrations. `docker compose down` retains data; `down -v` removes it.

## Checks

```bash
npm run check
npx playwright install chromium
npm run test:e2e
docker compose -p luna config --quiet
```

Unit and API tests cover command parsing, path resolution, completion, themes, safe content rendering, private media, contact validation/persistence/rate limits, authentication, setup races, session rotation/expiry, and route protection. Game tests cover directional merges, scoring, spawning, invalid moves, win/loss detection, continued play, ASCII rendering, and personal best validation. Browser tests cover startup, the exact cat logo, keyboard controls, text selection, scrollback, mobile viewport shrinking, contact review/editing, inline image/video containment, and admin editing/preview, plus game restart/exit, saved scores, all theme palettes and tile contrast, and full board visibility in a short viewport.

Bonsai tests cover seeded generation, bounded rendering, virtual commands, pause/resume, selection, screensaver cycling, reduced motion, hidden-tab suspension, and viewport fitting. Adventure tests cover the exact house graph, all six quest orders, early toy discovery, target/action coverage, carried and dropped items, hints, completion, safe text output, and save validation. Desktop and mobile adventure checks include a full walkthrough, browser reload/resume, confirmed restart, separate command history, selection/copy, clearing, internal scrolling, small keyboard viewports, theme inheritance, corrupt saves, blocked storage, and write failures.

Browser tests use frontend port 5187, API port 3087, an isolated database at `/tmp/luna-e2e.sqlite`, and uploads at `/tmp/luna-e2e-media`. They use a test-only admin account, never the configured local account. Screenshots are written to `artifacts/` and traces to `test-results/`, both ignored. The fixtures are generated test patterns, not portfolio content.

After building `luna-portfolio:local`, run `node tests/container-smoke.mjs` to verify the production container, health check, non-root execution, secure sessions, private submissions, and database/media persistence across restart. This creates a temporary Compose project and removes its own containers, network, and volumes afterwards.

For an additional WebKit mobile run on a supported host, install WebKit and its OS dependencies, then run `LUNA_WEBKIT=1 npm run test:e2e`. Mobile emulation checks layout and interaction; actual on-screen keyboard behaviour still needs a real-device check. If browsers are installed in a custom location, pass `PLAYWRIGHT_BROWSERS_PATH` when installing and running.

## License

[MIT](LICENSE), copyright © 2026 Peter McKinney. Third-party dependencies retain their own licenses. Bonsai's original author and the GitHub fork are credited above and inside the terminal.

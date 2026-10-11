# Night Watch example

Sample project content with a feature list, an original illustration, and a 12-second embedded video. This is a fictional concept, not a claim about a completed client project.

- `project.md`: editable project Markdown.
- `night-sky.png`: original illustration generated with the built-in image generation tool.
- `night-sky.mp4`: a slow zoom across the illustration, generated locally with FFmpeg. H.264, 1280 × 720, 25 fps, no audio.
- `manifest.json`: identifiers used by the import helper.

Import into an initialized local database as a draft:

```bash
npm run example:night-watch
```

To publish on import:

```bash
npm run example:night-watch -- --publish
```

In Docker:

```bash
docker compose -p luna exec luna node scripts/import-example.mjs --publish
```

The helper copies the assets into the configured media directory, registers them in SQLite, and creates `~/projects/night-watch.luna`. Running it again preserves existing content. Once imported, use the admin to edit, publish, unpublish, or delete the entry.

## Image prompt

Generated using the built-in image tool with this final prompt:

Use case: stylized-concept. Asset type: inline illustration for a sample project named Night Watch in a dark terminal portfolio. Create a polished wide landscape illustration of a tranquil mountain lake at night, dark layered mountain silhouettes, a clear star-filled sky, a slender crescent moon, and subtle moonlight reflected in still water. Modern editorial illustration with restrained detail, soft atmospheric gradients, muted midnight blue, lavender and pale moonlight tones that fit Catppuccin Mocha. Wide 16:9 composition, landscape artwork filling the entire frame, clear focal point, attractive at small terminal widths. No text, no labels, no logos, no borders, no UI, no watermark. This is a fictional illustrative asset, not a screenshot or a photograph.

# dailysticky

one sticker a day. memories that stick.

## Live app

https://dailysticky.app

## Structure

Pages live at the repo root (their URLs are public — `about.html`, `artists.html`, etc. are indexed directly, so they never move). Everything else is grouped by feature under `src/`:

- `index.html` — main calendar + picker page, loads `src/calendar/app.js`
- `notes.html` — saved daily notes view, loads `src/notes/notes.js`
- `about.html`, `artists.html` / `artist-profile.html` — static + artist pages, load `src/artists/*.js`
- `blog/` — Sticky Notes blog
- `share.html` — weekly recap share screen
- `sw.js`, `manifest.webmanifest` — PWA support
- `ig/` — Instagram bio-link redirect (`ig/redirect.js`, `ig/redirects.js`)

- `src/calendar/app.js` — calendar rendering; also currently owns export, weekly sharing, and the in-day note modal (not yet split apart — see below)
- `src/stickers/` — `sticker-data-v2.js` (reads `data/stickers.db` via `sql.js`), `sticker-picker-v2.js`
- `src/notes/notes.js` — saved notes page logic
- `src/artists/` — `artists.js`, `artist-profile.js`
- `src/shared/` — `nav.js`, `analytics.js`, `styles.css` — used across multiple pages
- `src/legacy/` — quarantined, unreferenced-by-`app.js` code kept for reference: `sticker-picker.js` + `state.js` (superseded v1 picker path), `stickers.json` + `disabled-stickers.json` (its data), `generate-stickers.js` (deprecated generator), `stickers-demo.db` (for `?demo`), `needs-review.json` + `failed-stickers.json` (tagging-script output), `no-favicon.ico`, `download-tray.svg`, `open-book.svg` (unused assets). `index.html` still loads `state.js`/`sticker-picker.js` from here even though `app.js` never calls them — not deleted, just moved out of the way.
- `admin/sticker-admin-v3.html` — the sticker/artist admin tool (see below)
- `assets/img/` — app images (logo, icons, share graphics). `favicon.ico` stays at repo root by hosting convention.
- `data/` — `stickers.db`, the live picker's source of truth

> `app.js` isn't split into `src/export/` or `src/sharing/` folders yet — it was moved as a single file to keep this reorg to file moves + path updates, not a rewrite. Splitting it apart is a separate, riskier follow-up if wanted.

## Data

- `data/stickers.db` (and `src/legacy/stickers-demo.db` for `?demo`) — sqlite db loaded client-side via `sql.js` (`vendor/sql.js`), read by `src/stickers/sticker-data-v2.js`. **Source of truth** for the live picker.
- `src/legacy/stickers.json` — generated flat list, only used by the retired `src/legacy/state.js` / `src/legacy/sticker-picker.js` (v1) path.
- `src/legacy/disabled-stickers.json` — ids excluded from the active set in the old v1 path.
- `src/legacy/needs-review.json` / `src/legacy/failed-stickers.json` — output from the tagging script for stickers needing manual attention.

## Tools & repeat actions

### Adding new stickers

`admin/sticker-admin-v3.html` is the **only** way stickers get added — don't hand-edit `stickers.db` or drop files into `/stickers` directly.

1. Open `admin/sticker-admin-v3.html` locally and load the current `data/stickers.db` ("Choose file").
2. Click **Bulk import** in the header, then "Choose images" to select one or more source images.
3. For each row, fill in name / tags / primary & secondary category / artist (or edit inline in the table; "Apply to selected" can batch-set a field across rows).
4. Click **Add all to database**. This:
   - converts each image to `.webp` (512px max, quality 0.85),
   - writes the file straight into your local `/stickers` folder (you'll be asked to pick that folder the first time — Chrome/Edge only; other browsers get a `stickers-export.zip` to unzip into `/stickers` instead),
   - inserts a row into the in-memory `stickers` table.
5. Click **Download .db** and overwrite `data/stickers.db` with the downloaded file.

Use **+ Add sticker** instead only when the `.webp` file is already sitting in `/stickers` and you just need to add one db row by hand. 
4. To retire a sticker open it in `admin/sticker-admin-v3.html` and uncheck **Active**, then download and overwrite `data/stickers.db`. - `src/legacy/disabled-stickers.json` — legacy only, don't edit.

### Local dev

No build step — serve statically:

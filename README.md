# dailysticky

one sticker a day. memories that stick.

## Live app

https://dailysticky.app

## Structure

- `index.html` / `app.js` — main calendar + picker (loads `nav.js`, `state.js`, `sticker-picker.js`, `sticker-data-v2.js`, `sticker-picker-v2.js`)
- `notes.html` / `notes.js` — saved daily notes view
- `about.html`, `artists.html` / `artist-profile.html` — static + artist pages
- `blog/` — Sticky Notes blog
- `share.html` — weekly recap share screen
- `styles.css` — all styling
- `sw.js`, `manifest.webmanifest` — PWA support

## Data

- `stickers.db` (and `stickers-demo.db` for `?demo`) — sqlite db loaded client-side via `sql.js` (`vendor/sql.js`), read by `sticker-data-v2.js`. **Source of truth** for the live picker.
- `stickers.json` — generated flat list, only used by the older `state.js` / `sticker-picker.js` (v1) path.
- `disabled-stickers.json` — ids excluded from the active set.
- `needs-review.json` / `failed-stickers.json` — output from the tagging script for stickers needing manual attention.

## Tools & repeat actions

### Adding new stickers

`sticker-admin-v3.html` is the **only** way stickers get added — don't hand-edit `stickers.db` or drop files into `/stickers` directly.

1. Open `sticker-admin-v3.html` locally and load the current `stickers.db` ("Choose file").
2. Click **Bulk import** in the header, then "Choose images" to select one or more source images.
3. For each row, fill in name / tags / primary & secondary category / artist (or edit inline in the table; "Apply to selected" can batch-set a field across rows).
4. Click **Add all to database**. This:
   - converts each image to `.webp` (512px max, quality 0.85),
   - writes the file straight into your local `/stickers` folder (you'll be asked to pick that folder the first time — Chrome/Edge only; other browsers get a `stickers-export.zip` to unzip into `/stickers` instead),
   - inserts a row into the in-memory `stickers` table.
5. Click **Download .db** and overwrite the repo's `stickers.db` with the downloaded file.

Use **+ Add sticker** instead only when the `.webp` file is already sitting in `/stickers` and you just need to add one db row by hand. 
4. To retire a sticker open it in `sticker-admin-v3.html` and uncheck **Active**, then download and overwrite `stickers.db`. - `disabled-stickers.json` — legacy only, don't edit.

### Local dev

No build step — serve statically:

// Run: node build-stickers-db.js
// Rebuilds stickers.db from stickers-tagged.json + disabled-stickers.json

const fs = require("fs");
const Database = require("better-sqlite3");

const TAGGED_FILE = "./stickers-tagged.json";
const DISABLED_FILE = "./disabled-stickers.json";
const DB_FILE = "./stickers.db";

const tagged = JSON.parse(fs.readFileSync(TAGGED_FILE, "utf8"));
const disabled = new Set(
  fs.existsSync(DISABLED_FILE)
    ? JSON.parse(fs.readFileSync(DISABLED_FILE, "utf8"))
    : [],
);

if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
const db = new Database(DB_FILE);

db.exec(`
  CREATE TABLE stickers (
    id TEXT PRIMARY KEY,
    file TEXT NOT NULL,
    name TEXT,
    primary_category TEXT NOT NULL,
    secondary_category TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    needs_review INTEGER NOT NULL DEFAULT 0,
    artist_id TEXT
  );

  CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE sticker_tags (
    sticker_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (sticker_id, tag_id)
  );

  CREATE TABLE artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    store_url TEXT,
    instagram_url TEXT,
    website_url TEXT
  );
`);

const insertSticker = db.prepare(`
  INSERT INTO stickers (id, file, name, primary_category, secondary_category, active, needs_review, artist_id)
  VALUES (@id, @file, @name, @primaryCategory, @secondaryCategory, @active, @needsReview, NULL)
`);

const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`);
const getTagId = db.prepare(`SELECT id FROM tags WHERE name = ?`);
const insertStickerTag = db.prepare(
  `INSERT OR IGNORE INTO sticker_tags (sticker_id, tag_id) VALUES (?, ?)`,
);

const insertAll = db.transaction((rows) => {
  for (const row of rows) {
    insertSticker.run({
      id: row.id,
      file: `${row.id}.webp`,
      name: row.name || null,
      primaryCategory: row.primaryCategory,
      secondaryCategory: row.secondaryCategory || null,
      active: disabled.has(row.id) ? 0 : 1,
      needsReview: row.needsReview ? 1 : 0,
    });

    for (const tagName of row.tags || []) {
      insertTag.run(tagName);
      const { id: tagId } = getTagId.get(tagName);
      insertStickerTag.run(row.id, tagId);
    }
  }
});

insertAll(tagged);

console.log(`✅ stickers.db built: ${tagged.length} stickers`);
db.close();

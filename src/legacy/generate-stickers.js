// DEPRECATED — superseded by the sticker-admin-v3.html + stickers.db (v2) path.
// to generate sticker file JSON, run this command from the repo root:
// node src/legacy/generate-stickers.js

const fs = require("fs");

const STICKERS_DIR = "./stickers";
const DISABLED_FILE = "./src/legacy/disabled-stickers.json";

const CATEGORY_LABELS = {
  relax: "Mental Health",
};

const disabledStickers = fs.existsSync(DISABLED_FILE)
  ? JSON.parse(fs.readFileSync(DISABLED_FILE, "utf8"))
  : [];

console.log("DISABLED:", disabledStickers);

const files = fs.readdirSync(STICKERS_DIR).filter((f) => f.endsWith(".webp"));

const groups = {};

for (const file of files) {
  const base = file.replace(".webp", "");

  // category = everything before the first number
  const match = base.match(/^([a-z-]+)/i);
  const category = match ? match[1] : "other";

  if (!groups[category]) groups[category] = [];

  groups[category].push({
    id: base,
    file,
    label: category.replace(/-/g, " "),
    active: !disabledStickers.includes(base),
  });
}

const formatCategoryName = (category) =>
  CATEGORY_LABELS[category] ||
  category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const output = Object.entries(groups)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([category, items]) => ({
    category: formatCategoryName(category),
    items: items.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    ),
  }));

fs.writeFileSync("./src/legacy/stickers.json", JSON.stringify(output, null, 2));

console.log("✅ stickers.json generated");

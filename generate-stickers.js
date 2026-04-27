// to generate sticker file JSON, run this command in the terminal
// node generate-stickers.js

const fs = require("fs");

const STICKERS_DIR = "./stickers";
const DISABLED_FILE = "./disabled-stickers.json";

const disabledStickers = fs.existsSync(DISABLED_FILE)
  ? JSON.parse(fs.readFileSync(DISABLED_FILE, "utf8"))
  : [];
console.log("DISABLED:", disabledStickers);
const files = fs.readdirSync(STICKERS_DIR).filter((f) => f.endsWith(".png"));

const groups = {};

for (const file of files) {
  const base = file.replace(".png", "");

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

const output = Object.entries(groups)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([category, items]) => ({
    category: category
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    items: items.sort((a, b) => a.id.localeCompare(b.id)),
  }));

fs.writeFileSync("stickers.json", JSON.stringify(output, null, 2));
console.log("✅ stickers.json generated");

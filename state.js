const STICKER_YEAR_STORAGE_KEY = "stickerYear.v1";
const STICKER_YEAR_VERSION = 1;
// test
function loadDailyStickyState() {
  try {
    const raw = localStorage.getItem(STICKER_YEAR_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return migrateDailyStickyState(parsed);
  } catch (error) {
    console.error("Could not load Daily Sticky state:", error);
    return null;
  }
}

function migrateDailyStickyState(parsed) {
  return {
    version: STICKER_YEAR_VERSION,
    year: parsed.year ?? new Date().getFullYear(),
    month: parsed.month ?? new Date().getMonth(),
    view: parsed.view ?? "month",
    placements: parsed.placements ?? {},
    notes: parsed.notes ?? {},
  };
}

function saveDailyStickyState(state) {
  const toSave = { ...state, version: STICKER_YEAR_VERSION };
  localStorage.setItem(STICKER_YEAR_STORAGE_KEY, JSON.stringify(toSave));
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

async function fetchStickerData() {
  const res = await fetch("/stickers.json");
  const data = await res.json();

  let stickerGroups = [];
  let stickers = [];

  if (Array.isArray(data) && data.length && data[0].items) {
    stickerGroups = data;
    stickers = data.flatMap((group) =>
      (group.items || []).map((item) => ({
        ...item,
        category: group.category || item.category || "Other",
        file: item.file || item.src || "",
      })),
    );
  } else {
    stickers = data;
  }

  const stickerById = new Map(stickers.map((sticker) => [sticker.id, sticker]));

  return { stickerGroups, stickers, stickerById };
}

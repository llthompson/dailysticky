const STICKER_YEAR_STORAGE_KEY = "stickerYear.v1";
const STICKER_YEAR_VERSION = 1;
// test again at 10 am
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

function exportDailyStickyBackup() {
  const state = loadDailyStickyState() || migrateDailyStickyState({});

  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sticker-year-${ymd(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);

  DailyStickyAnalytics.trackEvent("backup_exported");
}

async function importDailyStickyBackup(file) {
  const text = await file.text();
  const imported = JSON.parse(text);

  if (!imported || typeof imported !== "object" || !imported.placements) {
    throw new Error("Not a valid Daily Sticky export.");
  }

  const current = loadDailyStickyState() || migrateDailyStickyState({});
  const next = {
    year: imported.year ?? current.year,
    month: imported.month ?? current.month,
    view: imported.view ?? current.view,
    placements: imported.placements ?? {},
    notes: imported.notes ?? {},
  };

  saveDailyStickyState(next);
  DailyStickyAnalytics.trackEvent("backup_imported");

  return next;
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
  const res = await fetch("/src/legacy/stickers.json");
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

const STICKER_YEAR_STORAGE_KEY = "stickerYear.v1";
const STICKER_YEAR_VERSION = 1;

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

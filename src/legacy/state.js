const STICKER_YEAR_STORAGE_KEY = "stickerYear.v1";
const STICKER_YEAR_VERSION = 1;
const LAST_AUTO_EXPORT_KEY = "dailySticky.lastAutoExport.v1";
const AUTO_EXPORT_INTERVAL_MS = 12 * 60 * 60 * 1000;
const AUTO_BACKUP_MODE_KEY = "dailySticky.autoBackupMode.v1";
const LAST_PROMPT_SHOWN_KEY = "dailySticky.lastPromptShownDate.v1";
const BACKUP_DIR_DB_NAME = "dailySticky.backupDir";
const BACKUP_DIR_STORE = "handles";
const BACKUP_DIR_HANDLE_KEY = "backupDirHandle";
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

function hasAnyPromptShownToday() {
  return localStorage.getItem(LAST_PROMPT_SHOWN_KEY) === ymd(new Date());
}

function markPromptShownToday() {
  localStorage.setItem(LAST_PROMPT_SHOWN_KEY, ymd(new Date()));
}

function isAutoBackupEnabled() {
  return !!localStorage.getItem(AUTO_BACKUP_MODE_KEY);
}

function openBackupHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_DIR_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(BACKUP_DIR_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBackupDirectoryHandle(handle) {
  const db = await openBackupHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_DIR_STORE, "readwrite");
    tx.objectStore(BACKUP_DIR_STORE).put(handle, BACKUP_DIR_HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadBackupDirectoryHandle() {
  const db = await openBackupHandleDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_DIR_STORE, "readonly");
    const req = tx.objectStore(BACKUP_DIR_STORE).get(BACKUP_DIR_HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

async function clearBackupDirectoryHandle() {
  const db = await openBackupHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_DIR_STORE, "readwrite");
    tx.objectStore(BACKUP_DIR_STORE).delete(BACKUP_DIR_HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function setupAutoBackup() {
  if ("showDirectoryPicker" in window) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      await saveBackupDirectoryHandle(dirHandle);
      localStorage.setItem(AUTO_BACKUP_MODE_KEY, "directory");
      DailyStickyAnalytics.trackEvent("auto_backup_enabled");
      return true;
    } catch {
      return false;
    }
  }

  localStorage.setItem(AUTO_BACKUP_MODE_KEY, "download");
  DailyStickyAnalytics.trackEvent("auto_backup_enabled");
  return true;
}

async function disableAutoBackup() {
  localStorage.removeItem(AUTO_BACKUP_MODE_KEY);
  await clearBackupDirectoryHandle();
  DailyStickyAnalytics.trackEvent("auto_backup_disabled");
}

async function renderAutoBackupStatus() {
  const statusEl = document.getElementById("autoBackupStatus");
  if (!statusEl) return;

  const mode = localStorage.getItem(AUTO_BACKUP_MODE_KEY);

  if (!mode) {
    statusEl.textContent = "Off";
    statusEl.classList.remove("on");
    statusEl.classList.add("off");
    return;
  }

  if (mode === "directory") {
    const handle = await loadBackupDirectoryHandle();
    const name = handle?.name || "a chosen folder";
    statusEl.textContent = `Saving to "${name}"`;
  } else {
    statusEl.textContent = "Saving to your device's downloads";
  }

  statusEl.classList.remove("off");
  statusEl.classList.add("on");
}

async function writeBackupToDirectory() {
  try {
    const dirHandle = await loadBackupDirectoryHandle();
    if (!dirHandle) return false;

    const permission = await dirHandle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") return false;

    const state = loadDailyStickyState() || migrateDailyStickyState({});
    const fileHandle = await dirHandle.getFileHandle(
      `sticker-year-${ymd(new Date())}.json`,
      { create: true },
    );
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();

    return true;
  } catch {
    return false;
  }
}

async function maybeAutoExportBackup() {
  const mode = localStorage.getItem(AUTO_BACKUP_MODE_KEY);
  if (!mode) return;

  const last = Number(localStorage.getItem(LAST_AUTO_EXPORT_KEY));
  if (last && Date.now() - last < AUTO_EXPORT_INTERVAL_MS) return;

  if (mode === "directory") {
    const wrote = await writeBackupToDirectory();
    if (!wrote) return;
  } else {
    exportDailyStickyBackup();
  }

  localStorage.setItem(LAST_AUTO_EXPORT_KEY, String(Date.now()));
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

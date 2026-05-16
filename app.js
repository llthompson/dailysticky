/* Sticker Year — minimal, mobile-first, GitHub Pages friendly */

const STORAGE_KEY = "stickerYear.v1";

const el = (id) => document.getElementById(id);

const monthViewEl = el("monthView");
const yearViewEl = el("yearView");

const prevBtn = el("prevBtn");
const nextBtn = el("nextBtn");
const todayBtn = el("todayBtn");
const toggleViewBtn = el("toggleViewBtn");
const shareWeekBtn = el("shareWeekBtn");
const secondaryControls = el("secondaryControls");

const monthSelect = el("monthSelect");
const yearSelect = el("yearSelect");

// New menu elements
const menuBtn = el("menuBtn");
const menuDropdown = el("menuDropdown");
// const menuAbout = el("menuAbout");
const menuExport = el("menuExport");
const menuImportInput = el("menuImportInput");

const clearBtn = el("clearBtn");

const overlay = el("modalOverlay");
const closeModalBtn = el("closeModalBtn");
const modalDateEl = el("modalDate");
const stickerGrid = el("stickerGrid");

const searchInput = el("searchInput");

const noteBtn = el("noteBtn");
const removeStickerBtn = el("removeStickerBtn");

// Note modal
const noteOverlay = el("noteOverlay");
const noteModalDateEl = el("noteModalDate");
const noteInput = el("noteInput");
const noteCount = el("noteCount");
const closeNoteModalBtn = el("closeNoteModalBtn");
const saveNoteBtn = el("saveNoteBtn");
const deleteNoteBtn = el("deleteNoteBtn");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

const today = new Date();

let state = loadState() || {
  year: today.getFullYear(),
  month: today.getMonth(),
  view: "month", // "month" | "year"
  placements: {}, // { "YYYY-MM-DD": "stickerId" }
  notes: {}, // { "YYYY-MM-DD": "short note" }
};

if (!state.notes) state.notes = {};

let shareState = "idle"; // "idle" | "preparing" | "ready"
let preparedShareFile = null;
let sharePrepTimeout = null;

let stickerGroups = []; // [{ category, items:[{id,file,label...}] }]
let stickers = []; // flattened list
let stickerById = new Map();

let selectedDayKey = null;
let noteDayKey = null;
let stickerModalMode = "cats";
let activeStickerCategory = null;
let modalHistoryDepth = 0;

window.addEventListener("DOMContentLoaded", init);

window.addEventListener("pageshow", () => {
  try {
    render();
  } catch {}
});

async function init() {
  populateMonthYearSelects();
  await loadStickers();
  wireEvents();
  render();
  scheduleSharePreparation();
}

function populateMonthYearSelects() {
  monthSelect.innerHTML = "";
  MONTHS.forEach((monthName, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = monthName;
    monthSelect.appendChild(opt);
  });

  const baseYear = today.getFullYear();
  yearSelect.innerHTML = "";

  for (let year = baseYear - 5; year <= baseYear + 5; year++) {
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = String(year);
    yearSelect.appendChild(opt);
  }
}

async function loadStickers() {
  const res = await fetch("./stickers.json");
  const data = await res.json();

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
    stickerGroups = [];
    stickers = data;
  }

  stickerById = new Map(stickers.map((sticker) => [sticker.id, sticker]));
}

function wireEvents() {
  prevBtn.addEventListener("click", () => shiftMonth(-1));
  nextBtn.addEventListener("click", () => shiftMonth(1));

  todayBtn.addEventListener("click", () => {
    state.year = today.getFullYear();
    state.month = today.getMonth();
    saveAndRender();
  });

  shareWeekBtn.addEventListener("click", shareWeek);

  toggleViewBtn.addEventListener("click", () => {
    state.view = state.view === "month" ? "year" : "month";
    saveAndRender();
  });

  monthSelect.addEventListener("change", () => {
    state.month = Number(monthSelect.value);
    saveAndRender();
  });

  yearSelect.addEventListener("change", () => {
    state.year = Number(yearSelect.value);
    saveAndRender();
  });

  closeModalBtn.addEventListener("click", requestModalClose);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) requestModalClose();
  });

  noteBtn.addEventListener("click", openNoteModal);

  removeStickerBtn.addEventListener("click", () => {
    if (!selectedDayKey) return;
    delete state.placements[selectedDayKey];
    saveState(state);
    scheduleSharePreparation();
    requestModalClose();
  });

  closeNoteModalBtn.addEventListener("click", closeNoteModal);

  noteOverlay.addEventListener("click", (e) => {
    if (e.target === noteOverlay) closeNoteModal();
  });

  noteInput.addEventListener("input", () => {
    noteCount.textContent = `${noteInput.value.length}/160`;
  });

  saveNoteBtn.addEventListener("click", saveNoteForSelectedDay);

  deleteNoteBtn.addEventListener("click", () => {
    if (!selectedDayKey) return;

    if (state.notes[selectedDayKey]) {
      delete state.notes[selectedDayKey];
      saveState(state);
      scheduleSharePreparation();
      render();
    }

    closeNoteModal();
    requestModalClose();
  });

  wireMenuEvents();

  if (clearBtn) {
    clearBtn.addEventListener("click", clearCurrentYear);
  }

  window.addEventListener("popstate", handlePopState);

  monthSelect.value = String(state.month);
  yearSelect.value = String(state.year);

  if (searchInput) searchInput.value = "";
}

function wireMenuEvents() {
  if (menuBtn && menuDropdown) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle("hidden");
    });

    menuDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.addEventListener("click", () => {
      menuDropdown.classList.add("hidden");
    });
  }

  // menuAbout.addEventListener("click", () => {
  //   menuDropdown.classList.add("hidden");
  //   window.location.href = "/about.html";
  // });

  if (menuExport) {
    menuExport.addEventListener("click", () => {
      if (menuDropdown) menuDropdown.classList.add("hidden");
      exportJson();
    });
  }

  if (menuImportInput) {
    menuImportInput.addEventListener("change", importJson);
  }
}

function handlePopState(e) {
  const historyState = e.state;

  if (historyState?.modal) {
    selectedDayKey = historyState.dayKey || selectedDayKey;
    modalDateEl.textContent = selectedDayKey || "Date";
    overlay.classList.remove("hidden");
    updateNoteButtonLabel();

    if (historyState.view === "categories") {
      stickerModalMode = "cats";
      activeStickerCategory = null;
      modalHistoryDepth = 1;
      renderStickerCategories();
      return;
    }

    if (historyState.view === "stickers") {
      stickerModalMode = "stickers";
      activeStickerCategory = historyState.category || null;
      modalHistoryDepth = 2;
      renderStickersForCategory(historyState.category, true);
      return;
    }
  }

  if (!overlay.classList.contains("hidden")) {
    closeModal(true);
    render();
    return;
  }
}

function shiftMonth(delta) {
  const d = new Date(state.year, state.month + delta, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  saveAndRender();
}

function saveAndRender() {
  saveState(state);
  render();
  scheduleSharePreparation();
}

function render() {
  monthSelect.value = String(state.month);
  yearSelect.value = String(state.year);
  toggleViewBtn.textContent =
    state.view === "month" ? "Year view" : "Month view";

  if (state.view === "month") {
    yearViewEl.classList.add("hidden");
    monthViewEl.classList.remove("hidden");
    renderMonth();
  } else {
    monthViewEl.classList.add("hidden");
    yearViewEl.classList.remove("hidden");
    renderYear();
  }

  renderWeeklyShare();
}

function renderMonth() {
  const year = state.year;
  const month = state.month;

  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const gridCells = 42;
  const startDate = new Date(year, month, 1 - startDay);

  const wrapper = document.createElement("div");
  wrapper.className = "card";

  const stickeredCount = Object.keys(state.placements).filter((key) =>
    key.startsWith(`${year}-${pad2(month + 1)}-`),
  ).length;

  const header = document.createElement("div");
  header.className = "monthHeader";
  header.innerHTML = `
    <div>
      <h2>${MONTHS[month]} ${year}</h2>
      <div class="small">${stickeredCount} days stickered</div>
    </div>
  `;
  wrapper.appendChild(header);

  const weekdays = document.createElement("div");
  weekdays.className = "weekdays";
  WEEKDAYS.forEach((dayName) => {
    const d = document.createElement("div");
    d.textContent = dayName;
    weekdays.appendChild(d);
  });
  wrapper.appendChild(weekdays);

  const cal = document.createElement("div");
  cal.className = "calendar";

  for (let i = 0; i < gridCells; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);

    const key = ymd(d);
    const isToday = key === ymd(today);
    const isOutside = d.getMonth() !== month;
    const hasNote = !!state.notes[key];

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `day${isToday ? " today" : ""}${
      isOutside ? " outside" : ""
    }${hasNote ? " has-note" : ""}`;
    cell.setAttribute("aria-label", `Day ${key}`);

    const num = document.createElement("div");
    num.className = `num${hasNote ? " has-note" : ""}`;
    num.textContent = String(d.getDate());

    const slot = document.createElement("div");
    slot.className = "stickerSlot";

    const stickerId = state.placements[key];
    if (stickerId && stickerById.has(stickerId)) {
      const sticker = stickerById.get(stickerId);
      const img = document.createElement("img");
      img.alt = sticker.label || sticker.id;
      img.loading = "lazy";
      img.src = `./stickers/${sticker.file}`;
      slot.appendChild(img);
    }

    cell.appendChild(num);
    cell.appendChild(slot);

    cell.addEventListener("click", () => {
      if (isOutside) {
        state.year = d.getFullYear();
        state.month = d.getMonth();
        saveState(state);
        render();
      }
      openModal(key);
    });

    cal.appendChild(cell);
  }

  wrapper.appendChild(cal);
  monthViewEl.innerHTML = "";
  monthViewEl.appendChild(wrapper);
}

function renderYear() {
  const year = state.year;

  const wrapper = document.createElement("div");
  wrapper.className = "yearGrid";

  for (let month = 0; month < 12; month++) {
    const card = document.createElement("div");
    card.className = "miniMonth";

    const title = document.createElement("div");
    title.className = "miniMonthTitle";
    title.textContent = `${MONTHS[month]} ${year}`;
    card.appendChild(title);

    const cal = document.createElement("div");
    cal.className = "miniCal";

    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement("div");
      empty.className = "miniDay empty";
      cal.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = ymd(date);
      const hasNote = !!state.notes[key];

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `miniDay${hasNote ? " has-note" : ""}`;
      cell.setAttribute("aria-label", key);

      const num = document.createElement("div");
      num.className = `miniNum${hasNote ? " has-note" : ""}`;
      num.textContent = String(day);
      cell.appendChild(num);

      const stickerId = state.placements[key];
      if (stickerId && stickerById.has(stickerId)) {
        const sticker = stickerById.get(stickerId);
        const img = document.createElement("img");
        img.alt = sticker.label || sticker.id;
        img.loading = "lazy";
        img.src = `./stickers/${sticker.file}`;
        cell.appendChild(img);
      }

      cell.addEventListener("click", () => {
        state.month = month;
        state.view = "month";
        saveState(state);
        render();
        openModal(key);
      });

      cal.appendChild(cell);
    }

    card.appendChild(cal);
    wrapper.appendChild(card);
  }

  yearViewEl.innerHTML = "";
  yearViewEl.appendChild(wrapper);
}

function openModal(dayKey) {
  selectedDayKey = dayKey;
  modalDateEl.textContent = dayKey;

  if (searchInput) searchInput.value = "";

  updateNoteButtonLabel();
  renderStickerCategories();
  overlay.classList.remove("hidden");

  history.pushState(
    {
      modal: true,
      view: "categories",
      dayKey,
    },
    "",
  );

  modalHistoryDepth = 1;
}

function closeModal(fromHistory = false) {
  overlay.classList.add("hidden");
  selectedDayKey = null;
  stickerModalMode = "cats";
  activeStickerCategory = null;
  closeNoteModal();

  if (fromHistory) {
    modalHistoryDepth = 0;
  }
}

function closePickerImmediately() {
  closeModal(true);
  render();

  if (history.state?.modal) {
    history.replaceState(null, "", window.location.href);
  }
}

function requestModalClose() {
  if (overlay.classList.contains("hidden")) return;

  closePickerImmediately();
}

function updateNoteButtonLabel() {
  if (!selectedDayKey) {
    noteBtn.textContent = "Add Note";
    return;
  }

  noteBtn.textContent = state.notes[selectedDayKey] ? "View Note" : "Add Note";
}

function openNoteModal() {
  if (!selectedDayKey) return;

  noteDayKey = selectedDayKey;

  noteModalDateEl.textContent = noteDayKey;
  noteInput.value = state.notes[noteDayKey] || "";
  noteCount.textContent = `${noteInput.value.length}/160`;
  deleteNoteBtn.textContent = state.notes[noteDayKey] ? "Delete Note" : "Skip";

  noteOverlay.classList.remove("hidden");
  noteInput.focus();
}

function closeNoteModal() {
  noteOverlay.classList.add("hidden");
}

function saveNoteForSelectedDay() {
  if (!noteDayKey) return;

  const dayKeyToSave = noteDayKey;
  const value = noteInput.value.trim();

  if (value) {
    state.notes[dayKeyToSave] = value;
  } else {
    delete state.notes[dayKeyToSave];
  }

  saveState(state);
  scheduleSharePreparation();

  noteDayKey = null;
  closeNoteModal();
  closeModal(true);
  render();
}

function resetStickerPickerScroll() {
  const modal = overlay?.querySelector(".modal");

  if (modal) modal.scrollTop = 0;
  if (overlay) overlay.scrollTop = 0;
  if (stickerGrid) stickerGrid.scrollTop = 0;
}

function renderStickerCategories() {
  stickerModalMode = "cats";
  activeStickerCategory = null;

  const groups = getGroups();
  stickerGrid.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "catList";

  groups.forEach((group) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "catTile";
    btn.setAttribute("data-cat", group.category);
    btn.addEventListener("click", () =>
      renderStickersForCategory(group.category),
    );

    const name = document.createElement("div");
    name.className = "catName";
    name.textContent = group.category;

    const meta = document.createElement("div");
    meta.className = "catMeta";
    meta.textContent = `${group.items.length} stickers`;

    const preview = document.createElement("div");
    preview.className = "catPreview";

    group.items.slice(0, 3).forEach((sticker) => {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = `./stickers/${sticker.file}`;
      preview.appendChild(img);
    });

    btn.appendChild(name);
    btn.appendChild(meta);
    btn.appendChild(preview);
    wrapper.appendChild(btn);
  });

  stickerGrid.appendChild(wrapper);
  resetStickerPickerScroll();
}

function renderStickersForCategory(category, fromHistory = false) {
  stickerModalMode = "stickers";
  activeStickerCategory = category;

  if (!fromHistory) {
    const historyState = history.state;

    if (historyState?.modal && historyState.view === "stickers") {
      history.replaceState(
        {
          modal: true,
          view: "stickers",
          category,
          dayKey: selectedDayKey,
        },
        "",
      );
    } else {
      history.pushState(
        {
          modal: true,
          view: "stickers",
          category,
          dayKey: selectedDayKey,
        },
        "",
      );
    }

    modalHistoryDepth = 2;
  }

  const group = getGroups().find((g) => g.category === category);
  const items = (group?.items || [])
    .filter((sticker) => sticker.active !== false)
    .sort((a, b) => a.id.localeCompare(b.id));

  stickerGrid.innerHTML = "";

  const top = document.createElement("div");
  top.className = "catTopRow";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "btn catBack";
  back.setAttribute("data-action", "back-to-cats");
  back.textContent = "← Categories";
  back.addEventListener("click", () => history.back());

  const title = document.createElement("div");
  title.className = "catTitle";
  title.textContent = category;

  top.appendChild(back);
  top.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "catGrid";

  items.forEach((sticker) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stickerBtn";
    btn.setAttribute("data-sticker-id", sticker.id);

    btn.addEventListener("click", () => {
      if (!selectedDayKey) return;

      state.placements[selectedDayKey] = sticker.id;
      saveState(state);
      scheduleSharePreparation();
      updateNoteButtonLabel();
      openNoteModal();
    });

    const img = document.createElement("img");
    img.alt = sticker.label || sticker.id;
    img.loading = "lazy";
    img.src = `./stickers/${sticker.file}`;

    const label = document.createElement("div");
    label.className = "stickerLabel";
    label.textContent = sticker.label || sticker.id;

    btn.appendChild(img);
    btn.appendChild(label);
    grid.appendChild(btn);
  });

  stickerGrid.appendChild(top);
  stickerGrid.appendChild(grid);
  resetStickerPickerScroll();
}

function getGroups() {
  if (stickerGroups && stickerGroups.length) {
    return stickerGroups
      .map((group) => ({
        category: group.category || "Other",
        items: (group.items || [])
          .filter((sticker) => sticker.active !== false)
          .map((item) => ({
            ...item,
            file: item.file || item.src || "",
          })),
      }))
      .filter((group) => group.items.length);
  }

  const groupMap = new Map();

  stickers.forEach((sticker) => {
    const category = sticker.category || "Other";
    if (!groupMap.has(category)) groupMap.set(category, []);
    groupMap.get(category).push(sticker);
  });

  return [...groupMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: items.slice().sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

function clearCurrentYear() {
  if (!confirm("Clear all stickers for this year?")) return;

  const yearPrefix = `${state.year}-`;

  for (const key of Object.keys(state.placements)) {
    if (key.startsWith(yearPrefix)) delete state.placements[key];
  }

  for (const key of Object.keys(state.notes)) {
    if (key.startsWith(yearPrefix)) delete state.notes[key];
  }

  saveAndRender();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed.notes) parsed.notes = {};
    return parsed;
  } catch {
    return null;
  }
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sticker-year-${state.year}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function importJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!imported || typeof imported !== "object" || !imported.placements) {
      alert("That JSON doesn't look like a Sticker Year export.");
      return;
    }

    state = {
      year: imported.year ?? state.year,
      month: imported.month ?? state.month,
      view: imported.view ?? state.view,
      placements: imported.placements ?? {},
      notes: imported.notes ?? {},
    };

    saveAndRender();
    alert("Imported!");
  } catch {
    alert("Import failed. Make sure it's a valid JSON export from this app.");
  } finally {
    if (menuImportInput) menuImportInput.value = "";
    if (menuDropdown) menuDropdown.classList.add("hidden");
  }
}

function scheduleSharePreparation() {
  shareState = "idle";
  preparedShareFile = null;

  if (sharePrepTimeout) {
    clearTimeout(sharePrepTimeout);
  }

  sharePrepTimeout = setTimeout(() => {
    prepareShareImage();
  }, 200);
}

async function prepareShareImage() {
  const card = document.getElementById("weeklyShareCard");
  if (!card || typeof html2canvas === "undefined") return;

  shareState = "preparing";

  try {
    renderWeeklyShare();

    const canvas = await html2canvas(card, {
      backgroundColor: "#fffafc",
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );

    if (!blob) {
      shareState = "idle";
      return;
    }

    preparedShareFile = new File([blob], "my-week-in-stickers.png", {
      type: "image/png",
    });

    shareState = "ready";
  } catch (e) {
    console.error("prepareShareImage error:", e);
    shareState = "idle";
  }
}

function renderWeeklyShare() {
  const grid = document.getElementById("weeklyShareGrid");

  if (!grid) return;

  grid.innerHTML = "";

  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);

    const key = ymd(d);
    const stickerId = state.placements[key];
    const sticker = stickerId ? stickerById.get(stickerId) : null;

    days.push({
      date: d,
      label: WEEKDAYS[d.getDay()],
      sticker,
    });
  }

  const start = days[0].date;
  const end = days[6].date;

  const startStr = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const endStr = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const weekRangeText = `${startStr}–${endStr}`;

  const topThree = days.slice(0, 3);
  const bottomFour = days.slice(3, 7);

  function makeLabelCell(text) {
    const el = document.createElement("div");
    el.className = "share-label-cell";
    el.textContent = text;
    return el;
  }

  function makeStickerCell(sticker) {
    const el = document.createElement("div");
    el.className = "share-sticker-cell";

    if (sticker) {
      const img = document.createElement("img");
      img.src = `./stickers/${sticker.file}`;
      img.alt = sticker.label || sticker.id;
      el.appendChild(img);
    } else {
      el.classList.add("is-empty");
      el.textContent = "";
    }

    return el;
  }

  function makeLogoCell() {
    const el = document.createElement("div");
    el.className = "share-logo-cell";

    const img = document.createElement("img");
    img.src = "./the-daily-sticky-words.png";
    img.alt = "The Daily Sticky — a sticker journal for your year";
    el.appendChild(img);

    return el;
  }

  const brandCell = makeLabelCell(weekRangeText);
  brandCell.classList.add("share-brand-cell", "share-range-cell");
  grid.appendChild(brandCell);

  topThree.forEach((day) => {
    grid.appendChild(makeLabelCell(day.label));
  });

  grid.appendChild(makeLogoCell());

  topThree.forEach((day) => {
    grid.appendChild(makeStickerCell(day.sticker));
  });

  bottomFour.forEach((day) => {
    grid.appendChild(makeLabelCell(day.label));
  });

  bottomFour.forEach((day) => {
    grid.appendChild(makeStickerCell(day.sticker));
  });
}

async function shareWeek() {
  const shareText = "sticker your week @ ";
  const shareUrl = "https://dailysticky.app/share.html";

  if (
    shareState === "ready" &&
    preparedShareFile &&
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [preparedShareFile] })
  ) {
    try {
      await navigator.share({
        files: [preparedShareFile],
        text: shareText,
        url: shareUrl,
      });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("file share failed:", err);
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({
        text: shareText,
        url: shareUrl,
      });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("text share failed:", err);
    }
  }

  if (preparedShareFile) {
    const url = URL.createObjectURL(preparedShareFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-week-in-stickers.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    alert("Image downloaded. Link copied.");
  } catch {
    alert("Image downloaded.");
  }
}

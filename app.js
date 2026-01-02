/* Sticker Year — minimal, mobile-first, GitHub Pages friendly */

const STORAGE_KEY = "stickerYear.v1";

const el = (id) => document.getElementById(id);

const monthViewEl = el("monthView");
const yearViewEl = el("yearView");

const prevBtn = el("prevBtn");
const nextBtn = el("nextBtn");
const todayBtn = el("todayBtn");
const toggleViewBtn = el("toggleViewBtn");
const settingsBtn = el("settingsBtn");
const secondaryControls = el("secondaryControls");

const monthSelect = el("monthSelect");
const yearSelect = el("yearSelect");

const exportBtn = el("exportBtn");
const importInput = el("importInput");
const clearBtn = el("clearBtn");

const overlay = el("modalOverlay");
const closeModalBtn = el("closeModalBtn");
const modalDateEl = el("modalDate");
const stickerGrid = el("stickerGrid");

// These are now optional; you can remove them from HTML safely
const searchInput = el("searchInput");
const categorySelect = el("categorySelect");

const removeStickerBtn = el("removeStickerBtn");

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
const parseYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const today = new Date();
let state = loadState() || {
  year: today.getFullYear(),
  month: today.getMonth(),
  view: "month", // "month" | "year"
  placements: {}, // { "YYYY-MM-DD": "stickerId" }
};

let stickerGroups = []; // [{ category, items:[{id,file,label...}] }]
let stickers = []; // flattened internal list
let stickerById = new Map();

let selectedDayKey = null;

// Modal navigation state
let stickerModalMode = "cats"; // "cats" | "stickers"
let activeStickerCategory = null;

window.addEventListener("DOMContentLoaded", () => {
  init();
});

// Handles Safari/back-forward cache restores where DOM is present but JS state/render can be stale
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
}

function populateMonthYearSelects() {
  // months
  monthSelect.innerHTML = "";
  MONTHS.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });

  // years: this year ± 5
  const base = today.getFullYear();
  yearSelect.innerHTML = "";
  for (let y = base - 5; y <= base + 5; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }
}

async function loadStickers() {
  const res = await fetch("./stickers.json");
  const data = await res.json();

  // grouped format
  if (Array.isArray(data) && data.length && data[0].items) {
    stickerGroups = data;

    stickers = data.flatMap((group) =>
      (group.items || []).map((item) => ({
        ...item,
        category: group.category || item.category || "Other",
        file: item.file || item.src || "",
      }))
    );
  } else {
    // flat format
    stickerGroups = [];
    stickers = data;
  }

  stickerById = new Map(stickers.map((s) => [s.id, s]));
}

function wireEvents() {
  prevBtn.addEventListener("click", () => shiftMonth(-1));
  nextBtn.addEventListener("click", () => shiftMonth(1));
  todayBtn.addEventListener("click", () => {
    state.year = today.getFullYear();
    state.month = today.getMonth();
    saveAndRender();
  });

  settingsBtn.addEventListener("click", () => {
    secondaryControls.classList.toggle("is-visible");
  });

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

  // modal close
  closeModalBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  // REMOVE sticker for day
  removeStickerBtn.addEventListener("click", () => {
    if (!selectedDayKey) return;
    delete state.placements[selectedDayKey];
    saveState(state);
    closeModal();
    render();
  });

  // Export/import/clear
  exportBtn.addEventListener("click", exportJson);
  importInput.addEventListener("change", importJson);
  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear all stickers for this year?")) return;
    // only clear current year
    const yearStr = String(state.year) + "-";
    for (const k of Object.keys(state.placements)) {
      if (k.startsWith(yearStr)) delete state.placements[k];
    }
    saveAndRender();
  });



  // sync selects on load
  monthSelect.value = String(state.month);
  yearSelect.value = String(state.year);

  // If these controls still exist in your HTML, disable them safely
  if (searchInput) searchInput.value = "";
  if (categorySelect) categorySelect.value = "";
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
}

function render() {
  // sync selects + button text
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
}

function renderMonth() {
  const year = state.year;
  const month = state.month;

  const first = new Date(year, month, 1);
  const startDay = first.getDay();

  // show a nice 6-week grid including previous/next month days
  const gridCells = 42;
  const startDate = new Date(year, month, 1 - startDay);

  const wrapper = document.createElement("div");
  wrapper.className = "card";

  const header = document.createElement("div");
  header.className = "monthHeader";
  header.innerHTML = `
    <div>
      <h2>${MONTHS[month]} ${year}</h2>
      <div class="small">${
        Object.keys(state.placements).filter((k) =>
          k.startsWith(`${year}-${pad2(month + 1)}-`)
        ).length
      } days stickered</div>
    </div>
  `;
  wrapper.appendChild(header);

  const weekdays = document.createElement("div");
  weekdays.className = "weekdays";
  WEEKDAYS.forEach((w) => {
    const d = document.createElement("div");
    d.textContent = w;
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

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `day${isToday ? " today" : ""}${
      isOutside ? " outside" : ""
    }`;
    cell.setAttribute("aria-label", `Day ${key}`);

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = String(d.getDate());

    const slot = document.createElement("div");
    slot.className = "stickerSlot";

    const stickerId = state.placements[key];
    if (stickerId && stickerById.has(stickerId)) {
      const s = stickerById.get(stickerId);
      const img = document.createElement("img");
      img.alt = s.label || s.id;
      img.loading = "lazy";
      img.src = `./stickers/${s.file}`;
      slot.appendChild(img);
    }

    cell.appendChild(num);
    cell.appendChild(slot);

    cell.addEventListener("click", () => {
      // if tapping an "outside" day, jump to that month first
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

  for (let m = 0; m < 12; m++) {
    const card = document.createElement("div");
    card.className = "miniMonth";

    const title = document.createElement("div");
    title.className = "miniMonthTitle";
    title.textContent = `${MONTHS[m]} ${year}`;
    card.appendChild(title);

    const cal = document.createElement("div");
    cal.className = "miniCal";

    const first = new Date(year, m, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    // pad empty cells
    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement("div");
      empty.className = "miniDay empty";
      cal.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, m, d);
      const key = ymd(date);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "miniDay";
      cell.setAttribute("aria-label", key);

      const stickerId = state.placements[key];
      if (stickerId && stickerById.has(stickerId)) {
        const s = stickerById.get(stickerId);
        const img = document.createElement("img");
        img.alt = s.label || s.id;
        img.loading = "lazy";
        img.src = `./stickers/${s.file}`;
        cell.appendChild(img);
      } else {
        // show dot for empty to keep grid readable
        cell.textContent = "·";
        cell.style.color = "rgba(255,255,255,0.18)";
      }

      cell.addEventListener("click", () => {
        state.month = m;
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

  // Optional: keep day shown, but we’ll change the modal content beneath it
  modalDateEl.textContent = dayKey;

  // If these still exist, clear them (they're unused now)
  if (searchInput) searchInput.value = "";
  if (categorySelect) categorySelect.value = "";

  // Start in Categories view
  renderStickerCategories();

  overlay.classList.remove("hidden");
}

function closeModal() {
  overlay.classList.add("hidden");
  selectedDayKey = null;
  stickerModalMode = "cats";
  activeStickerCategory = null;
  // leave stickerGrid content as-is; it will be re-rendered next open
}

/* ---------- Modal rendering: Categories -> Stickers ---------- */

function renderStickerCategories() {
  stickerModalMode = "cats";
  activeStickerCategory = null;

  const groups = getGroups();

  stickerGrid.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "catList";

  groups.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "catTile";
    btn.addEventListener("click", () => renderStickersForCategory(g.category));

    btn.setAttribute("data-cat", g.category);

    const name = document.createElement("div");
    name.className = "catName";
    name.textContent = g.category;

    const meta = document.createElement("div");
    meta.className = "catMeta";
    meta.textContent = `${g.items.length} stickers`;

    const preview = document.createElement("div");
    preview.className = "catPreview";

    // show up to 3 preview icons
    g.items.slice(0, 3).forEach((s) => {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = `./stickers/${s.file}`;
      preview.appendChild(img);
    });

    btn.appendChild(name);
    btn.appendChild(meta);
    btn.appendChild(preview);

    wrapper.appendChild(btn);
  });

  stickerGrid.appendChild(wrapper);
}

function renderStickersForCategory(category) {
  stickerModalMode = "stickers";
  activeStickerCategory = category;

  const groups = getGroups();
  const group = groups.find((g) => g.category === category);
  const items = (group?.items || [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  stickerGrid.innerHTML = "";

  // Top row: Back + Title
  const top = document.createElement("div");
  top.className = "catTopRow";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "btn catBack";
  back.setAttribute("data-action", "back-to-cats");
  back.textContent = "← Categories";
  back.addEventListener("click", () => {
    renderStickerCategories();
  });

  const title = document.createElement("div");
  title.className = "catTitle";
  title.textContent = category;

  top.appendChild(back);
  top.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "catGrid";

  items.forEach((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stickerBtn";
    btn.setAttribute("data-sticker-id", s.id);

    btn.addEventListener("click", () => {
      if (!selectedDayKey) return;

      state.placements[selectedDayKey] = s.id;
      saveState(state);
      closeModal(); // closes overlay
      render(); // updates calendar
    });

    const img = document.createElement("img");
    img.alt = s.label || s.id;
    img.loading = "lazy";
    img.src = `./stickers/${s.file}`;

    const label = document.createElement("div");
    label.className = "stickerLabel";
    label.textContent = s.label || s.id;

    btn.appendChild(img);
    btn.appendChild(label);

    grid.appendChild(btn);
  });

  stickerGrid.appendChild(top);
  stickerGrid.appendChild(grid);
}

function getGroups() {
  // Prefer the grouped JSON from stickers.json
  if (stickerGroups && stickerGroups.length) {
    // Ensure each item has file populated (defensive)
    return stickerGroups
      .map((g) => ({
        category: g.category || "Other",
        items: (g.items || []).map((item) => ({
          ...item,
          file: item.file || item.src || "",
        })),
      }))
      .filter((g) => g.items.length);
  }

  // Fallback: build from flat stickers
  const map = new Map();
  stickers.forEach((s) => {
    const cat = s.category || "Other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(s);
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: items.slice().sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

/* storage + import/export */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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

    // minimal validation
    if (!imported || typeof imported !== "object" || !imported.placements) {
      alert("That JSON doesn't look like a Sticker Year export.");
      return;
    }

    state = {
      year: imported.year ?? state.year,
      month: imported.month ?? state.month,
      view: imported.view ?? state.view,
      placements: imported.placements ?? {},
    };

    saveAndRender();
    alert("Imported!");
  } catch (err) {
    alert("Import failed. Make sure it's a valid JSON export from this app.");
  } finally {
    importInput.value = "";
  }
}

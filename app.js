/* Sticker Year — minimal, mobile-first, GitHub Pages friendly */

const WELCOME_CARD_KEY = "dailySticky.welcomeCardSeen.v1";

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
const yearViewSelect = el("yearViewSelect");
const monthViewSelect = el("monthViewSelect");

// New menu elements
const menuBtn = el("menuBtn");
const menuDropdown = el("menuDropdown");
// const menuAbout = el("menuAbout");
const menuExport = el("menuExport");
const menuImportInput = el("menuImportInput");

const clearBtn = el("clearBtn");

const monthExportOverlay = el("monthExportOverlay");
const yearExportOverlay = el("yearExportOverlay");
const closeMonthExportBtn = el("closeMonthExportBtn");
const closeYearExportBtn = el("closeYearExportBtn");
const downloadMonthImageBtn = el("downloadMonthImageBtn");
const downloadYearImageBtn = el("downloadYearImageBtn");

// First visit welcome card
const welcomeOverlay = el("welcomeOverlay");
const welcomeStartBtn = el("welcomeStartBtn");
const welcomeSkipBtn = el("welcomeSkipBtn");
const welcomeCloseBtn = el("welcomeCloseBtn");

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

// Weekly recap prompt
const weeklyRecapPromptOverlay = el("weeklyRecapPromptOverlay");
const shareWeeklyRecapPromptBtn = el("shareWeeklyRecapPromptBtn");
const dismissWeeklyRecapPromptBtn = el("dismissWeeklyRecapPromptBtn");
const closeWeeklyRecapPromptBtn = el("closeWeeklyRecapPromptBtn");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const today = new Date();
// for testing Sunday prompt
// const today = new Date("2026-05-31T12:00:00");

let state = loadState() || {
  year: today.getFullYear(),
  month: today.getMonth(),
  view: "month", // "month" | "year"
  placements: {}, // { "YYYY-MM-DD": "stickerId" }
  notes: {}, // { "YYYY-MM-DD": "sticker stories" }
};

if (!state.notes) state.notes = {};

function getStickerYears(state) {
  const years = new Set();

  Object.keys(state?.placements || {}).forEach((dateKey) => {
    const year = Number(dateKey.slice(0, 4));
    if (year) years.add(year);
  });

  if (!years.size) years.add(today.getFullYear());

  return [...years].sort((a, b) => b - a);
}

let shareState = "idle"; // "idle" | "preparing" | "ready"
let preparedShareFile = null;
let sharePrepTimeout = null;

let stickerGroups = []; // [{ category, items:[{id,file,label...}] }]
let stickers = []; // flattened list
let stickerById = new Map();

let selectedDayKey = null;
let noteDayKey = null;
let pendingWeeklyRecapDayKey = null;
let stickerModalMode = "cats";
let activeStickerCategory = null;
let modalHistoryDepth = 0;

function pushModalLevel(level, extra = {}) {
  if (!selectedDayKey) return;

  modalHistoryDepth += 1;

  history.pushState(
    {
      modal: true,
      level,
      depth: modalHistoryDepth,
      dayKey: selectedDayKey,
      ...extra,
    },
    "",
  );
}

window.DailyStickyModalNav = { pushLevel: pushModalLevel };

window.addEventListener("DOMContentLoaded", init);

window.addEventListener("pageshow", () => {
  try {
    render();
  } catch {}
});

async function init() {
  populateMonthYearSelects();
  await loadStickers();
  renderWelcomeStickers();
  wireEvents();
  wireGridBulge("yearExportPreviewGrid", ".export-year-flat-day");
  wireGridBulge("monthExportPreviewGrid", ".export-month-day");
  render();
  // renderYearExportCard("download"); for testing/styling only
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
  // const data = await fetchStickerData(); old picker

  const data = await DailyStickyStickerData.load(); // new picker
  // stickerGroups = data.stickerGroups; old picker
  stickers = data.stickers;
  stickerById = data.stickerById;
}

function renderWelcomeStickers() {
  document
    .querySelectorAll(".welcome-sticker[data-sticker-id]")
    .forEach((slot) => {
      const stickerId = slot.dataset.stickerId;
      const sticker = stickerById.get(stickerId);

      if (!sticker) {
        console.warn(`Welcome sticker not found: ${stickerId}`);
        return;
      }

      const img = document.createElement("img");
      img.src = `./stickers/${sticker.file}`;
      img.alt = "";
      img.draggable = false;

      slot.replaceChildren(img);
    });
}

function wireEvents() {
  wireWelcomeCard();
  prevBtn.addEventListener("click", () => shiftMonth(-1));
  nextBtn.addEventListener("click", () => shiftMonth(1));

  // Today button is currently commented out in the HTML.
  // Keeping this here so we can bring it back later if needed.
  // if (todayBtn) {
  //   todayBtn.addEventListener("click", () => {
  //     state.year = today.getFullYear();
  //     state.month = today.getMonth();
  //     saveAndRender();
  //   });
  // }

  shareWeekBtn.addEventListener("click", shareWeek);

  if (shareWeeklyRecapPromptBtn) {
    shareWeeklyRecapPromptBtn.addEventListener("click", () => {
      hideWeeklyRecapPrompt();
      shareWeek();
    });
  }

  if (dismissWeeklyRecapPromptBtn) {
    dismissWeeklyRecapPromptBtn.addEventListener(
      "click",
      hideWeeklyRecapPrompt,
    );
  }

  if (closeWeeklyRecapPromptBtn) {
    closeWeeklyRecapPromptBtn.addEventListener("click", hideWeeklyRecapPrompt);
  }

  if (weeklyRecapPromptOverlay) {
    weeklyRecapPromptOverlay.addEventListener("click", (e) => {
      if (e.target === weeklyRecapPromptOverlay) hideWeeklyRecapPrompt();
    });
  }

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

  if (yearViewSelect) {
    yearViewSelect.addEventListener("change", () => {
      state.year = Number(yearViewSelect.value);
      saveAndRender();
    });
  }

  if (monthViewSelect) {
    monthViewSelect.addEventListener("change", () => {
      state.month = Number(monthViewSelect.value);
      saveAndRender();
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#openMonthExportBtn")) openMonthExportPreview();
    if (e.target.closest("#openYearExportBtn")) openYearExportPreview();
  });

  if (closeMonthExportBtn) {
    closeMonthExportBtn.addEventListener("click", closeMonthExportPreview);
  }
  if (closeYearExportBtn) {
    closeYearExportBtn.addEventListener("click", closeYearExportPreview);
  }

  if (monthExportOverlay) {
    monthExportOverlay.addEventListener("click", (e) => {
      if (e.target === monthExportOverlay) closeMonthExportPreview();
    });
  }
  if (yearExportOverlay) {
    yearExportOverlay.addEventListener("click", (e) => {
      if (e.target === yearExportOverlay) closeYearExportPreview();
    });
  }

  if (downloadMonthImageBtn) {
    downloadMonthImageBtn.addEventListener("click", downloadMonthImage);
  }
  if (downloadYearImageBtn) {
    downloadYearImageBtn.addEventListener("click", downloadYearImage);
  }

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
    noteCount.textContent = `${noteInput.value.length}/300`;
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

  // wireMenuEvents(); moving to nav.js for better separation of concerns and to avoid circular dependencies

  if (clearBtn) {
    clearBtn.addEventListener("click", clearCurrentYear);
  }

  window.addEventListener("popstate", handlePopState);

  monthSelect.value = String(state.month);
  yearSelect.value = String(state.year);

  if (searchInput) searchInput.value = "";
}

function shouldShowWelcomeCard() {
  return localStorage.getItem(WELCOME_CARD_KEY) !== "true";
}

function markWelcomeCardSeen() {
  localStorage.setItem(WELCOME_CARD_KEY, "true");
}

function showWelcomeCard() {
  if (!welcomeOverlay) return;
  welcomeOverlay.classList.remove("hidden");
}

function hideWelcomeCard() {
  if (!welcomeOverlay) return;
  welcomeOverlay.classList.add("hidden");
  markWelcomeCardSeen();
}

function wireWelcomeCard() {
  if (!welcomeOverlay) return;

  if (shouldShowWelcomeCard()) {
    showWelcomeCard();
  }

  if (welcomeStartBtn) {
    welcomeStartBtn.addEventListener("click", () => {
      hideWelcomeCard();
      openModal(ymd(today));
    });
  }

  if (welcomeSkipBtn) {
    welcomeSkipBtn.addEventListener("click", hideWelcomeCard);
  }

  if (welcomeCloseBtn) {
    welcomeCloseBtn.addEventListener("click", hideWelcomeCard);
  }

  welcomeOverlay.addEventListener("click", (e) => {
    if (e.target === welcomeOverlay) hideWelcomeCard();
  });
}

// function wireMenuEvents() { moving to nav.js for better separation of concerns and to avoid circular dependencies
//   if (menuBtn && menuDropdown) {
//     menuBtn.addEventListener("click", (e) => {
//       e.stopPropagation();
//       menuDropdown.classList.toggle("hidden");
//     });

//     menuDropdown.addEventListener("click", (e) => {
//       e.stopPropagation();
//     });

//     document.addEventListener("click", () => {
//       menuDropdown.classList.add("hidden");
//     });
//   }

//   // menuAbout.addEventListener("click", () => {
//   //   menuDropdown.classList.add("hidden");
//   //   window.location.href = "/about.html";
//   // });

//   if (menuExport) {
//     menuExport.addEventListener("click", () => {
//       if (menuDropdown) menuDropdown.classList.add("hidden");
//       exportJson();
//     });
//   }

//   if (menuImportInput) {
//     menuImportInput.addEventListener("change", importJson);
//   }
// }

function handlePopState(e) {
  const historyState = e.state;

  if (historyState?.modal) {
    selectedDayKey = historyState.dayKey || selectedDayKey;
    modalDateEl.textContent = selectedDayKey || "Date";
    overlay.classList.remove("hidden");
    updateNoteButtonLabel();

    modalHistoryDepth = historyState.depth || 1;

    if (historyState.level === "categories") {
      DailyStickyStickerPickerV2.renderCategoriesForTab(
        historyState.tabId,
        true,
      );
      return;
    }

    if (historyState.level === "stickers") {
      DailyStickyStickerPickerV2.renderStickersForCategory(
        historyState.tabId,
        historyState.category,
        true,
      );
      return;
    }

    if (historyState.level === "artist") {
      DailyStickyStickerPickerV2.renderStickersForArtist(
        historyState.artistId,
        true,
      );
      return;
    }

    if (historyState.level === "search") {
      DailyStickyStickerPickerV2.renderSearchForQuery(historyState.query, true);
      return;
    }

    DailyStickyStickerPickerV2.renderTabs();
    return;
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

  if (monthViewSelect) {
    monthViewSelect.classList.toggle("hidden", state.view !== "month");

    monthViewSelect.innerHTML = "";

    MONTHS.forEach((monthName, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = monthName;
      monthViewSelect.appendChild(opt);
    });

    monthViewSelect.value = String(state.month);
  }

  if (yearViewSelect) {
    yearViewSelect.classList.toggle("hidden", state.view !== "year");

    if (state.view === "year") {
      const stickerYears = getStickerYears(state);

      yearViewSelect.innerHTML = "";

      stickerYears.forEach((year) => {
        const opt = document.createElement("option");
        opt.value = String(year);
        opt.textContent = String(year);
        yearViewSelect.appendChild(opt);
      });

      if (!stickerYears.includes(state.year)) {
        state.year = stickerYears[0];
        saveState(state);
      }

      yearViewSelect.value = String(state.year);
    }
  }

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

  const monthWrap = document.createElement("div");
  monthWrap.className = "monthViewWrap";

  const wrapper = document.createElement("div");
  wrapper.className = "card";

  const stickeredCount = Object.keys(state.placements).filter((key) =>
    key.startsWith(`${year}-${pad2(month + 1)}-`),
  ).length;

  const monthNumber = pad2(month + 1);

  const header = document.createElement("div");
  header.className = "monthHeader";
  header.innerHTML = `
  <h2>${MONTHS[month]} ${year}</h2>

  <div class="month-sticker-count">
    ${stickeredCount} days stickered
  </div>



  <div class="header-icon-actions">
 <button id="openMonthExportBtn" class="btn icon-btn image-btn icon-btn-labeled" aria-label="View month export">
  <img src="/calendar-download.svg" alt="" />
  <span>Month</span>
</button>
<a class="btn icon-btn image-btn icon-btn-labeled" href="/notes.html" aria-label="View sticker stories">
  <img src="/open-book-round.svg" alt="" />
  <span>Stories</span>
</a>
  </div>
`;

  //   <div class="header-icon-actions">
  //     <button id="downloadMonthBtn" class="btn icon-btn image-btn" aria-label="Download month image">
  //       <img src="/calendar-download.svg" alt="" />
  //     </button>
  //     <a class="btn icon-btn image-btn" href="/notes.html" aria-label="View sticker stories">
  //       <img src="/open-book-round.svg" alt="" />
  //     </a>
  //   </div>
  // `;

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
      img.draggable = false;
      img.src = `./stickers/${sticker.file}`;
      slot.appendChild(img);

      // if (sticker.artist) {
      //   const badge = document.createElement("div");
      //   badge.className = "stickerArtistBadge";
      //   badge.textContent = sticker.artist.name;
      //   slot.appendChild(badge);
      // }
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
  monthWrap.appendChild(wrapper);

  monthViewEl.innerHTML = "";
  monthViewEl.appendChild(monthWrap);
}

function renderYear() {
  const year = state.year;

  const stickeredCount = Object.keys(state.placements).filter((key) =>
    key.startsWith(`${year}-`),
  ).length;

  const wrapper = document.createElement("div");
  wrapper.className = "yearViewWrap";

  const yearCard = document.createElement("div");
  yearCard.className = "card yearCard";

  const header = document.createElement("div");
  header.className = "header-icon-actions year-header-actions";
  header.innerHTML = `
    <h2>${year}</h2>

    <div class="year-sticker-count">
      ${stickeredCount} days stickered
    </div>

    <div class="year-action-buttons">
      <button id="openYearExportBtn" class="btn icon-btn image-btn icon-btn-labeled" aria-label="View year export">
        <img src="/calendar-download.svg" alt="" />
        <span>Year</span>
      </button>

      <a class="btn icon-btn image-btn icon-btn-labeled" href="/notes.html" aria-label="View sticker stories">
        <img src="/open-book-round.svg" alt="" />
        <span>Stories</span>
      </a>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "yearGrid";

  yearCard.appendChild(header);
  yearCard.appendChild(grid);
  wrapper.appendChild(yearCard);

  for (let month = 0; month < 12; month++) {
    const card = document.createElement("div");
    card.className = "miniMonth";

    const monthTop = document.createElement("div");
    monthTop.className = "miniMonthTop";

    const title = document.createElement("div");
    title.className = "miniMonthTitle";
    title.textContent = `${MONTHS[month]} ${year}`;

    monthTop.appendChild(title);
    card.appendChild(monthTop);

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
        img.draggable = false;
        cell.appendChild(img);
      }

      cell.addEventListener("click", () => {
        state.month = month;
        saveState(state);
        render();
        openModal(key);
      });

      cal.appendChild(cell);
    }

    card.appendChild(cal);
    grid.appendChild(card);
  }

  yearViewEl.innerHTML = "";
  yearViewEl.appendChild(wrapper);
}

function renderMonthExportCard(target = "download") {
  const year = state.year;
  const month = state.month;

  const ids =
    target === "preview"
      ? {
          title: "monthExportPreviewTitle",
          count: "monthExportPreviewCount",
          weekdays: "monthExportPreviewWeekdays",
          grid: "monthExportPreviewGrid",
        }
      : {
          title: "monthExportTitle",
          count: "monthExportCount",
          weekdays: "monthExportWeekdays",
          grid: "monthExportGrid",
        };

  document.getElementById(ids.title).textContent = `${MONTHS[month]} ${year}`;

  const stickeredCount = Object.keys(state.placements).filter((key) =>
    key.startsWith(`${year}-${pad2(month + 1)}-`),
  ).length;

  document.getElementById(ids.count).textContent =
    `${stickeredCount} days stickered`;

  document.getElementById(ids.weekdays).innerHTML = WEEKDAYS.map(
    (d) => `<div>${d}</div>`,
  ).join("");

  const grid = document.getElementById(ids.grid);
  grid.innerHTML = "";

  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const startDate = new Date(year, month, 1 - startDay);

  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);

    const key = ymd(d);
    const isOutside = d.getMonth() !== month;

    const cell = document.createElement("div");
    cell.className = `export-month-day${isOutside ? " outside" : ""}`;

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = String(d.getDate());
    cell.appendChild(num);

    const stickerId = state.placements[key];
    if (stickerId && stickerById.has(stickerId)) {
      const sticker = stickerById.get(stickerId);
      const img = document.createElement("img");
      img.src = `./stickers/${sticker.file}`;
      img.alt = "";
      cell.appendChild(img);
    }

    grid.appendChild(cell);
  }
}

async function downloadMonthImage() {
  if (typeof html2canvas === "undefined") return;

  renderMonthExportCard("download");

  const card = document.getElementById("monthExportCard");
  if (!card) return;

  const canvas = await html2canvas(card, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-sticky-${MONTHS[state.month].toLowerCase()}-${state.year}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderYearExportCard(target = "download") {
  const year = state.year;

  const ids =
    target === "preview"
      ? {
          title: "yearExportPreviewTitle",
          count: "yearExportPreviewCount",
          grid: "yearExportPreviewGrid",
        }
      : {
          title: "yearExportTitle",
          count: "yearExportCount",
          grid: "yearExportGrid",
        };

  document.getElementById(ids.title).textContent = String(year);

  const stickeredCount = Object.keys(state.placements).filter((key) =>
    key.startsWith(`${year}-`),
  ).length;

  document.getElementById(ids.count).textContent =
    `${stickeredCount} days stickered`;

  const grid = document.getElementById(ids.grid);
  grid.innerHTML = "";

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  for (let dayOfYear = 0; dayOfYear < daysInYear; dayOfYear++) {
    const date = new Date(year, 0, 1 + dayOfYear);
    const key = ymd(date);

    const cell = document.createElement("div");
    cell.className = "export-year-flat-day";

    const stickerId = state.placements[key];

    if (stickerId && stickerById.has(stickerId)) {
      const sticker = stickerById.get(stickerId);
      const img = document.createElement("img");
      img.src = `./stickers/${sticker.file}`;
      img.alt = "";
      cell.appendChild(img);
    } else {
      cell.classList.add("is-empty");
    }

    grid.appendChild(cell);
  }
}

async function downloadYearImage() {
  if (typeof html2canvas === "undefined") return;

  renderYearExportCard("download");

  const card = document.getElementById("yearExportCard");
  if (!card) return;

  const canvas = await html2canvas(card, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-sticky-${state.year}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openModal(dayKey) {
  selectedDayKey = dayKey;
  modalDateEl.textContent = dayKey;

  if (searchInput) searchInput.value = "";

  updateNoteButtonLabel();
  overlay.classList.remove("hidden");

  modalHistoryDepth = 0;
  pushModalLevel("tabs");

  DailyStickyStickerPickerV2.renderTabs();
}

function openMonthExportPreview() {
  renderMonthExportCard("preview");
  monthExportOverlay.classList.remove("hidden");
}

function closeMonthExportPreview() {
  monthExportOverlay.classList.add("hidden");
}

function openYearExportPreview() {
  renderYearExportCard("preview");
  yearExportOverlay.classList.remove("hidden");
}

function closeYearExportPreview() {
  yearExportOverlay.classList.add("hidden");
}

function wireGridBulge(gridId, cellSelector) {
  const grid = document.getElementById(gridId);

  if (!grid) return;

  const BULGE_RADIUS = 80;
  const MAX_SCALE = 2.9;
  const MAX_PUSH = 14;

  // Higher = the bubble trail hangs around longer.
  const FADE_DURATION = 300;

  // Higher = growth ramps in more gradually instead of snapping.
  const RISE_DURATION = 90;

  // Lower = smoother but slightly more delayed.
  const POINTER_SMOOTHING = 0.22;

  // Prevents the main sticker from switching too easily.
  const FOCUS_SWITCH_MARGIN = 6;

  // Minimum time between focus switches, prevents flicker near boundaries.
  const FOCUS_SWITCH_COOLDOWN = 120;

  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;

  let pointerActive = false;
  let animationFrame = null;
  let previousTime = performance.now();
  let cellMeasurements = [];
  let focusedCell = null;
  let lastFocusSwitchTime = 0;

  const cellStates = new WeakMap();

  function getCellState(cell) {
    if (!cellStates.has(cell)) {
      cellStates.set(cell, {
        strength: 0,
        pushX: 0,
        pushY: 0,
        angle: null, //testing less swoopy
      });
    }

    return cellStates.get(cell);
  }

  function smoothstep(edgeStart, edgeEnd, value) {
    const normalized = Math.min(
      1,
      Math.max(0, (value - edgeStart) / (edgeEnd - edgeStart)),
    );

    return normalized * normalized * (3 - 2 * normalized);
  }

  function getZoneMultiplier(normalizedDistance) {
    const centerToMiddle = smoothstep(0.08, 0.42, normalizedDistance);

    const middleToOuter = smoothstep(0.42, 1, normalizedDistance);

    const middleMultiplier = 1 + (0.72 - 1) * centerToMiddle;

    return middleMultiplier + (0.5 - middleMultiplier) * middleToOuter;
  }

  function measureCells() {
    cellMeasurements = Array.from(grid.querySelectorAll(cellSelector)).map(
      (cell) => {
        const rect = cell.getBoundingClientRect();

        return {
          cell,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        };
      },
    );
  }

  function updateFocusedCell() {
    if (!cellMeasurements.length) return;

    let nearestMeasurement = null;
    let nearestDistance = Infinity;

    cellMeasurements.forEach((measurement) => {
      const distance = Math.hypot(
        measurement.centerX - pointerX,
        measurement.centerY - pointerY,
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestMeasurement = measurement;
      }
    });

    if (!nearestMeasurement) return;

    if (!focusedCell) {
      focusedCell = nearestMeasurement.cell;
      return;
    }

    const currentMeasurement = cellMeasurements.find(
      ({ cell }) => cell === focusedCell,
    );

    if (!currentMeasurement) {
      focusedCell = nearestMeasurement.cell;
      return;
    }

    const currentDistance = Math.hypot(
      currentMeasurement.centerX - pointerX,
      currentMeasurement.centerY - pointerY,
    );

    /*
     * Only switch focus when the new cell is clearly closer,
     * and enough time has passed since the last switch.
     * This prevents rapid back-and-forth switching near boundaries.
     */
    if (
      nearestMeasurement.cell !== focusedCell &&
      nearestDistance + FOCUS_SWITCH_MARGIN < currentDistance &&
      performance.now() - lastFocusSwitchTime > FOCUS_SWITCH_COOLDOWN
    ) {
      focusedCell = nearestMeasurement.cell;
      lastFocusSwitchTime = performance.now();
    }
  }

  function startAnimation() {
    if (animationFrame) return;

    previousTime = performance.now();
    animationFrame = requestAnimationFrame(updateBulge);
  }

  function updateBulge(currentTime) {
    animationFrame = null;

    const elapsed = Math.min(currentTime - previousTime, 40);
    previousTime = currentTime;

    if (pointerActive) {
      pointerX += (targetPointerX - pointerX) * POINTER_SMOOTHING;

      pointerY += (targetPointerY - pointerY) * POINTER_SMOOTHING;

      updateFocusedCell();
    }

    const riseDecay = Math.exp(-elapsed / RISE_DURATION);
    const fallDecay = Math.exp(-elapsed / FADE_DURATION);

    let anythingStillBulging = false;

    cellMeasurements.forEach(({ cell, centerX, centerY }) => {
      const state = getCellState(cell);

      const deltaX = centerX - pointerX;
      const deltaY = centerY - pointerY;
      const distance = Math.hypot(deltaX, deltaY);

      let targetStrength = 0;
      let targetPushX = 0;
      let targetPushY = 0;

      if (pointerActive && distance < BULGE_RADIUS) {
        const normalizedDistance = distance / BULGE_RADIUS;

        const baseStrength = Math.pow(1 - normalizedDistance, 2);

        const zoneMultiplier = getZoneMultiplier(normalizedDistance);

        targetStrength = baseStrength * zoneMultiplier;

        if (cell === focusedCell) {
          targetStrength = Math.min(1, targetStrength * 1.12);
        }
      }

      // swoopy start

      const isGrowing = targetStrength >= state.strength;
      const smoothing = isGrowing ? riseDecay : fallDecay;

      state.strength =
        targetStrength + (state.strength - targetStrength) * smoothing;

      if (distance > 0 && targetStrength > 0.01) {
        const targetAngle = Math.atan2(deltaY, deltaX);

        if (state.angle === null) {
          state.angle = targetAngle;
        } else {
          // Shortest-path angle smoothing so it doesn't spin the long way around.
          let diff = targetAngle - state.angle;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));

          // Slower than strength smoothing — this is what kills the swoop.
          const ANGLE_SMOOTHING = 0.6;
          state.angle += diff * ANGLE_SMOOTHING;
        }
      }

      const pushMagnitude = MAX_PUSH * state.strength;
      state.pushX =
        state.angle === null ? 0 : Math.cos(state.angle) * pushMagnitude;
      state.pushY =
        state.angle === null ? 0 : Math.sin(state.angle) * pushMagnitude;

      // testing less swoopy
      //   if (distance > 0) {
      //     targetPushX = (deltaX / distance) * MAX_PUSH * targetStrength;

      //     targetPushY = (deltaY / distance) * MAX_PUSH * targetStrength;
      //   }
      // }

      // const isGrowing = targetStrength >= state.strength;
      // const smoothing = isGrowing ? riseDecay : fallDecay;

      // state.strength =
      //   targetStrength + (state.strength - targetStrength) * smoothing;
      // state.pushX = targetPushX + (state.pushX - targetPushX) * smoothing;
      // state.pushY = targetPushY + (state.pushY - targetPushY) * smoothing;

      // if (state.strength < 0.002) {
      //   state.strength = 0;
      //   state.pushX = 0;
      //   state.pushY = 0;
      // }

      const scale = +(1 + (MAX_SCALE - 1) * state.strength).toFixed(2);
      const pushX = +state.pushX.toFixed(1);
      const pushY = +state.pushY.toFixed(1);

      cell.style.transform = `
        translate3d(${pushX}px, ${pushY}px, 0)
        scale(${scale})
      `;

      cell.style.zIndex = cell === focusedCell ? "30" : "1";

      cell.style.setProperty("--bulge-strength", state.strength.toFixed(3));

      if (state.strength > 0) {
        anythingStillBulging = true;
      }
    });

    if (pointerActive || anythingStillBulging) {
      animationFrame = requestAnimationFrame(updateBulge);
    } else {
      grid.classList.remove("is-bulging");
      cellMeasurements = [];
      focusedCell = null;
    }
  }

  function updatePointer(event) {
    const newX = event.clientX;
    const newY = event.clientY - 37;

    if (Math.hypot(newX - targetPointerX, newY - targetPointerY) < 1.5) {
      return;
    }

    targetPointerX = newX;
    targetPointerY = newY;

    startAnimation();
  }

  grid.addEventListener("pointerdown", (event) => {
    pointerActive = true;
    focusedCell = null;

    grid.classList.add("is-bulging");

    measureCells();

    pointerX = event.clientX;
    pointerY = event.clientY - 42;

    targetPointerX = pointerX;
    targetPointerY = pointerY;

    updateFocusedCell();

    grid.setPointerCapture?.(event.pointerId);

    updatePointer(event);
    event.preventDefault();
  });

  grid.addEventListener("pointermove", (event) => {
    if (!pointerActive) return;

    updatePointer(event);
    event.preventDefault();
  });

  function endPointer(event) {
    if (!pointerActive) return;

    pointerActive = false;

    if (
      event?.pointerId !== undefined &&
      grid.hasPointerCapture?.(event.pointerId)
    ) {
      grid.releasePointerCapture(event.pointerId);
    }

    startAnimation();
  }

  grid.addEventListener("pointerup", endPointer);
  grid.addEventListener("pointercancel", endPointer);
  grid.addEventListener("lostpointercapture", endPointer);
}

function closeModal(fromHistory = false) {
  overlay.classList.add("hidden");
  selectedDayKey = null;
  stickerModalMode = "cats";
  activeStickerCategory = null;
  modalHistoryDepth = 0;
  closeNoteModal();
}

function closePickerImmediately() {
  const depthToUnwind = modalHistoryDepth;

  closeModal(true);
  render();

  if (depthToUnwind > 0) {
    history.go(-depthToUnwind);
  }
}

function requestModalClose() {
  if (overlay.classList.contains("hidden")) return;

  closePickerImmediately();
  maybeShowWeeklyRecapPrompt();
  maybeShowInstallPromptAfterNoteFlow();
}

function isSunday(dayKey) {
  const date = new Date(`${dayKey}T12:00:00`);
  return date.getDay() === 0;
}

function weeklyRecapPromptStorageKey(dayKey) {
  return `weeklyRecapPromptShown.${dayKey}`;
}

function hasSeenWeeklyRecapPrompt(dayKey) {
  return localStorage.getItem(weeklyRecapPromptStorageKey(dayKey)) === "true";
}

function markWeeklyRecapPromptSeen(dayKey) {
  localStorage.setItem(weeklyRecapPromptStorageKey(dayKey), "true");
}

function queueWeeklyRecapPromptIfSunday(dayKey) {
  if (!dayKey) return;

  const todayKey = ymd(today);

  if (dayKey !== todayKey) return;
  if (!isSunday(dayKey)) return;
  if (hasSeenWeeklyRecapPrompt(dayKey)) return;

  pendingWeeklyRecapDayKey = dayKey;
}

function maybeShowWeeklyRecapPrompt() {
  if (!pendingWeeklyRecapDayKey) return;
  if (!weeklyRecapPromptOverlay) return;

  markWeeklyRecapPromptSeen(pendingWeeklyRecapDayKey);
  pendingWeeklyRecapDayKey = null;

  weeklyRecapPromptOverlay.classList.remove("hidden");
}

function hideWeeklyRecapPrompt() {
  if (!weeklyRecapPromptOverlay) return;
  weeklyRecapPromptOverlay.classList.add("hidden");

  maybeShowInstallPromptAfterNoteFlow();
}

function maybeShowInstallPromptAfterNoteFlow() {
  const weeklyRecapIsShowing =
    weeklyRecapPromptOverlay &&
    !weeklyRecapPromptOverlay.classList.contains("hidden");

  if (pendingWeeklyRecapDayKey) return;
  if (weeklyRecapIsShowing) return;

  const hasSeenWelcomeCard = localStorage.getItem(WELCOME_CARD_KEY) === "true";

  const stickeredDays = Object.keys(state.placements || {}).length;

  if (typeof window.showDailyStickyInstallPrompt === "function") {
    window.showDailyStickyInstallPrompt({
      isReturningVisitor: hasSeenWelcomeCard,
      stickeredDays,
      minStickeredDays: 2,
    });
  }
}

function updateNoteButtonLabel() {
  if (!selectedDayKey) {
    noteBtn.textContent = "Add a Story";
    return;
  }

  noteBtn.textContent = state.notes[selectedDayKey]
    ? "View Story"
    : "Add a Story";
}

function openNoteModal() {
  if (!selectedDayKey) return;

  noteDayKey = selectedDayKey;

  noteModalDateEl.textContent = noteDayKey;
  noteInput.value = state.notes[noteDayKey] || "";
  noteCount.textContent = `${noteInput.value.length}/300`;
  deleteNoteBtn.textContent = state.notes[noteDayKey]
    ? "Delete Sticker Story"
    : "Skip";

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
  closePickerImmediately();
  maybeShowWeeklyRecapPrompt();
  maybeShowInstallPromptAfterNoteFlow();
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

// Demo reel feature to place one sticker per day in year view. Run in browser console with this command: playYearStickerReel(state.year, 235);

async function playYearStickerReel(year = state.year, delay = 235) {
  const originalPlacements = { ...state.placements };
  const originalYear = state.year;
  const originalView = state.view;

  const yearPrefix = `${year}-`;

  const yearPlacements = Object.entries(originalPlacements)
    .filter(([dateKey, stickerId]) => {
      const monthNumber = Number(dateKey.slice(5, 7));

      return (
        dateKey.startsWith(yearPrefix) &&
        monthNumber >= 1 &&
        monthNumber <= 3 &&
        stickerById.has(stickerId)
      );
    })
    .sort(([a], [b]) => a.localeCompare(b));

  if (!yearPlacements.length) {
    alert("No stickers found for this year.");
    return;
  }

  state.year = year;
  state.view = "year";

  state.placements = Object.fromEntries(
    Object.entries(originalPlacements).filter(
      ([dateKey]) => !dateKey.startsWith(yearPrefix),
    ),
  );

  monthViewEl.classList.add("hidden");
  yearViewEl.classList.remove("hidden");
  renderYear();

  for (const [dateKey, stickerId] of yearPlacements) {
    state.placements[dateKey] = stickerId;
    renderYear();

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  state.placements = originalPlacements;
  state.year = originalYear;
  state.view = originalView;
}

// end demo reel

function loadState() {
  return loadDailyStickyState();
}

function saveState(next) {
  saveDailyStickyState(next);
}

function exportJson() {
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
  const shareUrlEl = document.getElementById("weeklyShareUrl");

  if (!grid) return;

  grid.innerHTML = "";

  if (shareUrlEl) {
    shareUrlEl.textContent = "dailysticky.app";
  }

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
      img.draggable = false;
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
    img.draggable = false;
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
  const shareText = "sticker your week at";
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

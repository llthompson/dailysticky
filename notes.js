const notesList = document.getElementById("notesList");
const notesYearNav = document.getElementById("notesYearNav");
const toggleAllNotesBtn = document.getElementById("toggleAllNotesBtn");
const notesYearSelect = document.getElementById("notesYearSelect");

let selectedNotesYear = null;
let stickers = [];
let stickerById = new Map();

function loadState() {
  return loadDailyStickyState();
}

function getYearToShow(state) {
  return state?.year || new Date().getFullYear();
}

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getNotesForMonth(notes, year, monthIndex) {
  const monthNumber = pad2(monthIndex + 1);
  const monthPrefix = `${year}-${monthNumber}`;

  return Object.entries(notes)
    .filter(([dateKey, note]) => {
      return dateKey.startsWith(monthPrefix) && note && note.trim();
    })
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
}

function renderMonthJumpLinks(year) {
  notesYearNav.innerHTML = "";

  MONTHS.forEach((monthName, monthIndex) => {
    const monthNumber = pad2(monthIndex + 1);

    const link = document.createElement("a");
    link.className = "notes-month-jump";
    link.href = `#notes-${year}-${monthNumber}`;
    link.textContent = monthName.slice(0, 3);

    notesYearNav.appendChild(link);
  });
}

function renderNoteCard(dateKey, note, placements) {
  const card = document.createElement("article");
  card.className = "note-card";

  const date = document.createElement("p");
  date.className = "note-date";
  date.textContent = formatDate(dateKey);

  const noteText = document.createElement("p");
  noteText.className = "note-text";
  noteText.textContent = note.trim();

  const stickerId = placements[dateKey];
  const sticker = stickerId ? stickerById.get(stickerId) : null;

  if (sticker) {
    const stickerWrap = document.createElement("div");
    stickerWrap.className = "note-sticker";

    const img = document.createElement("img");
    img.src = `/stickers/${sticker.file}`;
    img.alt = sticker.label || sticker.id;
    img.loading = "lazy";

    stickerWrap.appendChild(img);

    card.append(date, stickerWrap, noteText);
  } else {
    card.append(date, noteText);
  }

  return card;
}

function updateToggleAllButtonText() {
  if (!toggleAllNotesBtn) return;

  const sections = [...document.querySelectorAll(".notes-month-section")];
  const allExpanded = sections.every(
    (section) => !section.classList.contains("is-collapsed"),
  );

  toggleAllNotesBtn.textContent = allExpanded
    ? "Collapse all months"
    : "Expand all months";
}

function toggleAllMonths() {
  const sections = [...document.querySelectorAll(".notes-month-section")];
  const shouldExpand = sections.some((section) =>
    section.classList.contains("is-collapsed"),
  );

  sections.forEach((section) => {
    section.classList.toggle("is-collapsed", !shouldExpand);

    const button = section.querySelector(".notes-month-toggle");
    if (button) {
      button.setAttribute("aria-expanded", String(shouldExpand));
    }
  });

  updateToggleAllButtonText();
}

function expandLinkedMonth(useCurrentMonthWhenNoHash = false) {
  const now = new Date();
  const hasLinkedMonth = Boolean(window.location.hash);

  const targetSelector = hasLinkedMonth
    ? window.location.hash
    : useCurrentMonthWhenNoHash
      ? `#notes-${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
      : null;

  if (!targetSelector) return;

  const section = document.querySelector(targetSelector);
  if (!section) return;

  collapseOtherMonths(section);

  section.classList.remove("is-collapsed");

  const button = section.querySelector(".notes-month-toggle");
  if (button) {
    button.setAttribute("aria-expanded", "true");
  }

  updateToggleAllButtonText();

  const isCurrentMonthArrival = useCurrentMonthWhenNoHash && !hasLinkedMonth;

  let scrollTarget = section;

  if (isCurrentMonthArrival) {
    const storyCards = section.querySelectorAll(".note-card");

    scrollTarget =
      storyCards[storyCards.length - 1] ||
      section.querySelector(".notes-empty") ||
      section;
  }

  setTimeout(() => {
    scrollTarget.scrollIntoView({
      behavior: "smooth",
      block: isCurrentMonthArrival ? "end" : "start",
    });
  }, 50);
}

function collapseOtherMonths(openSection) {
  const sections = [...document.querySelectorAll(".notes-month-section")];

  sections.forEach((section) => {
    if (section === openSection) return;

    section.classList.add("is-collapsed");

    const button = section.querySelector(".notes-month-toggle");
    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
  });
}

if (toggleAllNotesBtn) {
  toggleAllNotesBtn.addEventListener("click", toggleAllMonths);
}

async function loadStickers() {
  try {
    const data = await DailyStickyStickerData.load();
    stickers = data.stickers;
    stickerById = data.stickerById;
  } catch (error) {
    console.error("Could not load stickers for sticker story page:", error);
    stickers = [];
    stickerById = new Map();
  }
}

function renderNotesPage() {
  const state = loadState();
  const years = getAvailableYears(state);

  const year =
    selectedNotesYear ||
    getYearFromHash() ||
    (years.includes(state?.year) ? state.year : years[0]);

  selectedNotesYear = Number(year);

  const notes = state?.notes || {};
  const placements = state?.placements || {};

  populateNotesYearSelect(years, selectedNotesYear);

  renderMonthJumpLinks(year);

  notesList.innerHTML = "";

  MONTHS.forEach((monthName, monthIndex) => {
    const monthNumber = pad2(monthIndex + 1);
    const monthNotes = getNotesForMonth(notes, year, monthIndex);
    const sectionId = `notes-${year}-${monthNumber}`;

    const section = document.createElement("section");
    section.className = "notes-month-section is-collapsed";
    section.id = sectionId;

    const monthButton = document.createElement("button");
    monthButton.className = "notes-month-toggle";
    monthButton.type = "button";
    monthButton.setAttribute("aria-expanded", "false");

    const monthTitle = document.createElement("span");
    monthTitle.textContent = `${monthName} ${year}`;

    const noteCount = document.createElement("span");
    noteCount.className = "notes-month-count";
    noteCount.textContent =
      monthNotes.length === 1 ? "1 story" : `${monthNotes.length} stories`;

    monthButton.append(monthTitle, noteCount);

    const content = document.createElement("div");
    content.className = "notes-month-content";

    if (!monthNotes.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "notes-empty";
      emptyMessage.textContent = "No sticker stories for this month yet.";
      content.appendChild(emptyMessage);
    } else {
      monthNotes.forEach(([dateKey, note]) => {
        content.appendChild(renderNoteCard(dateKey, note, placements));
      });
    }

    if (monthNotes.length) {
      const collapseMonthBtn = document.createElement("button");
      collapseMonthBtn.className = "btn notes-collapse-month-btn";
      collapseMonthBtn.type = "button";
      collapseMonthBtn.textContent = `Collapse ${monthName}`;

      collapseMonthBtn.addEventListener("click", () => {
        section.classList.add("is-collapsed");
        monthButton.setAttribute("aria-expanded", "false");
        updateToggleAllButtonText();

        window.scrollTo({
          top: 2,
          behavior: "smooth",
        });
      });

      content.appendChild(collapseMonthBtn);
    }

    monthButton.addEventListener("click", () => {
      const isCollapsed = section.classList.toggle("is-collapsed");
      monthButton.setAttribute("aria-expanded", String(!isCollapsed));
      updateToggleAllButtonText();
    });

    section.append(monthButton, content);
    notesList.appendChild(section);
  });

  expandLinkedMonth();
  updateToggleAllButtonText();
}

function getAvailableYears(state) {
  const years = new Set();

  if (state?.year) years.add(Number(state.year));

  Object.keys(state?.notes || {}).forEach((dateKey) => {
    const year = Number(dateKey.slice(0, 4));
    if (year) years.add(year);
  });

  Object.keys(state?.placements || {}).forEach((dateKey) => {
    const year = Number(dateKey.slice(0, 4));
    if (year) years.add(year);
  });

  years.add(new Date().getFullYear());

  return [...years].sort((a, b) => b - a);
}

function getYearFromHash() {
  const match = window.location.hash.match(/notes-(\d{4})-\d{2}/);
  return match ? Number(match[1]) : null;
}

function populateNotesYearSelect(years, selectedYear) {
  if (!notesYearSelect) return;

  notesYearSelect.innerHTML = "";

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    notesYearSelect.appendChild(option);
  });

  notesYearSelect.value = String(selectedYear);
}

async function initNotesPage() {
  await loadStickers();

  const hashYear = getYearFromHash();
  const currentYear = new Date().getFullYear();

  selectedNotesYear = hashYear || currentYear;

  renderNotesPage();

  if (!window.location.hash) {
    expandLinkedMonth(true);
  }

  if (notesYearSelect) {
    notesYearSelect.addEventListener("change", () => {
      selectedNotesYear = Number(notesYearSelect.value);
      history.replaceState(null, "", window.location.pathname);
      renderNotesPage();
    });
  }
}

window.addEventListener("hashchange", () => {
  expandLinkedMonth();
  updateToggleAllButtonText();
});

initNotesPage();

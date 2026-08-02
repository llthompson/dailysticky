(function () {
  let cachedDataPromise = null;
  let activeTab = null;
  let activeCategory = null;
  let searchListenerWired = false;
  let inSearchMode = false;

  function loadData() {
    if (!cachedDataPromise) {
      cachedDataPromise = DailyStickyStickerData.load();
    }
    return cachedDataPromise;
  }

  function resetScroll() {
    const modal = overlay?.querySelector(".modal");
    if (modal) modal.scrollTop = 0;
    if (overlay) overlay.scrollTop = 0;
    if (stickerGrid) stickerGrid.scrollTop = 0;
  }

  function selectSticker(sticker) {
    if (!selectedDayKey) return;

    state.placements[selectedDayKey] = sticker.id;
    saveState(state);
    scheduleSharePreparation();
    updateNoteButtonLabel();
    queueWeeklyRecapPromptIfSunday(selectedDayKey);
    openNoteModal();
  }

  function buildStickerButton(sticker, options = {}) {
    const { markArtist = false } = options;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stickerBtn";
    btn.setAttribute("data-sticker-id", sticker.id);

    if (markArtist && sticker.artist) {
      btn.classList.add("hasArtist");
    }

    btn.addEventListener("click", () => selectSticker(sticker));

    const img = document.createElement("img");
    img.alt = sticker.label || sticker.id;
    img.loading = "lazy";
    img.src = `./stickers/${sticker.file}`;
    img.draggable = false;
    btn.appendChild(img);

    if (markArtist && sticker.artist) {
      const badge = document.createElement("div");
      badge.className = "stickerArtistBadge";
      badge.textContent = sticker.artist.name;
      btn.appendChild(badge);
    }

    const label = document.createElement("div");
    label.className = "stickerLabel";
    label.textContent = sticker.label || sticker.id;
    btn.appendChild(label);

    return btn;
  }

  function renderFeaturedStrip(data) {
    const strip = document.getElementById("featuredStrip");
    if (!strip) return;

    const artist = data.featuredArtist;
    const items = data.featuredStickers || [];

    if (!artist || !items.length) {
      strip.innerHTML = "";
      strip.classList.add("hidden");
      return;
    }

    strip.classList.remove("hidden");
    strip.innerHTML = "";

    const header = document.createElement("div");
    header.className = "featuredStripHeader";

    const label = document.createElement("div");
    label.className = "featuredStripLabel";
    label.textContent = `Featured artist: ${artist.name}`;
    header.appendChild(label);

    const a = document.createElement("a");
    a.className = "featuredStripLink";
    a.href = `/artist.html?id=${encodeURIComponent(artist.id)}`;
    a.textContent = "Meet the Artist →";
    header.appendChild(a);

    const row = document.createElement("div");
    row.className = "featuredStripRow";

    items.forEach((sticker) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "featuredStripSticker";
      btn.setAttribute("data-sticker-id", sticker.id);
      btn.addEventListener("click", () => selectSticker(sticker));

      const img = document.createElement("img");
      img.alt = sticker.label || sticker.id;
      img.loading = "lazy";
      img.src = `./stickers/${sticker.file}`;
      img.draggable = false;

      btn.appendChild(img);
      row.appendChild(btn);
    });

    strip.appendChild(header);
    strip.appendChild(row);
  }

  function getCategoryGroupsForTab(data, tab) {
    return tab.categories
      .map((categoryName) => ({
        category: categoryName,
        items: data.activeStickers
          .filter((sticker) => sticker.primaryCategory === categoryName)
          .slice()
          .sort((a, b) =>
            a.id.localeCompare(b.id, undefined, { numeric: true }),
          ),
      }))
      .filter((group) => group.items.length);
  }

  function wireSearchOnce() {
    if (searchListenerWired) return;
    if (!searchInput) return;

    searchInput.addEventListener("input", async () => {
      const data = await loadData();
      const query = searchInput.value;

      if (query.trim()) {
        if (!inSearchMode) {
          inSearchMode = true;
          window.DailyStickyModalNav?.pushLevel("search", { query });
        }
        renderSearchResults(data, query);
      } else if (inSearchMode) {
        inSearchMode = false;
        history.back();
      }
    });

    searchListenerWired = true;
  }

  function renderSearchResults(data, query) {
    const q = query.trim().toLowerCase();

    const matches = data.activeStickers.filter((sticker) => {
      const haystack = [
        sticker.label,
        sticker.id,
        sticker.primaryCategory,
        sticker.secondaryCategory,
        sticker.artist?.name,
        ...(sticker.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    renderFeaturedStrip(data);

    stickerGrid.innerHTML = "";

    const top = document.createElement("div");
    top.className = "catTopRow";

    const title = document.createElement("div");
    title.className = "catTitle";
    title.textContent = matches.length
      ? `${matches.length} result${matches.length === 1 ? "" : "s"}`
      : "No stickers found";

    top.appendChild(title);
    stickerGrid.appendChild(top);

    const grid = document.createElement("div");
    grid.className = "catGrid";

    matches
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      .forEach((sticker) => {
        grid.appendChild(buildStickerButton(sticker));
      });

    stickerGrid.appendChild(grid);
    resetScroll();
  }

  async function renderSearchForQuery(query, fromHistory = false) {
    inSearchMode = true;

    if (searchInput) searchInput.value = query || "";

    const data = await loadData();
    renderSearchResults(data, query || "");
  }

  async function renderTabs() {
    wireSearchOnce();

    inSearchMode = false;
    if (searchInput) searchInput.value = "";

    activeTab = null;
    activeCategory = null;

    const data = await loadData();
    renderFeaturedStrip(data);

    stickerGrid.innerHTML = "";

    const top = document.createElement("div");
    top.className = "catTopRow";

    const title = document.createElement("div");
    title.className = "catTitleTab";
    title.textContent = "Sticker Books";

    top.appendChild(title);
    stickerGrid.appendChild(top);

    const wrapper = document.createElement("div");
    wrapper.className = "catList";

    data.tabs.forEach((tab) => {
      const groups = getCategoryGroupsForTab(data, tab);
      const previewItems = groups.flatMap((g) => g.items);
      const count = previewItems.length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "catTile";
      btn.setAttribute("data-tab", tab.id);
      btn.addEventListener("click", () => renderCategoriesForTab(tab.id));

      const name = document.createElement("div");
      name.className = "catName";
      name.textContent = tab.label;

      const meta = document.createElement("div");
      meta.className = "catMeta";
      meta.textContent = `${count} stickers`;

      const preview = document.createElement("div");
      preview.className = "catPreview";

      const shuffled = previewItems
        .map((sticker) => ({ sticker, sortKey: Math.random() }))
        .sort((a, b) => a.sortKey - b.sortKey)
        .map((entry) => entry.sticker);

      shuffled.slice(0, 3).forEach((sticker) => {
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.src = `./stickers/${sticker.file}`;
        img.draggable = false;
        preview.appendChild(img);
      });

      btn.appendChild(name);
      btn.appendChild(meta);
      btn.appendChild(preview);
      wrapper.appendChild(btn);
    });

    stickerGrid.appendChild(wrapper);
    resetScroll();
  }

  async function renderCategoriesForTab(tabId, fromHistory = false) {
    inSearchMode = false;
    if (searchInput) searchInput.value = "";
    activeTab = tabId;
    activeCategory = null;

    if (!fromHistory) {
      window.DailyStickyModalNav?.pushLevel("categories", { tabId });
    }

    const data = await loadData();
    renderFeaturedStrip(data);

    const tab = data.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const groups = getCategoryGroupsForTab(data, tab);

    stickerGrid.innerHTML = "";

    const top = document.createElement("div");
    top.className = "catTopRow";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn Tab catBack";
    back.innerHTML = '<i class="fa-solid fa-arrow-left"></i>Back';
    back.addEventListener("click", () => history.back());

    const title = document.createElement("div");
    title.className = "catTitleTab";
    title.textContent = tab.label;

    top.appendChild(back);
    top.appendChild(title);
    stickerGrid.appendChild(top);

    const wrapper = document.createElement("div");
    wrapper.className = "catList";

    groups.forEach((group) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "catTile";
      btn.setAttribute("data-cat", group.category);
      btn.addEventListener("click", () =>
        renderStickersForCategory(tabId, group.category),
      );

      const name = document.createElement("div");
      name.className = "catName";
      name.textContent = group.category;

      const meta = document.createElement("div");
      meta.className = "catMeta";
      meta.textContent = `${group.items.length} stickers`;

      const preview = document.createElement("div");
      preview.className = "catPreview";

      const shuffledGroupItems = group.items
        .map((sticker) => ({ sticker, sortKey: Math.random() }))
        .sort((a, b) => a.sortKey - b.sortKey)
        .map((entry) => entry.sticker);

      shuffledGroupItems.slice(0, 3).forEach((sticker) => {
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.src = `./stickers/${sticker.file}`;
        img.draggable = false;
        preview.appendChild(img);
      });

      btn.appendChild(name);
      btn.appendChild(meta);
      btn.appendChild(preview);
      wrapper.appendChild(btn);
    });

    stickerGrid.appendChild(wrapper);
    resetScroll();
  }

  async function renderStickersForCategory(
    tabId,
    category,
    fromHistory = false,
  ) {
    inSearchMode = false;
    if (searchInput) searchInput.value = "";

    activeTab = tabId;
    activeCategory = category;

    if (!fromHistory) {
      window.DailyStickyModalNav?.pushLevel("stickers", { tabId, category });
    }

    const data = await loadData();
    renderFeaturedStrip(data);

    const items = data.activeStickers
      .filter((sticker) => sticker.primaryCategory === category)
      .slice()
      .sort((a, b) => {
        const artistRank = (s) => (s.artistId ? 0 : 1);
        const rankDiff = artistRank(a) - artistRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });

    stickerGrid.innerHTML = "";

    const top = document.createElement("div");
    top.className = "catTopRow";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn catBack";
    back.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Categories';
    back.addEventListener("click", () => history.back());

    const title = document.createElement("div");
    title.className = "catTitle";
    title.textContent = category;

    top.appendChild(back);
    top.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "catGrid";

    items.forEach((sticker) => {
      grid.appendChild(buildStickerButton(sticker, { markArtist: true }));
    });

    stickerGrid.appendChild(top);
    stickerGrid.appendChild(grid);
    resetScroll();
  }

  window.DailyStickyStickerPickerV2 = {
    renderTabs,
    renderCategoriesForTab,
    renderStickersForCategory,
    renderSearchForQuery,
  };
})();

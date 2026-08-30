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
    DailyStickyAnalytics.trackEvent("sticker_placed");
    DailyStickyAnalytics.trackOnce(
      "first_sticker_placed",
      "dailySticky.firstStickerPlaced.v1",
    );
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

    const label = document.createElement("div");
    label.className = "stickerLabel";
    label.textContent = sticker.label || sticker.id;
    btn.appendChild(label);

    if (markArtist && sticker.artist) {
      const badge = document.createElement("div");
      badge.className = "stickerArtistBadge";
      badge.textContent = sticker.artist.name;
      btn.appendChild(badge);
    }

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
      strip.removeAttribute("role");
      strip.removeAttribute("tabindex");
      strip.onclick = null;
      strip.onkeydown = null;
      return;
    }

    strip.classList.remove("hidden");
    strip.innerHTML = "";

    function openArtistSet() {
      renderStickersForArtist(artist.id);
    }

    strip.setAttribute("role", "button");
    strip.setAttribute("tabindex", "0");
    strip.setAttribute("aria-label", `View all stickers by ${artist.name}`);

    strip.onclick = (event) => {
      if (event.target.closest(".featuredStripSticker")) return;
      openArtistSet();
    };

    strip.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      openArtistSet();
    };

    const header = document.createElement("div");
    header.className = "featuredStripHeader";

    const label = document.createElement("div");
    label.className = "featuredStripLabel";
    label.append("Featured artist: ");

    const artistNameSpan = document.createElement("span");
    artistNameSpan.className = "featuredStripArtistName";
    artistNameSpan.textContent = artist.name;
    label.appendChild(artistNameSpan);

    header.appendChild(label);

    const viewAll = document.createElement("span");
    viewAll.className = "featuredStripLink";
    viewAll.textContent = "View all stickers →";
    header.appendChild(viewAll);

    const row = document.createElement("div");
    row.className = "featuredStripRow";

    items.forEach((sticker) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "featuredStripSticker";
      btn.setAttribute("data-sticker-id", sticker.id);

      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        selectSticker(sticker);
      });

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
          .filter(
            (sticker) =>
              sticker.primaryCategory === categoryName ||
              sticker.secondaryCategory === categoryName,
          )
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

    const artistBrowseRow = document.createElement("div");
    artistBrowseRow.className = "artistBrowseRow";

    const artistBrowseLink = document.createElement("a");
    artistBrowseLink.href = "#";
    artistBrowseLink.className = "featuredStripLink";
    artistBrowseLink.textContent = "Browse by artist →";
    artistBrowseLink.addEventListener("click", (event) => {
      event.preventDefault();
      renderAllArtistStickers();
    });

    artistBrowseRow.appendChild(artistBrowseLink);
    stickerGrid.appendChild(artistBrowseRow);

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

  async function renderStickersForArtist(artistId, fromHistory = false) {
    inSearchMode = false;

    if (searchInput) {
      searchInput.value = "";
    }
    activeTab = null;
    activeCategory = null;

    if (!fromHistory) {
      window.DailyStickyModalNav?.pushLevel("artist", { artistId });
    }

    const data = await loadData();
    const artist = data.artistById.get(artistId);

    if (!artist) return;

    const strip = document.getElementById("featuredStrip");

    if (strip) {
      strip.classList.add("hidden");
    }

    const items = data.activeStickers
      .filter((sticker) => sticker.artistId === artistId)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    stickerGrid.innerHTML = "";

    const top = document.createElement("div");
    top.className = "catTopRow catTopRowSticky";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn catBack";
    back.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back';
    back.addEventListener("click", () => history.back());

    const title = document.createElement("div");
    title.className = "catTitle";
    title.textContent = artist.name;

    top.appendChild(back);
    top.appendChild(title);

    const artistLinkRow = document.createElement("div");
    artistLinkRow.className = "artistSetLinkRow";

    const artistLink = document.createElement("a");
    artistLink.className = "artistSetProfileLink";
    artistLink.href = `/artist-profile.html?id=${encodeURIComponent(artist.id)}`;
    artistLink.textContent = "Meet the Artist →";

    artistLinkRow.appendChild(artistLink);

    const grid = document.createElement("div");
    grid.className = "catGrid";

    items.forEach((sticker) => {
      grid.appendChild(buildStickerButton(sticker, { markArtist: true }));
    });

    stickerGrid.appendChild(top);
    stickerGrid.appendChild(artistLinkRow);
    stickerGrid.appendChild(grid);

    resetScroll();
  }

  async function renderAllArtistStickers(fromHistory = false) {
    inSearchMode = false;

    if (searchInput) {
      searchInput.value = "";
    }
    activeTab = null;
    activeCategory = null;

    if (!fromHistory) {
      window.DailyStickyModalNav?.pushLevel("allArtists");
    }

    const data = await loadData();

    const strip = document.getElementById("featuredStrip");

    if (strip) {
      strip.classList.add("hidden");
    }

    const items = data.activeStickers
      .filter((sticker) => sticker.artistId)
      .slice()
      .sort((a, b) => {
        const artistCompare = (a.artist?.name || "").localeCompare(
          b.artist?.name || "",
        );
        if (artistCompare !== 0) return artistCompare;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });

    const artistOptions = [
      ...new Set(
        items.map((sticker) => sticker.artist?.name).filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));

    stickerGrid.innerHTML = "";

    const top = document.createElement("div");
    top.className = "catTopRow catTopRowSticky";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn catBack";
    back.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back';
    back.addEventListener("click", () => history.back());

    const title = document.createElement("div");
    title.className = "catTitle";
    title.textContent = "Artist Stickers";

    top.appendChild(back);
    top.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "catGrid";

    function renderGridItems(list) {
      grid.innerHTML = "";
      list.forEach((sticker) => {
        grid.appendChild(buildStickerButton(sticker, { markArtist: true }));
      });
    }

    let artistRow = null;

    if (artistOptions.length) {
      const filterToggle = document.createElement("button");
      filterToggle.type = "button";
      filterToggle.className = "btn catFilterToggle";
      filterToggle.setAttribute("aria-label", "Filter by artist");
      filterToggle.setAttribute("aria-expanded", "false");
      filterToggle.innerHTML = '<i class="fa-solid fa-sliders"></i>';

      top.appendChild(filterToggle);

      artistRow = document.createElement("div");
      artistRow.className = "catTagFilterRow hidden";

      const artistList = document.createElement("div");
      artistList.className = "catTagFilterList";

      const showMoreButton = document.createElement("button");
      showMoreButton.type = "button";
      showMoreButton.className = "catTagShowMore";
      showMoreButton.textContent = "Show all artists ↓";

      function createArtistChip(artistName) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "catTagFilterChip";
        chip.textContent = artistName;

        chip.addEventListener("click", () => {
          const isActive = chip.classList.contains("active");

          artistList
            .querySelectorAll(".catTagFilterChip")
            .forEach((el) => el.classList.remove("active"));

          if (isActive) {
            renderGridItems(items);
          } else {
            chip.classList.add("active");

            renderGridItems(
              items.filter((sticker) => sticker.artist?.name === artistName),
            );
          }

          resetScroll();
        });

        return chip;
      }

      artistOptions.forEach((artistName) => {
        artistList.appendChild(createArtistChip(artistName));
      });

      artistRow.appendChild(artistList);
      artistRow.appendChild(showMoreButton);

      let artistsExpanded = false;

      showMoreButton.addEventListener("click", () => {
        artistsExpanded = !artistsExpanded;

        artistList.classList.toggle("expanded", artistsExpanded);

        showMoreButton.textContent = artistsExpanded
          ? "Show fewer ↑"
          : "Show all artists ↓";

        resetScroll();
      });

      filterToggle.addEventListener("click", () => {
        const isHidden = artistRow.classList.toggle("hidden");

        filterToggle.setAttribute("aria-expanded", isHidden ? "false" : "true");

        if (!isHidden) {
          requestAnimationFrame(() => {
            const hasMoreArtists =
              artistList.scrollHeight > artistList.clientHeight + 1;

            showMoreButton.style.display = hasMoreArtists ? "" : "none";
          });
        }

        resetScroll();
      });
    }

    renderGridItems(items);

    stickerGrid.appendChild(top);
    if (artistRow) stickerGrid.appendChild(artistRow);
    stickerGrid.appendChild(grid);
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

    const strip = document.getElementById("featuredStrip");

    if (strip) {
      strip.classList.add("hidden");
    }

    const items = data.activeStickers
      .filter(
        (sticker) =>
          sticker.primaryCategory === category ||
          sticker.secondaryCategory === category,
      )
      .slice()
      .sort((a, b) => {
        const artistRank = (s) => (s.artistId ? 0 : 1);
        const rankDiff = artistRank(a) - artistRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });

    const tagCounts = new Map();

    items.forEach((sticker) => {
      (sticker.tags || []).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // console.warn("ALL TAG COUNTS", [...tagCounts.entries()]);
    // console.warn(
    //   "QUALIFYING TAGS",
    //   [...tagCounts.entries()].filter(([, count]) => count >= 6),
    // );

    const tagOptions = [...tagCounts.entries()]
      .filter(([, count]) => count >= 6 && count < items.length)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag]) => tag);

    stickerGrid.innerHTML = "";

    const top = document.createElement("div");
    top.className = "catTopRow catTopRowSticky";

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

    function renderGridItems(list) {
      grid.innerHTML = "";
      list.forEach((sticker) => {
        grid.appendChild(buildStickerButton(sticker, { markArtist: true }));
      });
    }

    let tagRow = null;

    if (tagOptions.length) {
      const filterToggle = document.createElement("button");
      filterToggle.type = "button";
      filterToggle.className = "btn catFilterToggle";
      filterToggle.setAttribute("aria-label", "Filter this category by tag");
      filterToggle.setAttribute("aria-expanded", "false");
      filterToggle.innerHTML = '<i class="fa-solid fa-sliders"></i>';

      top.appendChild(filterToggle);

      tagRow = document.createElement("div");
      tagRow.className = "catTagFilterRow hidden";

      const tagList = document.createElement("div");
      tagList.className = "catTagFilterList";

      const showMoreButton = document.createElement("button");
      showMoreButton.type = "button";
      showMoreButton.className = "catTagShowMore";
      showMoreButton.textContent = "Show all tags ↓";

      function createTagChip(tag) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "catTagFilterChip";
        chip.textContent = tag;

        chip.addEventListener("click", () => {
          const isActive = chip.classList.contains("active");

          tagList
            .querySelectorAll(".catTagFilterChip")
            .forEach((el) => el.classList.remove("active"));

          if (isActive) {
            renderGridItems(items);
          } else {
            chip.classList.add("active");

            renderGridItems(
              items.filter((sticker) => (sticker.tags || []).includes(tag)),
            );
          }

          resetScroll();
        });

        return chip;
      }

      tagOptions.forEach((tag) => {
        tagList.appendChild(createTagChip(tag));
      });

      tagRow.appendChild(tagList);
      tagRow.appendChild(showMoreButton);

      let tagsExpanded = false;

      showMoreButton.addEventListener("click", () => {
        tagsExpanded = !tagsExpanded;

        tagList.classList.toggle("expanded", tagsExpanded);

        showMoreButton.textContent = tagsExpanded
          ? "Show fewer ↑"
          : "Show all tags ↓";

        resetScroll();
      });

      filterToggle.addEventListener("click", () => {
        const isHidden = tagRow.classList.toggle("hidden");

        filterToggle.setAttribute("aria-expanded", isHidden ? "false" : "true");

        // Once the filter panel is actually visible, check whether
        // there are more than two rows of tags.
        if (!isHidden) {
          requestAnimationFrame(() => {
            const hasMoreTags = tagList.scrollHeight > tagList.clientHeight + 1;

            showMoreButton.style.display = hasMoreTags ? "" : "none";
          });
        }

        resetScroll();
      });
    }

    renderGridItems(items);

    stickerGrid.appendChild(top);
    if (tagRow) stickerGrid.appendChild(tagRow);
    stickerGrid.appendChild(grid);
    resetScroll();
  }

  window.DailyStickyStickerPickerV2 = {
    renderTabs,
    renderCategoriesForTab,
    renderStickersForCategory,
    renderStickersForArtist,
    renderAllArtistStickers,
    renderSearchForQuery,
  };
})();

(function () {
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
        img.draggable = false;
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
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

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
        queueWeeklyRecapPromptIfSunday(selectedDayKey);
        openNoteModal();
      });

      const img = document.createElement("img");
      img.alt = sticker.label || sticker.id;
      img.loading = "lazy";
      img.src = `./stickers/${sticker.file}`;
      img.draggable = false;
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
        items: items
          .slice()
          .sort((a, b) =>
            a.id.localeCompare(b.id, undefined, { numeric: true }),
          ),
      }));
  }

  window.DailyStickyStickerPicker = {
    renderCategories: renderStickerCategories,
    renderStickersForCategory,
    getGroups,
  };
})();

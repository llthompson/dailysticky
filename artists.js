(function () {
  const MAX_SAMPLE_STICKERS = 4;

  const directoryEl = document.getElementById("artistDirectory");
  const emptyEl = document.getElementById("artistDirectoryEmpty");

  function buildArtistCard(artist, sampleStickers) {
    const card = document.createElement("div");
    card.className = "artistCard";

    const name = document.createElement("h2");
    name.className = "artistCardName";

    const nameLink = document.createElement("a");
    nameLink.href = `/artist-profile.html?id=${encodeURIComponent(artist.id)}`;
    nameLink.textContent = artist.name;
    name.appendChild(nameLink);
    card.appendChild(name);

    const stickerRow = document.createElement("div");
    stickerRow.className = "artistCardStickerRow";

    sampleStickers.forEach((sticker) => {
      const img = document.createElement("img");
      img.src = `./stickers/${sticker.file}`;
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      stickerRow.appendChild(img);
    });

    card.appendChild(stickerRow);

    if (artist.storeUrl) {
      const shopWrap = document.createElement("div");
      shopWrap.className = "artistCardShop";

      const shopLink = document.createElement("a");
      shopLink.className = "artistCardShopLink";
      shopLink.href = artist.storeUrl;
      shopLink.target = "_blank";
      shopLink.rel = "noopener noreferrer";
      shopLink.textContent = "Shop \u2192";

      shopWrap.appendChild(shopLink);
      card.appendChild(shopWrap);
    }

    return card;
  }

  async function init() {
    let data;

    try {
      data = await DailyStickyStickerData.load();
    } catch (error) {
      console.error("Could not load sticker data for artist directory:", error);
      emptyEl.classList.remove("hidden");
      return;
    }

    const samplesByArtistId = new Map();

    data.activeStickers.forEach((sticker) => {
      if (!sticker.artistId) return;

      if (!samplesByArtistId.has(sticker.artistId)) {
        samplesByArtistId.set(sticker.artistId, []);
      }

      const samples = samplesByArtistId.get(sticker.artistId);
      if (samples.length < MAX_SAMPLE_STICKERS) {
        samples.push(sticker);
      }
    });

    const artistsWithStickers = data.artists.filter((artist) =>
      samplesByArtistId.has(artist.id),
    );

    if (!artistsWithStickers.length) {
      emptyEl.classList.remove("hidden");
      return;
    }

    directoryEl.innerHTML = "";

    artistsWithStickers.forEach((artist) => {
      directoryEl.appendChild(
        buildArtistCard(artist, samplesByArtistId.get(artist.id)),
      );
    });
  }

  init();
})();

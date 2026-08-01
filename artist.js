(function () {
  const artistNotFoundEl = document.getElementById("artistNotFound");
  const artistContentEl = document.getElementById("artistContent");
  const artistNameEl = document.getElementById("artistName");
  const artistBioEl = document.getElementById("artistBio");
  const artistLinksEl = document.getElementById("artistLinks");
  const artistStickerHeadingEl = document.getElementById(
    "artistStickerHeading",
  );
  const artistStickerCountEl = document.getElementById("artistStickerCount");
  const artistGalleryEl = document.getElementById("artistGallery");

  function getArtistIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  function buildLinkButton(url, label, isPrimary) {
    const a = document.createElement("a");
    a.className = isPrimary ? "menu-item artistLinkPrimary" : "menu-item";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    return a;
  }

  function renderArtistLinks(artist) {
    artistLinksEl.innerHTML = "";

    if (artist.storeUrl) {
      artistLinksEl.appendChild(
        buildLinkButton(artist.storeUrl, `Shop ${artist.name}'s Sticker Store!`, true),
      );
    }

    (artist.links || []).forEach((link) => {
      artistLinksEl.appendChild(buildLinkButton(link.url, link.label, false));
    });
  }

  function renderGallery(stickers) {
    artistGalleryEl.innerHTML = "";

    stickers
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      .forEach((sticker) => {
        const tile = document.createElement("div");
        tile.className = "artistStickerTile";

        const img = document.createElement("img");
        img.src = `./stickers/${sticker.file}`;
        img.alt = sticker.label || sticker.id;
        img.loading = "lazy";

        const label = document.createElement("div");
        label.className = "stickerLabel";
        label.textContent = sticker.label || sticker.id;

        tile.appendChild(img);
        tile.appendChild(label);
        artistGalleryEl.appendChild(tile);
      });
  }

  async function init() {
    const artistId = getArtistIdFromUrl();

    if (!artistId) {
      artistNotFoundEl.classList.remove("hidden");
      return;
    }

    let data;

    try {
      data = await DailyStickyStickerData.load();
    } catch (error) {
      console.error("Could not load sticker data for artist page:", error);
      artistNotFoundEl.classList.remove("hidden");
      return;
    }

    const artist = data.artistById.get(artistId);

    if (!artist) {
      artistNotFoundEl.classList.remove("hidden");
      return;
    }

    const stickers = data.activeStickers.filter(
      (sticker) => sticker.artistId === artistId,
    );

    artistNameEl.textContent = artist.name;

    if (artist.bio) {
      artistBioEl.textContent = artist.bio;
      artistBioEl.classList.remove("hidden");
    }

    renderArtistLinks(artist);

    artistStickerHeadingEl.textContent = `Stickers by ${artist.name}`;
    artistStickerCountEl.textContent =
      stickers.length === 1 ? "1 sticker" : `${stickers.length} stickers`;

    renderGallery(stickers);

    artistContentEl.classList.remove("hidden");
  }

  init();
})();

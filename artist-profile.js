(function () {
  const artistNotFoundEl = document.getElementById("artistNotFound");
  const artistContentEl = document.getElementById("artistContent");
  const artistNameEl = document.getElementById("artistName");
  const artistBioEl = document.getElementById("artistBio");
  const artistLinksEl = document.getElementById("artistLinks");
  const artistNameBannerEl = document.getElementById("artistNameBanner");
  const artistStickerHeadingEl = document.getElementById(
    "artistStickerHeading",
  );
  const artistStickerCountEl = document.getElementById("artistStickerCount");
  const artistGalleryEl = document.getElementById("artistGallery");

  function getArtistIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  }

  const ARMED_STICKER_STORAGE_KEY = "dailySticky.armedSticker.v1";

  function armStickerAndGoToCalendar(sticker) {
    try {
      localStorage.setItem(
        ARMED_STICKER_STORAGE_KEY,
        JSON.stringify({ stickerId: sticker.id }),
      );
    } catch (error) {
      console.error("Could not arm sticker:", error);
    }

    window.location.href = "/";
  }

function buildLinkButton(url, label, isPrimary, artistSlug) {
    const a = document.createElement("a");
    a.className = isPrimary ? "menu-item artistLinkPrimary" : "menu-item";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;

    if (isPrimary) {
      a.addEventListener("click", () => {
        let destinationDomain = "";
        try {
          destinationDomain = new URL(url).hostname;
        } catch {}

        DailyStickyAnalytics.trackEvent("artist_shop_clicked", {
          artist_slug: artistSlug,
          destination_domain: destinationDomain,
        });
      });
    }

    return a;
  }

  function renderArtistLinks(artist) {
    artistLinksEl.innerHTML = "";

    if (artist.storeUrl) {
      artistLinksEl.appendChild(
        buildLinkButton(
          artist.storeUrl,
          `Shop ${artist.name}'s Art!`,
          true,
          artist.id,
        ),
      );
    }

    (artist.links || []).forEach((link) => {
      artistLinksEl.appendChild(
        buildLinkButton(link.url, link.label, false, artist.id),
      );
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
        img.draggable = false;

        const label = document.createElement("div");
        label.className = "stickerLabel";
        label.textContent = sticker.label || sticker.id;

        tile.appendChild(img);
        tile.appendChild(label);

        tile.setAttribute("role", "button");
        tile.setAttribute("tabindex", "0");
        tile.addEventListener("click", () =>
          armStickerAndGoToCalendar(sticker),
        );
        tile.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          armStickerAndGoToCalendar(sticker);
        });

        if (sticker.artist) {
          const badge = document.createElement("div");
          badge.className = "stickerArtistBadge";
          badge.textContent = sticker.artist.name;
          tile.appendChild(badge);
        }

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

    DailyStickyAnalytics.trackEvent("artist_profile_viewed", {
      artist_slug: artist.id,
    });

    const stickers = data.activeStickers.filter(
      (sticker) => sticker.artistId === artistId,
    );

    artistNameEl.textContent = artist.name;

    if (artist.storeUrl) {
      artistNameBannerEl.href = artist.storeUrl;
    } else {
      artistNameBannerEl.removeAttribute("href");
    }

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

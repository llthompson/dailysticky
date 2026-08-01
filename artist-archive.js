(function () {
  const directoryEl = document.getElementById("artistDirectory");
  const emptyEl = document.getElementById("artistDirectoryEmpty");

  function buildArtistCard(artist, stickerCount) {
    const card = document.createElement("a");
    card.className = "artistCard";
    card.href = `/artist.html?id=${encodeURIComponent(artist.id)}`;

    const name = document.createElement("div");
    name.className = "artistCardName";
    name.textContent = artist.name;
    card.appendChild(name);

    if (artist.bio) {
      const bio = document.createElement("div");
      bio.className = "artistCardBio";
      bio.textContent = artist.bio;
      card.appendChild(bio);
    }

    const count = document.createElement("div");
    count.className = "artistCardCount";
    count.textContent =
      stickerCount === 1 ? "1 sticker" : `${stickerCount} stickers`;
    card.appendChild(count);

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

    const countsByArtistId = new Map();

    data.activeStickers.forEach((sticker) => {
      if (!sticker.artistId) return;
      countsByArtistId.set(
        sticker.artistId,
        (countsByArtistId.get(sticker.artistId) || 0) + 1,
      );
    });

    const artistsWithStickers = data.artists.filter((artist) =>
      countsByArtistId.has(artist.id),
    );

    if (!artistsWithStickers.length) {
      emptyEl.classList.remove("hidden");
      return;
    }

    directoryEl.innerHTML = "";

    artistsWithStickers.forEach((artist) => {
      directoryEl.appendChild(
        buildArtistCard(artist, countsByArtistId.get(artist.id)),
      );
    });
  }

  init();
})();
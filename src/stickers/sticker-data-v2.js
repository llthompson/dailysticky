(function () {
  const SQL_JS_BASE_URL = "/vendor/sql.js";
  const DEMO_MODE_KEY = "dailySticky.demoMode";

  function isDemoMode() {
    const params = new URLSearchParams(window.location.search);
    const demoParam = params.get("demo");

    if (demoParam === "off") {
      sessionStorage.removeItem(DEMO_MODE_KEY);
      return false;
    }

    if (params.has("demo")) {
      sessionStorage.setItem(DEMO_MODE_KEY, "1");
      return true;
    }

    return sessionStorage.getItem(DEMO_MODE_KEY) === "1";
  }

  const DATABASE_URL = isDemoMode() ? "/src/legacy/stickers-demo.db" : "/data/stickers.db";

  // https://dailysticky.app/?demo
  // https://dailysticky.app/?demo=off
  // http://127.0.0.1:5500/?demo
  // http://localhost:8000/?demo

  const FEELING_CATEGORY_ORDER = [
    "Joy & Fun",
    "Calm & Peace",
    "Love & Connection",
    "Sad & Down",
    "Stressed & Anxious",
    "Angry & Frustrated",
    "Tired & Drained",
    "Confused & Mixed",
  ];

  const WORLD_CATEGORY_ORDER = [
    "People & Body",
    "Animals & Nature",
    "Food & Drink",
    "Travel & Places",
    "Activities",
    "Objects",
  ];

  const TAB_DEFINITIONS = [
    {
      id: "feelings",
      label: "My Feelings",
      categories: FEELING_CATEGORY_ORDER,
    },
    {
      id: "world",
      label: "My World",
      categories: WORLD_CATEGORY_ORDER,
    },
  ];

  let sqlJsPromise = null;
  let stickerDataPromise = null;

  function loadSqlJs() {
    if (window.initSqlJs) {
      return Promise.resolve(window.initSqlJs);
    }

    if (sqlJsPromise) return sqlJsPromise;

    sqlJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${SQL_JS_BASE_URL}/sql-wasm.js`;
      script.async = true;

      script.addEventListener("load", () => {
        if (!window.initSqlJs) {
          reject(new Error("SQLite loaded, but initSqlJs is unavailable."));
          return;
        }

        resolve(window.initSqlJs);
      });

      script.addEventListener("error", () => {
        reject(new Error("Could not load the SQLite browser library."));
      });

      document.head.appendChild(script);
    });

    return sqlJsPromise;
  }

  function rowsFromResult(result) {
    if (!result.length) return [];

    const { columns, values } = result[0];

    return values.map((valuesRow) =>
      Object.fromEntries(
        columns.map((column, index) => [column, valuesRow[index]]),
      ),
    );
  }

  function queryRows(database, sql, params = []) {
    return rowsFromResult(database.exec(sql, params));
  }

  function naturalCompare(left, right) {
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function getDailyRotationIndex(count) {
    const now = new Date();

    // Date.UTC on local Y/M/D gives a day number that only advances at
    // local midnight, regardless of the visitor's time zone.
    const localMidnightMs = Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const dayNumber = Math.floor(localMidnightMs / 86400000);

    return ((dayNumber % count) + count) % count;
  }

  async function readStickerDatabase() {
    const initSqlJs = await loadSqlJs();

    const SQL = await initSqlJs({
      locateFile: (file) => `${SQL_JS_BASE_URL}/${file}`,
    });

    const response = await fetch(DATABASE_URL, {
      cache: "no-cache",
    });

    if (!response.ok) {
      throw new Error(`Could not load ${DATABASE_URL} (${response.status}).`);
    }

    const databaseBytes = new Uint8Array(await response.arrayBuffer());

    const database = new SQL.Database(databaseBytes);

    try {
      const categoryRows = queryRows(
        database,
        `
          SELECT name, tab
          FROM categories
        `,
      );

      const artistRows = queryRows(
        database,
        `
          SELECT
            id,
            name,
            bio,
            store_url,
            is_featured
          FROM artists
          ORDER BY is_featured DESC, name COLLATE NOCASE
        `,
      );

      const artistLinkRows = queryRows(
        database,
        `
          SELECT artist_id, label, url, sort_order
          FROM artist_links
          ORDER BY artist_id, sort_order
        `,
      );

      const linksByArtistId = new Map();

      artistLinkRows.forEach((row) => {
        if (!linksByArtistId.has(row.artist_id)) {
          linksByArtistId.set(row.artist_id, []);
        }

        linksByArtistId.get(row.artist_id).push({
          label: row.label,
          url: row.url,
        });
      });

      const stickerRows = queryRows(
        database,
        `
          SELECT
            id,
            file,
            name,
            primary_category,
            secondary_category,
            active,
            needs_review,
            artist_id
          FROM stickers
        `,
      );

      const tagRows = queryRows(
        database,
        `
          SELECT sticker_tags.sticker_id, tags.name
          FROM sticker_tags
          JOIN tags ON tags.id = sticker_tags.tag_id
          ORDER BY sticker_tags.sticker_id, sticker_tags.tag_id
        `,
      );

      const tagsByStickerId = new Map();

      tagRows.forEach((row) => {
        if (!tagsByStickerId.has(row.sticker_id)) {
          tagsByStickerId.set(row.sticker_id, []);
        }

        tagsByStickerId.get(row.sticker_id).push(row.name);
      });

      const orderedCategoryNames = [
        ...FEELING_CATEGORY_ORDER,
        ...WORLD_CATEGORY_ORDER,
      ];

      const categories = categoryRows
        .map((row) => ({
          name: row.name,
          tab: row.tab,
        }))
        .sort(
          (left, right) =>
            orderedCategoryNames.indexOf(left.name) -
            orderedCategoryNames.indexOf(right.name),
        );

      const artists = artistRows.map((row) => ({
        id: row.id,
        name: row.name,
        bio: row.bio || "",
        storeUrl: row.store_url || "",
        links: (linksByArtistId.get(row.id) || []).slice(0, 2),
        isFeatured: Boolean(row.is_featured),
      }));

      const artistById = new Map(artists.map((artist) => [artist.id, artist]));

      const stickers = stickerRows
        .map((row) => ({
          id: row.id,
          file: row.file,
          name: row.name || row.id,
          label: row.name || row.id,
          tags: tagsByStickerId.get(row.id) || [],
          primaryCategory: row.primary_category,
          secondaryCategory: row.secondary_category || null,
          active: Boolean(row.active),
          needsReview: Boolean(row.needs_review),
          artistId: row.artist_id || null,
          artist: row.artist_id ? artistById.get(row.artist_id) || null : null,
        }))
        .sort((left, right) => naturalCompare(left.id, right.id));

      const stickerById = new Map(
        stickers.map((sticker) => [sticker.id, sticker]),
      );

      const activeStickers = stickers.filter((sticker) => sticker.active);

      const activeStickerById = new Map(
        activeStickers.map((sticker) => [sticker.id, sticker]),
      );

      const featuredArtists = artists.filter((artist) => artist.isFeatured);

      const featuredArtist = featuredArtists.length
        ? featuredArtists[getDailyRotationIndex(featuredArtists.length)]
        : null;

      const featuredStickers = featuredArtist
        ? activeStickers.filter(
            (sticker) => sticker.artistId === featuredArtist.id,
          )
        : [];

      return {
        tabs: TAB_DEFINITIONS,
        categories,
        artists,
        artistById,
        featuredArtist,
        featuredStickers,
        stickers,
        stickerById,
        activeStickers,
        activeStickerById,
      };
    } finally {
      database.close();
    }
  }

  function load() {
    if (!stickerDataPromise) {
      stickerDataPromise = readStickerDatabase().catch((error) => {
        stickerDataPromise = null;
        throw error;
      });
    }

    return stickerDataPromise;
  }

  window.DailyStickyStickerData = {
    load,
  };
})();

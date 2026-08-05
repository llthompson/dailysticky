function wireNavMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const menuExport = document.getElementById("menuExport");
  const menuImportInput = document.getElementById("menuImportInput");

  if (!menuBtn || !menuDropdown) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle("hidden");
  });

  menuDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    menuDropdown.classList.add("hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menuDropdown.classList.add("hidden");
    }
  });

  hideCurrentPageLink();

  if (menuExport && typeof exportJson === "function") {
    menuExport.addEventListener("click", () => {
      menuDropdown.classList.add("hidden");
      exportJson();
    });
  }

  if (menuImportInput && typeof importJson === "function") {
    menuImportInput.addEventListener("change", importJson);
  }
}

function hideCurrentPageLink() {
  const currentPath = normalizePath(window.location.pathname);
  const menuLinks = document.querySelectorAll("#menuDropdown a[href]");

  menuLinks.forEach((link) => {
    const linkPath = normalizePath(new URL(link.href).pathname);

    if (linkPath === currentPath) {
      link.classList.add("hidden");
    }
  });
}

function normalizePath(path) {
  if (path === "/index.html") return "/";
  if (path.endsWith("/index.html")) return path.replace("index.html", "");
  return path;
}

document.addEventListener("contextmenu", (e) => {
  if (
    e.target.closest(
      ".stickerBtn, .stickerSlot, .miniDay, .catPreview, .featuredStripSticker, .artistStickerTile, .artistCardStickerRow, .note-sticker, .share-sticker-cell",
    )
  ) {
    e.preventDefault();
  }
});

document.addEventListener("DOMContentLoaded", wireNavMenu);

let deferredInstallPrompt = null;

const INSTALL_PROMPT_DISMISSED_KEY =
  "dailySticky.installPromptDismissedUntil.v1";

function isInstallPromptDismissed() {
  const dismissedUntil = Number(
    localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY),
  );

  if (!dismissedUntil) return false;

  return Date.now() < dismissedUntil;
}

function dismissInstallPrompt() {
  const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;

  localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, String(sevenDaysFromNow));

  const installPrompt = document.getElementById("installPrompt");
  if (installPrompt) installPrompt.classList.add("hidden");
}

function isDailyStickyInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function showInstallPromptBanner(options = {}) {
  if (isInstallPromptDismissed()) return;
  if (isDailyStickyInstalled()) return;

  const minStickeredDays = options.minStickeredDays || 0;
  const stickeredDays = Number(options.stickeredDays || 0);
  const isReturningVisitor = options.isReturningVisitor === true;

  if (!isReturningVisitor) return;
  if (stickeredDays < minStickeredDays) return;

  const installPrompt = document.getElementById("installPrompt");
  if (!installPrompt) return;

  installPrompt.classList.remove("hidden");
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  dismissInstallPrompt();
});

const installPromptBtn = document.getElementById("installPromptBtn");

if (installPromptBtn) {
  installPromptBtn.addEventListener("click", async () => {
    const isIOS =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

    if (isIOS) {
      alert(
        "To add Daily Sticky to your Home Screen: tap the Share button in Safari, then tap Add to Home Screen.",
      );
      return;
    }

    if (!deferredInstallPrompt) {
      alert(
        "To add Daily Sticky to your Home Screen, open your browser menu and look for Install App or Add to Home Screen.",
      );
      return;
    }

    deferredInstallPrompt.prompt();

    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;

    dismissInstallPrompt();
  });
}

const dismissInstallPromptBtn = document.getElementById(
  "dismissInstallPromptBtn",
);

if (dismissInstallPromptBtn) {
  dismissInstallPromptBtn.addEventListener("click", dismissInstallPrompt);
}

window.showDailyStickyInstallPrompt = showInstallPromptBanner;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

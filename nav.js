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

document.addEventListener("DOMContentLoaded", wireNavMenu);

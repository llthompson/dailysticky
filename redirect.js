(function () {
  var slug = window.location.pathname.replace(/^\/|\/$/g, "").split("/")[0];
  var target = window.DAILY_STICKY_REDIRECTS && window.DAILY_STICKY_REDIRECTS[slug];
  if (target) {
    window.location.replace(target);
  }
})();
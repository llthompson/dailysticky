/**
 * Daily Sticky analytics helper.
 * Centralizes all GA (via GTM dataLayer) event sends so event names/params
 * stay consistent, analytics stays out of app logic, and privacy + the
 * dev/test opt-out are enforced in one place.
 */
(function () {
  const DISABLE_KEY = "dailySticky.analyticsDisabled.v1";

  function isAnalyticsDisabled() {
    try {
      return localStorage.getItem(DISABLE_KEY) === "1";
    } catch {
      return false;
    }
  }

  // Run DailyStickyAnalytics.setAnalyticsDisabled(true) in the console on
  // dev/testing devices to keep that traffic out of real GA data.
  function setAnalyticsDisabled(disabled) {
    try {
      if (disabled) {
        localStorage.setItem(DISABLE_KEY, "1");
      } else {
        localStorage.removeItem(DISABLE_KEY);
      }
    } catch (error) {
      console.error("Could not update analytics disable flag:", error);
    }
  }

  function trackEvent(eventName, params = {}) {
    if (!eventName || isAnalyticsDisabled()) return;

    window.dataLayer = window.dataLayer || [];

    try {
      window.dataLayer.push({ event: eventName, ...params });
    } catch (error) {
      console.error(`Could not send analytics event "${eventName}":`, error);
    }
  }

  // Fires eventName only the first time it's ever called for storageKey
  // on this browser (e.g. first_sticker_placed).
  function trackOnce(eventName, storageKey, params = {}) {
    try {
      if (localStorage.getItem(storageKey) === "1") return;
      localStorage.setItem(storageKey, "1");
    } catch (error) {
      console.error(`Could not set analytics flag "${storageKey}":`, error);
      return;
    }
    trackEvent(eventName, params);
  }

  window.DailyStickyAnalytics = { trackEvent, trackOnce, isAnalyticsDisabled, setAnalyticsDisabled };
})();
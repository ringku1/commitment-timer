const DEFAULT_BLOCKED_SITES = [
  "youtube.com",
  "reddit.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "x.com",
];

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["blockedSites", "sessions", "stats"], (data) => {
    if (!data.blockedSites) {
      chrome.storage.sync.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    }
    if (!data.sessions) {
      chrome.storage.sync.set({ sessions: [] });
    }
    if (!data.stats) {
      chrome.storage.sync.set({ stats: { totalSessions: 0, keptPromises: 0 } });
    }
  });
});

// Intercept navigation to blocked sites
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // main frame only

  chrome.storage.sync.get(["blockedSites", "activeSessions"], (data) => {
    const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
    const activeSessions = data.activeSessions || {};

    const url = new URL(details.url);
    const hostname = url.hostname.replace("www.", "");

    const isBlocked = blockedSites.some((site) => hostname.includes(site));
    if (!isBlocked) return;

    const hasActiveSession =
      activeSessions[details.tabId] &&
      activeSessions[details.tabId].site === hostname &&
      activeSessions[details.tabId].expiresAt > Date.now();

    if (hasActiveSession) {
      // Already has active session, inject timer widget
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["content/timer-widget.js"],
      });
      chrome.scripting.insertCSS({
        target: { tabId: details.tabId },
        files: ["content/timer-widget.css"],
      });
    } else {
      // No active session, show intercept overlay
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["content/intercept.js"],
      });
      chrome.scripting.insertCSS({
        target: { tabId: details.tabId },
        files: ["content/intercept.css"],
      });
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_SESSION") {
    const { site, intention, durationMins } = message;
    const tabId = sender.tab.id;
    const expiresAt = Date.now() + durationMins * 60 * 1000;

    // Save active session
    chrome.storage.sync.get("activeSessions", (data) => {
      const activeSessions = data.activeSessions || {};
      activeSessions[tabId] = {
        site,
        intention,
        durationMins,
        expiresAt,
        startedAt: Date.now(),
      };
      chrome.storage.sync.set({ activeSessions });
    });

    // Set alarm for when timer expires
    chrome.alarms.create(`session_${tabId}`, { delayInMinutes: durationMins });

    sendResponse({ success: true, expiresAt });
  }

  if (message.type === "GET_SESSION") {
    const tabId = sender.tab.id;
    chrome.storage.sync.get("activeSessions", (data) => {
      const activeSessions = data.activeSessions || {};
      sendResponse({ session: activeSessions[tabId] || null });
    });
    return true;
  }

  if (message.type === "END_SESSION") {
    const { keptPromise } = message;
    const tabId = sender.tab.id;

    chrome.storage.sync.get(["activeSessions", "sessions", "stats"], (data) => {
      const activeSessions = data.activeSessions || {};
      const sessions = data.sessions || [];
      const stats = data.stats || { totalSessions: 0, keptPromises: 0 };
      const session = activeSessions[tabId];

      if (session) {
        const actualMins = Math.round((Date.now() - session.startedAt) / 60000);
        sessions.unshift({
          site: session.site,
          intention: session.intention,
          plannedMins: session.durationMins,
          actualMins,
          keptPromise,
          timestamp: Date.now(),
        });

        stats.totalSessions += 1;
        if (keptPromise) stats.keptPromises += 1;

        delete activeSessions[tabId];

        chrome.storage.sync.set({
          activeSessions,
          sessions: sessions.slice(0, 100),
          stats,
        });
      }

      sendResponse({ success: true });
    });

    return true;
  }

  return true;
});

// Handle alarm firing (timer expired)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("session_")) return;
  const tabId = parseInt(alarm.name.replace("session_", ""));

  // Inject guilt screen
  chrome.scripting
    .executeScript({
      target: { tabId },
      func: () => {
        window.dispatchEvent(new CustomEvent("COMMITMENT_TIMER_EXPIRED"));
      },
    })
    .catch(() => {}); // tab might be closed
});

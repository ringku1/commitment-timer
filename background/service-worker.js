const DEFAULT_BLOCKED_SITES = [
  "youtube.com",
  "reddit.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "x.com",
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["blockedSites", "sessions", "stats"], (data) => {
    if (!data.blockedSites)
      chrome.storage.sync.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    if (!data.sessions) chrome.storage.sync.set({ sessions: [] });
    if (!data.stats)
      chrome.storage.sync.set({
        stats: {
          totalSessions: 0,
          keptPromises: 0,
          currentStreak: 0,
          bestStreak: 0,
        },
      });
  });
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;

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
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["content/timer-widget.js"],
      });
      chrome.scripting.insertCSS({
        target: { tabId: details.tabId },
        files: ["content/timer-widget.css"],
      });
    } else {
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_SESSION") {
    const { site, intention, durationMins } = message;
    const tabId = sender.tab.id;
    const expiresAt = Date.now() + durationMins * 60 * 1000;

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
      const stats = data.stats || {
        totalSessions: 0,
        keptPromises: 0,
        currentStreak: 0,
        bestStreak: 0,
      };
      const session = activeSessions[tabId];

      if (session) {
        const actualMins = Math.round((Date.now() - session.startedAt) / 60000);
        const today = new Date().toDateString();

        sessions.unshift({
          site: session.site,
          intention: session.intention,
          plannedMins: session.durationMins,
          actualMins,
          keptPromise,
          timestamp: Date.now(),
          date: today,
        });

        stats.totalSessions += 1;
        if (keptPromise) stats.keptPromises += 1;

        // --- STREAK CALCULATION ---
        stats.currentStreak = calculateStreak(sessions);
        if (stats.currentStreak > (stats.bestStreak || 0)) {
          stats.bestStreak = stats.currentStreak;
        }

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

function calculateStreak(sessions) {
  if (!sessions.length) return 0;

  // Group sessions by date, check if each day had at least one kept promise
  const dayMap = {};
  sessions.forEach((s) => {
    const d = s.date || new Date(s.timestamp).toDateString();
    if (!dayMap[d]) dayMap[d] = false;
    if (s.keptPromise) dayMap[d] = true;
  });

  // Build sorted list of days (most recent first)
  const days = Object.keys(dayMap).sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < days.length; i++) {
    const dayDate = new Date(days[i]);
    dayDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((checkDate - dayDate) / 86400000);

    if (diffDays > 1) break; // gap in days, streak broken
    if (!dayMap[days[i]]) break; // that day had no kept promise

    streak++;
    checkDate = dayDate;
  }

  return streak;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("session_")) return;
  const tabId = parseInt(alarm.name.replace("session_", ""));

  chrome.scripting
    .executeScript({
      target: { tabId },
      func: () => {
        window.dispatchEvent(new CustomEvent("COMMITMENT_TIMER_EXPIRED"));
      },
    })
    .catch(() => {});
});

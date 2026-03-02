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

// Use onHistoryStateUpdated for SPAs (YouTube) + onCommitted for normal pages
function handleNavigation(details) {
  if (details.frameId !== 0) return;

  // Small delay to let storage catch up — fixes race condition on refresh
  setTimeout(() => {
    chrome.storage.sync.get(
      ["blockedSites", "activeSessions", "cooldowns", "extensionEnabled"],
      (data) => {
        // Respect enable/disable toggle
        if (data.extensionEnabled === false) return;

        const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
        const activeSessions = data.activeSessions || {};
        const cooldowns = data.cooldowns || {};

        let url;
        try {
          url = new URL(details.url);
        } catch {
          return;
        }
        const hostname = url.hostname.replace("www.", "");

        const isBlocked = blockedSites.some((site) => hostname.includes(site));
        if (!isBlocked) return;

        // Check cooldown
        if (cooldowns[hostname] && cooldowns[hostname] > Date.now()) {
          chrome.scripting
            .executeScript({
              target: { tabId: details.tabId },
              files: ["content/intercept.js"],
            })
            .catch(() => {});
          chrome.scripting
            .insertCSS({
              target: { tabId: details.tabId },
              files: ["content/intercept.css"],
            })
            .catch(() => {});
          return;
        }

        // Check active session — key fix: also check by hostname not just tabId
        const tabSession = activeSessions[details.tabId];
        const hasActiveSession =
          tabSession &&
          tabSession.site === hostname &&
          tabSession.expiresAt > Date.now();

        if (hasActiveSession) {
          // Already committed — inject timer widget
          chrome.scripting
            .executeScript({
              target: { tabId: details.tabId },
              files: ["content/timer-widget.js"],
            })
            .catch(() => {});
          chrome.scripting
            .insertCSS({
              target: { tabId: details.tabId },
              files: ["content/timer-widget.css"],
            })
            .catch(() => {});
        } else {
          // No active session — show intercept
          chrome.scripting
            .executeScript({
              target: { tabId: details.tabId },
              files: ["content/intercept.js"],
            })
            .catch(() => {});
          chrome.scripting
            .insertCSS({
              target: { tabId: details.tabId },
              files: ["content/intercept.css"],
            })
            .catch(() => {});
        }
      },
    );
  }, 100); // 100ms delay fixes race condition
}

// Handle both regular navigation and SPA navigation (YouTube)
chrome.webNavigation.onCommitted.addListener(handleNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleNavigation);

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
        snoozeCount: 0,
      };
      chrome.storage.sync.set({ activeSessions });
    });

    chrome.alarms.create(`session_${tabId}`, { delayInMinutes: durationMins });
    sendResponse({ success: true, expiresAt });
  }

  if (message.type === "GET_SESSION") {
    const tabId = sender.tab.id;
    chrome.storage.sync.get(["activeSessions", "cooldowns"], (data) => {
      const activeSessions = data.activeSessions || {};
      const cooldowns = data.cooldowns || {};
      sendResponse({ session: activeSessions[tabId] || null, cooldowns });
    });
    return true;
  }

  if (message.type === "SNOOZE_SESSION") {
    const { extraMins } = message;
    const tabId = sender.tab.id;

    chrome.storage.sync.get("activeSessions", (data) => {
      const activeSessions = data.activeSessions || {};
      const session = activeSessions[tabId];

      if (session) {
        session.expiresAt = Date.now() + extraMins * 60 * 1000;
        session.snoozeCount = (session.snoozeCount || 0) + 1;
        activeSessions[tabId] = session;
        chrome.storage.sync.set({ activeSessions });

        chrome.alarms.clear(`session_${tabId}`, () => {
          chrome.alarms.create(`session_${tabId}`, {
            delayInMinutes: extraMins,
          });
        });

        sendResponse({
          success: true,
          expiresAt: session.expiresAt,
          snoozeCount: session.snoozeCount,
        });
      }
    });
    return true;
  }

  if (message.type === "END_SESSION") {
    const { keptPromise } = message;
    const tabId = sender.tab.id;

    chrome.storage.sync.get(
      ["activeSessions", "sessions", "stats", "cooldowns"],
      (data) => {
        const activeSessions = data.activeSessions || {};
        const sessions = data.sessions || [];
        const stats = data.stats || {
          totalSessions: 0,
          keptPromises: 0,
          currentStreak: 0,
          bestStreak: 0,
        };
        const cooldowns = data.cooldowns || {};
        const session = activeSessions[tabId];

        if (session) {
          const actualMins = Math.round(
            (Date.now() - session.startedAt) / 60000,
          );
          const today = new Date().toDateString();

          sessions.unshift({
            site: session.site,
            intention: session.intention,
            plannedMins: session.durationMins,
            actualMins,
            keptPromise,
            snoozeCount: session.snoozeCount || 0,
            timestamp: Date.now(),
            date: today,
          });

          stats.totalSessions += 1;
          if (keptPromise) {
            stats.keptPromises += 1;
          } else {
            // ❄️ Cooldown penalty
            cooldowns[session.site] = Date.now() + 10 * 60 * 1000;
            chrome.alarms.create(`cooldown_${session.site}`, {
              delayInMinutes: 10,
            });
          }

          stats.currentStreak = calculateStreak(sessions);
          if (stats.currentStreak > (stats.bestStreak || 0)) {
            stats.bestStreak = stats.currentStreak;
          }

          delete activeSessions[tabId];
          chrome.storage.sync.set({
            activeSessions,
            sessions: sessions.slice(0, 100),
            stats,
            cooldowns,
          });
        }

        sendResponse({ success: true });
      },
    );
    return true;
  }

  if (message.type === "GET_COOLDOWN") {
    const { site } = message;
    chrome.storage.sync.get("cooldowns", (data) => {
      const cooldowns = data.cooldowns || {};
      sendResponse({ expiresAt: cooldowns[site] || null });
    });
    return true;
  }

  return true;
});

function calculateStreak(sessions) {
  if (!sessions.length) return 0;

  const dayMap = {};
  sessions.forEach((s) => {
    const d = s.date || new Date(s.timestamp).toDateString();
    if (!dayMap[d]) dayMap[d] = false;
    if (s.keptPromise) dayMap[d] = true;
  });

  const days = Object.keys(dayMap).sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < days.length; i++) {
    const dayDate = new Date(days[i]);
    dayDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((checkDate - dayDate) / 86400000);
    if (diffDays > 1) break;
    if (!dayMap[days[i]]) break;
    streak++;
    checkDate = dayDate;
  }

  return streak;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("cooldown_")) {
    const site = alarm.name.replace("cooldown_", "");
    chrome.storage.sync.get("cooldowns", (data) => {
      const cooldowns = data.cooldowns || {};
      delete cooldowns[site];
      chrome.storage.sync.set({ cooldowns });
    });
  }

  if (alarm.name.startsWith("session_")) {
    const tabId = parseInt(alarm.name.replace("session_", ""));
    chrome.scripting
      .executeScript({
        target: { tabId },
        func: () => {
          window.dispatchEvent(new CustomEvent("COMMITMENT_TIMER_EXPIRED"));
        },
      })
      .catch(() => {});
  }
});

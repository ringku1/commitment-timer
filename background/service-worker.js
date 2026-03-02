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

function handleNavigation(details) {
  if (details.frameId !== 0) return;

  setTimeout(() => {
    chrome.storage.sync.get(
      ["blockedSites", "activeSessions", "cooldowns", "extensionEnabled"],
      (data) => {
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

        const tabSession = activeSessions[details.tabId];
        const hasActiveSession =
          tabSession &&
          tabSession.site === hostname &&
          tabSession.expiresAt > Date.now();

        if (hasActiveSession) {
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
  }, 100);
}

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

    // Alarm 1 — timer expires at committed time
    chrome.alarms.create(`session_${tabId}`, { delayInMinutes: durationMins });

    // Alarm 2 — overstay check at 2x committed time
    chrome.alarms.create(`overstay_${tabId}`, {
      delayInMinutes: durationMins * 2,
    });

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

        // Reset session alarm
        chrome.alarms.clear(`session_${tabId}`, () => {
          chrome.alarms.create(`session_${tabId}`, {
            delayInMinutes: extraMins,
          });
        });

        // Reset overstay alarm to 2x new time
        chrome.alarms.clear(`overstay_${tabId}`, () => {
          chrome.alarms.create(`overstay_${tabId}`, {
            delayInMinutes: extraMins * 2,
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

    // Cancel overstay alarm — user ended session manually
    chrome.alarms.clear(`overstay_${tabId}`);

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

function autoBreakSession(tabId) {
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

      // Session already ended manually — do nothing
      if (!session) return;

      const actualMins = Math.round((Date.now() - session.startedAt) / 60000);
      const today = new Date().toDateString();

      // Auto mark as BROKE
      sessions.unshift({
        site: session.site,
        intention: session.intention,
        plannedMins: session.durationMins,
        actualMins,
        keptPromise: false,
        snoozeCount: session.snoozeCount || 0,
        autoBreak: true, // flag so we know it was automatic
        timestamp: Date.now(),
        date: today,
      });

      stats.totalSessions += 1;

      // Apply cooldown
      cooldowns[session.site] = Date.now() + 10 * 60 * 1000;
      chrome.alarms.create(`cooldown_${session.site}`, { delayInMinutes: 10 });

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

      // Notify the tab — show overstay message then redirect
      chrome.scripting
        .executeScript({
          target: { tabId },
          func: (site) => {
            // Remove any existing widgets
            const w = document.getElementById("ct-widget");
            const g = document.getElementById("ct-guilt");
            if (w) w.remove();
            if (g) g.remove();

            // Show overstay overlay
            const overlay = document.createElement("div");
            overlay.style.cssText = `
          position:fixed;inset:0;background:rgba(7,11,20,0.98);
          display:flex;align-items:center;justify-content:center;
          z-index:9999999;font-family:sans-serif;flex-direction:column;
          gap:12px;text-align:center;padding:20px;
        `;
            overlay.innerHTML = `
          <div style="font-size:52px">⏱️</div>
          <div style="font-size:24px;font-weight:800;color:#fff">Overstay Detected</div>
          <div style="font-size:15px;color:#7aa0c0;max-width:400px;line-height:1.6">
            You stayed on <strong style="color:#06b6d4">${site}</strong> for
            more than <strong style="color:#ef4444">2x your committed time.</strong><br/>
            This has been automatically marked as a broken promise.
          </div>
          <div style="background:#2a0a0a;border:1px solid #ef4444;border-radius:10px;
            padding:12px 24px;font-size:14px;color:#ef4444;margin-top:8px">
            ❄️ Site locked for 10 minutes as a consequence.
          </div>
          <div style="font-size:13px;color:#334d6a;margin-top:8px">Redirecting in <span id="ct-countdown">5</span>s...</div>
        `;
            document.body.innerHTML = "";
            document.body.appendChild(overlay);

            let count = 5;
            const interval = setInterval(() => {
              count--;
              const el = document.getElementById("ct-countdown");
              if (el) el.textContent = count;
              if (count <= 0) {
                clearInterval(interval);
                window.location.reload();
              }
            }, 1000);
          },
          args: [session.site],
        })
        .catch(() => {});
    },
  );
}

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
  // Cooldown expired — unlock site
  if (alarm.name.startsWith("cooldown_")) {
    const site = alarm.name.replace("cooldown_", "");
    chrome.storage.sync.get("cooldowns", (data) => {
      const cooldowns = data.cooldowns || {};
      delete cooldowns[site];
      chrome.storage.sync.set({ cooldowns });
    });
  }

  // Session timer expired — show guilt screen
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

  // ⏱️ Overstay detected — auto break
  if (alarm.name.startsWith("overstay_")) {
    const tabId = parseInt(alarm.name.replace("overstay_", ""));
    autoBreakSession(tabId);
  }
});

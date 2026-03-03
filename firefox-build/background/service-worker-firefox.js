const DEFAULT_BLOCKED_SITES = [
  "youtube.com",
  "reddit.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "x.com",
];

browser.runtime.onInstalled.addListener(() => {
  browser.storage.sync
    .get(["blockedSites", "sessions", "stats"])
    .then((data) => {
      if (!data.blockedSites)
        browser.storage.sync.set({ blockedSites: DEFAULT_BLOCKED_SITES });
      if (!data.sessions) browser.storage.sync.set({ sessions: [] });
      if (!data.stats)
        browser.storage.sync.set({
          stats: {
            totalSessions: 0,
            keptPromises: 0,
            currentStreak: 0,
            bestStreak: 0,
          },
        });
    });
});

function injectIntercept(tabId) {
  browser.tabs
    .insertCSS(tabId, { file: "content/intercept.css" })
    .catch(() => {});
  browser.tabs
    .executeScript(tabId, { file: "content/intercept.js" })
    .catch(() => {});
}

function injectWidget(tabId) {
  browser.tabs
    .insertCSS(tabId, { file: "content/timer-widget.css" })
    .catch(() => {});
  browser.tabs
    .executeScript(tabId, { file: "content/timer-widget.js" })
    .catch(() => {});
}

function handleNavigation(details) {
  if (details.frameId !== 0) return;

  setTimeout(() => {
    browser.storage.sync
      .get(["blockedSites", "activeSessions", "cooldowns", "extensionEnabled"])
      .then((data) => {
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

        if (cooldowns[hostname] && cooldowns[hostname] > Date.now()) {
          injectIntercept(details.tabId);
          return;
        }

        const tabSession = activeSessions[details.tabId];
        const hasActiveSession =
          tabSession &&
          tabSession.site === hostname &&
          tabSession.expiresAt > Date.now();

        if (hasActiveSession) {
          injectWidget(details.tabId);
        } else {
          injectIntercept(details.tabId);
        }
      });
  }, 100);
}

browser.webNavigation.onCommitted.addListener(handleNavigation);
browser.webNavigation.onHistoryStateUpdated.addListener(handleNavigation);

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

function showNotification(notifId, title, message) {
  browser.notifications.create(notifId, {
    type: "basic",
    iconUrl: browser.runtime.getURL("assets/icon128.png"),
    title,
    message,
    priority: 2,
  });
}

browser.notifications.onClicked.addListener((notifId) => {
  browser.notifications.clear(notifId);
  if (notifId.startsWith("session_") || notifId.startsWith("warning_")) {
    const tabId = parseInt(
      notifId.replace("session_", "").replace("warning_", ""),
    );
    browser.tabs.update(tabId, { active: true }).then((tab) => {
      if (tab && tab.windowId) {
        browser.windows.update(tab.windowId, { focused: true });
      }
    });
  }
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "START_SESSION") {
    const { site, intention, durationMins } = message;
    const tabId = sender.tab.id;
    const expiresAt = Date.now() + durationMins * 60 * 1000;

    return browser.storage.sync
      .get("activeSessions")
      .then((data) => {
        const activeSessions = data.activeSessions || {};
        activeSessions[tabId] = {
          site,
          intention,
          durationMins,
          expiresAt,
          startedAt: Date.now(),
          snoozeCount: 0,
        };
        return browser.storage.sync.set({ activeSessions });
      })
      .then(() => {
        browser.alarms.create(`session_${tabId}`, {
          delayInMinutes: durationMins,
        });
        browser.alarms.create(`overstay_${tabId}`, {
          delayInMinutes: durationMins * 2,
        });
        if (durationMins > 1) {
          browser.alarms.create(`warning_${tabId}`, {
            delayInMinutes: durationMins - 1,
          });
        }
        return { success: true, expiresAt };
      });
  }

  if (message.type === "GET_SESSION") {
    const tabId = sender.tab.id;
    return browser.storage.sync
      .get(["activeSessions", "cooldowns"])
      .then((data) => {
        const activeSessions = data.activeSessions || {};
        const cooldowns = data.cooldowns || {};
        return { session: activeSessions[tabId] || null, cooldowns };
      });
  }

  if (message.type === "SNOOZE_SESSION") {
    const { extraMins } = message;
    const tabId = sender.tab.id;

    return browser.storage.sync.get("activeSessions").then((data) => {
      const activeSessions = data.activeSessions || {};
      const session = activeSessions[tabId];
      if (!session) return { success: false };

      session.expiresAt = Date.now() + extraMins * 60 * 1000;
      session.snoozeCount = (session.snoozeCount || 0) + 1;
      activeSessions[tabId] = session;

      return browser.storage.sync.set({ activeSessions }).then(() => {
        browser.alarms.clear(`session_${tabId}`);
        browser.alarms.clear(`overstay_${tabId}`);
        browser.alarms.clear(`warning_${tabId}`);
        browser.alarms.create(`session_${tabId}`, {
          delayInMinutes: extraMins,
        });
        browser.alarms.create(`overstay_${tabId}`, {
          delayInMinutes: extraMins * 2,
        });
        if (extraMins > 1) {
          browser.alarms.create(`warning_${tabId}`, {
            delayInMinutes: extraMins - 1,
          });
        }
        return {
          success: true,
          expiresAt: session.expiresAt,
          snoozeCount: session.snoozeCount,
        };
      });
    });
  }

  if (message.type === "END_SESSION") {
    const { keptPromise } = message;
    const tabId = sender.tab.id;

    browser.alarms.clear(`overstay_${tabId}`);
    browser.alarms.clear(`warning_${tabId}`);
    browser.notifications.clear(`session_${tabId}`);
    browser.notifications.clear(`warning_${tabId}`);

    return browser.storage.sync
      .get(["activeSessions", "sessions", "stats", "cooldowns"])
      .then((data) => {
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

        if (!session) return { success: true };

        const actualMins = Math.round((Date.now() - session.startedAt) / 60000);
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
          browser.alarms.create(`cooldown_${session.site}`, {
            delayInMinutes: 10,
          });
        }

        stats.currentStreak = calculateStreak(sessions);
        if (stats.currentStreak > (stats.bestStreak || 0)) {
          stats.bestStreak = stats.currentStreak;
        }

        delete activeSessions[tabId];
        return browser.storage.sync
          .set({
            activeSessions,
            sessions: sessions.slice(0, 100),
            stats,
            cooldowns,
          })
          .then(() => ({ success: true }));
      });
  }

  if (message.type === "GET_COOLDOWN") {
    const { site } = message;
    return browser.storage.sync.get("cooldowns").then((data) => {
      const cooldowns = data.cooldowns || {};
      return { expiresAt: cooldowns[site] || null };
    });
  }
});

// ─── AUTO BREAK (OVERSTAY) ───────────────────────────────────────────────────

function autoBreakSession(tabId) {
  browser.storage.sync
    .get(["activeSessions", "sessions", "stats", "cooldowns"])
    .then((data) => {
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

      if (!session) return;

      const actualMins = Math.round((Date.now() - session.startedAt) / 60000);
      const today = new Date().toDateString();

      sessions.unshift({
        site: session.site,
        intention: session.intention,
        plannedMins: session.durationMins,
        actualMins,
        keptPromise: false,
        snoozeCount: session.snoozeCount || 0,
        autoBreak: true,
        timestamp: Date.now(),
        date: today,
      });

      stats.totalSessions += 1;
      cooldowns[session.site] = Date.now() + 10 * 60 * 1000;
      browser.alarms.create(`cooldown_${session.site}`, { delayInMinutes: 10 });

      stats.currentStreak = calculateStreak(sessions);
      if (stats.currentStreak > (stats.bestStreak || 0)) {
        stats.bestStreak = stats.currentStreak;
      }

      delete activeSessions[tabId];
      browser.storage.sync.set({
        activeSessions,
        sessions: sessions.slice(0, 100),
        stats,
        cooldowns,
      });

      showNotification(
        `overstay_${tabId}`,
        "⏱️ Overstay Detected!",
        `You stayed too long on ${session.site}. Marked as broken. Site locked 10 mins.`,
      );

      browser.tabs
        .executeScript(tabId, {
          code: `
        const w = document.getElementById("ct-widget");
        const g = document.getElementById("ct-guilt");
        if (w) w.remove();
        if (g) g.remove();

        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(7,11,20,0.98);display:flex;align-items:center;justify-content:center;z-index:9999999;font-family:sans-serif;flex-direction:column;gap:12px;text-align:center;padding:20px;";
        overlay.innerHTML = '<div style="font-size:52px">⏱️</div><div style="font-size:24px;font-weight:800;color:#fff">Overstay Detected</div><div style="font-size:15px;color:#7aa0c0;max-width:400px;line-height:1.6">You stayed too long. Marked as broken promise.</div><div style="background:#2a0a0a;border:1px solid #ef4444;border-radius:10px;padding:12px 24px;font-size:14px;color:#ef4444;margin-top:8px">❄️ Site locked for 10 minutes.</div><div style="font-size:13px;color:#334d6a;margin-top:8px">Redirecting in <span id="ct-countdown">5</span>s...</div>';
        document.body.innerHTML = "";
        document.body.appendChild(overlay);

        let count = 5;
        const interval = setInterval(() => {
          count--;
          const el = document.getElementById("ct-countdown");
          if (el) el.textContent = count;
          if (count <= 0) { clearInterval(interval); window.location.reload(); }
        }, 1000);
      `,
        })
        .catch(() => {});
    });
}

// ─── CALCULATE STREAK ────────────────────────────────────────────────────────

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

// ─── ALARMS ──────────────────────────────────────────────────────────────────

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("cooldown_")) {
    const site = alarm.name.replace("cooldown_", "");
    browser.storage.sync.get("cooldowns").then((data) => {
      const cooldowns = data.cooldowns || {};
      delete cooldowns[site];
      browser.storage.sync.set({ cooldowns });
    });
  }

  if (alarm.name.startsWith("session_")) {
    const tabId = parseInt(alarm.name.replace("session_", ""));
    browser.storage.sync.get("activeSessions").then((data) => {
      const session = (data.activeSessions || {})[tabId];
      if (session) {
        showNotification(
          `session_${tabId}`,
          "⏰ Time's up!",
          `Your ${session.durationMins}min session on ${session.site} has ended.`,
        );
      }
    });
    browser.tabs
      .executeScript(tabId, {
        code: `window.dispatchEvent(new CustomEvent("COMMITMENT_TIMER_EXPIRED"));`,
      })
      .catch(() => {});
  }

  if (alarm.name.startsWith("warning_")) {
    const tabId = parseInt(alarm.name.replace("warning_", ""));
    browser.storage.sync.get("activeSessions").then((data) => {
      const session = (data.activeSessions || {})[tabId];
      if (session) {
        showNotification(
          `warning_${tabId}`,
          "⚠️ 1 minute left!",
          `Wrapping up on ${session.site}? "${session.intention}"`,
        );
      }
    });
  }

  if (alarm.name.startsWith("overstay_")) {
    const tabId = parseInt(alarm.name.replace("overstay_", ""));
    autoBreakSession(tabId);
  }
});

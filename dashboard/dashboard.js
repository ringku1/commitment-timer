chrome.storage.sync.get(["stats", "sessions"], (data) => {
  const stats = data.stats || {
    totalSessions: 0,
    keptPromises: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
  const sessions = data.sessions || [];
  renderDashboard(stats, sessions);
});

// ─── HEADER BUTTONS ──────────────────────────────────────────────────────────

document.getElementById("btn-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("btn-close").addEventListener("click", () => {
  window.close();
});

// ─── CLEAR HISTORY — registered once here, not inside renderDashboard ────────

document.getElementById("btn-clear").addEventListener("click", () => {
  showConfirmDialog();
});

// ─── RENDER ──────────────────────────────────────────────────────────────────

function renderDashboard(stats, sessions) {
  const score =
    stats.totalSessions > 0
      ? Math.round((stats.keptPromises / stats.totalSessions) * 100)
      : 0;

  const streak = stats.currentStreak || 0;

  document.getElementById("streak-num").textContent = streak;
  document.getElementById("best-streak").textContent = stats.bestStreak || 0;
  document.getElementById("streak-emoji").textContent =
    streak === 0 ? "💤" : streak < 3 ? "🔥" : streak < 7 ? "🔥🔥" : "🔥🔥🔥";

  document.getElementById("total").textContent = stats.totalSessions;
  document.getElementById("kept").textContent = stats.keptPromises;
  document.getElementById("score").textContent = score + "%";
  document.getElementById("honesty-bar").style.width = score + "%";
  document.getElementById("honesty-label").textContent =
    score + "% follow-through";

  // Calendar
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";
  const dayMap = {};
  sessions.forEach((s) => {
    const d = s.date || new Date(s.timestamp).toDateString();
    if (!dayMap[d]) dayMap[d] = { kept: false, any: false };
    dayMap[d].any = true;
    if (s.keptPromise) dayMap[d].kept = true;
  });

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const day = document.createElement("div");
    day.className = "cal-day";
    day.title = key;
    day.textContent = d.getDate();
    if (dayMap[key]) {
      day.classList.add(dayMap[key].kept ? "cal-kept" : "cal-broke");
    } else {
      day.classList.add("cal-empty");
    }
    calendar.appendChild(day);
  }

  // Session list
  const list = document.getElementById("session-list");
  list.innerHTML = "";

  if (sessions.length === 0) {
    chrome.storage.sync.get("blockedSites", (data) => {
      const sites = data.blockedSites || ["youtube.com"];
      const exampleSite = sites[0] || "youtube.com";
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-text">
            Visit <strong>${exampleSite}</strong> or any blocked site<br/>
            to make your first commitment.<br/><br/>
            Your history will appear here.
          </div>
        </div>
      `;
    });
    document.getElementById("btn-clear").style.display = "none";
    return;
  }

  document.getElementById("btn-clear").style.display = "block";
  // Note: btn-clear listener is registered once at the top, not here

  sessions.forEach((s) => {
    const date = new Date(s.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const card = document.createElement("div");
    card.className = "session-card";
    card.innerHTML = `
      <div class="session-left">
        <div class="session-site">🌐 ${s.site}</div>
        <div class="session-intention">"${s.intention}"</div>
      </div>
      <div class="session-right">
        <div class="session-time">${s.plannedMins}min planned · ${s.actualMins}min actual</div>
        <span class="session-badge ${s.keptPromise ? "badge-kept" : "badge-broke"}">
          ${s.keptPromise ? "✅ Kept" : "❌ Broke"}
        </span>
        ${s.snoozeCount > 0 ? `<div class="session-snooze">⏸️ Snoozed ${s.snoozeCount}x</div>` : ""}
        ${s.autoBreak ? `<div class="session-snooze" style="color:#ef4444">⏱️ Auto-detected overstay</div>` : ""}
        <div class="session-time" style="margin-top:3px">${date}</div>
      </div>
    `;
    list.appendChild(card);
  });
}

function showConfirmDialog() {
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">🗑️</div>
      <div class="confirm-title">Clear All History?</div>
      <div class="confirm-text">
        This will permanently delete all your sessions,
        stats, streaks and honesty score.<br/><br/>
        <strong style="color:#ef4444">This cannot be undone.</strong>
      </div>
      <div class="confirm-buttons">
        <button class="confirm-cancel" id="confirm-cancel">Cancel</button>
        <button class="confirm-delete" id="confirm-delete">Yes, Clear Everything</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("confirm-cancel").addEventListener("click", () => {
    overlay.remove();
  });

  document.getElementById("confirm-delete").addEventListener("click", () => {
    chrome.storage.sync.set(
      {
        sessions: [],
        stats: {
          totalSessions: 0,
          keptPromises: 0,
          currentStreak: 0,
          bestStreak: 0,
        },
        activeSessions: {},
        cooldowns: {},
      },
      () => {
        overlay.remove();
        renderDashboard(
          {
            totalSessions: 0,
            keptPromises: 0,
            currentStreak: 0,
            bestStreak: 0,
          },
          [],
        );
      },
    );
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

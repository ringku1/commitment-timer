chrome.storage.sync.get(["stats", "sessions"], (data) => {
  const stats = data.stats || {
    totalSessions: 0,
    keptPromises: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
  const sessions = data.sessions || [];
  const score =
    stats.totalSessions > 0
      ? Math.round((stats.keptPromises / stats.totalSessions) * 100)
      : 0;

  const streak = stats.currentStreak || 0;

  // Streak card
  document.getElementById("streak-num").textContent = streak;
  document.getElementById("best-streak").textContent = stats.bestStreak || 0;
  document.getElementById("streak-emoji").textContent =
    streak === 0 ? "💤" : streak < 3 ? "🔥" : streak < 7 ? "🔥🔥" : "🔥🔥🔥";

  // Stats
  document.getElementById("total").textContent = stats.totalSessions;
  document.getElementById("kept").textContent = stats.keptPromises;
  document.getElementById("score").textContent = score + "%";
  document.getElementById("honesty-bar").style.width = score + "%";
  document.getElementById("honesty-label").textContent =
    score + "% follow-through";

  // Calendar — last 30 days
  const calendar = document.getElementById("calendar");
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
  if (sessions.length === 0) return;

  list.innerHTML = "";
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
        <div class="session-time">${date}</div>
      </div>
    `;
    list.appendChild(card);
  });
});

chrome.storage.sync.get(["stats", "sessions"], (data) => {
  const stats = data.stats || { totalSessions: 0, keptPromises: 0 };
  const sessions = data.sessions || [];
  const score =
    stats.totalSessions > 0
      ? Math.round((stats.keptPromises / stats.totalSessions) * 100)
      : 0;

  document.getElementById("total").textContent = stats.totalSessions;
  document.getElementById("kept").textContent = stats.keptPromises;
  document.getElementById("score").textContent = score + "%";
  document.getElementById("honesty-bar").style.width = score + "%";
  document.getElementById("honesty-label").textContent =
    score + "% follow-through";

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

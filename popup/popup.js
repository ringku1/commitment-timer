chrome.storage.sync.get(["stats"], (data) => {
  const stats = data.stats || { totalSessions: 0, keptPromises: 0 };
  const score =
    stats.totalSessions > 0
      ? Math.round((stats.keptPromises / stats.totalSessions) * 100)
      : 0;

  document.getElementById("total-sessions").textContent = stats.totalSessions;
  document.getElementById("kept-promises").textContent = stats.keptPromises;
  document.getElementById("honesty-bar").style.width = score + "%";
  document.getElementById("honesty-score").textContent =
    score + "% follow-through";
});

document.getElementById("dashboard-btn").addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard/dashboard.html"),
  });
});

document.getElementById("options-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

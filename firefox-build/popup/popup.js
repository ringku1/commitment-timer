chrome.storage.sync.get(
  ["onboardingDone", "stats", "extensionEnabled"],
  (data) => {
    const onboardingDone = data.onboardingDone || false;
    const isEnabled = data.extensionEnabled !== false; // default ON

    if (!onboardingDone) {
      showOnboarding();
    } else {
      showMain(data.stats, isEnabled);
    }
  },
);

function showOnboarding() {
  document.getElementById("onboarding").style.display = "block";

  document.getElementById("ob-got-it").addEventListener("click", () => {
    chrome.storage.sync.set({ onboardingDone: true }, () => {
      chrome.storage.sync.get(["stats", "extensionEnabled"], (data) => {
        document.getElementById("onboarding").style.display = "none";
        showMain(data.stats, data.extensionEnabled !== false);
      });
    });
  });

  document.getElementById("ob-skip").addEventListener("click", () => {
    chrome.storage.sync.set({ onboardingDone: true }, () => {
      chrome.storage.sync.get(["stats", "extensionEnabled"], (data) => {
        document.getElementById("onboarding").style.display = "none";
        showMain(data.stats, data.extensionEnabled !== false);
      });
    });
  });
}

function showMain(statsData, isEnabled) {
  document.getElementById("main").style.display = "block";

  const stats = statsData || {
    totalSessions: 0,
    keptPromises: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
  const score =
    stats.totalSessions > 0
      ? Math.round((stats.keptPromises / stats.totalSessions) * 100)
      : 0;

  const streak = stats.currentStreak || 0;
  document.getElementById("streak-number").textContent = streak;
  document.getElementById("best-streak").textContent = stats.bestStreak || 0;
  document.getElementById("streak-emoji").textContent =
    streak === 0 ? "💤" : streak < 3 ? "🔥" : streak < 7 ? "🔥🔥" : "🔥🔥🔥";

  document.getElementById("total-sessions").textContent = stats.totalSessions;
  document.getElementById("kept-promises").textContent = stats.keptPromises;
  document.getElementById("honesty-bar").style.width = score + "%";
  document.getElementById("honesty-score").textContent =
    score + "% follow-through";

  // Toggle state
  const toggle = document.getElementById("toggle");
  const toggleLabel = document.getElementById("toggle-label");
  const enabledContent = document.getElementById("enabled-content");
  const disabledContent = document.getElementById("disabled-content");

  function setToggleState(enabled) {
    if (enabled) {
      toggle.classList.add("on");
      toggleLabel.textContent = "ON";
      toggleLabel.style.color = "#06b6d4";
      enabledContent.style.display = "block";
      disabledContent.style.display = "none";
    } else {
      toggle.classList.remove("on");
      toggleLabel.textContent = "OFF";
      toggleLabel.style.color = "#334d6a";
      enabledContent.style.display = "none";
      disabledContent.style.display = "block";
    }
  }

  setToggleState(isEnabled);

  toggle.addEventListener("click", () => {
    const nowEnabled = !toggle.classList.contains("on");
    chrome.storage.sync.set({ extensionEnabled: nowEnabled }, () => {
      setToggleState(nowEnabled);
    });
  });

  document.getElementById("dashboard-btn").addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard/dashboard.html"),
    });
  });

  document.getElementById("options-btn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

const manifest = chrome.runtime.getManifest();
const version = manifest.version;

const DEFAULT_BLOCKED_SITES = [
  "youtube.com",
  "reddit.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "x.com",
];

chrome.storage.sync.get(
  ["onboardingDone", "stats", "extensionEnabled", "blockedSites"],
  (data) => {
    const onboardingDone = data.onboardingDone || false;
    const isEnabled = data.extensionEnabled !== false;
    const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;

    if (!onboardingDone) {
      showOnboarding(blockedSites, data.stats, isEnabled);
    } else {
      showMain(data.stats, isEnabled);
    }
  },
);

function showOnboarding(blockedSites, statsData, isEnabled) {
  document.getElementById("onboarding").style.display = "block";

  // Populate sites dynamically from storage
  const sitesList = document.getElementById("ob-sites-list");
  sitesList.innerHTML = blockedSites
    .map((site) => `<span class="ob-site-tag">${site}</span>`)
    .join("");

  document.getElementById("ob-got-it").addEventListener("click", () => {
    chrome.storage.sync.set({ onboardingDone: true }, () => {
      document.getElementById("onboarding").style.display = "none";
      showMain(statsData, isEnabled);
    });
  });

  document.getElementById("ob-skip").addEventListener("click", () => {
    chrome.storage.sync.set({ onboardingDone: true }, () => {
      document.getElementById("onboarding").style.display = "none";
      showMain(statsData, isEnabled);
    });
  });
}

function showMain(statsData, isEnabled) {
  document.getElementById("main").style.display = "block";

  // Version
  const versionEl = document.getElementById("version-label");
  if (versionEl) versionEl.textContent = `v${version}`;

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

  // Toggle
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

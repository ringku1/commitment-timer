const DEFAULT_BLOCKED_SITES = [
  "youtube.com",
  "reddit.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "x.com",
];

let blockedSites = [];

// Load sites
chrome.storage.sync.get("blockedSites", (data) => {
  blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
  renderSites();
});

function renderSites() {
  const list = document.getElementById("site-list");
  list.innerHTML = "";

  if (blockedSites.length === 0) {
    list.innerHTML = `<div class="empty-sites">No blocked sites. Add one below.</div>`;
    return;
  }

  blockedSites.forEach((site) => {
    const row = document.createElement("div");
    row.className = "site-row";
    row.innerHTML = `
      <span class="site-name">${site}</span>
      <button class="btn-remove" data-site="${site}">Remove</button>
    `;
    list.appendChild(row);
  });

  // Remove buttons → show confirmation first
  list.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const site = btn.dataset.site;
      showRemoveConfirm(site);
    });
  });
}

function showRemoveConfirm(site) {
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">⚠️</div>
      <div class="confirm-title">Remove Site?</div>
      <div class="confirm-text">
        Are you sure you want to unblock
        <span class="confirm-site">${site}</span>?<br/><br/>
        You will be able to visit it freely without any commitment.
      </div>
      <div class="confirm-buttons">
        <button class="confirm-cancel" id="confirm-cancel">Keep It</button>
        <button class="confirm-delete" id="confirm-delete">Yes, Remove</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("confirm-cancel").addEventListener("click", () => {
    overlay.remove();
  });

  document.getElementById("confirm-delete").addEventListener("click", () => {
    blockedSites = blockedSites.filter((s) => s !== site);
    chrome.storage.sync.set({ blockedSites }, () => {
      overlay.remove();
      renderSites();
      showSuccess(`${site} removed from blocked sites.`);
    });
  });

  // Click outside to cancel
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// Add site
document.getElementById("btn-add").addEventListener("click", addSite);
document.getElementById("add-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});

function addSite() {
  const input = document.getElementById("add-input");
  const errorMsg = document.getElementById("error-msg");
  const successMsg = document.getElementById("success-msg");

  let site = input.value.trim().toLowerCase();

  // Strip protocol if pasted as full URL
  site = site
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0];

  errorMsg.style.display = "none";
  successMsg.style.display = "none";

  if (!site) {
    showError("Please enter a site name.");
    return;
  }

  if (!site.includes(".")) {
    showError("Please enter a valid domain e.g. twitch.tv");
    return;
  }

  if (blockedSites.includes(site)) {
    showError(`${site} is already blocked.`);
    return;
  }

  blockedSites.push(site);
  chrome.storage.sync.set({ blockedSites }, () => {
    input.value = "";
    renderSites();
    showSuccess(`${site} added to blocked sites! ✅`);
  });
}

function showError(msg) {
  const el = document.getElementById("error-msg");
  el.textContent = "❌ " + msg;
  el.style.display = "block";
  document.getElementById("success-msg").style.display = "none";
}

function showSuccess(msg) {
  const el = document.getElementById("success-msg");
  el.textContent = "✅ " + msg;
  el.style.display = "block";
  document.getElementById("error-msg").style.display = "none";
  setTimeout(() => {
    el.style.display = "none";
  }, 3000);
}

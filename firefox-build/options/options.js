let blockedSites = [];

function renderSites() {
  const list = document.getElementById("site-list");
  list.innerHTML = "";
  blockedSites.forEach((site, i) => {
    const item = document.createElement("div");
    item.className = "site-item";
    item.innerHTML = `
      <span class="site-name">🌐 ${site}</span>
      <button class="remove-btn" data-index="${i}">×</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      blockedSites.splice(parseInt(btn.dataset.index), 1);
      save();
      renderSites();
    });
  });
}

function save() {
  chrome.storage.sync.set({ blockedSites }, () => {
    const msg = document.getElementById("saved-msg");
    msg.style.display = "block";
    setTimeout(() => {
      msg.style.display = "none";
    }, 2000);
  });
}

chrome.storage.sync.get("blockedSites", (data) => {
  blockedSites = data.blockedSites || [];
  renderSites();
});

document.getElementById("add-btn").addEventListener("click", () => {
  const input = document.getElementById("new-site");
  const site = input.value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (site && !blockedSites.includes(site)) {
    blockedSites.push(site);
    save();
    renderSites();
    input.value = "";
  }
});

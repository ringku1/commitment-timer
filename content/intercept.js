(function () {
  if (document.getElementById("ct-overlay")) return;

  const site = window.location.hostname.replace("www.", "");

  // Check cooldown first
  chrome.runtime.sendMessage({ type: "GET_COOLDOWN", site }, (response) => {
    const cooldownExpiry = response && response.expiresAt;

    if (cooldownExpiry && cooldownExpiry > Date.now()) {
      showCooldownScreen(site, cooldownExpiry);
    } else {
      showIntentionScreen(site);
    }
  });

  function showCooldownScreen(site, expiresAt) {
    const overlay = document.createElement("div");
    overlay.id = "ct-overlay";

    overlay.innerHTML = `
      <div class="ct-box">
        <div class="ct-icon">❄️</div>
        <h1 class="ct-title">Cooldown Active</h1>
        <p class="ct-subtitle">You broke your promise on <strong>${site}</strong>.</p>
        <p class="ct-hint">Site is locked as a consequence. Come back later.</p>

        <div class="ct-cooldown-timer" id="ct-cooldown-timer">--:--</div>
        <p class="ct-cooldown-label">remaining</p>

        <p class="ct-footer">Use this time to do something meaningful 💪</p>
      </div>
    `;

    document.body.innerHTML = "";
    document.body.appendChild(overlay);
    document.body.style.margin = "0";
    document.body.style.padding = "0";

    function updateCooldown() {
      const remaining = expiresAt - Date.now();
      const el = document.getElementById("ct-cooldown-timer");
      if (!el) return;

      if (remaining <= 0) {
        el.textContent = "00:00";
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return;
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      el.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    updateCooldown();
    setInterval(updateCooldown, 1000);
  }

  function showIntentionScreen(site) {
    const overlay = document.createElement("div");
    overlay.id = "ct-overlay";

    overlay.innerHTML = `
      <div class="ct-box">
        <div class="ct-icon">🔒</div>
        <h1 class="ct-title">Hold on.</h1>
        <p class="ct-subtitle">Why are you visiting <strong>${site}</strong>?</p>
        <p class="ct-hint">Be specific. Vague reasons will be rejected.</p>

        <textarea
          id="ct-intention"
          class="ct-textarea"
          placeholder="e.g. Watch a tutorial on CSS flexbox"
          maxlength="200"
          rows="3"
        ></textarea>

        <p class="ct-label">How long do you need?</p>
        <div class="ct-time-buttons">
          <button class="ct-time-btn" data-mins="5">5 min</button>
          <button class="ct-time-btn" data-mins="10">10 min</button>
          <button class="ct-time-btn" data-mins="15">15 min</button>
          <button class="ct-time-btn" data-mins="30">30 min</button>
          <button class="ct-time-btn ct-custom-btn" data-mins="custom">Custom</button>
        </div>

        <input
          type="number"
          id="ct-custom-input"
          class="ct-custom-input hidden"
          placeholder="Enter minutes"
          min="1"
          max="120"
        />

        <div id="ct-error" class="ct-error hidden"></div>

        <button id="ct-submit" class="ct-submit-btn" disabled>
          Commit & Enter →
        </button>

        <p class="ct-footer">Commitment Timer is watching 👁</p>
      </div>
    `;

    document.body.innerHTML = "";
    document.body.appendChild(overlay);
    document.body.style.margin = "0";
    document.body.style.padding = "0";

    let selectedMins = null;

    overlay.querySelectorAll(".ct-time-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        overlay
          .querySelectorAll(".ct-time-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const customInput = document.getElementById("ct-custom-input");
        if (btn.dataset.mins === "custom") {
          customInput.classList.remove("hidden");
          customInput.focus();
          selectedMins = null;
        } else {
          customInput.classList.add("hidden");
          selectedMins = parseInt(btn.dataset.mins);
        }
        validateForm();
      });
    });

    document
      .getElementById("ct-custom-input")
      .addEventListener("input", (e) => {
        selectedMins = parseInt(e.target.value) || null;
        validateForm();
      });

    document
      .getElementById("ct-intention")
      .addEventListener("input", validateForm);

    function validateForm() {
      const intention = document.getElementById("ct-intention").value.trim();
      const submitBtn = document.getElementById("ct-submit");
      submitBtn.disabled = !(intention.length >= 10 && selectedMins);
    }

    document.getElementById("ct-submit").addEventListener("click", () => {
      const intention = document.getElementById("ct-intention").value.trim();
      const errorEl = document.getElementById("ct-error");

      const vagueWords = [
        "nothing",
        "just browse",
        "bored",
        "fun",
        "random",
        "idk",
        "dunno",
        "chill",
        "scroll",
      ];
      const isVague = vagueWords.some((w) =>
        intention.toLowerCase().includes(w),
      );

      if (isVague) {
        errorEl.textContent =
          "❌ Too vague. Be specific about what you're looking for.";
        errorEl.classList.remove("hidden");
        return;
      }

      errorEl.classList.add("hidden");

      chrome.runtime.sendMessage(
        { type: "START_SESSION", site, intention, durationMins: selectedMins },
        (response) => {
          if (response && response.success) {
            overlay.remove();
            window.location.reload();
          }
        },
      );
    });
  }
})();

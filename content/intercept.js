(function () {
  if (document.getElementById("ct-shadow-host")) return;

  const site = window.location.hostname.replace("www.", "");

  const host = document.createElement("div");
  host.id = "ct-shadow-host";
  host.style.cssText = `
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    display: block !important;
    pointer-events: auto !important;
  `;

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    #ct-overlay {
      position: fixed;
      inset: 0;
      background: #070b14;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #ffffff;
    }

    .ct-box {
      background: #0d1526;
      border: 1px solid #0ea5e9;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow:
        0 0 0 1px #0ea5e920,
        0 0 30px #0ea5e930,
        0 0 80px #0ea5e915;
    }

    .ct-icon {
      font-size: 48px;
      margin-bottom: 16px;
      display: block;
      filter: drop-shadow(0 0 12px #0ea5e9);
    }

    .ct-title {
      font-size: 32px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
      display: block;
      text-shadow: 0 0 20px #0ea5e950;
      line-height: 1.2;
    }

    .ct-subtitle {
      font-size: 16px;
      color: #7aa0c0;
      margin-bottom: 4px;
      display: block;
    }

    .ct-subtitle strong {
      color: #06b6d4;
      font-weight: 700;
      text-shadow: 0 0 10px #06b6d470;
    }

    .ct-hint {
      font-size: 13px;
      color: #334d6a;
      margin-bottom: 20px;
      display: block;
    }

    .ct-textarea {
      width: 100%;
      background: #0a1220;
      border: 1px solid #1a2d4a;
      border-radius: 10px;
      color: #e0f0ff;
      font-size: 15px;
      padding: 14px;
      resize: none;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin-bottom: 20px;
      display: block;
      line-height: 1.5;
    }

    .ct-textarea:focus {
      border-color: #0ea5e9;
      box-shadow: 0 0 0 3px #0ea5e920, 0 0 20px #0ea5e920;
    }

    .ct-textarea::placeholder { color: #334d6a; }

    .ct-label {
      font-size: 13px;
      color: #7aa0c0;
      margin-bottom: 10px;
      text-align: left;
      display: block;
    }

    .ct-time-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 12px;
    }

    .ct-time-btn {
      background: #0a1220;
      border: 1px solid #1a2d4a;
      border-radius: 8px;
      color: #7aa0c0;
      font-size: 14px;
      padding: 8px 16px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.4;
    }

    .ct-time-btn:hover {
      border-color: #0ea5e9;
      color: #ffffff;
      box-shadow: 0 0 12px #0ea5e930;
    }

    .ct-time-btn.active {
      background: linear-gradient(135deg, #0369a1, #0891b2);
      border-color: #06b6d4;
      color: #ffffff;
      box-shadow: 0 0 16px #0ea5e940;
    }

    .ct-custom-input {
      width: 100%;
      background: #0a1220;
      border: 1px solid #1a2d4a;
      border-radius: 10px;
      color: #e0f0ff;
      font-size: 15px;
      padding: 10px 14px;
      outline: none;
      margin-bottom: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: block;
      transition: border-color 0.2s, box-shadow 0.2s;
      line-height: 1.4;
    }

    .ct-custom-input:focus {
      border-color: #0ea5e9;
      box-shadow: 0 0 0 3px #0ea5e920;
    }

    .ct-custom-input.hidden { display: none; }

    .ct-error {
      background: #1a0a0a;
      border: 1px solid #ef4444;
      border-radius: 8px;
      color: #ef4444;
      font-size: 13px;
      padding: 10px 14px;
      margin-bottom: 12px;
      text-align: left;
      display: block;
      box-shadow: 0 0 12px #ef444420;
      line-height: 1.4;
    }

    .ct-error.hidden { display: none; }

    .ct-submit-btn {
      width: 100%;
      background: linear-gradient(135deg, #0369a1, #0891b2);
      border: 1px solid #0ea5e9;
      border-radius: 10px;
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      padding: 14px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 16px;
      display: block;
      box-shadow: 0 0 20px #0ea5e930;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.4;
    }

    .ct-submit-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #0284c7, #06b6d4);
      box-shadow: 0 0 30px #0ea5e950;
      transform: translateY(-1px);
    }

    .ct-submit-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      box-shadow: none;
    }

    .ct-footer {
      font-size: 12px;
      color: #1a2d4a;
      display: block;
    }

    .ct-cooldown-timer {
      font-size: 56px;
      font-weight: 900;
      color: #06b6d4;
      letter-spacing: 4px;
      margin: 20px 0 4px;
      display: block;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 0 30px #06b6d460;
      line-height: 1;
    }

    .ct-cooldown-label {
      font-size: 13px;
      color: #334d6a;
      margin-bottom: 24px;
      display: block;
    }
  `;

  shadow.appendChild(style);

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

    shadow.appendChild(overlay);
    document.documentElement.appendChild(host);
    document.body.style.overflow = "hidden";

    function updateCooldown() {
      const remaining = expiresAt - Date.now();
      const el = shadow.getElementById("ct-cooldown-timer");
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
        <p class="ct-hint">Be specific. At least 3 words. No vague reasons.</p>

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
          <button class="ct-time-btn" data-mins="custom">Custom</button>
        </div>

        <input
          type="number"
          id="ct-custom-input"
          class="ct-custom-input hidden"
          placeholder="Enter minutes (1–120)"
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

    shadow.appendChild(overlay);
    document.documentElement.appendChild(host);
    document.body.style.overflow = "hidden";

    let selectedMins = null;

    shadow.querySelectorAll(".ct-time-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        shadow
          .querySelectorAll(".ct-time-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const customInput = shadow.getElementById("ct-custom-input");
        const errorEl = shadow.getElementById("ct-error");

        if (btn.dataset.mins === "custom") {
          customInput.classList.remove("hidden");
          customInput.focus();
          selectedMins = null;
        } else {
          customInput.classList.add("hidden");
          errorEl.classList.add("hidden");
          selectedMins = parseInt(btn.dataset.mins);
        }
        validateForm();
      });
    });

    shadow.getElementById("ct-custom-input").addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      const errorEl = shadow.getElementById("ct-error");

      if (e.target.value && (val < 1 || val > 120 || isNaN(val))) {
        errorEl.textContent =
          "❌ Please enter a number between 1 and 120 minutes.";
        errorEl.classList.remove("hidden");
        selectedMins = null;
      } else {
        errorEl.classList.add("hidden");
        selectedMins = val || null;
      }
      validateForm();
    });

    shadow
      .getElementById("ct-intention")
      .addEventListener("input", validateForm);

    function validateForm() {
      const intention = shadow.getElementById("ct-intention").value.trim();
      const submitBtn = shadow.getElementById("ct-submit");
      submitBtn.disabled = !(intention.length >= 10 && selectedMins);
    }

    shadow.getElementById("ct-submit").addEventListener("click", () => {
      const intention = shadow.getElementById("ct-intention").value.trim();
      const errorEl = shadow.getElementById("ct-error");

      const vagueWords = [
        // Classic bypasses
        "nothing",
        "idk",
        "dunno",
        "just browse",
        "bored",
        "fun",
        "random",
        "chill",
        "scroll",
        "browse",
        // Vague check-ins
        "just check",
        "just look",
        "just see",
        "just visit",
        "check it out",
        "see what",
        "look around",
        "look at",
        "see if",
        "check if",
        "check my",
        "check the",
        // Curiosity bypasses
        "curious",
        "maybe",
        "perhaps",
        "might",
        "waste time",
        "kill time",
        "free time",
        "spare time",
        // Minimal effort
        "stuff",
        "things",
        "whatever",
        "anything",
        "relax",
        "rest",
        "chill out",
        "hang out",
        // Vague entertainment
        "watch something",
        "see something",
        "find something",
        "look for something",
        "search for something",
        // Procrastination
        "procrastin",
        "take a break",
        "quick break",
        "few minutes",
        "just a min",
        "just for a bit",
        "just quickly",
        "real quick",
      ];

      const intentionLower = intention.toLowerCase();
      const isVague = vagueWords.some((w) => intentionLower.includes(w));
      const wordCount = intention.trim().split(/\s+/).length;
      const isTooShort = wordCount < 3;

      if (isVague || isTooShort) {
        errorEl.textContent = isVague
          ? "❌ Too vague. Be specific about what you're looking for."
          : "❌ Too short. Use at least 3 words to describe your intention.";
        errorEl.classList.remove("hidden");
        return;
      }

      errorEl.classList.add("hidden");

      chrome.runtime.sendMessage(
        { type: "START_SESSION", site, intention, durationMins: selectedMins },
        (response) => {
          if (response && response.success) {
            host.remove();
            document.body.style.overflow = "";
            window.location.reload();
          }
        },
      );
    });
  }
})();

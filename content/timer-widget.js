(function () {
  if (document.getElementById("ct-widget")) return;

  chrome.runtime.sendMessage({ type: "GET_SESSION" }, (response) => {
    if (!response || !response.session) return;

    const session = response.session;
    const expiresAt = session.expiresAt;

    const widget = document.createElement("div");
    widget.id = "ct-widget";
    widget.innerHTML = `
      <div class="ct-widget-intention" id="ct-widget-intention">📝 ${session.intention}</div>
      <div class="ct-widget-timer" id="ct-widget-time">--:--</div>
      <button class="ct-widget-snooze" id="ct-widget-snooze">+5 min</button>
    `;
    document.body.appendChild(widget);

    // Drag support
    let isDragging = false,
      dragOffsetX = 0,
      dragOffsetY = 0;
    widget.addEventListener("mousedown", (e) => {
      if (e.target.id === "ct-widget-snooze") return;
      isDragging = true;
      dragOffsetX = e.clientX - widget.getBoundingClientRect().left;
      dragOffsetY = e.clientY - widget.getBoundingClientRect().top;
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      widget.style.left = e.clientX - dragOffsetX + "px";
      widget.style.top = e.clientY - dragOffsetY + "px";
      widget.style.right = "auto";
      widget.style.bottom = "auto";
    });
    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Snooze button
    let snoozeCount = session.snoozeCount || 0;
    document
      .getElementById("ct-widget-snooze")
      .addEventListener("click", () => {
        showSnoozeScreen(session, snoozeCount);
      });

    // Countdown
    let currentExpiry = expiresAt;
    function updateTimer() {
      const remaining = currentExpiry - Date.now();
      const timeEl = document.getElementById("ct-widget-time");
      if (!timeEl) return;

      if (remaining <= 0) {
        timeEl.textContent = "00:00";
        widget.classList.add("ct-widget-expired");
        showGuiltScreen(session);
        return;
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      timeEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      if (remaining <= 120000) widget.classList.add("ct-widget-warning");
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    window.addEventListener("COMMITMENT_TIMER_EXPIRED", () => {
      clearInterval(interval);
      showGuiltScreen(session);
    });
  });

  // ⏸️ SNOOZE TAX SCREEN
  function showSnoozeScreen(session, snoozeCount) {
    const existing = document.getElementById("ct-snooze-screen");
    if (existing) return;

    // Snooze tax: each snooze requires more justification
    const minChars = 20 + snoozeCount * 30; // 20, 50, 80, 110...
    const extraMins = Math.max(5, 5 - snoozeCount); // 5, 4, 3... gets less each time
    const taxLevel = snoozeCount + 1;

    const snoozeEl = document.createElement("div");
    snoozeEl.id = "ct-snooze-screen";
    snoozeEl.innerHTML = `
      <div class="ct-snooze-box">
        <div class="ct-snooze-icon">⏸️</div>
        <h2 class="ct-snooze-title">Snooze Tax — Level ${taxLevel}</h2>
        <p class="ct-snooze-sub">
          You've snoozed ${snoozeCount} time${snoozeCount !== 1 ? "s" : ""} already.
          Each snooze gets harder.
        </p>

        <div class="ct-snooze-terms">
          <div class="ct-snooze-term">
            <span class="ct-snooze-term-label">Extra time you'll get</span>
            <span class="ct-snooze-term-value ${extraMins <= 3 ? "ct-red" : ""}">${extraMins} minutes</span>
          </div>
          <div class="ct-snooze-term">
            <span class="ct-snooze-term-label">Minimum justification</span>
            <span class="ct-snooze-term-value">${minChars} characters</span>
          </div>
        </div>

        <p class="ct-snooze-prompt">Why do you need more time? Be very specific.</p>
        <textarea
          id="ct-snooze-reason"
          class="ct-snooze-textarea"
          placeholder="Explain exactly why you need more time..."
          maxlength="500"
          rows="4"
        ></textarea>
        <div class="ct-snooze-char-count">
          <span id="ct-snooze-chars">0</span> / ${minChars} required characters
        </div>

        <div class="ct-snooze-buttons">
          <button id="ct-snooze-cancel" class="ct-snooze-btn-cancel">Cancel</button>
          <button id="ct-snooze-confirm" class="ct-snooze-btn-confirm" disabled>
            Accept Tax & Snooze
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(snoozeEl);

    const textarea = document.getElementById("ct-snooze-reason");
    const confirmBtn = document.getElementById("ct-snooze-confirm");
    const charCount = document.getElementById("ct-snooze-chars");

    textarea.focus();
    textarea.addEventListener("input", () => {
      const len = textarea.value.trim().length;
      charCount.textContent = len;
      confirmBtn.disabled = len < minChars;
      charCount.style.color = len >= minChars ? "#22c55e" : "#8888aa";
    });

    document
      .getElementById("ct-snooze-cancel")
      .addEventListener("click", () => {
        snoozeEl.remove();
      });

    document
      .getElementById("ct-snooze-confirm")
      .addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "SNOOZE_SESSION", extraMins, site: session.site },
          (response) => {
            if (response && response.success) {
              snoozeCount = response.snoozeCount;
              snoozeEl.remove();

              // Update widget snooze button
              const snoozeBtn = document.getElementById("ct-widget-snooze");
              if (snoozeBtn) {
                const nextExtra = Math.max(5 - snoozeCount, 1);
                snoozeBtn.textContent =
                  snoozeCount >= 4 ? "No more snoozes" : `+${nextExtra} min`;
                snoozeBtn.disabled = snoozeCount >= 4;
              }
            }
          },
        );
      });
  }

  // ⏰ GUILT SCREEN
  function showGuiltScreen(session) {
    const existing = document.getElementById("ct-guilt");
    if (existing) return;

    const plannedMins = session.durationMins;
    const actualMins = Math.round((Date.now() - session.startedAt) / 60000);
    const snoozeCount = session.snoozeCount || 0;

    const guilt = document.createElement("div");
    guilt.id = "ct-guilt";
    guilt.innerHTML = `
      <div class="ct-guilt-box">
        <div class="ct-guilt-icon">⏰</div>
        <h2 class="ct-guilt-title">Time's up.</h2>
        <p class="ct-guilt-subtitle">Your commitment has ended.</p>

        <div class="ct-guilt-stats">
          <div class="ct-guilt-stat">
            <span class="ct-guilt-label">Planned</span>
            <span class="ct-guilt-value">${plannedMins} min</span>
          </div>
          <div class="ct-guilt-stat">
            <span class="ct-guilt-label">Actual</span>
            <span class="ct-guilt-value ${actualMins > plannedMins ? "ct-over" : "ct-ok"}">${actualMins} min</span>
          </div>
          <div class="ct-guilt-stat">
            <span class="ct-guilt-label">Snoozes</span>
            <span class="ct-guilt-value ${snoozeCount > 0 ? "ct-over" : "ct-ok"}">${snoozeCount}x</span>
          </div>
        </div>

        <div class="ct-guilt-intention">
          <span class="ct-guilt-label">Your intention was:</span>
          <p class="ct-guilt-intention-text">"${session.intention}"</p>
        </div>

        ${
          snoozeCount > 0
            ? `
        <div class="ct-guilt-snooze-warning">
          ⚠️ You snoozed ${snoozeCount} time${snoozeCount !== 1 ? "s" : ""}. Each snooze is a sign of weak commitment.
        </div>`
            : ""
        }

        <p class="ct-guilt-question">Did you actually do what you committed to?</p>

        <div class="ct-guilt-buttons">
          <button id="ct-yes" class="ct-guilt-btn ct-guilt-yes">✅ Yes, I did</button>
          <button id="ct-no" class="ct-guilt-btn ct-guilt-no">❌ No, I got distracted</button>
        </div>

        <p class="ct-guilt-warning">
          ❌ Answering "No" will lock this site for <strong>10 minutes</strong>.
        </p>
      </div>
    `;

    document.body.appendChild(guilt);

    document
      .getElementById("ct-yes")
      .addEventListener("click", () => endSession(true, guilt));
    document
      .getElementById("ct-no")
      .addEventListener("click", () => endSession(false, guilt));
  }

  function endSession(keptPromise, guiltEl) {
    chrome.runtime.sendMessage({ type: "END_SESSION", keptPromise }, () => {
      guiltEl.remove();
      const widget = document.getElementById("ct-widget");
      if (widget) widget.remove();

      // Always just reload — intercept.js handles everything:
      // YES → new commitment screen (site is still blocked)
      // NO  → cooldown screen (penalty already saved to storage)
      window.location.reload();
    });
  }
})();

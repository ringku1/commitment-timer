(function () {
  if (document.getElementById("ct-widget-host")) return;

  chrome.runtime.sendMessage({ type: "GET_SESSION" }, (response) => {
    if (!response || !response.session) return;
    const session = response.session;
    if (session.expiresAt <= Date.now()) return;
    createWidget(session);
  });

  function createWidget(session) {
    let guiltShown = false; // ← guard flag

    // ─── WIDGET HOST (Shadow DOM) ─────────────────────────────────────────
    const widgetHost = document.createElement("div");
    widgetHost.id = "ct-widget-host";
    widgetHost.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      display: block !important;
    `;

    const widgetShadow = widgetHost.attachShadow({ mode: "open" });

    const widgetStyle = document.createElement("style");
    widgetStyle.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }

      #ct-widget {
        background: #0d1526;
        border: 1px solid #0ea5e9;
        border-radius: 12px;
        padding: 10px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        cursor: grab;
        box-shadow:
          0 0 0 1px #0ea5e920,
          0 0 20px #0ea5e930,
          0 0 60px #0ea5e910;
        min-width: 150px;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transition: border-color 0.3s, box-shadow 0.3s;
      }

      #ct-widget:active { cursor: grabbing; }

      .ct-widget-intention {
        font-size: 11px;
        color: #7aa0c0;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 100%;
        text-align: center;
      }

      .ct-widget-timer {
        font-size: 24px;
        font-weight: 800;
        color: #06b6d4;
        letter-spacing: 2px;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 0 16px #06b6d460;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      #ct-widget.ct-warning {
        border-color: #f97316;
        box-shadow:
          0 0 0 1px #f9731620,
          0 0 20px #f9731640,
          0 0 60px #f9731615;
      }

      #ct-widget.ct-warning .ct-widget-timer {
        color: #f97316;
        text-shadow: 0 0 16px #f9731660;
        animation: ct-pulse 1s infinite;
      }

      #ct-widget.ct-expired {
        border-color: #ef4444;
        box-shadow: 0 0 20px #ef444440;
      }

      #ct-widget.ct-expired .ct-widget-timer {
        color: #ef4444;
        text-shadow: 0 0 16px #ef444460;
      }

      @keyframes ct-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .ct-widget-snooze {
        background: #0a1220;
        border: 1px solid #1a2d4a;
        border-radius: 6px;
        color: #7aa0c0;
        font-size: 11px;
        padding: 3px 8px;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        font-family: inherit;
        text-align: center;
      }

      .ct-widget-snooze:hover:not(:disabled) {
        border-color: #f97316;
        color: #f97316;
        box-shadow: 0 0 10px #f9731630;
      }

      .ct-widget-snooze:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    `;

    widgetShadow.appendChild(widgetStyle);

    const widget = document.createElement("div");
    widget.id = "ct-widget";
    widget.innerHTML = `
      <div class="ct-widget-intention">${session.intention}</div>
      <div class="ct-widget-timer" id="ct-timer-display">--:--</div>
      <button class="ct-widget-snooze" id="ct-snooze-btn">⏸ Snooze</button>
    `;

    widgetShadow.appendChild(widget);
    document.documentElement.appendChild(widgetHost);

    // ─── DRAGGING ─────────────────────────────────────────────────────────
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    widget.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("ct-widget-snooze")) return;
      isDragging = true;
      const rect = widgetHost.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      widget.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      widgetHost.style.left = e.clientX - dragOffsetX + "px";
      widgetHost.style.top = e.clientY - dragOffsetY + "px";
      widgetHost.style.bottom = "auto";
      widgetHost.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      widget.style.cursor = "grab";
    });

    // ─── COUNTDOWN ────────────────────────────────────────────────────────
    function updateTimer() {
      const remaining = session.expiresAt - Date.now();
      const display = widgetShadow.getElementById("ct-timer-display");
      if (!display) return;

      if (remaining <= 0) {
        display.textContent = "00:00";
        widget.classList.add("ct-expired");
        // Disable snooze when expired
        const snooze = widgetShadow.getElementById("ct-snooze-btn");
        if (snooze) {
          snooze.disabled = true;
          snooze.textContent = "Time's up!";
        }
        return;
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      display.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      if (remaining < 2 * 60 * 1000) {
        widget.classList.add("ct-warning");
      }
    }

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    // ─── SNOOZE ───────────────────────────────────────────────────────────
    const snoozeBtn = widgetShadow.getElementById("ct-snooze-btn");
    let snoozeCount = session.snoozeCount || 0;

    function updateSnoozeBtn() {
      if (snoozeCount >= 3) {
        snoozeBtn.textContent = "No more snoozes";
        snoozeBtn.disabled = true;
        return;
      }
      const levels = [
        { mins: 5, chars: 20 },
        { mins: 4, chars: 50 },
        { mins: 3, chars: 80 },
      ];
      const level = levels[snoozeCount];
      snoozeBtn.textContent = `⏸ Snooze (+${level.mins}min)`;
      snoozeBtn.disabled = false;
    }

    updateSnoozeBtn();

    snoozeBtn.addEventListener("click", () => {
      // Block snooze if timer already expired
      if (session.expiresAt <= Date.now()) return;
      if (snoozeCount >= 3) return;
      showSnoozeScreen();
    });

    // ─── TIMER EXPIRED EVENT ──────────────────────────────────────────────
    window.addEventListener("COMMITMENT_TIMER_EXPIRED", () => {
      if (guiltShown) return; // ← guard — ignore duplicate events
      guiltShown = true;
      clearInterval(timerInterval);
      widget.classList.add("ct-expired");
      // Disable snooze immediately
      const snooze = widgetShadow.getElementById("ct-snooze-btn");
      if (snooze) {
        snooze.disabled = true;
        snooze.textContent = "Time's up!";
      }
      setTimeout(() => showGuiltScreen(), 500);
    });

    // ─── SNOOZE SCREEN (Shadow DOM) ───────────────────────────────────────
    function showSnoozeScreen() {
      // Don't show if guilt already shown
      if (guiltShown) return;

      const levels = [
        { mins: 5, chars: 20 },
        { mins: 4, chars: 50 },
        { mins: 3, chars: 80 },
      ];
      const level = levels[snoozeCount];

      const snoozeHost = document.createElement("div");
      snoozeHost.id = "ct-snooze-host";
      snoozeHost.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
      `;

      const snoozeShadow = snoozeHost.attachShadow({ mode: "open" });

      const snoozeStyle = document.createElement("style");
      snoozeStyle.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; }

        #ct-snooze-screen {
          position: fixed;
          inset: 0;
          background: rgba(7, 11, 20, 0.97);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
        }

        .ct-snooze-box {
          background: #0d1526;
          border: 1px solid #f97316;
          border-radius: 16px;
          padding: 36px;
          max-width: 460px;
          width: 100%;
          text-align: center;
          box-shadow:
            0 0 0 1px #f9731615,
            0 0 30px #f9731630,
            0 0 80px #f9731610;
        }

        .ct-snooze-icon { font-size: 40px; margin-bottom: 12px; display: block; }
        .ct-snooze-title { font-size: 22px; font-weight: 800; color: #f97316; margin-bottom: 6px; display: block; text-shadow: 0 0 16px #f9731650; }
        .ct-snooze-sub { font-size: 14px; color: #7aa0c0; margin-bottom: 20px; display: block; }

        .ct-snooze-terms { display: flex; gap: 12px; justify-content: center; margin-bottom: 20px; }
        .ct-snooze-term { background: #0a1220; border: 1px solid #1a2d4a; border-radius: 10px; padding: 12px 20px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .ct-snooze-term-label { font-size: 11px; color: #334d6a; }
        .ct-snooze-term-value { font-size: 18px; font-weight: 700; color: #ffffff; }
        .ct-snooze-term-value.ct-red { color: #ef4444; text-shadow: 0 0 10px #ef444440; }

        .ct-snooze-prompt { font-size: 14px; color: #c0d8f0; margin-bottom: 10px; text-align: left; display: block; }

        .ct-snooze-textarea {
          width: 100%; background: #0a1220; border: 1px solid #1a2d4a;
          border-radius: 10px; color: #e0f0ff; font-size: 14px; padding: 12px;
          resize: none; outline: none; font-family: inherit;
          margin-bottom: 6px; display: block;
          transition: border-color 0.2s, box-shadow 0.2s; line-height: 1.5;
        }
        .ct-snooze-textarea:focus { border-color: #f97316; box-shadow: 0 0 0 3px #f9731620; }

        .ct-snooze-char-count { font-size: 12px; color: #334d6a; text-align: right; margin-bottom: 16px; display: block; }

        .ct-snooze-buttons { display: flex; gap: 10px; }

        .ct-snooze-btn-cancel {
          flex: 1; background: #0a1220; border: 1px solid #1a2d4a;
          border-radius: 10px; color: #7aa0c0; font-size: 14px;
          padding: 12px; cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .ct-snooze-btn-cancel:hover { border-color: #0ea5e9; color: #ffffff; }

        .ct-snooze-btn-confirm {
          flex: 2; background: linear-gradient(135deg, #9a3412, #c2410c);
          border: 1px solid #f97316; border-radius: 10px; color: #fff;
          font-size: 14px; font-weight: 700; padding: 12px; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 0 16px #f9731630; font-family: inherit;
        }
        .ct-snooze-btn-confirm:hover:not(:disabled) { background: linear-gradient(135deg, #c2410c, #ea580c); box-shadow: 0 0 24px #f9731650; }
        .ct-snooze-btn-confirm:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
      `;

      snoozeShadow.appendChild(snoozeStyle);

      const snoozeScreen = document.createElement("div");
      snoozeScreen.id = "ct-snooze-screen";
      snoozeScreen.innerHTML = `
        <div class="ct-snooze-box">
          <span class="ct-snooze-icon">⏸️</span>
          <span class="ct-snooze-title">Snooze Tax</span>
          <span class="ct-snooze-sub">Each snooze costs more. This is snooze #${snoozeCount + 1}.</span>
          <div class="ct-snooze-terms">
            <div class="ct-snooze-term">
              <span class="ct-snooze-term-label">Extra time</span>
              <span class="ct-snooze-term-value">+${level.mins} min</span>
            </div>
            <div class="ct-snooze-term">
              <span class="ct-snooze-term-label">Min characters</span>
              <span class="ct-snooze-term-value ct-red">${level.chars}</span>
            </div>
          </div>
          <span class="ct-snooze-prompt">Why do you need more time?</span>
          <textarea
            id="ct-snooze-reason"
            class="ct-snooze-textarea"
            placeholder="Explain why you need more time..."
            rows="3"
            maxlength="300"
          ></textarea>
          <span class="ct-snooze-char-count" id="ct-snooze-chars">0 / ${level.chars} required</span>
          <div class="ct-snooze-buttons">
            <button class="ct-snooze-btn-cancel" id="ct-snooze-cancel">Cancel</button>
            <button class="ct-snooze-btn-confirm" id="ct-snooze-confirm" disabled>
              Accept Tax & Snooze
            </button>
          </div>
        </div>
      `;

      snoozeShadow.appendChild(snoozeScreen);
      document.documentElement.appendChild(snoozeHost);

      snoozeShadow
        .getElementById("ct-snooze-reason")
        .addEventListener("input", (e) => {
          const len = e.target.value.trim().length;
          snoozeShadow.getElementById("ct-snooze-chars").textContent =
            `${len} / ${level.chars} required`;
          snoozeShadow.getElementById("ct-snooze-confirm").disabled =
            len < level.chars;
        });

      snoozeShadow
        .getElementById("ct-snooze-cancel")
        .addEventListener("click", () => {
          snoozeHost.remove();
        });

      snoozeShadow
        .getElementById("ct-snooze-confirm")
        .addEventListener("click", () => {
          chrome.runtime.sendMessage(
            { type: "SNOOZE_SESSION", extraMins: level.mins },
            (response) => {
              if (response && response.success) {
                snoozeCount = response.snoozeCount;
                session.expiresAt = response.expiresAt;
                snoozeHost.remove();
                updateSnoozeBtn();
                widget.classList.remove("ct-warning", "ct-expired");
              }
            },
          );
        });
    }

    // ─── GUILT SCREEN (Shadow DOM) ────────────────────────────────────────
    function showGuiltScreen() {
      // Extra guard — don't create if already exists
      if (document.getElementById("ct-guilt-host")) return;

      const guiltHost = document.createElement("div");
      guiltHost.id = "ct-guilt-host";
      guiltHost.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
      `;

      const guiltShadow = guiltHost.attachShadow({ mode: "open" });

      const guiltStyle = document.createElement("style");
      guiltStyle.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; }

        #ct-guilt {
          position: fixed;
          inset: 0;
          background: rgba(7, 11, 20, 0.97);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
        }

        .ct-guilt-box {
          background: #0d1526;
          border: 1px solid #0ea5e9;
          border-radius: 16px;
          padding: 40px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow:
            0 0 0 1px #0ea5e915,
            0 0 40px #0ea5e925,
            0 0 100px #0ea5e910;
        }

        .ct-guilt-icon { font-size: 48px; margin-bottom: 12px; display: block; }
        .ct-guilt-title { font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 6px; display: block; text-shadow: 0 0 20px #0ea5e940; }
        .ct-guilt-subtitle { font-size: 15px; color: #7aa0c0; margin-bottom: 24px; display: block; }

        .ct-guilt-stats { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
        .ct-guilt-stat { background: #0a1220; border: 1px solid #1a2d4a; border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .ct-guilt-label { font-size: 11px; color: #334d6a; display: block; }
        .ct-guilt-value { font-size: 20px; font-weight: 700; color: #ffffff; display: block; }
        .ct-guilt-value.ct-over { color: #ef4444; text-shadow: 0 0 10px #ef444440; }
        .ct-guilt-value.ct-ok { color: #10b981; text-shadow: 0 0 10px #10b98140; }

        .ct-guilt-intention { background: #0a1220; border: 1px solid #1a2d4a; border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: left; }
        .ct-guilt-intention-label { font-size: 11px; color: #334d6a; display: block; margin-bottom: 4px; }
        .ct-guilt-intention-text { font-size: 14px; color: #06b6d4; font-style: italic; display: block; text-shadow: 0 0 10px #06b6d430; }

        .ct-guilt-snooze-warning { background: #1a1000; border: 1px solid #f97316; border-radius: 8px; color: #f97316; font-size: 13px; padding: 10px 14px; margin-bottom: 16px; text-align: left; display: block; box-shadow: 0 0 12px #f9731620; }

        .ct-guilt-question { font-size: 16px; color: #c0d8f0; margin-bottom: 16px; font-weight: 600; display: block; }

        .ct-guilt-buttons { display: flex; gap: 10px; }

        .ct-guilt-btn { flex: 1; border-radius: 10px; font-size: 15px; font-weight: 600; padding: 12px; cursor: pointer; transition: all 0.2s; font-family: inherit; }

        .ct-guilt-yes { background: #064e3b; border: 1px solid #10b981; color: #ffffff; box-shadow: 0 0 16px #10b98130; }
        .ct-guilt-yes:hover { background: #065f46; box-shadow: 0 0 24px #10b98150; }

        .ct-guilt-no { background: #450a0a; border: 1px solid #ef4444; color: #ffffff; box-shadow: 0 0 16px #ef444430; }
        .ct-guilt-no:hover { background: #7f1d1d; box-shadow: 0 0 24px #ef444450; }

        .ct-guilt-warning { font-size: 12px; color: #334d6a; margin-top: 12px; display: block; }
      `;

      guiltShadow.appendChild(guiltStyle);

      const actualMins = Math.round((Date.now() - session.startedAt) / 60000);
      const isOver = actualMins > session.durationMins;

      const guiltScreen = document.createElement("div");
      guiltScreen.id = "ct-guilt";
      guiltScreen.innerHTML = `
        <div class="ct-guilt-box">
          <span class="ct-guilt-icon">⏰</span>
          <span class="ct-guilt-title">Time's Up!</span>
          <span class="ct-guilt-subtitle">Your session on ${session.site} has ended.</span>
          <div class="ct-guilt-stats">
            <div class="ct-guilt-stat">
              <span class="ct-guilt-label">Planned</span>
              <span class="ct-guilt-value">${session.durationMins}m</span>
            </div>
            <div class="ct-guilt-stat">
              <span class="ct-guilt-label">Actual</span>
              <span class="ct-guilt-value ${isOver ? "ct-over" : "ct-ok"}">${actualMins}m</span>
            </div>
          </div>
          <div class="ct-guilt-intention">
            <span class="ct-guilt-intention-label">Your intention was:</span>
            <span class="ct-guilt-intention-text">"${session.intention}"</span>
          </div>
          ${
            snoozeCount > 0
              ? `
            <span class="ct-guilt-snooze-warning">
              ⏸️ You snoozed ${snoozeCount} time${snoozeCount > 1 ? "s" : ""} this session.
            </span>
          `
              : ""
          }
          <span class="ct-guilt-question">Did you actually do what you said?</span>
          <div class="ct-guilt-buttons">
            <button class="ct-guilt-btn ct-guilt-yes" id="ct-guilt-yes">✅ Yes, I did</button>
            <button class="ct-guilt-btn ct-guilt-no" id="ct-guilt-no">❌ No, I didn't</button>
          </div>
          <span class="ct-guilt-warning">Saying No will lock this site for 10 minutes ❄️</span>
        </div>
      `;

      guiltShadow.appendChild(guiltScreen);
      document.documentElement.appendChild(guiltHost);

      // Block Escape key
      function blockEscape(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      document.addEventListener("keydown", blockEscape);

      // Block yes/no from being clicked twice
      let sessionEnded = false;

      function endSession(keptPromise) {
        if (sessionEnded) return;
        sessionEnded = true;
        document.removeEventListener("keydown", blockEscape);
        chrome.runtime.sendMessage({ type: "END_SESSION", keptPromise }, () => {
          guiltHost.remove();
          widgetHost.remove();
          window.location.reload();
        });
      }

      guiltShadow
        .getElementById("ct-guilt-yes")
        .addEventListener("click", () => endSession(true));
      guiltShadow
        .getElementById("ct-guilt-no")
        .addEventListener("click", () => endSession(false));
    }
  }
})();

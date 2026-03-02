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
    `;
    document.body.appendChild(widget);

    // Drag support
    let isDragging = false,
      dragOffsetX = 0,
      dragOffsetY = 0;
    widget.addEventListener("mousedown", (e) => {
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

    // Countdown
    function updateTimer() {
      const remaining = expiresAt - Date.now();
      const timeEl = document.getElementById("ct-widget-time");

      if (remaining <= 0) {
        timeEl.textContent = "00:00";
        widget.classList.add("ct-widget-expired");
        showGuiltScreen(session);
        return;
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      timeEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      if (remaining <= 120000) {
        widget.classList.add("ct-widget-warning");
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    // Listen for alarm-triggered expiry
    window.addEventListener("COMMITMENT_TIMER_EXPIRED", () => {
      clearInterval(interval);
      showGuiltScreen(session);
    });
  });

  function showGuiltScreen(session) {
    const existing = document.getElementById("ct-guilt");
    if (existing) return;

    const plannedMins = session.durationMins;
    const actualMins = Math.round((Date.now() - session.startedAt) / 60000);

    const guilt = document.createElement("div");
    guilt.id = "ct-guilt";
    guilt.innerHTML = `
      <div class="ct-guilt-box">
        <div class="ct-guilt-icon">⏰</div>
        <h2 class="ct-guilt-title">Time's up.</h2>
        <p class="ct-guilt-subtitle">Your commitment has ended.</p>

        <div class="ct-guilt-stats">
          <div class="ct-guilt-stat">
            <span class="ct-guilt-label">You said</span>
            <span class="ct-guilt-value">${plannedMins} min</span>
          </div>
          <div class="ct-guilt-stat">
            <span class="ct-guilt-label">You spent</span>
            <span class="ct-guilt-value ${actualMins > plannedMins ? "ct-over" : "ct-ok"}">${actualMins} min</span>
          </div>
        </div>

        <div class="ct-guilt-intention">
          <span class="ct-guilt-label">Your intention was:</span>
          <p class="ct-guilt-intention-text">"${session.intention}"</p>
        </div>

        <p class="ct-guilt-question">Did you actually do what you committed to?</p>

        <div class="ct-guilt-buttons">
          <button id="ct-yes" class="ct-guilt-btn ct-guilt-yes">✅ Yes, I did</button>
          <button id="ct-no" class="ct-guilt-btn ct-guilt-no">❌ No, I got distracted</button>
        </div>
      </div>
    `;

    document.body.appendChild(guilt);

    document.getElementById("ct-yes").addEventListener("click", () => {
      endSession(true, guilt);
    });

    document.getElementById("ct-no").addEventListener("click", () => {
      endSession(false, guilt);
    });
  }

  function endSession(keptPromise, guiltEl) {
    chrome.runtime.sendMessage({ type: "END_SESSION", keptPromise }, () => {
      guiltEl.remove();
      const widget = document.getElementById("ct-widget");
      if (widget) widget.remove();
    });
  }
})();

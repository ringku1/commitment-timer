# 🔒 Commitment Timer

> Browse with intention, not impulse.

A Chrome extension that forces you to commit to a reason before visiting
distracting sites like YouTube, Reddit, or Twitter — then holds you accountable.

## ✨ Features

- 🔒 Intercepts distracting sites with a commitment screen
- ⏱️ Floating countdown timer while you browse
- 😬 Guilt screen when time's up — did you keep your promise?
- 🔥 Streak tracking — consecutive days of kept promises
- ⏸️ Snooze tax — extensions get progressively harder
- ❄️ Cooldown penalty — break a promise, site locked 10 mins
- 📊 Dashboard with honesty score + 30-day calendar
- 🔔 Desktop notifications — 1 min warning + time's up alert
- ⏱️ Overstay detection — auto breaks session at 2x committed time
- 🔘 Enable/disable toggle anytime

---

## 🌐 Supported Browsers

| Browser    | Support       | Install URL           |
| ---------- | ------------- | --------------------- |
| ✅ Chrome  | Full support  | `chrome://extensions` |
| ✅ Edge    | Full support  | `edge://extensions`   |
| ✅ Brave   | Full support  | `brave://extensions`  |
| ✅ Opera   | Full support  | `opera://extensions`  |
| ✅ Firefox | Full support  | `about:debugging`     |
| ❌ Safari  | Not supported | —                     |

---

## 🚀 Install Guide

### Chrome / Edge / Brave / Opera

### Step 1 — Download

![Step 1](docs/images/install-step1.png)

Click the green **Code** button above → **Download ZIP** → save to your computer

---

### Step 2 — Extract

![Step 2](docs/images/install-step2.png)

Find the ZIP in your Downloads folder → right-click → **Extract All**

---

### Step 3 — Load in your browser

![Step 3](docs/images/install-step3.png)

Open your browser and go to the extensions page:

| Browser | URL                   |
| ------- | --------------------- |
| Chrome  | `chrome://extensions` |
| Edge    | `edge://extensions`   |
| Brave   | `brave://extensions`  |
| Opera   | `opera://extensions`  |

1. Enable **Developer mode** (top right toggle)
2. Click **Load unpacked**
3. Select the extracted `Commitment Timer` folder
4. ✅ Done!

---

### 🦊 Firefox

1. Download and extract the ZIP as above
2. Open terminal inside the extracted folder
3. Run the build script:

```bash
bash build-firefox.sh
```

4. Open Firefox → go to `about:debugging`
5. Click **"This Firefox"**
6. Click **"Load Temporary Add-on"**
7. Navigate to `firefox-build/` → select `manifest.json`
8. ✅ Done!

> **Note:** Firefox temporary add-ons are removed when Firefox closes.
> Permanent Firefox install coming soon via Firefox Add-ons store.

---

## 🌐 Blocked Sites (default)

YouTube · Reddit · Twitter · Instagram · TikTok · Facebook · X

You can add/remove sites via the extension settings ⚙️

## 🛡️ Privacy

Everything stays on your device. No data is collected or transmitted ever.
[Privacy Policy](https://YOUR_USERNAME.github.io/commitment-timer/privacy-policy.html)

## 📄 License

MIT

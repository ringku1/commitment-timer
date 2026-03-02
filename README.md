# 🔒 Commitment Timer

A Chrome extension that forces you to commit to an intention before visiting distracting sites like YouTube, Reddit, or Twitter.

## How it works
1. Visit a blocked site (YouTube, Reddit, etc.)
2. Type **why** you're going there — be specific
3. Pick a time limit (5/10/15/30 min)
4. A floating timer appears while you browse
5. When time's up → guilt screen shows your planned vs actual time
6. Track your honesty score over time

## Features
- 🔒 Intercept overlay on blocked sites
- ✍️ Intention validator (rejects vague reasons)
- ⏱️ Floating countdown timer
- 😬 Guilt screen with planned vs actual comparison
- 📊 Dashboard with honesty score & session history
- ⚙️ Settings to add/remove blocked sites

## Installation (Developer Mode)
1. Clone this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the cloned folder

## Tech
- Manifest V3
- Vanilla JavaScript
- Chrome Extension APIs (webNavigation, storage, alarms, scripting)

## Coming Soon
- AI intention validator
- Weekly shame email reports
- Chrome Web Store release

## License
MIT

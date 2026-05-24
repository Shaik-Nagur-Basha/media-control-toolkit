# My Tools — Media Control Toolkit
### Chrome Extension (Manifest V3)

A powerful, production-ready Chrome extension for media control on any website.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔊 **Volume Booster** | Amplify audio up to **3×** using Web Audio API (GainNode) |
| ⚡ **Playback Speed** | Control speed from **0.25×** to **3×** on all video/audio elements |
| 📜 **Smart Scroll** | Programmatic page scrolling with adjustable amount & smoothness |
| 🎬 **Media Capture** | Scan page and download video, audio, images, and icons |
| ⌨️ **Keyboard Shortcuts** | Alt+V (volume), Alt+,/. (speed), Alt+S (scroll) |
| 💾 **Persistent Settings** | All settings saved via `chrome.storage.local` |

---

## 📁 Project Structure

```
media-control-toolkit/
├── manifest.json          ← Manifest V3 config
├── background.js          ← Service worker (keyboard shortcuts, message router)
├── content.js             ← Injected into pages (Web Audio, speed, scroll, scanner)
├── popup/
│   ├── popup.html         ← Extension popup UI
│   ├── popup.css          ← Dark glassmorphism styles
│   └── popup.js           ← Popup controller
├── assets/
│   ├── logo.svg           ← Custom SVG logo
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── utils/
    └── helpers.js         ← Shared utilities
```

---

## 🚀 Installation

### Load Unpacked (Development)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `media-control-toolkit/` folder
5. The extension icon appears in your toolbar ✅

> **Note:** If you don't see the icon, click the puzzle piece icon in Chrome's toolbar and pin "My Tools"

---

## 🎮 Usage

### Volume Booster
1. Open a page with audio/video (YouTube, Spotify, Netflix, etc.)
2. Click the extension icon → **Controls** tab
3. Enable the **Volume Booster** toggle
4. Drag the slider or use presets (1×, 1.5×, 2×, 3×)

### Playback Speed
1. Enable the **Playback Speed** toggle
2. Drag the slider or click a speed preset
3. All `<video>` and `<audio>` elements on the page update instantly

### Smart Scroll
1. Switch to the **Scroll** tab
2. Enable Smart Scroll toggle
3. Set scroll amount (100px–1000px) and behavior (smooth/instant)
4. Click **Scroll Down** or use keyboard shortcut `Alt+S`

### Media Capture
1. Switch to the **Media** tab
2. Click **Scan** — the extension scans the entire page
3. Filter by: All / Video / Audio / Images / Icons
4. Hover over any item → click the download button
5. Use **Download All** to save everything in the current filter

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + V` | Toggle Volume Boost |
| `Alt + .` | Increase playback speed by 0.25× |
| `Alt + ,` | Decrease playback speed by 0.25× |
| `Alt + S` | Smart scroll down |

> Customize shortcuts at `chrome://extensions/shortcuts`

---

## 🔧 Technical Details

### Volume Booster
- Uses the **Web Audio API** (`AudioContext` + `GainNode`)
- Creates a `MediaElementSource` for each `<video>`/`<audio>` element
- Gain nodes stored in a `WeakMap` to prevent duplicates
- Handles cross-origin media gracefully (skips, doesn't break)

### Playback Speed
- Directly sets `element.playbackRate` on all media elements
- `MutationObserver` catches dynamically added elements (SPAs, lazy-load)
- Applied on page navigation via `chrome.tabs.onUpdated`

### Media Scanner
- Scans: `<video>`, `<audio>`, `<img>`, CSS `background-image`, `<link rel="icon">`, `<picture source>`
- Deduplicates by URL via a `Set`
- Classifies into: video / audio / image / icon categories

### Communication Flow
```
Popup → chrome.runtime.sendMessage → Background Service Worker
                                          ↓
                              chrome.tabs.sendMessage → Content Script
                                          ↓
                                    DOM Manipulation
```

---

## 🧪 Testing

### Basic Tests
- [ ] **YouTube**: Volume boost + speed control on video player
- [ ] **Spotify Web**: Volume boost on audio
- [ ] **Netflix**: Speed control
- [ ] **Google Images**: Media scan finds images
- [ ] **Any page**: Smart scroll (Scroll tab → Scroll Down button)
- [ ] **Keyboard shortcuts**: Alt+V, Alt+,/. while video plays

### Edge Cases
- Page with no media → shows "No media found" message
- Cross-origin audio → gracefully skipped, no errors
- New dynamic videos added (e.g., infinite scroll) → auto-captured by MutationObserver

---

## ⚠️ Known Limitations

1. **Cross-origin iframes**: Content scripts don't inject into cross-origin iframes by default (would require additional manifest permissions)
2. **DRM content**: Some DRM-protected streams (Widevine) may restrict Web Audio API access
3. **data: URLs**: Data URIs are excluded from media scan results
4. **Download CORS**: Some files may be blocked by CORS policy on download

---

## 🎨 Design System

| Token | Value |
|---|---|
| Primary | `#6366F1` (Indigo) |
| Accent | `#22C55E` (Green) |
| Purple | `#a855f7` |
| Background | `#0d0f1a` |
| Card | `rgba(255,255,255,0.04)` |
| Font | Inter (Google Fonts) |
| Radius | 12–16px |
| Theme | Dark glassmorphism |

---

## 📄 License

MIT License — free to use, modify, and distribute.

# Media Control Toolkit 🚀
### Premium All-in-One Media & Privacy Browser Extension · Manifest V3

[![Version](https://img.shields.io/badge/version-1.1.0-6366f1.svg?style=flat-square)](https://github.com/Shaik-Nagur-Basha/media-control-toolkit/releases)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-10b981.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

A modern, high-performance browser extension delivering professional Web Audio volume boosting (up to 10×) with dynamic anti-distortion limiting, granular video/audio playback speed control, automated YouTube ad skipping with live top-middle notification toasts, smart page scrolling, a multi-technique media scanner/downloader, and comprehensive cookie privacy auditing.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 🔊 **Dynamic Volume Booster** | Amplify audio up to **10×** using a high-fidelity Web Audio mastering chain (`DynamicsCompressorNode` + `tanh` Soft-Clipper + True-Peak Limiter). Loud, punchy sound dynamically tuned to device hardware limits with zero crackling or distortion. |
| ⏩ **Granular Playback Speed** | Control video & audio speed smoothly from **0.01×** to **4×** with `MutationObserver` guards that persist speed across dynamic SPA video loads (YouTube, Netflix, Spotify). |
| 🛡️ **YouTube Ad Skipper** | Fully automated ad monitor that skips skippable ads instantly, mutes unskippable ads, and accelerates playback during ads. Toggle on/off anytime with **`Ctrl + Shift + Y`** with animated top-middle confirmation toasts. |
| 📜 **Smart Page Scrolling** | Programmatic page scrolling with customizable distance (100px–1000px) and behavior (smooth vs instant). |
| 📦 **Media Scanner & Downloader** | Deep-scans the DOM, background styles, meta tags, and network activity to preview and bulk-download videos, audio, images, icons, and documents into categorized ZIPs. |
| 🍪 **Cookie & Privacy Auditor** | Real-time audit dashboard scoring site tracking risks, analyzing cookie lifetimes, inspecting local/session storage footprints, and offering one-click cleanup with interactive security warning modals before session-clearing modes. |
| ⚡ **1-Click Auto-Updater** | Built-in **`update.bat`** script: 1-click update from GitHub that downloads, extracts, and opens `chrome://extensions` for effortless reloading. |

---

## ⌨️ Keyboard Shortcuts

All shortcuts are carefully chosen to prevent any conflicts with Windows OS or browser shortcuts, staying within Chrome's strict 4-command limit:

| Shortcut | Action | Scope | Confirmation Toast |
| :---: | :--- | :---: | :---: |
| **`Alt + V`** | Toggle Volume Boost ON/OFF | Global | 🟢/🔴 Top-Middle Toast |
| **`Alt + P`** | Toggle Playback Speed ON/OFF | Global | 🟢/🔴 Top-Middle Toast |
| **`Ctrl + Shift + Y`** | Toggle YouTube Ad Skipper ON/OFF | YouTube Only | 🟢/🔴 Top-Middle Toast |

> 💡 *Shortcuts can be customized anytime in Chrome by visiting `chrome://extensions/shortcuts`.*

---

## 🎧 Audio Engineering: Distortion-Free 10× Volume Boost

Traditional volume booster extensions cause harsh digital clipping and speaker rattle when amplifying above 100%. **Media Control Toolkit** solves this with a studio-grade audio processing graph:

```
[HTMLMediaElement Source]
          │
          ▼
     [Pre-Gain]             (Amplifies audio smoothly based on slider)
          │
          ▼
[Dynamics Compressor]       (Dynamically adapts threshold & ratio to physical device limits)
          │
          ▼
    [Soft Clipper]          (Hyperbolic tangent tanh curve with 4x oversampling — zero square-wave distortion)
          │
          ▼
   [Master Limiter]         (0.96 true-peak ceiling prevents DAC inter-sample clipping)
          │
          ▼
[Hardware Audio Output]
```

* **Adaptive Headroom:** When volume increases toward 10×, the compressor threshold dynamically scales down to `-24 dB` and ratio increases up to `20:1` brickwall limiting, elevating quiet dialog while softly reining in loud bursts.
* **Analogue $\tanh$ Saturation:** Hyperbolic tangent rounding ensures smooth peak saturation without the harsh odd harmonics of digital clipping.

---

## 🚀 Installation & Getting Started

### Load Unpacked in Google Chrome

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Shaik-Nagur-Basha/media-control-toolkit.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. In the top-right corner, turn **Developer mode** **ON**.
4. Click the **"Load unpacked"** button in the top-left corner.
5. Select the `media-control-toolkit` folder.
6. Click the **Puzzle Piece (🧩)** icon in the Chrome toolbar and pin **Media Control Toolkit**.

---

## ⚡ Updating to New Versions

### Option 1: 1-Click Updater (`update.bat`) — Recommended
Inside the extension folder, double-click **`update.bat`**:
1. It automatically pulls or downloads the newest release files from GitHub.
2. Extracts and replaces the files in the extension folder.
3. Automatically opens `chrome://extensions` in Chrome.
4. Simply click the **Reload (circle arrow ↺)** icon on Media Control Toolkit!

### Option 2: In-Popup Version Checker
Click **"Check for Updates"** at the bottom of the extension popup. If an update is detected, the **Release Highlights** card will appear with release notes and instructions.

---

## 📁 Repository Structure

```
media-control-toolkit/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Background service worker & GitHub update checker
├── content.js                 # Web Audio graph, speed controllers, toast notifications
├── yt-ad-skipper.js           # Automated YouTube ad monitoring & shortcut listener
├── update.bat                 # 1-click automated Windows updater
├── blockingrules.json         # Declarative net request blocking rules
├── popup/
│   ├── popup.html             # Modern compact glassmorphic interface
│   ├── popup.css              # Obsidian glass styling, segmented tabs & switches
│   └── popup.js               # Popup interactions, storage synchronization
├── assets/
│   ├── logo.svg               # Vector brand logo
│   └── icons/                 # Extension toolbar icons (16, 48, 128)
└── .github/
    └── workflows/
        └── release.yml        # Automated release packaging & CI/CD workflow
```

---

## 🔒 Privacy & Permissions

* **100% CSP-Compliant:** Does not use `eval()`, `new Function()`, or arbitrary remote code execution. All Web Audio logic executes locally inside your browser.
* **No Telemetry / No Tracking:** Zero analytics tracking or external data transmission. All cookie and privacy auditing executes client-side.

---

## 📄 License

Distributed under the **MIT License**. Free to use, modify, and distribute.

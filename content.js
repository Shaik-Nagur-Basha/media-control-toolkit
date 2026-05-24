/**
 * content.js — Media Control Toolkit · Content Script
 *
 * CSP-SAFE: No eval(), no new Function(), no <script> tag injection.
 * All Web Audio API code runs directly inside this content script context.
 *
 * Features:
 *  1. Volume boost via AudioContext + GainNode (direct, no injection)
 *  2. Playback speed control on all <video>/<audio>
 *  3. MutationObserver for dynamic elements (SPAs, lazy-loaders)
 *  4. Smart scroll
 *  5. Advanced multi-technique media scanner
 */

(function () {
  "use strict";

  // ── Guard: prevent double-injection on navigations ──────────────────
  if (window.__MCT_INJECTED__) return;
  window.__MCT_INJECTED__ = true;

  // ══════════════════════════════════════════════════════════════════════
  // 1. WEB AUDIO — GainNode Volume Booster
  //    Runs entirely in the content-script execution context.
  //    No <script> tags, no eval — 100% CSP-safe.
  // ══════════════════════════════════════════════════════════════════════
  let audioCtx = null;
  /** @type {WeakMap<HTMLMediaElement, {source: MediaElementAudioSourceNode, gain: GainNode}>} */
  const gainMap = new WeakMap();

  function getAudioCtx() {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      setupAudioResume();
    }
    return audioCtx;
  }

  function setupAudioResume() {
    const resume = () => {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().then(() => {
          removeListeners();
        }).catch(() => {});
      } else if (audioCtx && audioCtx.state === "running") {
        removeListeners();
      }
    };

    const types = ["click", "keydown", "touchstart", "mousedown"];
    const removeListeners = () => {
      types.forEach((t) => document.removeEventListener(t, resume, true));
    };

    types.forEach((t) => document.addEventListener(t, resume, true));
  }

  function applyGain(el, gainValue) {
    // Skip elements that are on a different origin or not yet buffered
    if (!(el instanceof HTMLMediaElement)) return;
    try {
      const ctx = getAudioCtx();
      if (!gainMap.has(el)) {
        const source = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        gainMap.set(el, { source, gain });
      }
      const { gain } = gainMap.get(el);
      // Smooth ramp — avoids click/pop artefacts
      gain.gain.setTargetAtTime(gainValue, ctx.currentTime, 0.015);
    } catch (_) {
      // Cross-origin restriction or element already sourced elsewhere — silently ignore
    }
  }

  function applyVolumeToAll(gainValue) {
    document
      .querySelectorAll("video, audio")
      .forEach((el) => applyGain(el, gainValue));
    // Also scan iframes we have access to (same-origin only)
    try {
      document.querySelectorAll("iframe").forEach((iframe) => {
        try {
          const doc = iframe.contentDocument;
          if (doc)
            doc
              .querySelectorAll("video, audio")
              .forEach((el) => applyGain(el, gainValue));
        } catch (_) {} // cross-origin blocked
      });
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. PLAYBACK SPEED
  // ══════════════════════════════════════════════════════════════════════
  let currentSpeed = 1.0;
  let speedEnabled = false;

  function applySpeedToAll(speed) {
    currentSpeed = speed;
    document.querySelectorAll("video, audio").forEach((el) => {
      el.playbackRate = speed;
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. MUTATION OBSERVER — Dynamic elements (SPA / lazy-load)
  // ══════════════════════════════════════════════════════════════════════
  let currentGain = 1.0;
  let gainEnabled = false;
  let currentRotation = 0;
  let currentZoom = 100;
  let currentInvert = false;
  let currentMediaTarget = "page";

  const domObserver = new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const mediaEls = [
          ...(node.matches?.("video, audio, img") ? [node] : []),
          ...Array.from(node.querySelectorAll?.("video, audio, img") ?? []),
        ];
        for (const el of mediaEls) {
          if (gainEnabled) applyGain(el, currentGain);
          if (
            speedEnabled &&
            (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement)
          ) {
            el.playbackRate = currentSpeed;
          }
          // Apply media transformations
          const transform = {
            rotation: currentRotation,
            scale: currentZoom / 100,
            invert: currentInvert,
          };
          if (currentRotation !== 0 || currentZoom !== 100 || currentInvert) {
            updateMediaTransform(el, transform);
            mediaTransforms.set(el, transform);
          }
        }
      }
    }
  });

  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4. SMART SCROLL
  // ══════════════════════════════════════════════════════════════════════
  function smartScroll(amount, behavior = "smooth") {
    window.scrollBy({ top: amount, behavior });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. MEDIA MANIPULATION — Rotation, Zoom, Invert
  // ══════════════════════════════════════════════════════════════════════
  const mediaTransforms = new WeakMap();

  function applyRotation(target, angle) {
    const elements = getTargetElements(target);
    elements.forEach((el) => {
      const transform = mediaTransforms.get(el) || {
        rotation: 0,
        scale: 1,
        invert: false,
      };
      transform.rotation = angle;
      updateMediaTransform(el, transform);
      mediaTransforms.set(el, transform);
    });
  }

  function applyZoom(target, level) {
    const elements = getTargetElements(target);
    elements.forEach((el) => {
      const transform = mediaTransforms.get(el) || {
        rotation: 0,
        scale: 1,
        invert: false,
      };
      transform.scale = level;
      updateMediaTransform(el, transform);
      mediaTransforms.set(el, transform);
    });
  }

  function applyInvert(target, enabled) {
    const elements = getTargetElements(target);
    elements.forEach((el) => {
      const transform = mediaTransforms.get(el) || {
        rotation: 0,
        scale: 1,
        invert: false,
      };
      transform.invert = enabled;
      updateMediaTransform(el, transform);
      mediaTransforms.set(el, transform);
    });
  }

  function getTargetElements(target) {
    const elements = [];
    if (target === "page") {
      elements.push(...document.querySelectorAll("img, video"));
      try {
        document.querySelectorAll("iframe").forEach((iframe) => {
          try {
            const doc = iframe.contentDocument;
            if (doc) {
              elements.push(...doc.querySelectorAll("img, video"));
            }
          } catch (_) {}
        });
      } catch (_) {}
    } else if (target === "image") {
      elements.push(...document.querySelectorAll("img"));
      try {
        document.querySelectorAll("iframe").forEach((iframe) => {
          try {
            const doc = iframe.contentDocument;
            if (doc) {
              elements.push(...doc.querySelectorAll("img"));
            }
          } catch (_) {}
        });
      } catch (_) {}
    } else if (target === "video") {
      elements.push(...document.querySelectorAll("video"));
      try {
        document.querySelectorAll("iframe").forEach((iframe) => {
          try {
            const doc = iframe.contentDocument;
            if (doc) {
              elements.push(...doc.querySelectorAll("video"));
            }
          } catch (_) {}
        });
      } catch (_) {}
    } else if (target === "navigate") {
      // Apply to all media elements on page
      elements.push(...document.querySelectorAll("img, video, picture"));
    }
    return elements;
  }

  function updateMediaTransform(el, transform) {
    let css = "";
    if (transform.rotation !== 0) {
      css += `rotate(${transform.rotation}deg) `;
    }
    if (transform.scale !== 1) {
      css += `scale(${transform.scale}) `;
    }
    if (transform.invert) {
      css += `invert(1) `;
    }
    el.style.transform = css.trim() || "none";
    el.style.transformOrigin = "center";
  }

  function getStorageSize(storage) {
    try {
      let total = 0;
      for (let x in storage) {
        if (storage.hasOwnProperty(x)) {
          total += (storage[x].length + x.length) * 2; // approximation in bytes
        }
      }
      return total;
    } catch (_) {
      return 0;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //    J. XHR/Fetch blob URL heuristics via object URLs in DOM
  //    K. PerformanceObserver for real-time fetch/XHR capture
  // ══════════════════════════════════════════════════════════════════════

  // Real-time detection cache for PerformanceObserver
  const performanceCache = new Set();
  const perfObserver = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.entryType === "resource") {
        const url = entry.name;
        const cat = classifyUrl(url);
        if (cat === "video" || cat === "audio") {
          performanceCache.add(url);
        }
      }
    });
  });
  try {
    perfObserver.observe({ type: "resource", buffered: true });
  } catch (e) {}

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
  const HLS_EXTS = new Set(["m3u8", "mpd"]); // streaming manifests
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

  function getExt(url) {
    try {
      const path = new URL(url).pathname;
      const dot = path.lastIndexOf(".");
      if (dot === -1) return "";
      return path
        .slice(dot + 1)
        .toLowerCase()
        .replace(/[?#].*$/, "");
    } catch {
      return "";
    }
  }

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
    return null; // unknown — excluded
  }

  function toAbsolute(url) {
    if (!url || url.startsWith("data:") || url.startsWith("javascript:"))
      return null;
    try {
      return new URL(url, location.href).href;
    } catch {
      return null;
    }
  }

  function getFilename(url) {
    try {
      const p = new URL(url).pathname;
      return decodeURIComponent(p.split("/").pop() || "file");
    } catch {
      return "file";
    }
  }

  function formatDuration(sec) {
    if (!sec || !isFinite(sec)) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  function scanPageMedia() {
    const seen = new Set();
    const result = { video: [], audio: [], image: [], icon: [], document: [], link: [] };

    function add(category, entry) {
      if (!result[category] || !entry?.url) return;
      const seenKey = `${category}:${entry.url}`;
      if (seen.has(seenKey)) return;
      seen.add(seenKey);
      if (result[category]) result[category].push(entry);
    }

    // ── A. <video> & <audio> DOM elements ──────────────────────────────
    document.querySelectorAll("video, audio").forEach((el) => {
      const isVideo = el.tagName === "VIDEO";
      const cat = isVideo ? "video" : "audio";
      // direct src
      if (el.src) add(cat, makeMediaEntry(el, el.src, cat));
      // <source> children
      el.querySelectorAll("source").forEach((s) => {
        const url = toAbsolute(s.src || s.getAttribute("src"));
        if (url) add(cat, makeMediaEntry(el, url, cat, s.type));
      });
      // currentSrc (what browser actually picked)
      if (el.currentSrc && el.currentSrc !== el.src) {
        add(cat, makeMediaEntry(el, el.currentSrc, cat));
      }
    });

    function makeMediaEntry(el, rawUrl, cat, mimeHint = "") {
      const url = toAbsolute(rawUrl);
      if (!url) return null;
      const isVideo = cat === "video";
      return {
        url,
        type: cat,
        tag: el.tagName.toLowerCase(),
        filename: getFilename(url),
        width: isVideo ? el.videoWidth || el.clientWidth || 0 : 0,
        height: isVideo ? el.videoHeight || el.clientHeight || 0 : 0,
        duration: formatDuration(el.duration),
        durationSec: isFinite(el.duration) ? Math.round(el.duration) : null,
        poster: isVideo ? toAbsolute(el.poster) || null : null,
        mime: mimeHint || "",
      };
    }

    // ── B. <img>, <picture>, srcset, data-src (lazy loaders) ───────────
    document.querySelectorAll("img").forEach((el) => {
      // currentSrc picks best responsive candidate automatically
      const urls = new Set(
        [
          el.src,
          el.currentSrc,
          el.getAttribute("data-src"),
          el.getAttribute("data-lazy-src"),
          el.getAttribute("data-original"),
          el.getAttribute("data-url"),
          el.getAttribute("lazysrc"),
        ]
          .filter(Boolean)
          .map(toAbsolute)
          .filter(Boolean),
      );

      // parse srcset
      const srcset =
        el.getAttribute("srcset") || el.getAttribute("data-srcset") || "";
      srcset.split(",").forEach((part) => {
        const u = toAbsolute(part.trim().split(/\s+/)[0]);
        if (u) urls.add(u);
      });

      urls.forEach((url) => {
        if (url.startsWith("data:")) return;
        const ext = getExt(url);
        const cat = ICON_EXTS.has(ext) ? "icon" : "image";
        add(cat, {
          url,
          type: cat,
          tag: "img",
          filename: getFilename(url),
          width: el.naturalWidth || el.clientWidth || 0,
          height: el.naturalHeight || el.clientHeight || 0,
          alt: el.alt || "",
        });
      });
    });

    // <picture><source srcset>
    document.querySelectorAll("picture source").forEach((el) => {
      const srcset = el.getAttribute("srcset") || "";
      srcset.split(",").forEach((part) => {
        const url = toAbsolute(part.trim().split(/\s+/)[0]);
        if (url)
          add("image", {
            url,
            type: "image",
            tag: "picture",
            filename: getFilename(url),
          });
      });
    });

    // ── C. CSS computed background-image ───────────────────────────────
    // Optimized: Only scan elements most likely to have background images to avoid full DOM walk
    const bgCandidates = document.querySelectorAll(
      "div, span, a, section, header, footer, article, figure, main, aside, .bg, .image, .hero, .banner, .thumbnail, .poster",
    );
    bgCandidates.forEach((el) => {
      try {
        const style = getComputedStyle(el);
        const bg = style.backgroundImage;
        if (!bg || bg === "none") return;
        const matches = [...bg.matchAll(/url\(["']?([^"')\s]+)["']?\)/g)];
        matches.forEach((m) => {
          const url = toAbsolute(m[1]);
          if (!url || url.startsWith("data:")) return;
          const ext = getExt(url);
          const cat = ICON_EXTS.has(ext) ? "icon" : "image";
          add(cat, {
            url,
            type: cat,
            tag: "css-bg",
            filename: getFilename(url),
            width: el.clientWidth,
            height: el.clientHeight,
          });
        });
      } catch (_) {}
    });

    // ── D. Inline style attributes ─────────────────────────────────────
    document.querySelectorAll('[style*="url("]').forEach((el) => {
      const attr = el.getAttribute("style") || "";
      const matches = [...attr.matchAll(/url\(["']?([^"')\s]+)["']?\)/g)];
      matches.forEach((m) => {
        const url = toAbsolute(m[1]);
        if (!url || url.startsWith("data:")) return;
        const ext = getExt(url);
        const cat = ICON_EXTS.has(ext) ? "icon" : "image";
        add(cat, {
          url,
          type: cat,
          tag: "inline-style",
          filename: getFilename(url),
        });
      });
    });

    // ── E. <link rel="icon|preload|stylesheet"> ─────────────────────────
    document.querySelectorAll("link").forEach((el) => {
      const rel = (el.rel || "").toLowerCase();
      const href = toAbsolute(el.href || el.getAttribute("href"));
      if (!href) return;

      if (
        rel.includes("icon") ||
        rel === "apple-touch-icon" ||
        rel === "mask-icon" ||
        rel === "shortcut icon"
      ) {
        add("icon", {
          url: href,
          type: "icon",
          tag: "link-icon",
          filename: getFilename(href),
          sizes: el.getAttribute("sizes") || "",
        });
      } else if (rel === "preload") {
        const as = (el.getAttribute("as") || "").toLowerCase();
        if (as === "video")
          add("video", {
            url: href,
            type: "video",
            tag: "link-preload",
            filename: getFilename(href),
          });
        else if (as === "audio")
          add("audio", {
            url: href,
            type: "audio",
            tag: "link-preload",
            filename: getFilename(href),
          });
        else if (as === "image")
          add("image", {
            url: href,
            type: "image",
            tag: "link-preload",
            filename: getFilename(href),
          });
      }
    });

    // ── F. <meta> Open Graph / Twitter Card ────────────────────────────
    const ogImageMeta = [
      "og:image",
      "og:image:url",
      "twitter:image",
      "twitter:image:src",
      "og:video",
      "og:video:url",
      "og:audio",
      "og:audio:url",
    ];
    ogImageMeta.forEach((name) => {
      const el = document.querySelector(
        `meta[property="${name}"], meta[name="${name}"]`,
      );
      const rawUrl = el?.getAttribute("content");
      const url = toAbsolute(rawUrl);
      if (!url) return;
      if (name.includes("video"))
        add("video", {
          url,
          type: "video",
          tag: "og-meta",
          filename: getFilename(url),
        });
      else if (name.includes("audio"))
        add("audio", {
          url,
          type: "audio",
          tag: "og-meta",
          filename: getFilename(url),
        });
      else
        add("image", {
          url,
          type: "image",
          tag: "og-meta",
          filename: getFilename(url),
        });
    });

    // ── G. JSON-LD structured data ─────────────────────────────────────
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((el) => {
        try {
          const data = JSON.parse(el.textContent);
          const items = Array.isArray(data) ? data : [data];
          items.forEach((item) => {
            const extract = (obj) => {
              if (!obj || typeof obj !== "object") return;
              [
                "contentUrl",
                "embedUrl",
                "thumbnailUrl",
                "image",
                "logo",
                "url",
              ].forEach((key) => {
                const val = obj[key];
                if (typeof val === "string") {
                  const url = toAbsolute(val);
                  if (!url) return;
                  const cat = classifyUrl(url);
                  if (cat)
                    add(cat, {
                      url,
                      type: cat,
                      tag: "json-ld",
                      filename: getFilename(url),
                    });
                }
              });
              Object.values(obj).forEach((v) => {
                if (v && typeof v === "object") extract(v);
              });
            };
            extract(item);
          });
        } catch (_) {}
      });

    // ── H. Performance Resource Timing API (network-level) ─────────────
    // Catches media loaded via JS, XHR, fetch, dynamic script, etc.
    try {
      const entries = performance.getEntriesByType("resource");
      entries.forEach((entry) => {
        const url = toAbsolute(entry.name);
        if (!url) return;
        const cat = classifyUrl(url);
        if (!cat) return;

        // Only add if not already found via DOM
        if (!seen.has(url)) {
          add(cat, {
            url,
            type: cat,
            tag: `perf-${entry.initiatorType || "fetch"}`,
            filename: getFilename(url),
            size: entry.transferSize || entry.encodedBodySize || 0,
          });
        }
      });
      // Also add from our observer cache
      performanceCache.forEach((url) => {
        const abs = toAbsolute(url);
        if (abs)
          add(classifyUrl(abs), {
            url: abs,
            type: classifyUrl(abs),
            tag: "perf-observer",
            filename: getFilename(abs),
          });
      });
    } catch (_) {}

    // ── I. Shadow DOM Traversal ─────────────────────────────────────────
    function scanShadowRoot(root) {
      if (!root) return;
      root.querySelectorAll("video, audio, img").forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (tag === "video" || tag === "audio") {
          const cat = tag === "video" ? "video" : "audio";
          const url = toAbsolute(el.src || el.currentSrc);
          if (url)
            add(cat, {
              url,
              type: cat,
              tag: `shadow-${tag}`,
              filename: getFilename(url),
              duration: formatDuration(el.duration),
              poster: tag === "video" ? toAbsolute(el.poster) : null,
            });
        } else if (tag === "img") {
          const url = toAbsolute(el.currentSrc || el.src);
          if (url && !url.startsWith("data:")) {
            const cat = ICON_EXTS.has(getExt(url)) ? "icon" : "image";
            add(cat, {
              url,
              type: cat,
              tag: "shadow-img",
              filename: getFilename(url),
            });
          }
        }
      });
      // Recurse into nested shadow roots
      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) scanShadowRoot(el.shadowRoot);
      });
    }
    document.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) scanShadowRoot(el.shadowRoot);
    });

    // ── J. Video.js / HLS.js / JWPlayer data attributes ───────────────
    const videoDataAttrs = [
      "data-src",
      "data-video-src",
      "data-mp4",
      "data-webm",
      "data-hls",
      "data-m3u8",
      "data-stream-url",
      "data-source-url",
    ];
    document
      .querySelectorAll("[" + videoDataAttrs.join("],[") + "]")
      .forEach((el) => {
        videoDataAttrs.forEach((attr) => {
          const val = el.getAttribute(attr);
          const url = toAbsolute(val);
          if (!url) return;
          const cat = classifyUrl(url) || "video";
          if (cat === "video" || cat === "audio") {
            add(cat, {
              url,
              type: cat,
              tag: `data-attr:${attr}`,
              filename: getFilename(url),
            });
          }
        });
      });

    // ── K. <canvas> — detect canvas used for video playback ────────────
    document.querySelectorAll("canvas").forEach((el) => {
      // Can't extract blob/frame but can detect canvas sized like a video viewport
      if (el.clientWidth > 200 && el.clientHeight > 100) {
        try {
          const dataUrl = el.toDataURL(); // will throw on tainted/cross-origin
          if (dataUrl && dataUrl !== "data:,") {
            // canvas snapshot as image
            add("image", {
              url: dataUrl,
              type: "image",
              tag: "canvas-snapshot",
              filename: "canvas-frame.png",
              width: el.width,
              height: el.height,
              isDataUrl: true,
            });
          }
        } catch (_) {}
      }
    });

    // ── L. <object> and <embed> legacy media ───────────────────────────
    document.querySelectorAll("object[data], embed[src]").forEach((el) => {
      const rawUrl = el.getAttribute("data") || el.getAttribute("src");
      const url = toAbsolute(rawUrl);
      if (!url) return;
      const mime = el.getAttribute("type") || "";
      const cat = classifyUrl(url, mime);
      if (cat)
        add(cat, {
          url,
          type: cat,
          tag: el.tagName.toLowerCase(),
          filename: getFilename(url),
          mime,
        });
    });

    // ── N. Inline <svg> tags ───────────────────────────────────────────
    // Captures icons that are embedded directly in the HTML
    document.querySelectorAll("svg").forEach((el, idx) => {
      // Skip if already in a link or image we might have caught
      if (el.closest("a, img, picture")) return;

      // Only capture meaningful SVGs (e.g. icons, not tiny spacers)
      const box = el.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) return;

      try {
        const svgData = new XMLSerializer().serializeToString(el);
        // Ensure xmlns is present for standalone rendering
        let finalSvg = svgData;
        if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
          finalSvg = svgData.replace(
            "<svg",
            '<svg xmlns="http://www.w3.org/2000/svg"',
          );
        }
        const dataUrl =
          "data:image/svg+xml;base64," +
          btoa(unescape(encodeURIComponent(finalSvg)));
        add("icon", {
          url: dataUrl,
          type: "icon",
          tag: "inline-svg",
          filename: `icon_${idx}.svg`,
          width: box.width,
          height: box.height,
          isDataUrl: true,
        });
      } catch (_) {}
    });

    // ── O. <a> tags linking directly to media ──────────────────────────
    document.querySelectorAll("a[href]").forEach((el) => {
      const url = toAbsolute(el.href);
      if (!url) return;

      // Try to classify by URL first
      let cat = classifyUrl(url);
      const linkedImage = el.querySelector("img");

      // If not caught by URL, check the 'download' attribute filename
      const downloadAttr = el.getAttribute("download");
      if (!cat && downloadAttr) {
        cat = classifyUrl(downloadAttr);
      }

      // Many image gallery links use extensionless CDN URLs. If the link wraps
      // an image, treat the href as an image link so it appears in Images too.
      if (!cat && linkedImage) {
        cat = "image";
      }

      if (cat) {
        const linkText = el.textContent.trim();
        const linkedImageUrl = linkedImage
          ? toAbsolute(linkedImage.currentSrc || linkedImage.src)
          : null;
        const attrFilename = downloadAttr || "";
        const finalFilename =
          getFilename(url) !== "file"
            ? getFilename(url)
            : attrFilename ||
              linkedImage?.alt?.trim().slice(0, 30) ||
              linkText.slice(0, 30) ||
              "media_file";

        const entry = {
          url,
          type: cat,
          tag: "link",
          filename: finalFilename,
          text: linkText,
          thumb: linkedImageUrl,
        };

        // Add to its specific category
        add(cat, entry);

        // ALWAYS add to 'link' category if it's a media/doc link
        add("link", {
          ...entry,
          type: "link",
          originalType: cat,
        });
      }
    });

    // ── M. HLS/DASH Manifest Parsing ───────────────────────────────────
    // If we found an m3u8 or mpd, we can try to fetch it to see qualities.
    // This is async and normally slow for a 'sync' scan, but we can return
    // the URLs now and the UI can fetch details later if needed.
    // For now, we just ensure they are captured.

    // Add total counts to each section
    Object.keys(result).forEach((k) => {
      result[k] = result[k].filter(Boolean); // final null-check
    });

    return result;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. MESSAGE LISTENER
  // ══════════════════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.target !== "content") return false;

    switch (message.action) {
      case "setVolume": {
        currentGain = message.value;
        gainEnabled = message.value > 1.0;
        applyVolumeToAll(message.value);
        sendResponse({ ok: true });
        break;
      }
      case "setSpeed": {
        currentSpeed = message.value;
        speedEnabled = message.value !== 1.0;
        applySpeedToAll(message.value);
        sendResponse({ ok: true });
        break;
      }
      case "scrollDown": {
        smartScroll(message.amount ?? 300, message.smoothness ?? "smooth");
        sendResponse({ ok: true });
        break;
      }
      case "scanMedia": {
        try {
          const media = scanPageMedia();
          sendResponse({ media });
        } catch (e) {
          sendResponse({ error: e.message });
        }
        break;
      }
      case "getPrivacyData": {
        try {
          const data = {
            storage: {
              local: getStorageSize(localStorage),
              session: getStorageSize(sessionStorage),
            },
            scripts: Array.from(document.scripts)
              .map((s) => s.src)
              .filter(Boolean),
            permissions: {}, // checked in popup usually but can hint here
          };
          sendResponse({ data });
        } catch (e) {
          sendResponse({ error: e.message });
        }
        break;
      }
      case "clearStorage": {
        try {
          localStorage.clear();
          sessionStorage.clear();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ error: e.message });
        }
        break;
      }
      case "ping": {
        sendResponse({ ok: true, url: location.href });
        break;
      }
      case "setPageTheme": {
        applyPageTheme(message.theme);
        sendResponse({ ok: true });
        break;
      }
      case "rotate": {
        applyRotation(message.target, message.angle);
        sendResponse({ ok: true });
        break;
      }
      case "zoom": {
        applyZoom(message.target, message.level);
        sendResponse({ ok: true });
        break;
      }
      case "invert": {
        applyInvert(message.target, message.enabled);
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: "unknown action" });
    }

    return true; // keep port open for async
  });

  // ══════════════════════════════════════════════════════════════════════
  // PAGE THEME INJECTION
  // ══════════════════════════════════════════════════════════════════════
  const PAGE_THEME_ID = "__mct_page_theme__";

  function buildPageThemeCSS(theme) {
    switch (theme) {
      case "dark":
        // Force a dark background + light text using a CSS layer so it
        // doesn't aggressively override every site's own colour scheme —
        // instead we nudge the colour-scheme so the browser picks dark
        // system controls and scrollbars, then tint uncoloured surfaces.
        return `
          :root { color-scheme: dark !important; }
          html {
            background-color: #0d0f1a !important;
            color: #e8eaf6 !important;
          }
          body {
            background-color: #0d0f1a !important;
            color: #e8eaf6 !important;
          }
          /* Low-specificity nudge: surfaces that have no bg get a dark default */
          *:not(img):not(video):not(canvas):not(svg):not(iframe):not([style*="background-image"]) {
            background-color: inherit;
            color: inherit;
          }
        `;

      case "light":
        return `
          :root { color-scheme: light !important; }
          html {
            filter: none !important;
            background-color: #ffffff !important;
            color: #1a1a2e !important;
          }
          body {
            background-color: #ffffff !important;
            color: #1a1a2e !important;
          }
        `;

      case "invert":
        // Invert the whole page, then counter-invert media so images/videos
        // look natural. hue-rotate(180deg) cancels the hue shift from invert.
        return `
          html {
            filter: invert(1) hue-rotate(180deg) !important;
            -webkit-filter: invert(1) hue-rotate(180deg) !important;
            background-color: #fff !important;
          }
          img, video, canvas, picture, svg image,
          [style*="background-image"],
          iframe {
            filter: invert(1) hue-rotate(180deg) !important;
            -webkit-filter: invert(1) hue-rotate(180deg) !important;
          }
          /* Preserve colour accuracy in videos */
          video {
            filter: invert(1) hue-rotate(180deg) !important;
            -webkit-filter: invert(1) hue-rotate(180deg) !important;
          }
        `;

      case "system":
        // Use the OS colour-scheme preference — the browser handles the rest
        return `
          :root { color-scheme: light dark !important; }
        `;

      default:
        return ""; // no override — remove style tag
    }
  }

  function applyPageTheme(theme) {
    // Find or create the injected style element
    let style = document.getElementById(PAGE_THEME_ID);

    if (!theme || theme === "none") {
      // Remove theme entirely
      if (style) style.remove();
      return;
    }

    const newCSS = buildPageThemeCSS(theme);
    if (!newCSS) {
      if (style) style.remove();
      return;
    }

    // Add a smooth transition wrapper so theme changes don't flash like a reload
    const transitionCSS = `
      html, body, *:not(img):not(video):not(canvas):not(iframe):not(svg) {
        transition: background-color 0.25s ease, color 0.2s ease, border-color 0.2s ease !important;
      }
    `;

    if (style) {
      // Update in-place — avoids remove+reinsert which causes a visible flash
      style.textContent = transitionCSS + newCSS;
    } else {
      style = document.createElement("style");
      style.id = PAGE_THEME_ID;
      style.textContent = transitionCSS + newCSS;
      // Insert at very end of <head> for highest cascade priority
      (document.head || document.documentElement).appendChild(style);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. RESTORE PERSISTED SETTINGS ON PAGE LOAD
  // ══════════════════════════════════════════════════════════════════════
  (async function restoreSettings() {
    // Build site-specific key (same logic as popup.js)
    let siteKey = "";
    try {
      const host = location.hostname.replace(/^www\./, "");
      if (host) siteKey = `theme_site_${host}`;
    } catch (_) {}

    const keysToLoad = [
      "volumeBoost",
      "volumeEnabled",
      "speed",
      "speedEnabled",
      "globalTheme",
    ];
    if (siteKey) keysToLoad.push(siteKey);

    chrome.storage.local.get(keysToLoad, (settings) => {
      // ── Volume ──
      if (settings.volumeEnabled && settings.volumeBoost > 1) {
        currentGain = settings.volumeBoost;
        gainEnabled = true;
        // Wait for media elements to appear — critical for SPAs
        setTimeout(() => applyVolumeToAll(settings.volumeBoost), 800);
        setTimeout(() => applyVolumeToAll(settings.volumeBoost), 2500);
      }
      // ── Speed ──
      if (settings.speedEnabled && settings.speed) {
        currentSpeed = settings.speed;
        speedEnabled = true;
        setTimeout(() => applySpeedToAll(settings.speed), 800);
        setTimeout(() => applySpeedToAll(settings.speed), 2500);
      }
      // ── Page Theme ──
      // Only restore if user has explicitly chosen a theme (globalThemeSet flag).
      // This prevents forcing dark mode on every site on first install.
      const siteTheme = siteKey ? settings[siteKey] : null;
      const pageTheme = siteTheme; // Strictly site-specific
      if (
        pageTheme &&
        ["dark", "light", "invert", "system"].includes(pageTheme)
      ) {
        applyPageTheme(pageTheme);
      }
    });
  })();
})();

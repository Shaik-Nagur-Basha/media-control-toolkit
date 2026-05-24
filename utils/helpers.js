/**
 * utils/debounce.js — Utility functions
 */

/**
 * Debounce: delays execution until after `wait` ms of inactivity
 */
export function debounce(fn, wait = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Format bytes to human-readable
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get file extension from URL
 */
export function getExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase().split('?')[0] : '';
  } catch {
    return '';
  }
}

/**
 * Classify a URL into a media category
 */
export function classifyMedia(url, mimeType = '') {
  const ext = getExtension(url);
  const mime = mimeType.toLowerCase();

  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm3u8', 'flv', 'ts'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'opus'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'tiff'];
  const iconExts = ['svg', 'ico', 'cur'];

  if (mime.startsWith('video') || videoExts.includes(ext)) return 'video';
  if (mime.startsWith('audio') || audioExts.includes(ext)) return 'audio';
  if (iconExts.includes(ext) || mime.includes('svg')) return 'icon';
  if (mime.startsWith('image') || imageExts.includes(ext)) return 'image';
  return 'other';
}

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

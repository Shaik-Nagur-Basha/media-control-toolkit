(function () {
  if (window.YTStorageManager) return;

  function get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function set(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, resolve);
    });
  }

  function subscribe(callback) {
    chrome.storage.onChanged.addListener(callback);
  }

  window.YTStorageManager = {
    get,
    set,
    subscribe,
  };
})();

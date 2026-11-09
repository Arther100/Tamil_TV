// Loads the playlist with timeout + cache. Cache keeps the last known-good catalogue.
(function () {
  "use strict";
  var URL = "https://iptv-org.github.io/iptv/languages/tam.m3u";
  var CACHE_KEY = "tamiltv.catalogue.v2"; // bumped: channel model changed (categories, resolution)
  var MAX_AGE_MS = 12 * 60 * 60 * 1000;

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeCache(channels) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), channels: channels }));
    } catch (e) { /* storage full or unavailable: ignore */ }
  }

  function fetchText(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.timeout = timeoutMs;
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
        else reject(new Error("HTTP " + xhr.status));
      };
      xhr.onerror = function () { reject(new Error("Network error")); };
      xhr.ontimeout = function () { reject(new Error("Timed out")); };
      xhr.send();
    });
  }

  // Resolves { channels, source: "cache"|"network", at, error? }
  function load(forceRefresh) {
    var cache = readCache();
    var fresh = cache && (Date.now() - cache.at) < MAX_AGE_MS;
    if (cache && fresh && !forceRefresh) {
      return Promise.resolve({ channels: cache.channels, source: "cache", at: cache.at });
    }
    return fetchText(URL, 20000).then(function (text) {
      var res = window.parseM3U(text);
      if (!res.channels.length) throw new Error("Playlist had no valid channels");
      writeCache(res.channels);
      return { channels: res.channels, source: "network", at: Date.now(), warnings: res.warnings };
    }).catch(function (err) {
      if (cache) return { channels: cache.channels, source: "cache", at: cache.at, error: err.message };
      throw err;
    });
  }

  window.Playlist = { load: load, URL: URL };
})();

// M3U parser. Returns { channels, warnings }. Never throws on a bad entry.
(function (root) {
  "use strict";

  function parseAttrs(str) {
    var attrs = {};
    var re = /([A-Za-z0-9_-]+)="([^"]*)"/g;
    var m;
    while ((m = re.exec(str)) !== null) attrs[m[1].toLowerCase()] = m[2];
    return attrs;
  }

  // Split '#EXTINF:-1 a="x, y" b="z",Display, Name' at the first comma outside quotes.
  function splitExtinf(line) {
    var inQuote = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (c === '"') inQuote = !inQuote;
      else if (c === "," && !inQuote) return [line.slice(0, i), line.slice(i + 1)];
    }
    return [line, ""];
  }

  function isHttpUrl(u) { return /^https?:\/\/[^\s]+$/i.test(u); }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function parseM3U(text) {
    var warnings = [];
    var channels = [];
    if (typeof text !== "string" || text.replace(/^﻿/, "").indexOf("#EXTM3U") !== 0) {
      return { channels: [], warnings: ["Missing #EXTM3U header"] };
    }
    var lines = text.replace(/\r\n?/g, "\n").split("\n");
    var pending = null;
    var seen = {};

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.indexOf("#EXTINF") === 0) {
        var parts = splitExtinf(line);
        var attrs = parseAttrs(parts[0]);
        pending = { attrs: attrs, name: (parts[1] || attrs["tvg-name"] || "").trim() };
        continue;
      }
      if (line.charAt(0) === "#") continue; // other tags/comments (#EXTVLCOPT etc.)
      if (!pending) continue;

      if (!isHttpUrl(line)) {
        warnings.push("Skipped non-HTTP(S) URL for " + pending.name);
        pending = null;
        continue;
      }
      if (!pending.name) {
        warnings.push("Skipped entry with no name");
        pending = null;
        continue;
      }
      var logo = pending.attrs["tvg-logo"];
      var key = (pending.attrs["tvg-id"] || pending.name.toLowerCase()) + "|" + line;
      if (seen[key]) { pending = null; continue; } // de-duplicate
      seen[key] = true;

      channels.push({
        id: pending.attrs["tvg-id"] ? pending.attrs["tvg-id"] + "-" + hash(line) : hash(key),
        name: pending.name,
        language: "tam",
        category: (pending.attrs["group-title"] || "").trim() || "Other",
        logoUrl: logo && isHttpUrl(logo) ? logo : null,
        streamUrl: line,
        quality: "unknown",           // never inferred from the name
        authorizationStatus: "unverified"
      });
      pending = null;
    }
    return { channels: channels, warnings: warnings };
  }

  root.parseM3U = parseM3U;
  if (typeof module !== "undefined") module.exports = { parseM3U: parseM3U };
})(typeof window !== "undefined" ? window : globalThis);

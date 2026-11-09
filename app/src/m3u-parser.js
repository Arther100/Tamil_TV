// M3U parser. Returns { channels, warnings }. Never throws on a bad entry.
(function (root) {
  "use strict";

  var HD_CATEGORY = "HD Channels";

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

  // iptv-org appends "(1080p)" and tags like "[Geo-blocked]" to names.
  // Move them out of the display name. Resolution is the playlist's own label,
  // not something measured by this app.
  function cleanName(raw) {
    var res = null;
    var tags = [];
    var name = raw.replace(/\s*\((\d{3,4})p\)/i, function (m, r) { res = parseInt(r, 10); return ""; });
    name = name.replace(/\s*\[([^\]]*)\]/g, function (m, t) { tags.push(t.trim()); return ""; });
    name = name.replace(/\s+/g, " ").trim();
    return { name: name, resolution: res, tags: tags };
  }

  function qualityFrom(res) {
    if (res === null || res === undefined) return "unknown";
    if (res >= 2160) return "uhd";
    if (res >= 1080) return "full-hd";
    if (res >= 720) return "hd";
    return "sd";
  }

  // 'Animation;Kids' -> ['Animation', 'Kids']
  function splitCategories(group) {
    var out = [];
    var seen = {};
    (group || "").split(";").forEach(function (p) {
      p = p.trim();
      if (!p || /^undefined$/i.test(p)) return;
      p = p.charAt(0).toUpperCase() + p.slice(1);
      var k = p.toLowerCase();
      if (!seen[k]) { seen[k] = true; out.push(p); }
    });
    return out.length ? out : ["Other"];
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
        pending = { attrs: attrs, rawName: (parts[1] || attrs["tvg-name"] || "").trim() };
        continue;
      }
      if (line.charAt(0) === "#") continue; // other tags/comments
      if (!pending) continue;

      var cleaned = cleanName(pending.rawName);
      if (!isHttpUrl(line)) {
        warnings.push("Skipped non-HTTP(S) URL for " + (cleaned.name || "unnamed entry"));
        pending = null;
        continue;
      }
      if (!cleaned.name) {
        warnings.push("Skipped entry with no name");
        pending = null;
        continue;
      }
      var logo = pending.attrs["tvg-logo"];
      var key = (pending.attrs["tvg-id"] || pending.rawName.toLowerCase()) + "|" + line;
      if (seen[key]) { pending = null; continue; } // de-duplicate
      seen[key] = true;

      var quality = qualityFrom(cleaned.resolution);
      var categories = splitCategories(pending.attrs["group-title"]);
      if (quality === "hd" || quality === "full-hd" || quality === "uhd") categories.push(HD_CATEGORY);

      channels.push({
        id: pending.attrs["tvg-id"] ? pending.attrs["tvg-id"] + "-" + hash(line) : hash(key),
        name: cleaned.name,
        language: "tam",
        category: categories[0],
        categories: categories,
        logoUrl: logo && isHttpUrl(logo) ? logo : null,
        streamUrl: line,
        quality: quality,              // from the playlist's own label only
        resolution: cleaned.resolution,
        tags: cleaned.tags,
        authorizationStatus: "unverified"
      });
      pending = null;
    }
    return { channels: channels, warnings: warnings };
  }

  root.parseM3U = parseM3U;
  root.HD_CATEGORY = HD_CATEGORY;
  if (typeof module !== "undefined") module.exports = { parseM3U: parseM3U, HD_CATEGORY: HD_CATEGORY };
})(typeof window !== "undefined" ? window : globalThis);

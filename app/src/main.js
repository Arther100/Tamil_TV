(function () {
  "use strict";

  // webOS Back = 461. Esc/Backspace are desktop-browser fallbacks. 82 = R.
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 461, ESC: 27, BKSP: 8, R: 82 };
  var COLS = 4;
  var PAD = 12;

  var MESSAGES = {
    timeout: "This channel is taking too long to start. It may be temporarily unavailable.",
    network: "Could not reach this stream. It may be offline, geo-restricted, or blocked by the browser (CORS). It may still work on the TV.",
    unsupported: "This stream is not supported on this device.",
    media: "The stream failed while playing.",
    lib: "Could not load the video library. Check your internet connection."
  };

  var state = {
    mode: "browse",        // "browse" | "player"
    zone: "grid",          // "rail" | "grid"
    categories: ["All"],
    counts: {},
    category: "All",
    catIndex: 0,
    gridIndex: 0,
    all: [],
    channels: [],
    playerState: "idle"
  };

  var el = {
    cats: document.getElementById("categories"),
    grid: document.getElementById("grid"),
    key: document.getElementById("lastKey"),
    code: document.getElementById("lastCode"),
    focus: document.getElementById("focusInfo"),
    status: document.getElementById("status"),
    player: document.getElementById("player"),
    video: document.getElementById("video"),
    overlay: document.getElementById("overlay"),
    ovLogo: document.getElementById("ovLogo"),
    ovName: document.getElementById("ovName"),
    ovMeta: document.getElementById("ovMeta"),
    msg: document.getElementById("playMsg")
  };

  var overlayTimer = null;

  // textContent only: playlist data is untrusted and never injected as HTML.
  function span(text) {
    var s = document.createElement("span");
    s.textContent = text;
    return s;
  }

  function keepVisible(container, node) {
    var top = node.offsetTop;
    var bottom = top + node.offsetHeight;
    if (top - PAD < container.scrollTop) container.scrollTop = Math.max(0, top - PAD);
    else if (bottom + PAD > container.scrollTop + container.clientHeight) {
      container.scrollTop = bottom + PAD - container.clientHeight;
    }
  }

  // ---------- catalogue ----------
  function catsOf(c) { return c.categories || [c.category || "Other"]; }

  function buildCategories() {
    var counts = {};
    state.all.forEach(function (c) {
      catsOf(c).forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
    });
    var hd = window.HD_CATEGORY || "HD Channels";
    var names = Object.keys(counts).filter(function (n) { return n !== hd; }).sort();
    var list = ["All"];
    if (counts[hd]) list.push(hd);
    state.categories = list.concat(names);
    state.counts = counts;
    if (state.categories.indexOf(state.category) === -1) {
      state.category = "All";
      state.catIndex = 0;
    }
  }

  function filtered() {
    if (state.category === "All") return state.all.slice();
    return state.all.filter(function (c) { return catsOf(c).indexOf(state.category) !== -1; });
  }

  function renderCategories() {
    el.cats.innerHTML = "";
    state.categories.forEach(function (name) {
      var n = name === "All" ? state.all.length : state.counts[name];
      var d = document.createElement("div");
      d.className = "item cat" + (name === state.category ? " active" : "");
      d.appendChild(span(name + " (" + n + ")"));
      el.cats.appendChild(d);
    });
  }

  function renderGrid() {
    state.channels = filtered();
    el.grid.innerHTML = "";
    state.channels.forEach(function (c) {
      var d = document.createElement("div");
      d.className = "item";
      if (c.logoUrl) {
        var img = document.createElement("img");
        img.className = "logo";
        img.alt = "";
        img.src = c.logoUrl;
        img.onerror = function () { img.style.display = "none"; };
        d.appendChild(img);
      }
      d.appendChild(span(c.name));
      if (c.resolution) {
        var b = span(c.resolution + "p");
        b.className = "badge";
        d.appendChild(b);
      }
      el.grid.appendChild(d);
    });
    el.grid.scrollTop = 0;
    if (state.gridIndex >= state.channels.length) {
      state.gridIndex = Math.max(0, state.channels.length - 1);
    }
  }

  function setStatus(msg) { el.status.textContent = msg; }

  function applyFocus() {
    var prev = document.querySelectorAll(".focused");
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove("focused");
    var target, container;
    if (state.zone === "rail") {
      container = el.cats;
      target = el.cats.children[state.catIndex];
      el.focus.textContent = "category: " + state.categories[state.catIndex];
    } else {
      container = el.grid;
      target = el.grid.children[state.gridIndex];
      var ch = state.channels[state.gridIndex];
      el.focus.textContent = ch ? "channel: " + ch.name : "(empty)";
    }
    if (target) {
      target.classList.add("focused");
      keepVisible(container, target);
    }
  }

  function selectCategory(i) {
    state.catIndex = i;
    state.category = state.categories[i];
    state.gridIndex = 0;
    renderCategories();
    renderGrid();
  }

  function setCatalogue(result) {
    state.all = result.channels;
    buildCategories();
    renderCategories();
    renderGrid();
    var msg = state.all.length + " channels · " + result.source + " · " + new Date(result.at).toLocaleString();
    if (result.error) msg += " · refresh failed: " + result.error;
    setStatus(msg);
    applyFocus();
  }

  function loadChannels(force) {
    setStatus("Loading channels...");
    window.Playlist.load(force).then(setCatalogue).catch(function (err) {
      setCatalogue({ channels: window.MOCK_CHANNELS, source: "sample", at: Date.now() });
      setStatus("Could not load playlist (" + err.message + "). Showing sample data. Press R to retry.");
    });
  }

  // ---------- player ----------
  function currentChannel() { return state.channels[state.gridIndex]; }

  function showOverlay(persist) {
    var ch = currentChannel();
    if (!ch) return;
    el.ovName.textContent = (state.gridIndex + 1) + "  " + ch.name;
    var meta = [];
    if (ch.resolution) meta.push(ch.resolution + "p (listed)");
    meta.push(catsOf(ch).filter(function (n) { return n !== window.HD_CATEGORY; }).join(", "));
    el.ovMeta.textContent = meta.join(" · ");
    if (ch.logoUrl) { el.ovLogo.src = ch.logoUrl; el.ovLogo.style.display = ""; }
    else el.ovLogo.style.display = "none";
    el.overlay.classList.remove("hidden");
    clearTimeout(overlayTimer);
    if (!persist) overlayTimer = setTimeout(hideOverlay, 4000);
  }

  function hideOverlay() { el.overlay.classList.add("hidden"); }

  function showMsg(text) {
    el.msg.textContent = text;
    el.msg.classList.toggle("hidden", !text);
  }

  function onPlayerState(s, detail) {
    state.playerState = s;
    if (state.mode !== "player") return;
    if (s === "loading") showMsg("Loading...");
    else if (s === "buffering") showMsg("Buffering...");
    else if (s === "playing") { showMsg(""); showOverlay(false); }
    else if (s === "error") {
      showMsg((MESSAGES[detail] || "Playback failed.") + "\n\nUp/Down: other channel · OK: retry · Back: list");
      showOverlay(true);
    }
  }

  function startPlayback() {
    var ch = currentChannel();
    if (!ch) return;
    showOverlay(false);
    window.Player.play(ch);
  }

  function enterPlayer() {
    if (!currentChannel()) return;
    state.mode = "player";
    el.player.classList.remove("hidden");
    startPlayback();
  }

  function exitPlayer() {
    window.Player.stop();
    state.mode = "browse";
    state.zone = "grid";
    clearTimeout(overlayTimer);
    hideOverlay();
    showMsg("");
    el.player.classList.add("hidden");
    applyFocus();
  }

  function switchChannel(delta) {
    var n = state.channels.length;
    if (!n) return;
    state.gridIndex = (state.gridIndex + delta + n) % n;
    startPlayback(); // Player invalidates the previous session; no auto-skip on failure
  }

  function onPlayerKey(e, k) {
    if (k === KEY.DOWN) switchChannel(1);
    else if (k === KEY.UP) switchChannel(-1);
    else if (k === KEY.ENTER) {
      if (state.playerState === "error") startPlayback();
      else if (el.overlay.classList.contains("hidden")) showOverlay(false);
      else hideOverlay();
    }
    else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP) exitPlayer();
    else return;
    e.preventDefault();
  }

  // ---------- keys ----------
  function onKey(e) {
    var k = e.keyCode;
    el.key.textContent = e.key || "-";
    el.code.textContent = k;

    if (state.mode === "player") { onPlayerKey(e, k); return; }
    if (k === KEY.R) { loadChannels(true); return; }

    var handled = true;
    if (state.zone === "rail") {
      if (k === KEY.UP && state.catIndex > 0) state.catIndex--;
      else if (k === KEY.DOWN && state.catIndex < state.categories.length - 1) state.catIndex++;
      else if (k === KEY.RIGHT && state.channels.length) state.zone = "grid";
      else if (k === KEY.ENTER) selectCategory(state.catIndex);
      else handled = (k === KEY.UP || k === KEY.DOWN || k === KEY.LEFT);
    } else {
      var n = state.channels.length;
      if (k === KEY.RIGHT && state.gridIndex % COLS < COLS - 1 && state.gridIndex + 1 < n) state.gridIndex++;
      else if (k === KEY.LEFT) {
        if (state.gridIndex % COLS === 0) state.zone = "rail";
        else state.gridIndex--;
      }
      else if (k === KEY.DOWN && state.gridIndex + COLS < n) state.gridIndex += COLS;
      else if (k === KEY.UP && state.gridIndex - COLS >= 0) state.gridIndex -= COLS;
      else if (k === KEY.ENTER) { enterPlayer(); e.preventDefault(); return; }
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP) state.zone = "rail";
      else handled = (k === KEY.UP || k === KEY.DOWN || k === KEY.RIGHT);
    }
    if (handled) e.preventDefault();
    applyFocus();
  }

  document.addEventListener("keydown", onKey);
  window.Player.init(el.video, onPlayerState);

  // Show something immediately, then load the real catalogue.
  state.all = window.MOCK_CHANNELS;
  buildCategories();
  renderCategories();
  renderGrid();
  applyFocus();
  loadChannels(false);
})();

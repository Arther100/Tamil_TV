(function () {
  "use strict";

  // webOS Back = 461. Esc/Backspace are desktop-browser fallbacks. 82 = R (desktop refresh).
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 461, ESC: 27, BKSP: 8, R: 82 };
  var COLS = 4;

  var state = {
    zone: "grid",
    categories: ["All"],
    category: "All",
    catIndex: 0,
    gridIndex: 0,
    all: [],
    channels: [],
    status: "Loading channels..."
  };

  var elCats = document.getElementById("categories");
  var elGrid = document.getElementById("grid");
  var elKey = document.getElementById("lastKey");
  var elCode = document.getElementById("lastCode");
  var elFocus = document.getElementById("focusInfo");
  var elStatus = document.getElementById("status");

  // textContent only: playlist data is untrusted and never injected as HTML.
  function make(cls, text) {
    var d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    return d;
  }

  function buildCategories() {
    var counts = {};
    state.all.forEach(function (c) { counts[c.category] = (counts[c.category] || 0) + 1; });
    var names = Object.keys(counts).sort();
    state.categories = ["All"].concat(names);
    state.counts = counts;
    if (state.categories.indexOf(state.category) === -1) {
      state.category = "All";
      state.catIndex = 0;
    }
  }

  function filtered() {
    if (state.category === "All") return state.all.slice();
    return state.all.filter(function (c) { return c.category === state.category; });
  }

  function renderCategories() {
    elCats.innerHTML = "";
    state.categories.forEach(function (name) {
      var n = name === "All" ? state.all.length : state.counts[name];
      var el = make("item cat", name + " (" + n + ")");
      if (name === state.category) el.classList.add("active");
      elCats.appendChild(el);
    });
  }

  function renderGrid() {
    state.channels = filtered();
    elGrid.innerHTML = "";
    state.channels.forEach(function (c) {
      var el = document.createElement("div");
      el.className = "item";
      if (c.logoUrl) {
        var img = document.createElement("img");
        img.className = "logo";
        img.alt = "";
        img.src = c.logoUrl;
        img.onerror = function () { img.style.display = "none"; };
        el.appendChild(img);
      }
      var label = document.createElement("span");
      label.textContent = c.name;
      el.appendChild(label);
      elGrid.appendChild(el);
    });
    if (state.gridIndex >= state.channels.length) {
      state.gridIndex = Math.max(0, state.channels.length - 1);
    }
  }

  function setStatus(msg) {
    state.status = msg;
    elStatus.textContent = msg;
  }

  function applyFocus() {
    var prev = document.querySelectorAll(".focused");
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove("focused");

    var target;
    if (state.zone === "rail") {
      target = elCats.children[state.catIndex];
      elFocus.textContent = "category: " + state.categories[state.catIndex];
    } else {
      target = elGrid.children[state.gridIndex];
      var ch = state.channels[state.gridIndex];
      elFocus.textContent = ch ? "channel: " + ch.name : "(empty)";
    }
    if (target) {
      target.classList.add("focused");
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
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
    var when = new Date(result.at).toLocaleString();
    var msg = state.all.length + " channels · " + result.source + " · " + when;
    if (result.error) msg += " · refresh failed: " + result.error;
    setStatus(msg);
    applyFocus();
  }

  function loadChannels(force) {
    setStatus("Loading channels...");
    window.Playlist.load(force).then(setCatalogue).catch(function (err) {
      setStatus("Could not load playlist (" + err.message + "). Showing sample data. Press R to retry.");
      setCatalogue({ channels: window.MOCK_CHANNELS, source: "sample", at: Date.now(), error: err.message });
      setStatus("Could not load playlist (" + err.message + "). Showing sample data. Press R to retry.");
    });
  }

  function onKey(e) {
    var k = e.keyCode;
    elKey.textContent = e.key || "-";
    elCode.textContent = k;
    var handled = true;

    if (k === KEY.R) { loadChannels(true); return; }

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
      else if (k === KEY.ENTER) {
        var ch = state.channels[state.gridIndex];
        elFocus.textContent = "SELECTED: " + (ch ? ch.name : "-");
        return e.preventDefault();
      }
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP) state.zone = "rail";
      else handled = (k === KEY.UP || k === KEY.DOWN || k === KEY.RIGHT);
    }

    if (handled) e.preventDefault();
    applyFocus();
  }

  document.addEventListener("keydown", onKey);

  // Show something immediately, then load the real catalogue.
  state.all = window.MOCK_CHANNELS;
  buildCategories();
  renderCategories();
  renderGrid();
  applyFocus();
  loadChannels(false);
})();

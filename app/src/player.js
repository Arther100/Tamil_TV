// PlaybackService: the only code that touches the <video> element.
// A session id makes late callbacks from a previous channel harmless.
(function () {
  "use strict";
  var HLS_URL = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"; // desktop-browser testing only
  var START_TIMEOUT_MS = 20000;

  var video = null;
  var hls = null;
  var session = 0;
  var active = false;
  var timer = null;
  var cb = function () {};
  var hlsLoading = null;

  function loadHlsLib() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLoading) return hlsLoading;
    hlsLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = HLS_URL;
      s.onload = function () { resolve(window.Hls); };
      s.onerror = function () { hlsLoading = null; reject(new Error("hls.js failed to load")); };
      document.head.appendChild(s);
    });
    return hlsLoading;
  }

  function teardown() {
    clearTimeout(timer);
    active = false;
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (video) {
      try { video.pause(); } catch (e) {}
      video.removeAttribute("src");
      try { video.load(); } catch (e) {}
    }
  }

  function fail(id, kind) {
    if (id !== session) return;
    teardown();
    cb("error", kind);
  }

  function tryPlay() {
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked: user can press OK */ });
  }

  function init(videoEl, onState) {
    video = videoEl;
    cb = onState || cb;
    video.addEventListener("playing", function () {
      if (!active) return;
      clearTimeout(timer);
      cb("playing", "");
    });
    video.addEventListener("waiting", function () { if (active) cb("buffering", ""); });
    video.addEventListener("error", function () {
      if (!active) return;
      var code = video.error ? video.error.code : 0;
      fail(session, code === 2 ? "network" : "unsupported");
    });
  }

  function play(channel) {
    var id = ++session;
    teardown();
    active = true;
    cb("loading", "");
    timer = setTimeout(function () { fail(id, "timeout"); }, START_TIMEOUT_MS);

    var url = channel.streamUrl;
    var nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    var looksHls = /\.m3u8(\?|$)/i.test(url);

    // webOS plays HLS natively. Desktop Chrome/Edge needs hls.js.
    if (nativeHls || !looksHls) {
      video.src = url;
      tryPlay();
      return;
    }
    loadHlsLib().then(function (Hls) {
      if (id !== session) return;
      if (!Hls.isSupported()) { fail(id, "unsupported"); return; }
      hls = new Hls({ maxBufferLength: 20 });
      hls.on(Hls.Events.ERROR, function (e, data) {
        if (id !== session || !data || !data.fatal) return;
        fail(id, data.type === Hls.ErrorTypes.NETWORK_ERROR ? "network" : "media");
      });
      hls.on(Hls.Events.MANIFEST_PARSED, function () { if (id === session) tryPlay(); });
      hls.loadSource(url);
      hls.attachMedia(video);
    }).catch(function () { fail(id, "lib"); });
  }

  function stop() {
    session++;
    teardown();
  }

  window.Player = { init: init, play: play, stop: stop };
})();

# Tamil TV (LG webOS)

HTML/CSS/JS webOS TV app that lists Tamil channels from the iptv-org playlist
and is operated with the LG remote.

**Status:** prototype. The playlist (`https://iptv-org.github.io/iptv/languages/tam.m3u`)
is for development/testing only. It is community-maintained and does not grant
rights to the underlying streams. Do not release publicly or commercially
without written rights from each broadcaster/provider.

## Run in a browser
Open `app/` with VS Code Live Server (do not open via `file://`).
Arrow keys + Enter; Esc = Back; R = refresh playlist.

## Run on an LG TV
1. `npm install -g @webos-tools/cli`
2. Enable Developer Mode + Key Server on the TV, then `ares-setup-device`.
3. `ares-package app` -> `ares-install --device mytv <file>.ipk` -> `ares-launch --device mytv com.example.tamiltv`

## Structure
- `app/appinfo.json` - webOS app metadata (placeholder app ID)
- `app/src/m3u-parser.js` - M3U parser (validates, de-duplicates, never throws)
- `app/src/playlist.js` - fetch with timeout + 12h cache, keeps last good catalogue
- `app/src/main.js` - remote navigation and focus

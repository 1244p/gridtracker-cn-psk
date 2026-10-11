# GridTracker2

**Do not commit to git. Commits are only done by the developer.**

Electron app (no bundler, no build step for dev). Main process: [src/main/index.js](src/main/index.js). Renderer pages: `src/renderer/*.html`, scripts in `src/renderer/lib/` loaded as plain `<script>` globals (load `first.js` first in every window). Translations: `resources/i18n/<locale>.json`, keyed by the `data-i18n` attribute (`.hover` keys set `title`, `.label` keys set `innerHTML`).

## Running dev

- `npm ci` first on a fresh clone (`node_modules` is not committed).
- Claude Code inside VS Code inherits `ELECTRON_RUN_AS_NODE=1`, which makes Electron act as Node and fail with `bad option: --no-sandbox`. Unset it for the launch:
  - macOS/Linux: `env -u ELECTRON_RUN_AS_NODE npm run dev`
  - Windows PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; npm run dev`
- The app holds a single-instance lock shared with the **installed** GridTracker2. If the installed app (or a previous dev instance) is still running, the dev build exits immediately with code 0 and no output. Ask the user to quit the installed app rather than killing it. After killing a dev instance, wait until its process is gone before relaunching.
- **Never reload the main window in place** (`location.reload()`, DevTools reload). It crashes the app; main-window HTML/JS changes need a full quit and relaunch. CSS-only changes can be hot-swapped (below).
- Sub-windows (roster, stats, lookup, …) can be reloaded in place with `location.reload()` to pick up their HTML/JS changes. The main window keeps its handle (e.g. `GT.callRosterWindowHandle`); check it's still live afterwards (`goProcessRoster()` re-renders the roster).
- Translation edits (`resources/i18n/*.json`): the main window loads `GT.i18n` once through a cached `require`, and sub-windows read their text from it, so reloading a sub-window alone still shows the old text. In the main window run `delete window.require.cache[path.resolve(resourcesPath, GT.languages[GT.settings.app.locale])]; readLocaleFile(GT.settings.app.locale)` (or `node tools/cdp.mjs GridTracker2.html evalfile tools/reload_i18n.js`), then reload the sub-window. Main-window text still needs a full relaunch.

## Verifying UI changes yourself

Launch with the Chrome DevTools Protocol open, then drive any window with [tools/cdp.mjs](tools/cdp.mjs) (Node 24 has global `fetch`/`WebSocket`):

```
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron --no-sandbox --remote-debugging-port=9333 .   # macOS/Linux
powershell -File tools\relaunch.ps1          # Windows: stops the previous dev copy (only the one on port 9333), waits, relaunches
```

```
node tools/cdp.mjs list                                     # pages: GridTracker2.html, gt_roster.html, ...
node tools/cdp.mjs GridTracker2.html eval "GT.settings.app.myCall"
node tools/cdp.mjs gt_roster.html evalfile check.js         # longer checks: an async IIFE in a file, its promise is awaited
node tools/cdp.mjs gt_roster.html shot roster.png           # then view the PNG
```

- On Windows run `cdp.mjs` calls through `Start-Job` with a `Wait-Job -Timeout`, so a hung page can't hang the shell. Don't wrap or replace main-window functions from a sub-window's context (`window.opener.someFn = ...`): that has locked up the app.
- `Runtime.evaluate` can call app globals, e.g. `showSettingsBox()`, `openSettingsTab(button, 'logSettingsDiv')`, and measure elements (`getBoundingClientRect`, `clientHeight` vs `scrollHeight`). Other windows (roster, band activity, …) are separate pages in the `/json` list.
- Try window sizes without touching the real window: `Emulation.setDeviceMetricsOverride { width, height, deviceScaleFactor: 1, mobile: false }`, then `Emulation.clearDeviceMetricsOverride`.
- Screenshot with `Page.captureScreenshot` and view the PNG.
- Hot-swap CSS: set the `style.css` `<link>`'s `href` to `…/style.css?v=<Date.now()>`, wait ~1s. Don't await the link's `onload`, it doesn't fire reliably.
- Don't use `scrollIntoView()` in the main window: even with `body` `overflow: hidden` it scrolls the page and cuts off the top (undo with `document.scrollingElement.scrollTop = 0`).
- Shortly after launch the main UI may not be laid out yet (everything measures 0), so wait ~10s.
- Only open the debugging port on dev runs. Anything local can control the app while it's open.

## Tools

Scripts in [tools/](tools/) (run from the repo root; each file's header has its usage; `tools/` is left out of the app package):

- [cdp.mjs](tools/cdp.mjs), [relaunch.ps1](tools/relaunch.ps1): drive / relaunch the dev copy (above).
- [smoke_static.js](tools/smoke_static.js): no app needed. JS and JSON parse, locales match `en.json`, used i18n keys exist, no leftover temporary/debug code, no BOMs or mixed line endings, version and CHANGELOG.md shape. Run before a release, and after bulk edits.
- [smoke_main.js](tools/smoke_main.js), [smoke_roster.js](tools/smoke_roster.js): live smoke tests via `cdp.mjs <page> evalfile`. They open every settings tab, exercise both rosters, report counts and collect page errors, and put the UI back as found.
- [i18n_apply.js](tools/i18n_apply.js): applies a batch of new translation keys (13 values each, in its `LOCALES` order) to every locale file, plus the matching `data-i18n` / `I18N()` source edits. Dry run unless `write`; the header documents the batch module format.
- [i18n_verify.js](tools/i18n_verify.js): every `data-i18n` / `I18N("…")` key in the given files exists in every locale.
- [audit_english.js](tools/audit_english.js): lists English-only UI strings of two or more words that don't go through i18n (a heuristic, so review the hits).
- [reload_i18n.js](tools/reload_i18n.js): reloads the locale file in the running main window (see Running dev).
- [eol_check.js](tools/eol_check.js), [bom_check.js](tools/bom_check.js): line endings / BOM of given files; every `.js` with a BOM.
- [changelog_html.js](tools/changelog_html.js): regenerates CHANGELOG.md's `### HTML List` section from its `### MD Markup Format` section (dry run unless `write`).
Text files in this repo are CRLF with no BOM. Do bulk or scripted edits with a Node script (keep the file's line endings, check anchors match exactly once, dry run first), then check with `eol_check.js`. One-off test scripts go in the session scratchpad, not `tools/`.

## Gotchas

- **macOS window identification** (`browser-window-created` in [src/main/index.js](src/main/index.js)): on macOS windows are matched to `allowedWindows` by `tabbingIdentifier`, on Windows by `title`. Frameless windows (Band Activity) have no `tabbingIdentifier` *and* an empty `title` at creation, so the `frameName` captured in `setWindowOpenHandler` (`pendingWindowFrameName`) is the fallback.
- **Settings panel layout**: `#rootSettingsDiv` is shown with `display: inline-flex` (set in [panel.js](src/renderer/lib/settings/panel.js); the toggle compares against that string). It's a column capped at the window size: the tab bar (`.settingstab`) wraps and floats the red X close button on its right, and the active `.settingsTabcontent` shrinks into the remaining height and scrolls. Tab buttons are styled via `.settingstab button.settingsTablinks` so the X keeps its `.Xbutton` look. Avoid fixed-width content in tabs; the Band Colors grid uses `repeat(auto-fill, 70px)` so it wraps.
- `body` is `overflow: hidden` and `white-space: nowrap`: content that overflows the window is simply cut off unless its own container scrolls.
- **New top-level settings keys** must be added to `validSettings` in [defaults.js](src/renderer/lib/settings/defaults.js) (as well as the default object there), or startup deletes them as "unknown setting" ([GridTracker2.js](src/renderer/lib/GridTracker2.js)). Nested keys under an existing top-level key don't need this.
- **New map layers**: `createGlobalMapLayer("name")` in [mapCore.js](src/renderer/lib/map/mapCore.js) only creates the layer; it must also be listed in the `layers: [...]` array of the `new ol.Map({...})` call below it, or nothing on it is ever drawn.
- **No BOM**: no `.js` file in the project starts with a UTF-8 BOM; keep it that way (Windows PowerShell 5.1 file writes can add one, so do bulk rewrites with a Node script).

## Releases / changelog

- Version format in `package.json` is `2.YYMMDD.N` (e.g. `2.261008.3`); bump it with user-visible changes.
- New work goes in [CHANGELOG.md](CHANGELOG.md): add user-facing entries to the version section being worked on (the topmost `## [v2.YYMMDD.N]`, matching `package.json`), under its `#### Area` heading (`Call Roster`, `Map / UI`, `App`, …) as `- ` bullets, sub-points two-space indented. New UI text needs a `data-i18n` key translated in every `resources/i18n/*.json`.
- The version section has a `### MD Markup Format` part (edit this one) and an `### HTML List` part generated from it: run `node tools/changelog_html.js write` after changing the Markdown.
- Old releases go in [HISTORY.md](HISTORY.md) (oldest first). Only when the developer says a version has been released: append its `## [v…]` heading and the contents of its `### MD Markup Format` part (the `####` areas and bullets) to the end of HISTORY.md, then remove that whole version section from CHANGELOG.md. Its `### HTML List` part is discarded, not copied. Don't add new entries to HISTORY.md otherwise.
- After a release CHANGELOG.md holds only its header. With the next version bump, add a new `## [v2.YYMMDD.N]` section (matching `package.json`) with empty `### MD Markup Format` and `### HTML List` parts.
- CHANGELOG.md is packaged with the app; HISTORY.md, CLAUDE.md, `notes` and `tools/` are left out (`files:` in `electron-builder.yml` and `electron-builder.win7.yml`).

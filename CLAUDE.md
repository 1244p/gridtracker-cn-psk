# GridTracker2

**Do not commit to git. Commits are only done by the developer.**

Electron app (no bundler, no build step for dev). Main process: [src/main/index.js](src/main/index.js). Renderer pages: `src/renderer/*.html`, scripts in `src/renderer/lib/` loaded as plain `<script>` globals (load `first.js` first in every window). Translations: `resources/i18n/<locale>.json`, keyed by the `data-i18n` attribute (`.hover` keys set `title`, `.label` keys set `innerHTML`).

## Running dev

- `npm ci` first on a fresh clone (`node_modules` is not committed).
- Claude Code inside VS Code inherits `ELECTRON_RUN_AS_NODE=1`, which makes Electron act as Node and fail with `bad option: --no-sandbox`. Unset it for the launch:
  - macOS/Linux: `env -u ELECTRON_RUN_AS_NODE npm run dev`
  - Windows PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; npm run dev`
- The app holds a single-instance lock shared with the **installed** GridTracker2. If the installed app (or a previous dev instance) is still running, the dev build exits immediately with code 0 and no output. Ask the user to quit the installed app rather than killing it. After killing a dev instance, wait until its process is gone before relaunching.
- **Never reload a window in place** (`location.reload()`, DevTools reload). It crashes the app. HTML/JS changes need a full quit and relaunch; CSS-only changes can be hot-swapped (below).

## Verifying UI changes yourself

Launch with the Chrome DevTools Protocol open, then drive the main window from a small Node script (Node 24 has global `fetch`/`WebSocket`):

```
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron --no-sandbox --remote-debugging-port=9333 .
```

```js
// cdp.mjs: node cdp.mjs eval "<expr>" | node cdp.mjs shot out.png
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(p => p.url.endsWith('/GridTracker2.html'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = {};
ws.onmessage = (m) => { const d = JSON.parse(m.data); pending[d.id]?.(d); };
const call = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
await new Promise(r => ws.onopen = r);
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'eval') {
  const r = await call('Runtime.evaluate', { expression: arg, returnByValue: true });
  console.log(JSON.stringify(r.result.result?.value ?? r.result));
} else if (cmd === 'shot') {
  const r = await call('Page.captureScreenshot', { format: 'png' });
  (await import('fs')).writeFileSync(arg, Buffer.from(r.result.data, 'base64'));
}
ws.close();
```

- `Runtime.evaluate` can call app globals, e.g. `showSettingsBox()`, `openSettingsTab(button, 'logSettingsDiv')`, and measure elements (`getBoundingClientRect`, `clientHeight` vs `scrollHeight`). Other windows (roster, band activity, …) are separate pages in the `/json` list.
- Try window sizes without touching the real window: `Emulation.setDeviceMetricsOverride { width, height, deviceScaleFactor: 1, mobile: false }`, then `Emulation.clearDeviceMetricsOverride`.
- Screenshot with `Page.captureScreenshot` and view the PNG.
- Hot-swap CSS: set the `style.css` `<link>`'s `href` to `…/style.css?v=<Date.now()>`, wait ~1s. Don't await the link's `onload`, it doesn't fire reliably.
- Don't use `scrollIntoView()` in the main window: even with `body` `overflow: hidden` it scrolls the page and cuts off the top (undo with `document.scrollingElement.scrollTop = 0`).
- Shortly after launch the main UI may not be laid out yet (everything measures 0), so wait ~10s.
- Only open the debugging port on dev runs. Anything local can control the app while it's open.

## Gotchas

- **macOS window identification** (`browser-window-created` in [src/main/index.js](src/main/index.js)): on macOS windows are matched to `allowedWindows` by `tabbingIdentifier`, on Windows by `title`. Frameless windows (Band Activity) have no `tabbingIdentifier` *and* an empty `title` at creation, so the `frameName` captured in `setWindowOpenHandler` (`pendingWindowFrameName`) is the fallback.
- **Settings panel layout**: `#rootSettingsDiv` is shown with `display: inline-flex` (set in [panel.js](src/renderer/lib/settings/panel.js); the toggle compares against that string). It's a column capped at the window size: the tab bar (`.settingstab`) wraps and floats the red X close button on its right, and the active `.settingsTabcontent` shrinks into the remaining height and scrolls. Tab buttons are styled via `.settingstab button.settingsTablinks` so the X keeps its `.Xbutton` look. Avoid fixed-width content in tabs; the Band Colors grid uses `repeat(auto-fill, 70px)` so it wraps.
- `body` is `overflow: hidden` and `white-space: nowrap`: content that overflows the window is simply cut off unless its own container scrolls.

## Releases / changelog

- Version format in `package.json` is `2.YYMMDD.N` (e.g. `2.261008.3`); bump it with user-visible changes.
- Add user-facing entries to `CHANGELOG` under `## [Unreleased]`, in the area-grouped list (`Map / UI:`, `App:`, …), two-space indented. New UI text needs a `data-i18n` key translated in every `resources/i18n/*.json`.

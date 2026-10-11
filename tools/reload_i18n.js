// Evaluated in the main window (node tools/cdp.mjs GridTracker2.html evalfile tools/reload_i18n.js) after editing
// resources/i18n/*.json: drops the cached locale file and reads it again, so reloaded sub-windows show the new text.
// Main-window text still needs a full relaunch.
(() =>
{
  const p = path.resolve(resourcesPath, GT.languages[GT.settings.app.locale]);
  const wasCached = p in window.require.cache;
  delete window.require.cache[p];
  readLocaleFile(GT.settings.app.locale);
  return JSON.stringify({ locale: GT.settings.app.locale, wasCached, keys: Object.keys(GT.i18n).length });
})()

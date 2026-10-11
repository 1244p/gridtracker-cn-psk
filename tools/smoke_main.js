// Live smoke test of the main window: node tools/cdp.mjs GridTracker2.html evalfile tools/smoke_main.js
// Opens every visible settings tab and both Audio Alerts sub-tabs, redraws the feed spots, re-processes the rosters
// and reports counts, collecting page errors; leaves the settings panel and Audio Alerts sub-tab as found.
// Never reload the main window to pick up changes (see CLAUDE.md); relaunch instead.
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const errs = [];
  const onErr = (e) => errs.push((e.message || e.reason || String(e)) + (e.filename ? " @" + e.filename.split("/").pop() + ":" + e.lineno : ""));
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onErr);
  const out = { steps: [] };
  const step = (name, fn) => { try { const r = fn(); out.steps.push(name + ": ok" + (r !== undefined ? " (" + r + ")" : "")); } catch (e) { out.steps.push(name + ": THREW " + e.message); errs.push(name + ": " + e.message); } };
  const wasOpen = rootSettingsDiv.style.display === "inline-flex";
  const startAudioRoster = GT.audioAlertsRoster;

  step("open settings", () => { if (!wasOpen) showSettingsBox(); return rootSettingsDiv.style.display; });
  for (const btn of [...document.querySelectorAll(".settingstab button.settingsTablinks")].filter(b => b.style.display !== "none")) {
    const target = (btn.getAttribute("onclick").match(/'([^']+)'/) || [])[1];
    step("settings tab " + btn.textContent.trim(), () => { openSettingsTab({ currentTarget: btn }, target); return document.getElementById(target).style.display; });
    await sleep(150);
  }
  step("audio alerts: feed sub-tab", () => { showAudioAlertsRoster("feed"); return GT.audioAlertsRoster; });
  step("audio alerts: call sub-tab", () => { showAudioAlertsRoster("call"); return GT.audioAlertsRoster; });
  step("close settings", () => { if (!wasOpen) showSettingsBox(); return rootSettingsDiv.style.display; });
  step("feeds active", () => feedsActive());
  step("feed spots held", () => Object.keys(GT.feedCallsigns).length);
  step("map feed features", () => { redrawDxcwSpots(); return GT.layerSources.dxcwSpots.getFeatures().length + " (map option " + GT.settings.map.dxcwFeed + ")"; });
  step("feed hover tooltip", () => { const h = Object.keys(GT.feedCallsigns)[0]; if (!h) return "no spots"; createFeedTipTable({ feedHash: h }); return /NaN|undefined/.test(myTooltip.innerText) ? "BAD TEXT" : "ok"; });
  step("call roster entries", () => Object.keys(GT.callRoster).length);
  step("process both rosters", () => { goProcessRoster(); return "ok"; });
  step("mode data", () => Object.keys(GT.modes).length + " modes, " + Object.keys(GT.modeColors).length + " colors");
  step("hotkey list", () => { generatePrintTable(); return Object.keys(GT.hotKeys).length + " hotkeys, " + printableHotKeyTable.rows.length + " rows"; });
  step("rtsn state", () => GT.gtState);
  step("windows", () => ["callRosterWindowHandle", "statsWindowHandle", "lookupWindowHandle", "baWindowHandle", "alertWindowHandle"].map(k => k.replace("WindowHandle", "") + ":" + (GT[k] && !GT[k].closed ? "up" : "-")).join(" "));
  await sleep(1500);
  if (startAudioRoster) showAudioAlertsRoster(startAudioRoster);
  window.removeEventListener("error", onErr);
  window.removeEventListener("unhandledrejection", onErr);
  out.pageErrors = errs;
  return JSON.stringify(out, null, 1);
})()

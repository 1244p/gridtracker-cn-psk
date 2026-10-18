// Live smoke test of the roster window: node tools/cdp.mjs gt_roster.html evalfile tools/smoke_roster.js
// For the Call and Feed Roster: shows the tab, builds the column menu, opens every settings tab, toggles compact
// mode twice and sorts by Age (then puts the sort back), collecting page errors; ends on the roster it started on.
// The Feed Roster tab only exists while DX Feeds is on.
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const errs = [];
  const onErr = (e) => errs.push((e.message || e.reason || String(e)) + (e.filename ? " @" + e.filename.split("/").pop() + ":" + e.lineno : ""));
  window.addEventListener("error", onErr);
  window.addEventListener("unhandledrejection", onErr);
  const out = { steps: [] };
  const step = (name, fn) => { try { const r = fn(); out.steps.push(name + ": ok" + (r !== undefined ? " (" + r + ")" : "")); } catch (e) { out.steps.push(name + ": THREW " + e.message); errs.push(name + ": " + e.message); } };
  const startTab = CR.visibleProfile.name;
  // (The Feed Roster's Spots tab moved to the main window's Settings -> Feeds, which smoke_main.js opens)
  const tabs = ["generalbox:generalSettingsDiv", "watcherbox:watcherBoxDiv", "exceptionsbox:exceptionsBoxDiv", "ingoresbox:ignoresBoxDiv", "colorsbox:colorsBoxDiv"];

  for (const name of ["call", "feed"]) {
    step(`${name}: show tab`, () => { showRosterTab(name); return CR.visibleProfile.name; });
    await sleep(300);
    step(`${name}: rows`, () => RosterTable.querySelectorAll("tr").length - 1);
    step(`${name}: column menu`, () => { createColumnMenu(); return CR.columnMenu.items.length + " items"; });
    step(`${name}: open settings`, () => { openSettings(); return settingsDiv.style.display; });
    for (const t of tabs) {
      const [btn, div] = t.split(":");
      const el = document.getElementById(btn);
      if (!el || el.style.display === "none") { out.steps.push(`${name}: tab ${btn} hidden (expected for this roster)`); continue; }
      step(`${name}: tab ${btn}`, () => { openInfoTab(btn, div, div === "watcherBoxDiv" ? openWatchersTab : div === "ignoresBoxDiv" ? renderIgnoresTab : div === "colorsBoxDiv" ? renderColorsTab : null); return document.getElementById(div).style.display; });
      await sleep(150);
    }
    step(`${name}: compact on`, () => { compactModeChanged(); return CR.rosterSettings.compact; });
    await sleep(200);
    step(`${name}: compact off`, () => { compactModeChanged(); return CR.rosterSettings.compact; });
    step(`${name}: close settings`, () => { settingsDiv.style.display = "none"; return "closed"; });
    step(`${name}: sort by Age`, () => { const s = CR.rosterSettings.sortColumn, r = CR.rosterSettings.sortReverse; setRosterSorting("Age"); CR.rosterSettings.sortColumn = s; CR.rosterSettings.sortReverse = r; viewRoster(); return "restored " + s; });
  }
  step("restore tab", () => { showRosterTab(startTab); return startTab; });
  step("window title", () => document.title.slice(0, 40));
  await sleep(1500);
  window.removeEventListener("error", onErr);
  window.removeEventListener("unhandledrejection", onErr);
  out.pageErrors = errs;
  return JSON.stringify(out, null, 1);
})()

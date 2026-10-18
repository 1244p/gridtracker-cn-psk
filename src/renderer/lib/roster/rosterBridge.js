// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Call Roster, main-window side: opening the roster and feeding it messages, worked status and instances (moved from GridTracker2.js)

function scheduleRosterUpdate()
{
    if (GT.rosterUpdateTimer) {
        if (typeof GT.rosterUpdateTimer.refresh === "function") {
            GT.rosterUpdateTimer.refresh();
        } else {
            nodeTimers.clearTimeout(GT.rosterUpdateTimer);
            GT.rosterUpdateTimer = nodeTimers.setTimeout(delayedRosterUpdate, 150);
        }
    } else {
        GT.rosterUpdateTimer = nodeTimers.setTimeout(delayedRosterUpdate, 150);
    }
}

function insertMessageInRoster(newMessage, msgDEcallsign, msgDXcallsign, callObj, hash)
{
    scheduleRosterUpdate();

    // 2. Adjust Hash for SP=7 (Fox/Hound or SuperFox)
    if (newMessage.SP === 7) {
        hash += msgDXcallsign;
    }

    if (callObj.life === undefined || callObj.reset) {
        callObj.life = timeNowSec();
        callObj.reset = false;
    }

    const activeCallObj = newMessage.SP === 7 ? { ...callObj } : callObj;
    activeCallObj.hash = hash;

    const entry = GT.callRoster[hash];
    
    if (!entry) {
        GT.callRoster[hash] = {
            message: newMessage,
            callObj: activeCallObj,
            DXcall: msgDXcallsign,
            DEcall: msgDEcallsign,
            ignored: false,
        };
    } else {
        entry.message = newMessage;
        entry.callObj = activeCallObj;
        entry.DXcall = msgDXcallsign;
        entry.DEcall = msgDEcallsign;
    }
}

function delayedRosterUpdate()
{
  GT.rosterUpdateTimer = null;
  goProcessRoster();
}

function openCallRosterWindow(toggle = true)
{
  if (GT.callRosterWindowHandle == null)
  {
    GT.callRosterWindowHandle = window.open("gt_roster.html", "gt_roster");
  }
  else if (GT.callRosterWindowInitialized)
  {
    if (toggle)
    {
      electron.ipcRenderer.send("toggleWin", "gt_roster");
    }
    else
    {
      electron.ipcRenderer.send("showWin", "gt_roster");
    }
    goProcessRoster();
  }
}

function updateRosterWorked()
{
  if (GT.callRosterWindowInitialized)
  {
    try
    {
      GT.callRosterWindowHandle.window.updateWorked();
    }
    catch (e)
    {
      console.error(e);
    }
  }
}

// Feed settings changed: the Feed Roster tabs (roster window and Settings -> Audio Alerts) come and go with them
function updateRosterFeeds()
{
  if (GT.activeRoster) setVisualAudioAlerts();
  if (GT.callRosterWindowInitialized)
  {
    try
    {
      GT.callRosterWindowHandle.window.updateFeedsTab();
    }
    catch (e)
    {
      console.error(e);
    }
  }
}

function updateRosterInstances()
{
  if (GT.callRosterWindowInitialized)
  {
    try
    {
      GT.callRosterWindowHandle.window.updateInstances();
    }
    catch (e)
    {
      console.error(e);
    }
  }
}

function pruneRosterEntries(roster, maxAge, now)
{
    for (const call in roster) {
        const callObj = roster[call].callObj;

        if (now - callObj.age > maxAge) {
            // callObj is passed by reference from elsewhere,
            // so we safely reset its flags before pruning the roster entry.
            callObj.rosterAlerted = false;
            callObj.shouldRosterAlert = false;
            callObj.audioAlerted = false;
            callObj.shouldAudioAlert = false;

            // Delete from the roster map
            delete roster[call];
        }
    }
}

// When the Feed Roster was last reprocessed (ms), for rosterTimer
GT.feedRosterProcessedAt = 0;

// Every 5 seconds: both rosters age (expired entries, Max Age). The Feed Roster is skipped when new spots reprocessed
// it within that time anyway, as they usually have: each pass rebuilds its whole table
function rosterTimer()
{
  if (Date.now() - GT.feedRosterProcessedAt >= 4500) goProcessRoster();
  else goProcessCallRoster();
}

// Reprocesses both rosters (Call Roster and Feed Roster): worked status, settings and instances affect both
function goProcessRoster() {
    const now = timeNowSec();
    pruneRosterEntries(GT.callRoster, 300, now);
    pruneRosterEntries(GT.feedRoster, FEED_KEEP_SECONDS, now);
    GT.feedRosterProcessedAt = Date.now();

    if (GT.callRosterWindowInitialized) {
        try {
            GT.callRosterWindowHandle.window.processRoster();
        } catch (e) {
            console.log("[goProcessRoster] IPC Error:", e);
        }
    }
}

// A rig status with nothing the Feed Roster uses changed: only the Call Roster needs reprocessing
function goProcessCallRoster() {
    pruneRosterEntries(GT.callRoster, 300, timeNowSec());

    if (GT.callRosterWindowInitialized) {
        try {
            GT.callRosterWindowHandle.window.processCallRoster();
        } catch (e) {
            console.log("[goProcessCallRoster] IPC Error:", e);
        }
    }
}

// New DX Cluster / CW Skimmer spots: only the Feed Roster needs reprocessing. Spots arrive in a steady stream, so
// they're gathered for a quarter second (the roster only draws the rows in view, renderVirtualRoster)
function scheduleFeedRosterUpdate()
{
  if (GT.feedRosterUpdateTimer == null)
  {
    GT.feedRosterUpdateTimer = nodeTimers.setTimeout(goProcessFeedRoster, 250);
  }
}

function goProcessFeedRoster()
{
    GT.feedRosterUpdateTimer = null;
    pruneRosterEntries(GT.feedRoster, FEED_KEEP_SECONDS, timeNowSec());
    GT.feedRosterProcessedAt = Date.now();

    if (GT.callRosterWindowInitialized) {
        try {
            GT.callRosterWindowHandle.window.processFeedRoster();
        } catch (e) {
            console.log("[goProcessFeedRoster] IPC Error:", e);
        }
    }
}

// Roster window "Reset Columns to Default": fresh copies of one roster's ("call" / "feed") default columns and order
function defaultRosterColumns(rosterName)
{
  const def = def_rosterColumns[rosterName];
  return { columns: { ...def.columns }, columnOrder: def.columnOrder.slice() };
}

// Roster window "Reset Colors": a fresh copy of one roster's default column colors
function defaultRosterColors(rosterName)
{
  return { ...def_rosterColors[rosterName] };
}

function setRosterSpot(enabled)
{
  GT.rosterSpot = enabled;
}

function toggleCRScript()
{
  GT.crScript ^= 1;
  GT.settings.app.crScript = GT.crScript;
  if (GT.crScript == 1)
  {
    addLastTraffic("<font style='color:lightgreen'>" + I18N("gt.callRoster.scriptEnabled") + "</font>");
  }
  else
  {
    addLastTraffic("<font style='color:yellow'>" + I18N("gt.callRoster.scriptDisabled") + "</font>");
  }
  goProcessRoster();
}

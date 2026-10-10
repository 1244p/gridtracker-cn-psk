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

// Reprocesses both rosters (Call Roster and Feed Roster): worked status, settings and instances affect both
function goProcessRoster() {
    const now = timeNowSec();
    pruneRosterEntries(GT.callRoster, 300, now);
    pruneRosterEntries(GT.feedRoster, FEED_KEEP_SECONDS, now);

    if (GT.callRosterWindowInitialized) {
        try {
            GT.callRosterWindowHandle.window.processRoster();
        } catch (e) {
            console.log("[goProcessRoster] IPC Error:", e);
        }
    }
}

// New DX Cluster / CW Skimmer spots: only the Feed Roster needs reprocessing
function scheduleFeedRosterUpdate()
{
  if (GT.feedRosterUpdateTimer == null)
  {
    GT.feedRosterUpdateTimer = nodeTimers.setTimeout(goProcessFeedRoster, 150);
  }
}

function goProcessFeedRoster()
{
    GT.feedRosterUpdateTimer = null;
    pruneRosterEntries(GT.feedRoster, FEED_KEEP_SECONDS, timeNowSec());

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
    addLastTraffic("<font style='color:lightgreen'>Call Roster Script Enabled</font>");
  }
  else
  {
    addLastTraffic("<font style='color:yellow'>Call Roster Script Disabled</font>");
  }
  goProcessRoster();
}

// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// SOTA (Summits on the Air) chasing: activators come only from DX Feeds spots, whose note carries the summit
// ("SOTA W7O/NC-039", from Spothole by way of the RTSN server); nothing here polls SOTA or Spothole for spots.
// Worked summits come from SOTA_REF (or SIG SOTA / SIG_INFO) in the logbook, like POTA_REF.
// SOTA's summit list (names, height, points) is downloaded while SOTA Chasing is on, like POTA's parks.

GT.sota = {
  // Summit reference -> { name, association, region, alt (m), points, lat, lon }; current summits only (retired ones
  // are left out)
  summits: {},
  count: 0,
  // The list's own date, from its first line ("SOTA Summits List (Date=15/10/2026)")
  listDate: "",
  timer: null,
  busy: false
};

// A SOTA reference: association / region - summit number, e.g. "W7O/NC-039", "G/LD-001", "VK3/VC-012", "9A/DH-001".
// The number is always three digits (SOTA's automatic spotter writes "F/JU-XXX" when it doesn't know it: not matched)
const SOTA_REF_REGEXP = /\b([A-Z0-9]{1,4}\/[A-Z0-9]{2}-\d{3})\b/g;

// The summit list: ~25 MB, rebuilt by SOTA about daily. Kept on disk; at startup and every 24 hours its date is read
// (a 128 byte request) and the list downloaded only when that changed
const SOTA_SUMMITS_URL = "https://storage.sota.org.uk/summitslist.csv";
const SOTA_SUMMITS_FILE = "sota-summits.csv";
const SOTA_SUMMITS_CHECK_MS = 86400000;
// The first check waits a little, so startup isn't held up reading the list
const SOTA_SUMMITS_FIRST_CHECK_MS = 5000;
// A truncated reply or an error page can still parse into a few rows; the real list has well over 150,000 summits
const SOTA_SUMMITS_MIN = 10000;

// SOTA Chasing is on and can run: it needs DX Feeds (which needs Off-Air Services and the map online)
function sotaActive()
{
  return GT.settings.app.sotaFeatureEnabled == true && feedsActive();
}

// The summit named in a feed spot's note, or null. Once the summit list is loaded, only a summit in it counts
function feedSotaReference(msg)
{
  const loaded = GT.sota.count > 0;
  for (const match of msg.toUpperCase().matchAll(SOTA_REF_REGEXP))
  {
    if (!loaded || match[1] in GT.sota.summits) return match[1];
  }
  return null;
}

// Settings -> Features -> Online -> SOTA Chasing: shown while DX Feeds is on (from updateFeedViews, so also at
// startup and when DX Feeds is switched); starts or stops the summit list with it
function updateSotaViews()
{
  sotaChasingTr.style.display = feedsActive() ? "" : "none";
  sotaFeatureEnabled.checked = GT.settings.app.sotaFeatureEnabled == true;
  // Button panel SOTA button: shown while SOTA Chasing runs, grey when its map layer is off
  sotaMapButton.style.display = sotaActive() ? "" : "none";
  sotaMapImg.style.filter = GT.settings.map.sotaMap ? "" : "grayscale(1)";
  scheduleSotaSummits();
}

// Button panel SOTA button: summits with activators on the map (their own layer, apart from the DX Feeds spots)
function toggleSotaMap()
{
  GT.settings.map.sotaMap = !GT.settings.map.sotaMap;
  sotaMapImg.style.filter = GT.settings.map.sotaMap ? "" : "grayscale(1)";
  redrawDxcwSpots();
}

function changeSotaEnable()
{
  GT.settings.app.sotaFeatureEnabled = sotaFeatureEnabled.checked;
  if (GT.settings.app.sotaFeatureEnabled == true)
  {
    // Like POTA Hunting: QSOs are logged to (and read back from) the GT backup log, which keeps their SOTA_REF
    logGTqsoCheckBox.checked = true;
    loadGTCheckBox.checked = true;
    GT.settings.adifLog.startup.loadGTCheckBox = true;
    GT.settings.adifLog.qsolog.logGTqsoCheckBox = true;
  }
  else
  {
    // Spots keep their summit only while SOTA Chasing is on
    for (const hash in GT.feedCallsigns) GT.feedCallsigns[hash].sota = null;
  }

  updateSotaViews();
  setVisualHunting();
  goProcessFeedRoster();
  scheduleDxcwRedraw();
}

// ---- Summit position and the DX Feeds map

// A spot on a known summit is there, not at its grid (often the activator's home QTH): its grid becomes the summit's
// 6-character square, which the Feed Roster, distance and a logged QSO's GRIDSQUARE then use. Its state comes from that
// grid; home lookups (ULS, CAC, cached county) don't apply (callObj.summitPlaced)
function placeFeedSpotAtSummit(callObj)
{
  const summit = callObj.sota && GT.sota.summits[callObj.sota];
  callObj.summitPlaced = !!summit;
  if (!summit) return;

  callObj.cnty = null;
  const grid = latLonToGridSquare(summit.lat, summit.lon, 6);
  if (grid && grid != callObj.fullGrid)
  {
    callObj.fullGrid = grid;
    callObj.grid = grid.substring(0, 4);
    callObj.distance = 0;
    callObj.state = null;
  }
}

// A summit's height (meters in the list) in the units that go with Settings -> General -> Distance: feet with statute or
// nautical miles, meters with kilometres or degrees
function sotaHeightText(meters)
{
  const unit = distanceUnit.value;
  return (unit == "MI" || unit == "NM") ? Math.round(meters * 3.28084) + " ft" : meters + " m";
}

// The summit's 6-character square, or "" if it isn't in the list
function sotaSummitGrid(ref)
{
  const summit = GT.sota.summits[ref];
  return summit ? latLonToGridSquare(summit.lat, summit.lon, 6) : "";
}

// SOTA layer icons for a summit, like the DX Feeds spots' but orange: no rig on the band, a rig on the band, a rig on
// band and mode. One scale: the three share the same mountain, and only the target's dashed box reaches past it
GT.sotaIdleIcon = new ol.style.Icon({ src: "img/sota_idle.png", scale: 0.45 });
GT.sotaOnBandIcon = new ol.style.Icon({ src: "img/sota_on_band.png", scale: 0.45 });
GT.sotaTargetIcon = new ol.style.Icon({ src: "img/sota_target.png", scale: 0.45 });

// Tooltip of a summit marker, laid out like the POTA park tooltip: for each summit it shows (several when they overlap
// at this zoom, feature.summitGroups), a header box with the summit, where it is and what it's worth, then every spot
// on it, newest first
function createSummitTipTable(toolElement)
{
  const groups = toolElement.summitGroups || [{ ref: toolElement.summitRef, hashes: toolElement.summitHashes }];
  const html = groups.length > 1 ? summitGroupTipHtml(groups) : summitTipHtml(groups[0].ref, groups[0].hashes);
  if (!html) return 0;
  myTooltip.innerHTML = html;
  return 10;
}

// Several summits under one marker: no summit headers, just "SOTA Spot × n" and one row per spot with its summit after
// the grid, newest first
function summitGroupTipHtml(groups)
{
  const now = timeNowSec();
  const spots = [];
  for (const group of groups)
  {
    for (const hash of group.hashes || [])
    {
      if (GT.feedCallsigns[hash]) spots.push({ ref: group.ref, callObj: GT.feedCallsigns[hash] });
    }
  }
  if (spots.length == 0) return "";
  spots.sort((a, b) => b.callObj.age - a.callObj.age);

  let rows = "";
  for (const { ref, callObj } of spots)
  {
    const freq = callObj.freq > 0 ? formatMhz(callObj.freq / 1000) + " " : "";
    rows += `<tr><td style='color:yellow'>${lookupCallHtml(callObj.DEcall, callObj.grid)}</td>` +
      `<td style='color:lightgreen'>${callObj.grid || "-"}</td>` +
      `<td style='color:orange'>${ref}</td>` +
      `<td style='color:cyan'>${lookupCallHtml(callObj.spotter)}</td>` +
      `<td style='color:lightgreen'>${freq}<font color='yellow'>(${callObj.band})</font></td>` +
      `<td style='color:orange'>${callObj.mode}</td>` +
      `<td style='color:lightblue'>${toDHMS(now - callObj.age)}</td>` +
      `<td style='white-space:normal;max-width:260px;'>${htmlEntities(callObj.msg)}</td></tr>`;
  }
  return `<table id='tooltipTable' class='darkTable'>
    <tr><th colspan=8 style='color:orange'>${I18N("gt.sotaSpot.title")} &times; ${spots.length}</th></tr>
    <tr><th>${I18N("gt.newCallList.Call")}</th><th>${I18N("gt.callsignBox.Grid")}</th><th>SOTA</th><th>${I18N("rosterColumns.Spotter.header")}</th>` +
    `<th>${I18N("gt.newCallList.Freq")}</th><th>${I18N("gt.newCallList.Mode")}</th><th>${I18N("gt.feedSpot.age")}</th><th>${I18N("gt.newCallList.LastMsg")}</th></tr>
    ${rows}
  </table>`;
}

// One summit's section: its header, then its spots, each with its 4-character grid (the summit's square)
function summitTipHtml(ref, hashes)
{
  const summit = GT.sota.summits[ref];
  if (!summit) return "";

  const now = timeNowSec();
  const bearing = parseInt(MyCircle.bearing(GT.myLat, GT.myLon, summit.lat, summit.lon));
  const dist = parseInt(MyCircle.distance(GT.myLat, GT.myLon, summit.lat, summit.lon) * MyCircle.validateRadius(distanceUnit.value));
  const where = [summit.region, summit.association].filter((part) => part).map((part) => htmlEntities(part)).join(", ");

  let html = `<div style='background-color:#000;color:orange;font-weight:bold;font-size:12px;border:1px solid gray;margin:0px' class='roundBorder'>
    ${ref} : <font color='cyan'>${htmlEntities(summit.name)}</font><br>
    ${where ? `<font color='lightblue'>${where}</font><br>` : ""}
    <font color='white'>${sotaHeightText(summit.alt)}</font> &bull; <font color='yellow'>${I18N("rosterColumns.SOTA.points").replace("{0}", summit.points)}</font> &bull;
    <font color='cyan'>${dist}${distanceUnit.value.toLowerCase()}</font> <font color='yellow'>${bearing}&deg;</font></div>
    <table id='tooltipTable' class='darkTable' style='margin: 0 auto;'>
    <tr><th>${I18N("gt.newCallList.Call")}</th><th>${I18N("gt.callsignBox.Grid")}</th><th>${I18N("rosterColumns.Spotter.header")}</th><th>${I18N("gt.newCallList.Freq")}</th>` +
    `<th>${I18N("gt.newCallList.Mode")}</th><th>${I18N("gt.feedSpot.age")}</th><th>${I18N("gt.newCallList.LastMsg")}</th></tr>`;

  const spots = (hashes || []).map((hash) => GT.feedCallsigns[hash]).filter((callObj) => callObj);
  spots.sort((a, b) => b.age - a.age);
  for (const callObj of spots)
  {
    const freq = callObj.freq > 0 ? formatMhz(callObj.freq / 1000) + " " : "";
    // Callsigns look up when clicked, also in the popped-out tooltip (lookupCallHtml, map/mouse.js)
    html += `<tr><td style='color:yellow'>${lookupCallHtml(callObj.DEcall, callObj.grid)}</td>` +
      `<td style='color:lightgreen'>${callObj.grid || "-"}</td>` +
      `<td style='color:cyan'>${lookupCallHtml(callObj.spotter)}</td>` +
      `<td style='color:lightgreen'>${freq}<font color='yellow'>(${callObj.band})</font></td>` +
      `<td style='color:orange'>${callObj.mode}</td>` +
      `<td style='color:lightblue'>${toDHMS(now - callObj.age)}</td>` +
      `<td style='white-space:normal;max-width:260px;'>${htmlEntities(callObj.msg)}</td></tr>`;
  }
  return html + "</table>";
}

// The summit of a feed spot of this call on this band (any mode), for SOTA_REF on a logged QSO; null if none
function feedSotaForCall(call, band)
{
  for (const hash in GT.feedCallsigns)
  {
    const callObj = GT.feedCallsigns[hash];
    if (callObj.sota && callObj.DEcall == call && callObj.band == band) return callObj.sota;
  }
  return null;
}

// ---- The summit list

// While SOTA Chasing runs, a check is pending (first soon, then every 24 hours); otherwise none, and the list is
// dropped from memory
function scheduleSotaSummits()
{
  if (sotaActive())
  {
    if (!GT.sota.timer) GT.sota.timer = nodeTimers.setTimeout(updateSotaSummits, SOTA_SUMMITS_FIRST_CHECK_MS);
  }
  else
  {
    if (GT.sota.timer) nodeTimers.clearTimeout(GT.sota.timer);
    GT.sota.timer = null;
    GT.sota.summits = {};
    GT.sota.count = 0;
    GT.sota.listDate = "";
  }
}

function sotaSummitsPath()
{
  return path.join(GT.appData, SOTA_SUMMITS_FILE);
}

function updateSotaSummits()
{
  if (GT.sota.timer) nodeTimers.clearTimeout(GT.sota.timer);
  GT.sota.timer = nodeTimers.setTimeout(updateSotaSummits, SOTA_SUMMITS_CHECK_MS);
  if (!sotaActive() || GT.sota.busy) return;
  GT.sota.busy = true;

  const check = () =>
  {
    getSotaSummitsListDate((date) =>
    {
      if (GT.sota.count > 0 && date === GT.sota.listDate)
      {
        GT.sota.busy = false;
      }
      else
      {
        downloadSotaSummits();
      }
    },
    (reason) =>
    {
      console.warn("SOTA summit list date check failed (" + reason + "), downloading it");
      downloadSotaSummits();
    });
  };

  // First check since SOTA Chasing started: the copy on disk first, so a current list isn't downloaded again
  if (GT.sota.count == 0)
  {
    fs.readFile(sotaSummitsPath(), "utf8", (error, data) =>
    {
      if (!error && sotaActive()) processSotaSummits(data);
      check();
    });
  }
  else
  {
    check();
  }
}

// The list's date, from its first line, without downloading the list
function getSotaSummitsListDate(onDate, onError)
{
  let done = false;
  const finish = (callback, value) =>
  {
    if (!done)
    {
      done = true;
      callback(value);
    }
  };

  try
  {
    const url = new URL(SOTA_SUMMITS_URL);
    const req = window.require("https").get({
      host: url.hostname,
      port: 443,
      path: url.pathname,
      headers: { "User-Agent": gtUserAgent, Range: "bytes=0-127" }
    }, (res) =>
    {
      res.on("data", (data) =>
      {
        req.destroy();
        const match = /SOTA Summits List[^\n]*Date\s*=\s*([^)]+)\)/i.exec(data.toString("utf8"));
        if (match) finish(onDate, match[1].trim());
        else finish(onError, "no date in the reply");
      });
      res.on("end", () => finish(onError, "empty reply"));
    });
    req.on("error", (e) => finish(onError, e.message));
    req.setTimeout(20000, () =>
    {
      req.destroy();
      finish(onError, "no reply from server");
    });
  }
  catch (e)
  {
    finish(onError, e.message);
  }
}

function downloadSotaSummits()
{
  getBuffer(SOTA_SUMMITS_URL, (buffer) =>
  {
    GT.sota.busy = false;
    if (!sotaActive() || !buffer) return;
    const data = buffer.toString("utf8");
    // Only a reply that parsed as the list replaces the copy on disk
    if (processSotaSummits(data))
    {
      fs.writeFile(sotaSummitsPath(), data, (error) =>
      {
        if (error) console.warn("SOTA summit list not saved: " + error.message);
      });
    }
  }, null, "https", 443, null, (reason) =>
  {
    GT.sota.busy = false;
    console.warn("SOTA summit list download failed: " + reason);
  });
}

// A CSV row; summit names can be quoted and hold commas
function parseSotaCsvRow(line)
{
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++)
  {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes)
    {
      result.push(current);
      current = "";
    }
    else current += c;
  }
  result.push(current);
  return result;
}

// Parses the list; returns false (and keeps the list already loaded) when it isn't a real summit list.
// Line 1 "SOTA Summits List (Date=DD/MM/YYYY)", line 2 the header, then one summit per line:
// SummitCode,AssociationName,RegionName,SummitName,AltM,AltFt,GridRef1,GridRef2,Longitude,Latitude,Points,BonusPoints,
// ValidFrom,ValidTo,...
function processSotaSummits(data)
{
  if (!data) return false;
  const lines = data.split("\n");
  const first = /SOTA Summits List[^\n]*Date\s*=\s*([^)]+)\)/i.exec(lines[0] || "");
  if (!first) return false;

  const today = new Date().toISOString().substring(0, 10).replaceAll("-", "");
  const summits = {};
  let count = 0;
  // Association and region names repeat across thousands of summits: one string each
  const names = {};
  const shared = (text) => names[text] || (names[text] = text);
  for (let i = 2; i < lines.length; i++)
  {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseSotaCsvRow(line);
    if (cols.length < 14) continue;

    // Retired summits (ValidTo DD/MM/YYYY before today) can't be activated
    const validTo = cols[13].split("/");
    if (validTo.length == 3 && validTo[2] + validTo[1] + validTo[0] < today) continue;

    const lon = parseFloat(cols[8]);
    const lat = parseFloat(cols[9]);
    if (isNaN(lon) || isNaN(lat)) continue;

    summits[cols[0].trim().toUpperCase()] = {
      name: cols[3].trim(),
      association: shared(cols[1].trim()),
      region: shared(cols[2].trim()),
      alt: parseInt(cols[4]) || 0,
      points: parseInt(cols[10]) || 0,
      lat,
      lon
    };
    count++;
  }

  if (count < SOTA_SUMMITS_MIN)
  {
    console.warn("SOTA summit list: only " + count + " summits, kept the list loaded before");
    return false;
  }

  GT.sota.summits = summits;
  GT.sota.count = count;
  GT.sota.listDate = first[1].trim();

  // Spots read before the list was loaded may name something that isn't a summit; the rest move to their summit
  for (const hash in GT.feedCallsigns)
  {
    const callObj = GT.feedCallsigns[hash];
    if (callObj.sota && !(callObj.sota in summits)) callObj.sota = null;
    placeFeedSpotAtSummit(callObj);
  }
  goProcessFeedRoster();
  scheduleDxcwRedraw();
  return true;
}

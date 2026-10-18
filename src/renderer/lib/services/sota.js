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
    GT.sotaDecodeSpots = {};
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
      if (summitSpotObj(hash)) spots.push({ ref: group.ref, callObj: summitSpotObj(hash) });
    }
  }
  if (spots.length == 0) return "";
  spots.sort((a, b) => b.callObj.age - a.callObj.age);

  let rows = "";
  for (const { ref, callObj } of spots)
  {
    const freq = callObj.freq > 0 ? formatMhz(callObj.freq / 1000) + " " : "";
    rows += `<tr><td style='color:yellow'>${lookupCallHtml(callObj.DEcall, callObj.grid)}</td>` +
      `<td style='color:lightgreen'>${callObj.fullGrid || callObj.grid || "-"}</td>` +
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

  const spots = (hashes || []).map((hash) => summitSpotObj(hash)).filter((callObj) => callObj);
  spots.sort((a, b) => b.age - a.age);
  for (const callObj of spots)
  {
    const freq = callObj.freq > 0 ? formatMhz(callObj.freq / 1000) + " " : "";
    // Callsigns look up when clicked, also in the popped-out tooltip (lookupCallHtml, map/mouse.js)
    html += `<tr><td style='color:yellow'>${lookupCallHtml(callObj.DEcall, callObj.grid)}</td>` +
      `<td style='color:lightgreen'>${callObj.fullGrid || callObj.grid || "-"}</td>` +
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
  // Spotted under another form of the call (W7ABC/P) or on another band: the summit the activator is on now
  return sotaActivatorSummit(call);
}

// ---- Active SOTA activators (for decodes: Call Roster, logging)

// Base call (feedBaseCallsign: W7ABC for W7ABC/P) -> { ref, age }: the summit an activator was last spotted on, from feed
// spots naming one (rtsn.js addFeedSpot). Kept as long as the map keeps summit spots (sotaSpotMaxAge)
GT.sotaActivators = {};

function noteSotaActivator(callObj)
{
  if (!callObj.sota) return;
  const base = feedBaseCallsign(callObj.DEcall);
  const prev = GT.sotaActivators[base];
  GT.sotaActivators[base] = { ref: callObj.sota, age: callObj.age };
  // On to another summit: an activator is on one at a time, so their spots still on the old one (other bands or
  // modes) go now instead of when they age out
  if (prev && prev.ref !== callObj.sota && dropSotaActivatorSpots(base, prev.ref))
  {
    scheduleFeedRosterUpdate();
    scheduleDxcwRedraw();
  }
}

// A decode of an activator: they're still on the air, so their summit keeps counting (sotaActivatorSummit) even once
// the last spot of them is older than the spots' max age
function refreshSotaActivator(call)
{
  const entry = GT.sotaActivators[feedBaseCallsign(String(call).toUpperCase())];
  if (entry) entry.age = timeNowSec();
}

// An activator's (base call) Feed Roster spots on a summit, and their decodes on its marker, removed; true if there
// were any
function dropSotaActivatorSpots(base, summit)
{
  let removed = false;
  for (const hash in GT.feedCallsigns)
  {
    const callObj = GT.feedCallsigns[hash];
    if (callObj.sota === summit && feedBaseCallsign(callObj.DEcall) === base)
    {
      delete GT.feedCallsigns[hash];
      delete GT.feedRoster[hash];
      removed = true;
    }
  }
  for (const hash in GT.sotaDecodeSpots)
  {
    const callObj = GT.sotaDecodeSpots[hash];
    if (callObj.sota === summit && feedBaseCallsign(callObj.DEcall) === base)
    {
      delete GT.sotaDecodeSpots[hash];
      removed = true;
    }
  }
  return removed;
}

// ---- Activators you decode, on their summit's marker (from Matt's SOTA work; like POTA's spots from decodes): your
// band, mode, frequency and dB, as a spot from you ("N0TTL-#"). Only the marker and its tooltip show them, not the Feed
// Roster. Keyed apart from feed spots ("decode:" + call + band + mode)
GT.sotaDecodeSpots = {};

// A summit marker's spot: a feed spot, or a decode of the activator
function summitSpotObj(hash)
{
  return GT.feedCallsigns[hash] || GT.sotaDecodeSpots[hash];
}

// A decode of an activator (callObj.sota, from sotaActivatorSummit); redraws the markers only when the spot is new or
// moved band, mode or summit (its age shows live in the tooltip)
function noteSotaDecode(callObj)
{
  const myCall = GT.settings.app.myCall;
  if (!callObj.sota || !myCall || myCall == "NOCALL") return;
  const hash = "decode:" + callObj.DEcall + callObj.band + callObj.mode;
  let spot = GT.sotaDecodeSpots[hash];
  const changed = !spot || spot.sota !== callObj.sota;
  if (!spot)
  {
    spot = new LiveCallsign(callObj.DEcall, "", callObj.grid, callObj.mode, callObj.band, "", callObj.dxcc, timeNowSec());
    spot.hash = hash;
    spot.instance = GT.feedInstance;
    GT.sotaDecodeSpots[hash] = spot;
  }
  spot.time = spot.age = timeNowSec();
  spot.sota = callObj.sota;
  spot.grid = callObj.grid;
  spot.fullGrid = callObj.grid;
  spot.gridQualified = callObj.gridQualified;
  const instance = GT.instances[callObj.instance];
  const dial = instance && instance.status ? Number(instance.status.Frequency) : 0;
  spot.freq = dial > 0 ? dial + Number(callObj.delta || 0) : 0;
  spot.spotter = myCall + "-#";
  spot.msg = "GT " + callObj.RSTsent + " dB " + GT.settings.app.myGrid;
  if (changed && GT.settings.map.sotaMap) scheduleDxcwRedraw();
}

// The summit a call is activating now (a decode's DEcall, a logged QSO's CALL), or null. Only while SOTA Chasing runs;
// it never changes the station's own grid
function sotaActivatorSummit(call)
{
  if (!sotaActive() || !call) return null;
  const entry = GT.sotaActivators[feedBaseCallsign(String(call).toUpperCase())];
  if (!entry) return null;
  return timeNowSec() - entry.age <= sotaSpotMaxAge() ? entry.ref : null;
}

const SOTA_QRT_REGEXP = /\bQRT\b/i;

// A feed spot whose comment says QRT, for an activator on a summit (the one the spot names, else the one they're
// spotted on): that activation has ended, so their spots on the summit leave the Feed Roster and the map, and decodes
// stop getting it. noFrequency: the spot has no frequency, which is how SOTLAS / Spothole post an activator marking
// themselves off the summit (its comment is often left over from their last spot), so it counts as QRT too. True if
// it was such a spot (the caller doesn't add it); a later spot of them brings it all back
function endSotaActivationOnQrt(call, msg, noFrequency = false)
{
  if (!noFrequency && !SOTA_QRT_REGEXP.test(msg)) return false;
  const base = feedBaseCallsign(call);
  const summit = feedSotaReference(msg) || (GT.sotaActivators[base] ? GT.sotaActivators[base].ref : null);
  if (!summit) return false;

  if (GT.sotaActivators[base] && GT.sotaActivators[base].ref === summit) delete GT.sotaActivators[base];
  const removed = dropSotaActivatorSpots(base, summit);
  if (removed)
  {
    scheduleFeedRosterUpdate();
    scheduleDxcwRedraw();
  }
  return true;
}

// How long a summit's spots count: the Feed Roster's Max Age or the map's Feed Spots Max Age, whichever is longer
function sotaSpotMaxAge()
{
  return Math.max(GT.settings.app.feedMaxAge, Number(GT.settings.feedRoster.rosterTime) || 0);
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
// Fields split at commas outside quotes, quote characters dropped. Each field is cut out in one slice (not built a
// character at a time): the list has ~180,000 rows
function parseSotaCsvRow(line)
{
  const result = [];
  let start = 0;
  let inQuotes = false;
  let hasQuote = false;
  for (let i = 0; i < line.length; i++)
  {
    const c = line.charCodeAt(i);
    if (c === 34) // "
    {
      inQuotes = !inQuotes;
      hasQuote = true;
    }
    else if (c === 44 && !inQuotes) // ,
    {
      const field = line.slice(start, i);
      result.push(hasQuote ? field.replaceAll('"', "") : field);
      start = i + 1;
      hasQuote = false;
    }
  }
  const field = line.slice(start);
  result.push(hasQuote ? field.replaceAll('"', "") : field);
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

// ---- Hand-logging a POTA / SOTA QSO from the Feed Roster (click a park or summit in its POTA / SOTA column,
// roster/sotaLogDialog.js; from Matt's SOTA work). For QSOs nothing else logs (CW, SSB). Never from the Call Roster

// A logging service GridTracker hands QSOs to is connected (AC Log, Log4OM; others to be added here): it logs the QSO
// itself
function loggingServiceConnected()
{
  return acLogCanWork(null) || log4OMCanWork(null);
}

// A Feed Roster spot's park (not the "?-????" of an unknown one), or ""
function feedSpotPark(callObj)
{
  return callObj.pota && callObj.pota !== "?-????" ? callObj.pota : "";
}

// A Feed Roster spot's QSO can be logged by hand: it's in a park or on a summit, no logging service is connected, and no
// WSJT-X / JTDX is on its band and mode (that rig logs the QSO, with the park / summit, sendToLogger)
function feedHandLogAllowed(callObj)
{
  if ((!callObj.sota && !feedSpotPark(callObj)) || loggingServiceConnected()) return false;
  for (const id in GT.instances)
  {
    const instance = GT.instances[id];
    if (!isLoggerInstance(id) && instance.open && instance.valid && instance.status &&
      instance.status.Band == callObj.band && instance.status.MO == callObj.mode) return false;
  }
  return true;
}

// The log reader drops QSOs outside the working callsign / date / grid filters without a word (adifWorker.js); a
// hand-logged one that vanished would look like a bug, so it's refused up front with the reason. null when it's fine
function sotaChaseFilterBlock(myCall, whenSec)
{
  const app = GT.settings.app;
  if (app.workingCallsignEnable && !(myCall in app.workingCallsigns)) return I18N("sotaLog.filterCall").replace("{0}", myCall);
  if (app.workingDateEnable && whenSec < app.workingDate) return I18N("sotaLog.filterDate");
  const myGrid = (app.myGrid || "").substring(0, 4).toUpperCase();
  if (app.workingGridEnable && myGrid.length > 3 && !(myGrid in app.workingGrids)) return I18N("sotaLog.filterGrid").replace("{0}", myGrid);
  return null;
}

const POTA_PARK_REGEXP = /^[A-Z0-9]{1,4}-\d{4,5}$/;

// fields: { myCall, call, park, ref (summit), dateUtc "YYYY-MM-DD", timeUtc "HH:MM", freqMhz, band, mode, rstSent,
// rstRcvd, comment, grid }; a park, a summit or both. Logged like any QSO (sendToLogger: the backup log, loggers,
// uploads; with a park, finishSendingReport spots it to POTA as for a logged decode, so it needs a frequency). Returns
// { ok, message }
function logSotaChaseQso(fields)
{
  try
  {
    const myCall = String(fields.myCall || "").trim().toUpperCase();
    const call = String(fields.call || "").trim().toUpperCase();
    const park = String(fields.park || "").trim().toUpperCase();
    const ref = String(fields.ref || "").trim().toUpperCase();
    const band = String(fields.band || "").trim().toLowerCase();
    const mode = String(fields.mode || "").trim().toUpperCase();
    if (!call) return { ok: false, message: I18N("sotaLog.needCall") };
    if (!myCall) return { ok: false, message: I18N("sotaLog.needMyCall") };
    if (!park && !ref) return { ok: false, message: I18N("sotaLog.needRef") };
    if (park && !POTA_PARK_REGEXP.test(park)) return { ok: false, message: I18N("sotaLog.badPark").replace("{0}", park) };
    if (ref && !sotaRefParts(ref)) return { ok: false, message: I18N("sotaLog.badRef").replace("{0}", ref) };
    if (!band) return { ok: false, message: I18N("sotaLog.needBand") };
    if (!mode) return { ok: false, message: I18N("sotaLog.needMode") };
    if (park && !(Number(fields.freqMhz) > 0)) return { ok: false, message: I18N("sotaLog.needFreq") };

    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fields.dateUtc || ""));
    const time = /^(\d{1,2}):(\d{2})/.exec(String(fields.timeUtc || ""));
    if (!date || !time) return { ok: false, message: I18N("sotaLog.needTime") };
    const whenMs = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), Number(time[1]), Number(time[2]), 0);
    if (isNaN(whenMs)) return { ok: false, message: I18N("sotaLog.needTime") };
    // A QSO in the future is nearly always local time typed as UTC (a few minutes' slack for a fast clock)
    if (whenMs > Date.now() + 300000) return { ok: false, message: I18N("sotaLog.future") };

    const blocked = sotaChaseFilterBlock(myCall, Math.floor(whenMs / 1000));
    if (blocked) return { ok: false, message: blocked };

    let adif = backupAdifHeader;
    adif += valueToAdiField("CALL", call);
    adif += valueToAdiField("QSO_DATE", date[1] + date[2] + date[3]);
    adif += valueToAdiField("TIME_ON", String(time[1]).padStart(2, "0") + time[2] + "00");
    adif += valueToAdiField("BAND", band);
    const freq = Number(fields.freqMhz);
    if (freq > 0) adif += valueToAdiField("FREQ", freq.toFixed(6));
    adif += valueToAdiField("MODE", mode);
    const rstSent = String(fields.rstSent || "").trim();
    const rstRcvd = String(fields.rstRcvd || "").trim();
    if (rstSent) adif += valueToAdiField("RST_SENT", rstSent);
    if (rstRcvd) adif += valueToAdiField("RST_RCVD", rstRcvd);
    adif += valueToAdiField("STATION_CALLSIGN", myCall);
    // The row's grid (its summit's square); with none, sendToLogger uses the summit's
    const grid = String(fields.grid || "").trim().toUpperCase();
    if (grid.length > 3) adif += valueToAdiField("GRIDSQUARE", grid);
    if (park) adif += valueToAdiField("POTA_REF", park);
    if (ref) adif += valueToAdiField("SOTA_REF", ref);
    const comment = String(fields.comment || "").trim();
    if (comment) adif += valueToAdiField("COMMENT", comment);
    adif += "<EOR>";

    // sendToLogger / finishSendingReport quietly skip a record identical to the last one; GT.lastReport only changes
    // once a QSO is committed, so it tells
    const before = GT.lastReport;
    sendToLogger(adif);
    if (GT.lastReport === before) return { ok: false, message: I18N("sotaLog.duplicate") };

    const refs = [park, ref].filter((value) => value).join(" / ");
    addLastTraffic(`<font style='color:lightgreen;'>${I18N("sotaLog.title")}</font><br><font style='color:yellow;'>${call}</font> ` +
      `<font style='color:#40FFD8;'>${refs}</font>`);
    return { ok: true, message: I18N("sotaLog.logged").replace("{0}", call).replace("{1}", refs) };
  }
  catch (e)
  {
    console.error("SOTA chase log failed:", e);
    return { ok: false, message: I18N("sotaLog.failed").replace("{0}", e.message) };
  }
}

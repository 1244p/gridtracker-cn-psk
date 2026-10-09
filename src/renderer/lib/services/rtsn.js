// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

GT.chatRecvFunctions = {
  l: gtChatNewList,
  o: gtSpotMessage,
  b: bandActivityReply,
  k: kpIndexMessage,
  a: gtAddCalls,
  d: gtRemoveCalls,
  f: handleFeed,
};

const ChatState = {
  none: 100,
  idle: 0,
  connect: 1,
  connecting: 2,
  connected: 3,
  status: 4,
  closed: 5,
  error: 6,
};

GT.gtStateToFunction = {
  100: gtSetIdle,
  0: gtCanConnect,
  1: gtConnectChat,
  2: gtConnecting,
  3: gtChatSendVersion,
  4: gtStatusCheck,
  5: gtInError,
  6: closeGtSocket,
};

GT.oamsDenied = false;
GT.lastConnectAttempt = 0;
GT.gtEngineInterval = null;
GT.gtChatSocket = null;
GT.rtsnPins = {};
GT.rtsnCallsigns = {};
GT.feedCallsigns = {};
GT.feedInstance = "Feed";
GT.lastFeedPrune = 0;
GT.wsStatusTimer = null;
GT.gtState = ChatState.none;
GT.gtNeedUsersList = true;
GT.gtLiveStatusUpdate = false;
GT.oamsBandActivityData = null;
GT.lastGtStatus = "";

function gtConnectChat() {
  if (GT.gtChatSocket != null) {
    GT.gtState = ChatState.error;
    GT.lastGtStatus = "";
    GT.spotCollector = {};
    GT.decodeCollector = {};
    return;
  }

  // Modern Math.floor and Template Literals
  const rnd = Math.floor(Math.random() * 10) + 18470;
  try {
    GT.gtState = ChatState.connecting;
    GT.gtChatSocket = new WebSocket(`ws://oams.space:${rnd}`);
  } catch (e) {
    GT.gtState = ChatState.error;
    return;
  }

  GT.gtChatSocket.onopen = function () {
    GT.gtState = ChatState.connected;
    GT.spotCollector = {};
    GT.decodeCollector = {};
    GT.lastGtStatus = "";
    GT.gtLiveStatusUpdate = true;
  };

  GT.gtChatSocket.onmessage = function (evt) {
    if (!GT.settings.app.offAirServicesEnable) {
      closeGtSocket();
      return;
    }

    try {
      const jsmesg = JSON.parse(evt.data);
 
      if (!jsmesg.t) {
        GT.gtState = ChatState.error;
        return;
      }

      if (jsmesg.t in GT.chatRecvFunctions) {
        GT.chatRecvFunctions[jsmesg.t](jsmesg);
      }
    } catch (err) {
      // bad message, dumping client
      GT.gtState = ChatState.error;
    }
  };

  GT.gtChatSocket.onerror = function () {
    this.close();
    GT.gtChatSocket = null;
    GT.gtState = ChatState.error;
  };

  GT.gtChatSocket.onclose = function () {
    GT.gtChatSocket = null;
    GT.gtState = ChatState.closed;
  };
}

function gtConnecting() {}

function gtInError()
{
  closeGtSocket();
}

function closeGtSocket()
{
  if (GT.gtChatSocket != null)
  {
    GT.gtChatSocket.close();
    GT.gtChatSocket = null;
  }
  
  GT.gtState = ChatState.none;
  GT.lastGtStatus = "";
}


function gtCanConnect()
{
  GT.lastConnectAttempt = timeNowSec();
  GT.gtState = ChatState.connect;
}

function gtSetIdle()
{
  if (timeNowSec() - GT.lastConnectAttempt >= 30)
  {
    GT.gtNeedUsersList = true;
    GT.gtState = ChatState.idle;
    GT.lastGtStatus = "";
  }
}

function gtStatusCheck()
{
  if (GT.gtLiveStatusUpdate)
  {
    GT.gtLiveStatusUpdate = false;
    gtChatSendStatus();
  }
  if (GT.gtNeedUsersList)
  {
    GT.gtNeedUsersList = false;
    gtChatGetList();
  }
}

function sendGtJson(json)
{
  if (GT.settings.app.offAirServicesEnable && GT.gtChatSocket != null)
  {
    if (GT.gtChatSocket.readyState === WebSocket.OPEN) {
      GT.gtChatSocket.send(json);
    } else if (GT.gtChatSocket.readyState === WebSocket.CLOSED) {
      GT.gtState = ChatState.closed;
    }
  }
}

function gtChatSendStatus()
{
  let msg = {
    t: "s",
    i: {}
  };

  for (const instance of Object.values(GT.instances))
  {
    if (GT.settings.app.spottingEnable && instance.open && instance.valid && instance.status && instance.instanceKey && instance.status.Band != "OOB")
    {
      msg.i[instance.instanceHash] = instance.instanceKey;
    }
  }

  msg = JSON.stringify(msg);

  if (GT.wsStatusTimer) 
  {
    nodeTimers.clearTimeout(GT.wsStatusTimer);
    GT.wsStatusTimer = null;
  }

  GT.wsStatusTimer = nodeTimers.setTimeout(sendStatusMessage, 10000, msg);
}

function sendStatusMessage(msg)
{
  if (msg != GT.lastGtStatus)
  {
    sendGtJson(msg);
    GT.lastGtStatus = msg;
  }
  GT.wsStatusTimer = null;
}

function gtChatSendSpots(instancesMap) {
  if (GT.wsStatusTimer != null) return; 

  const payloadInstances = {};

  for (const [instanceHash, spotMap] of Object.entries(instancesMap)) {
    payloadInstances[instanceHash] = Array.from(
      spotMap, 
      ([call, data]) => `${call}|${data}`
    ).join(",");
  }

  sendGtJson(JSON.stringify({ t: "o", i: payloadInstances }));
}

function gtChatSendDecodes(instancesCounts)
{
  // Don't send decodes if have a pending instance change
  if (GT.wsStatusTimer == null)
  {
    sendGtJson(JSON.stringify({ t: "d", i: instancesCounts }));
  }
}

function oamsBandActivityCheck()
{
  if (GT.settings.app.oamsBandActivity && GT.settings.app.myGrid.length >= 4)
  {
    let grid = GT.settings.app.myGrid.substring(0, 4).toUpperCase();
    if (GT.settings.app.oamsBandActivityNeighbors)
    {
      gtChatSendBandActivityRequest(squareToNeighbors(grid));
    }
    else
    {
      gtChatSendBandActivityRequest([grid]);
    }
  }
}

function gtChatSendBandActivityRequest(gridArray)
{
  let msg = { t: "b", g: gridArray };
  sendGtJson(JSON.stringify(msg));
}

function bandActivityReply(jsmesg)
{
  GT.oamsBandActivityData = jsmesg.r;
  renderBandActivity();
}

function kpIndexMessage(jsmesg)
{
  handleKpIndexJSON(jsmesg.i);
}

function oamsDisable(jsmesg)
{
  // Denied access from OAMS
  // Do not attempt to connect again this session
  GT.oamsDenied = true;
  closeGtSocket();
}

function gtAddCalls(jsmesg)
{

  const callkeys = jsmesg.c.split(",");

 for (const cid of callkeys) {
    if (!(cid in GT.rtsnPins)) {
      addNewCall(cid);
    }
  }
}

function gtRemoveCalls(jsmesg) {

  const gtFlagsLayer = GT.layerSources.gtflags;
  const rtsnPins = GT.rtsnPins;
  const rtsnCallsigns = GT.rtsnCallsigns;

  const callkeys = jsmesg.c.split(",");
  
  for (const cid of callkeys) {
    const pinObj = rtsnPins[cid];
    if (!pinObj) continue;

    if (pinObj.pin && gtFlagsLayer.hasFeature(pinObj.pin)) {
      gtFlagsLayer.removeFeature(pinObj.pin);
    }
    pinObj.pin = null;


    const call = pinObj.call;
    if (rtsnCallsigns[call]) {
      delete rtsnCallsigns[call][cid]; // Delete the specific CID first
      
      // If no more CIDs exist for this call, delete the call itself
      if (Object.keys(rtsnCallsigns[call]).length === 0) {
        delete rtsnCallsigns[call];
      }
    }

    delete GT.rtsnPins[cid];
  }
}

function handleFeed(jsmesg)
{
  if (typeof jsmesg.f !== "string") return;
  if (!GT.settings.app.feedDxCluster && !GT.settings.app.feedCwSkimmer) return;

  const now = timeNowSec();
  let added = false;
  for (const element of jsmesg.f.split(";"))
  {
    if (addFeedSpot(element.split("|"), now)) added = true;
  }
  pruneFeedCallsigns(now);

  if (added)
  {
    scheduleRosterUpdate();
    if (GT.settings.map.dxcwFeed) scheduleDxcwRedraw();
  }
}

// Bands offered in the roster's Feeds tab; spots on bands outside the user's plan are hidden
const FEED_BANDS_US = ["2200m", "630m", "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "1.25m", "70cm", "33cm", "23cm"];
const FEED_BANDS_OTHER = ["2200m", "630m", "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "4m", "2m", "70cm", "23cm"];

function feedBandPlan()
{
  return isKnownCallsignUSplus(GT.myDXCC) ? FEED_BANDS_US : FEED_BANDS_OTHER;
}

function feedsActive()
{
  const on = GT.settings.app.offAirServicesEnable == true && GT.settings.map.offlineMode == false;
  return { dx: on && GT.settings.app.feedDxCluster == true, cw: on && GT.settings.app.feedCwSkimmer == true };
}

// Main button panel DX/CW feed button: shows feed spots on the map
function toggleDxcwFeed()
{
  GT.settings.map.dxcwFeed = !GT.settings.map.dxcwFeed;
  dxcwFeedImg.style.filter = GT.settings.map.dxcwFeed ? "" : "grayscale(1)";

  redrawDxcwSpots();
}

// Map icons: a rig on the spot's band and mode, a rig on its band only, or neither
GT.feedTargetIcon = new ol.style.Icon({ src: "img/feed_target.png", scale: 0.4 });
GT.feedOnBandIcon = new ol.style.Icon({ src: "img/feed_on_band.png", scale: 0.3 });
GT.feedIdleIcon = new ol.style.Icon({ src: "img/feed_idle.png", scale: 0.3 });
GT.dxcwRedrawTimeout = null;

function scheduleDxcwRedraw()
{
  nodeTimers.clearTimeout(GT.dxcwRedrawTimeout);
  GT.dxcwRedrawTimeout = nodeTimers.setTimeout(redrawDxcwSpots, 250);
}

function redrawDxcwSpots()
{
  GT.dxcwRedrawTimeout = null;
  GT.layerSources.dxcwSpots.clear();

  const active = feedsActive();
  if (!GT.settings.map.dxcwFeed || !(active.dx || active.cw)) return;

  const onBand = {};
  const onBandMode = {};
  for (const id in GT.instances)
  {
    const instance = GT.instances[id];
    if (instance.valid && instance.open && instance.status)
    {
      onBand[instance.status.Band] = true;
      onBandMode[instance.status.Band + "|" + instance.status.MO] = true;
    }
  }

  const now = timeNowSec();
  for (const hash in GT.feedCallsigns)
  {
    const callObj = GT.feedCallsigns[hash];
    if (callObj.fullGrid.length < 4 || now - callObj.age > FEED_MAX_AGE_SEC) continue;
    // Map shows all bands and modes: only the map's own Band / Mode filter applies (the Feeds tab lists are roster-only)
    if (!validateMapBandAndMode(callObj.band, callObj.mode)) continue;

    const LL = squareToCenter(callObj.fullGrid);
    if (isNaN(LL.a)) continue;

    let icon = GT.feedIdleIcon;
    let zIndex = 1;
    if ((callObj.band + "|" + callObj.mode) in onBandMode)
    {
      icon = GT.feedTargetIcon;
      zIndex = 3;
    }
    else if (callObj.band in onBand)
    {
      icon = GT.feedOnBandIcon;
      zIndex = 2;
    }

    const feature = iconFeature(ol.proj.fromLonLat([LL.o, LL.a]), icon, zIndex, "feed");
    feature.feedHash = hash;
    // Same click handling as RX spots: left-click sets the call, right-click shows the tooltip
    feature.size = 6;
    GT.layerSources.dxcwSpots.addFeature(feature);
  }
}

// Map left-click on a feed spot, like an RX spot: a rig on its band and mode if there is one, otherwise the active rig
function leftClickFeedSpot(hash)
{
  const callObj = GT.feedCallsigns[hash];
  if (callObj)
  {
    setCallAndGrid(callObj.DEcall, callObj.grid, feedSpotInstance(callObj));
  }
}

function feedBandAllowed(callObj)
{
  return feedBandPlan().includes(callObj.band) && !(callObj.band in GT.settings.roster.feeds.hiddenBands);
}

// Roster-only, like the band list; a mode in neither mode list is always shown
function feedModeAllowed(callObj)
{
  let type = "";
  if (callObj.mode == "CW") type = "CW";
  else if (GT.modes[callObj.mode]) type = "Digital";
  else if (GT.modes_phone[callObj.mode]) type = "Phone";
  return !(type in GT.settings.roster.feeds.hiddenModes);
}

// Feed spots share the roster with WSJT-X decodes; a local decode of the same call/band/mode wins
function addFeedToRoster(hash, callObj, now)
{
  const entry = GT.callRoster[hash];
  if (entry && entry.callObj.instance !== GT.feedInstance) return;

  if (callObj.reset)
  {
    callObj.life = now;
    callObj.reset = false;
  }

  if (!entry)
  {
    GT.callRoster[hash] = { message: FEED_MESSAGE, callObj: callObj, DXcall: callObj.DXcall, DEcall: callObj.DEcall };
  }
  else
  {
    entry.callObj = callObj;
    entry.DXcall = callObj.DXcall;
  }
}

function clearFeedCallsigns()
{
  let removed = false;
  for (const hash in GT.callRoster)
  {
    if (GT.callRoster[hash].callObj.instance === GT.feedInstance)
    {
      delete GT.callRoster[hash];
      removed = true;
    }
  }
  GT.feedCallsigns = {};
  if (removed) goProcessRoster();
  redrawDxcwSpots();
}

// Called when the user ignores a spotter: drop the spots they currently own from the roster and map
function dropFeedSpotter(base)
{
  for (const hash in GT.feedCallsigns)
  {
    if (GT.feedCallsigns[hash].spotter.split("-")[0] === base)
    {
      delete GT.feedCallsigns[hash];
      if (hash in GT.callRoster && GT.callRoster[hash].callObj.instance === GT.feedInstance)
      {
        delete GT.callRoster[hash];
      }
    }
  }
  redrawDxcwSpots();
}

// A feed spot is workable only from a rig already on the spot's band and mode
function feedSpotInstance(callObj)
{
  for (const id in GT.instances)
  {
    const instance = GT.instances[id];
    if (instance.valid && instance.open && instance.status && instance.status.Band == callObj.band && instance.status.MO == callObj.mode)
    {
      return id;
    }
  }
  return null;
}

function workFeedSpot(hash)
{
  const entry = GT.callRoster[hash];
  if (!entry || entry.callObj.instance !== GT.feedInstance) return;

  const instance = feedSpotInstance(entry.callObj);
  if (instance == null) return;

  if (GT.settings.map.focusRig && GT.activeInstance != instance)
  {
    setRig(instance);
  }
  setCallAndGrid(entry.DEcall, entry.callObj.grid, instance);
}

// Gen Msgs on a feed spot: a rig on the spot's band and mode if there is one, otherwise the active rig
function genFeedMessages(hash)
{
  const entry = GT.callRoster[hash];
  if (!entry || entry.callObj.instance !== GT.feedInstance) return;

  setCallAndGrid(entry.DEcall, entry.callObj.grid, feedSpotInstance(entry.callObj));
}

// Feed text ends up in roster innerHTML and onClick attributes, so anything unexpected is rejected
const FEED_MODE_REGEXP = /^[A-Z0-9-]{1,12}$/;
const FEED_SPOTTER_REGEXP = /^[A-Z0-9/#-]{1,20}$/;
const FEED_GRID_REGEXP = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/;
const FEED_OFFSET_REGEXP = /^[0-9]{1,9}$/;
const FEED_MAX_AGE_SEC = 300;
// Roster filters read SR/DF/DT from the WSJT-X message; feed spots have none, so those filters pass them
const FEED_MESSAGE = Object.freeze({});

// parts: DEcall | mode | band | grid | Hz offset from start of band | spotter | message
function addFeedSpot(parts, now)
{

  if (parts.length < 7) return false;

  const DEcall = parts[0].trim().toUpperCase();
  const mode = parts[1].trim().toUpperCase();
  const band = parts[2].trim();
  const spotter = parts[5].trim().toUpperCase();
  const offset = parts[4].trim();
  let grid = parts[3].trim().toUpperCase();

  if (!CALLSIGN_REGEXP.test(DEcall) || !FEED_MODE_REGEXP.test(mode) || !FEED_SPOTTER_REGEXP.test(spotter)) return false;
  // Spotters the user ignored in the roster (by base callsign, so W3LPL covers W3LPL-#)
  if (spotter.split("-")[0] in GT.settings.ignoredSpotters) return false;
  if (band == "OOB" || !Object.prototype.hasOwnProperty.call(GT.bandColors, band)) return false;
  // The roster works in 4-character grids; the map places spots with the full 4 or 6
  const fullGrid = FEED_GRID_REGEXP.test(grid) ? grid : "";
  grid = fullGrid.substring(0, 4);

  // Kept raw like decoded messages: the roster escapes msg when it renders it
  let msg = parts[6].trim();
  // Beacons can't be worked
  if (msg.startsWith("BEACON") || msg.startsWith("NCDXF")) return false;
  if (msg.length > 40) msg = msg.substring(0, 40) + "...";

  // Calling column shows "CQ" like a decode would; the spotter is shown in the row's tooltip
  const isCQ = msg.startsWith("CQ");
  const calling = isCQ ? "CQ" : "";
  const hash = DEcall + band + mode;
  let callObj = GT.feedCallsigns[hash];

  if (callObj === undefined)
  {
    const dxcc = callsignToDxcc(DEcall);
    callObj = new LiveCallsign(DEcall, calling, grid, mode, band, msg, dxcc, now);
    callObj.hash = hash;
    callObj.instance = GT.feedInstance;
    callObj.fullGrid = fullGrid;

    if (dxcc > 0)
    {
      callObj.px = getWpx(DEcall);
      if (callObj.px)
      {
        callObj.zone = Number(callObj.px.charAt(callObj.px.length - 1));
      }
      callObj.cont = GT.dxccInfo[dxcc].continent;
      if (dxcc == 390 && callObj.zone == 1) { callObj.cont = "EU"; }
    }

    callObj.ituz = ituZoneFromCallsign(DEcall, dxcc);
    callObj.cqz = cqZoneFromCallsign(DEcall, dxcc);

    // A county from an earlier lookup of this call, as decodes get
    getLookupCachedObject(DEcall, null, null, null, callObj);
    GT.feedCallsigns[hash] = callObj;
  }
  else
  {
    callObj.time = now;
    callObj.age = now;
    callObj.DXcall = calling;
    callObj.msg = msg;
    if (grid.length > 0 && grid != callObj.grid)
    {
      callObj.grid = grid;
      callObj.distance = 0;
      callObj.state = null;
    }
    // A later 4-character spot of the same square doesn't throw away a known 6-character grid
    if (fullGrid.length > 0 && (fullGrid.length >= callObj.fullGrid.length || !callObj.fullGrid.startsWith(grid)))
    {
      callObj.fullGrid = fullGrid;
    }
  }

  callObj.freq = (FEED_OFFSET_REGEXP.test(offset) && Object.prototype.hasOwnProperty.call(K_BAND_TO_BASE_HZ, band)) ? K_BAND_TO_BASE_HZ[band] + (Number(offset) * 100) : 0;
  callObj.spotter = spotter;
  callObj.CQ = isCQ;
  callObj.gridQualified = callObj.grid.length > 0;
  // Audio alerts with "every decode" re-fire when UTC changes, so each spot gets its own time
  callObj.UTC = toColonHMS(now % 86400);

  if (callObj.grid.length > 0)
  {
    if (callObj.distance == 0) updateLiveDistance(callObj);

    if (callObj.state == null && isKnownCallsignUS(callObj.dxcc) && callObj.grid in GT.gridToState && GT.gridToState[callObj.grid].length == 1)
    {
      callObj.state = GT.gridToState[callObj.grid][0];
    }
  }

  // Same state/county lookups as decodes
  if (GT.settings.callsignLookups.ulsUseEnable == true && isKnownCallsignUSplus(callObj.dxcc) && (callObj.state == null || callObj.cnty == null))
  {
    lookupKnownCallsign(callObj);
  }

  if (callObj.state == null && callObj.dxcc == 1 && GT.settings.callsignLookups.cacUseEnable && callObj.DEcall in GT.cacCallsigns)
  {
    callObj.state = "CA-" + GT.cacCallsigns[callObj.DEcall];
  }

  // Feed spots never trigger custom alerts; audio alerts come from the roster (Feeds tab "Allow Alerting")
  addFeedToRoster(hash, callObj, now);
  return true;
}

function pruneFeedCallsigns(now)
{
  if (now - GT.lastFeedPrune < 60) return;
  GT.lastFeedPrune = now;

  for (const hash in GT.feedCallsigns)
  {
    if (now - GT.feedCallsigns[hash].age > FEED_MAX_AGE_SEC)
    {
      delete GT.feedCallsigns[hash];
    }
  }
}

function gtChatGetList()
{
  sendGtJson(JSON.stringify({t: "l"}));
}

function redrawPins()
{
  clearGtFlags();

  const features = [];

  for (const cid in GT.rtsnPins)
  {
    const pinObj = GT.rtsnPins[cid];

    pinObj.pin = null;
    makeGtPin(pinObj);

    if (pinObj.pin != null)
    {
      features.push(pinObj.pin);
    }
  }

  if (features.length > 0)
  {
    GT.layerSources.gtflags.addFeatures(features);
  }
}

function makeGtPin(obj) {
  try {
    if (obj.pin) {
      if (GT.layerSources.gtflags.hasFeature(obj.pin)) {
        GT.layerSources.gtflags.removeFeature(obj.pin);
      }
      obj.pin = null;
    }
        
    if (!obj.grid || (obj.grid.length !== 4 && obj.grid.length !== 6)) return;
    if (validateGridFromString(obj.grid) === false) return;
    if (!validateMapBandAndMode(obj.band, obj.mode)) return;

    let LL = squareToCenter(obj.grid);
    obj.pin = iconFeature(ol.proj.fromLonLat([LL.o, LL.a]), GT.gtFlagIcon, 100, "gtFlag");
    obj.pin.key = obj.cid;
    obj.pin.isGtFlag = true;
    obj.pin.size = 1;
  } catch (e) {
    console.error(`Failed to make GT Pin for ${obj?.cid}:`, e); 
  }
}

class PinData {
  constructor(call, band, mode, grid, cid, dxcc, fCall) {
    this.pin = null; 
    this.call = call;
    this.fCall = fCall;
    this.grid = grid;
    this.freq = 0;       // SMI (Small Integer)
    this.band = band;
    this.mode = mode;
    this.cid = cid;
    this.dxcc = dxcc;
  }
}

function addNewCall(cid) {
  const parts = cid.split("|");
  const call = parts[0];

  const fCall = formatCallsign(call);
  const dxcc = callsignToDxcc(call);

  const pinData = new PinData(
    call, 
    parts[1], 
    parts[2], 
    parts[3], 
    cid, 
    dxcc, 
    fCall
  );

  GT.rtsnPins[cid] = pinData;

  // 5. Caching the dictionary lookup.
  // When objects are used as Maps, V8 downgrades them to "Dictionary Mode" (Hash Maps).
  // Lookups in Dictionary Mode are slower, so we look it up exactly once.
  let callDict = GT.rtsnCallsigns[call];
  if (callDict === undefined) {
    callDict = {};
    GT.rtsnCallsigns[call] = callDict;
  }
  callDict[cid] = true;

  makeGtPin(pinData);

  // 6. Strict null check instead of Truthy check.
  // `if (pinData.pin)` requires V8 to perform type coercion.
  // `!== null` is a direct memory pointer comparison. It is faster.
  if (pinData.pin !== null) {
    GT.layerSources.gtflags.addFeature(pinData.pin);
  }
}

function gtChatNewList(jsmesg)
{
  clearGtFlags();

  // starting clean if we're getting a new chat list
  GT.rtsnPins = {}
  GT.rtsnCallsigns = {};

  const callkeys = jsmesg.c.split(",");

  for (const cid of callkeys)
  {
    addNewCall(cid);
  }

  oamsBandActivityCheck();
}


function htmlEntities(str)
{
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


function simplePushTestResponse(buffer, isTest)
{
  if (isTest)
  {
    let divText = I18N("adif.TestResult.error");
    let color = "#F00";
    try 
    {
      if (buffer)
      {
        const json = JSON.parse(String(buffer));
        if ("notificationId" in json || "taskId" in json)
        {
          divText = I18N("adif.TestResult.passed");
          color = "#1F1";
        }
        if ("error" in json)
        {
          divText = json.msg;
          color = "#F00";
        }
      }
      else
      {
        divText = I18N("adif.TestResult.response");
      }
    }
    catch (err)
    {
      console.log(err);
    }
    simplepushResponseDiv.innerHTML = divText;
    simplepushResponseDiv.style.color = color;
  }
}


function sendSimplePushTestMessage(jsmesg)
{
  const url = "https://api.simplepu.sh/v1/" + (GT.settings.msg.msgSimplepushNotifyOnly ? "notifications" : "tasks") + "/json";
  let data = {
    title: "GT Test - " + formatCallsign(GT.settings.app.myCall),
    content: formatCallsign(jsmesg.call) + ": " + jsmesg.msg
  };

  simplepushResponseDiv.innerHTML = I18N("adif.TestResult.testing");

  getPostJSONBuffer(
    url,
    simplePushTestResponse, // callback,
    true,  // test flag
    "https",
    443,
    data,
    5000,
    undefined,
    undefined,
    { "API-Token": GT.settings.msg.msgSimplepushApiKey }
  );
}

function sendPushOverMessage(jsmesg, test = false)
{
  const url = "https://api.pushover.net/1/messages.json";
  let data = {
    user: GT.settings.msg.msgPushoverUserKey,
    token: GT.settings.msg.msgPushoverToken,
    title:
        "GT Test - " + formatCallsign(GT.settings.app.myCall),
    message: formatCallsign(jsmesg.call) + ": " + jsmesg.msg
  };
  getPostBuffer(
    url,
    PushoverReply, // callback,
    test,
    "https",
    443,
    data,
    5000 // timeoutMs,
  );
}

function PushoverReply(data, isTest)
{
  if (isTest)
  {
    let result = "Unknown Error";
    let color = "#F00";
    let responseJson = JSON.parse(data);

    if (typeof responseJson != "undefined" && typeof responseJson.status != "undefined")
    {
      if (responseJson.status == 1)
      {
        // {"status":1,"request":"1d5ace84-c2e4-4b19-a051-5ac4c9671170"}
        color = "#FFF";
        result = I18N("adif.TestResult.passed");
      }
      else if (responseJson.status == 0)
      {
        color = "#FF0";
        if (typeof responseJson.user != "undefined")
        {
          // {"user":"invalid","errors":["user identifier is not a valid user, group, or subscribed user key, see https://pushover.net/api#identifiers"],"status":0,"request":"3ef45ac6-38d6-47db-b7aa-7731e8ac0fcb"}
          result = "User Key Invalid";
        }
        else if (typeof responseJson.token != "undefined")
        {
          //  {"token":"invalid","errors":["application token is invalid, see https://pushover.net/api"],"status":0,"request":"10629fe4-1e37-4c0f-a123-4585a3fb2aea"}
          result = "API Token Invalid";
        }
        else
        {
          result = "Unknown Response";
        }
      }
      else
      {
        result = "Unknown Status";
      }
    }

    pushOverTestResultsDiv.innerHTML = result;
    pushOverTestResultsDiv.style.color = color;
  }
}

function gtChatSendVersion()
{
  sendGtJson(JSON.stringify({t: "v", v: gtVersion, p: GT.platform}));
  gtChatSendFeeds();
  GT.gtState = ChatState.status;
}

function gtChatSendFeeds()
{
  sendGtJson(JSON.stringify({
    t: "f",
    d: GT.settings.app.feedDxCluster ? 1 : 0,
    s: GT.settings.app.feedCwSkimmer ? 1 : 0
  }));
}


GT.getEngineWasRunning = false;

function gtChatStateMachine()
{
  if (GT.settings.app.offAirServicesEnable && !GT.settings.map.offlineMode && GT.settings.app.myCall.length > 2 && GT.settings.app.myCall != "NOCALL" && !GT.oamsDenied)
  {
    GT.gtStateToFunction[GT.gtState]();
    GT.getEngineWasRunning = true;
  }
  else
  {
    if (GT.getEngineWasRunning)
    {
      GT.getEngineWasRunning = false;
      closeGtSocket();
      GT.lastGtStatus = "";
    }
  }
}

function gtSpotMessage(jsmesg)
{
  if ("O" in jsmesg)
  {
    const parts = jsmesg.O.split("|");
    if (parts.length == 5)
    {
      addNewRTSNSpot(parts);
    }
  }
}

function gtChatSystemInit()
{
  GT.lastConnectAttempt = timeNowSec() - 25;
  GT.gtEngineInterval = nodeTimers.setInterval(gtChatStateMachine, 1333);
}

function showGtFlags()
{
  if (GT.settings.app.gtFlagImgSrc > 0)
  {
    if (!GT.settings.map.offlineMode)
    {
      redrawPins();
      GT.layerVectors.gtflags.setVisible(true);
    }
    else
    {
      GT.layerVectors.gtflags.setVisible(false);
    }
  }
  else GT.layerVectors.gtflags.setVisible(false);
}

function clearGtFlags()
{
  GT.layerSources.gtflags.clear();
}

function toggleGtMap()
{
  GT.settings.app.gtFlagImgSrc += 1;
  GT.settings.app.gtFlagImgSrc %= 2;
  gtFlagImg.src = GT.gtFlagImageArray[GT.settings.app.gtFlagImgSrc];
  if (GT.spotView > 0 && !GT.settings.reception.mergeSpots) return;
  if (GT.settings.app.gtFlagImgSrc > 0)
  {
    redrawPins();
    GT.layerVectors.gtflags.setVisible(true);
  }
  else
  {
    GT.layerVectors.gtflags.setVisible(false);
  }
}

const K_BAND_TO_BASE_HZ = {
    // LF / MF (Sub-1 MHz)
    "4000m": 9000,
    "2200m": 135700,
    "630m": 472000,

    // HF
    "160m": 1000000,
    "80m": 3000000,
    "60m": 5000000,
    "40m": 7000000,
    "30m": 10000000,
    "20m": 14000000,
    "17m": 18000000,
    "15m": 21000000,
    "12m": 24000000,
    "11m": 27000000,
    "10m": 28000000,

    // VHF
    "8m": 40000000,
    "6m": 50000000,
    "4m": 70000000,
    "2m": 141000000,
    "1.25m": 219000000,

    // UHF
    "70cm": 420000000,
    "33cm": 902000000,
    "23cm": 1240000000,
    "13cm": 2300000000,

    // SHF / EHF (Microwave)
    "9cm": 3300000000,
    "6cm": 5650000000,
    "3cm": 10000000000,
    "1.2cm": 24000000000,
    "6mm": 47000000000,
    "4mm": 75500000000,
    "2.5mm": 122500000000,
    "2mm": 134000000000,
    "1mm": 241000000000,
};

const K_BAND_PLAN = [
    { mode: "WSPR", band: "160m", min: 1838000, max: 1838200, regex: null },
    { mode: "WSPR", band: "80m", min: 3570000, max: 3570200, regex: null },
    { mode: "WSPR", band: "60m", min: 5288600, max: 5288800, regex: null },
    { mode: "WSPR", band: "40m", min: 7040000, max: 7040200, regex: null },
    { mode: "WSPR", band: "30m", min: 10140100, max: 10140300, regex: null },
    { mode: "WSPR", band: "20m", min: 14097000, max: 14097200, regex: null },
    { mode: "WSPR", band: "17m", min: 18106000, max: 18106200, regex: null },
    { mode: "WSPR", band: "15m", min: 21096000, max: 21096200, regex: null },
    { mode: "WSPR", band: "12m", min: 24926000, max: 24926200, regex: null },
    { mode: "WSPR", band: "10m", min: 28126000, max: 28126200, regex: null },
    { mode: "WSPR", band: "6m", min: 50294400, max: 50294600, regex: null },
    { mode: "WSPR", band: "4m", min: 70091000, max: 70093000, regex: null },
    { mode: "WSPR", band: "2m", min: 144489000, max: 144491000, regex: null },

    { mode: "FT8", band: "160m", min: 1840000, max: 1843000, regex: null },
    { mode: "FT8", band: "80m", min: 3573000, max: 3576000, regex: null },
    { mode: "FT8", band: "60m", min: 5357000, max: 5360000, regex: null },
    { mode: "FT8", band: "40m", min: 7074000, max: 7077000, regex: null },
    { mode: "FT8", band: "30m", min: 10136000, max: 10139000, regex: null },
    { mode: "FT8", band: "20m", min: 14074000, max: 14077000, regex: null },
    { mode: "FT8", band: "17m", min: 18100000, max: 18103000, regex: null },
    { mode: "FT8", band: "15m", min: 21074000, max: 21077000, regex: null },
    { mode: "FT8", band: "12m", min: 24915000, max: 24918000, regex: null },
    { mode: "FT8", band: "10m", min: 28074000, max: 28077000, regex: null },
    { mode: "FT8", band: "6m", min: 50313000, max: 50316000, regex: null },
    { mode: "FT8", band: "4m", min: 70153000, max: 70156000, regex: null },
    { mode: "FT8", band: "2m", min: 144173000, max: 144176000, regex: null },

    { mode: "FT4", band: "160m", min: 1844000, max: 1847000, regex: null },
    { mode: "FT4", band: "80m", min: 3575000, max: 3578000, regex: null },
    { mode: "FT4", band: "40m", min: 7047500, max: 7050500, regex: null },
    { mode: "FT4", band: "30m", min: 10140000, max: 10143000, regex: null },
    { mode: "FT4", band: "20m", min: 14080000, max: 14083000, regex: null },
    { mode: "FT4", band: "17m", min: 18104000, max: 18107000, regex: null },
    { mode: "FT4", band: "15m", min: 21140000, max: 21143000, regex: null },
    { mode: "FT4", band: "12m", min: 24919000, max: 24922000, regex: null },
    { mode: "FT4", band: "10m", min: 28180000, max: 28183000, regex: null },
    { mode: "FT4", band: "6m", min: 50318000, max: 50321000, regex: null },
    { mode: "FT4", band: "4m", min: 70153000, max: 70156000, regex: null },
    { mode: "FT4", band: "2m", min: 144169000, max: 144172000, regex: null },

    { mode: "JS8CALL", band: "160m", min: 1842000, max: 1845000, regex: null },
    { mode: "JS8CALL", band: "80m", min: 3578000, max: 3581000, regex: null },
    { mode: "JS8CALL", band: "40m", min: 7078000, max: 7081000, regex: null },
    { mode: "JS8CALL", band: "30m", min: 10130000, max: 10133000, regex: null },
    { mode: "JS8CALL", band: "20m", min: 14078000, max: 14081000, regex: null },
    { mode: "JS8CALL", band: "17m", min: 18104000, max: 18107000, regex: null },
    { mode: "JS8CALL", band: "15m", min: 21078000, max: 21081000, regex: null },
    { mode: "JS8CALL", band: "12m", min: 24922000, max: 24925000, regex: null },
    { mode: "JS8CALL", band: "10m", min: 28078000, max: 28081000, regex: null },
    { mode: "JS8CALL", band: "6m", min: 50318000, max: 50321000, regex: null },
    { mode: "JS8CALL", band: "4m", min: 70153000, max: 70156000, regex: null },
    { mode: "JS8CALL", band: "2m", min: 144177000, max: 144180000, regex: null },

    { mode: "PSK31", band: "160m", min: 1838000, max: 1840000, regex: null },
    { mode: "PSK31", band: "80m", min: 3580000, max: 3582000, regex: null },
    { mode: "PSK31", band: "40m", min: 7070000, max: 7072000, regex: null },
    { mode: "PSK31", band: "30m", min: 10140000, max: 10142000, regex: null },
    { mode: "PSK31", band: "20m", min: 14070000, max: 14072000, regex: null },
    { mode: "PSK31", band: "17m", min: 18100000, max: 18102000, regex: null },
    { mode: "PSK31", band: "15m", min: 21070000, max: 21072000, regex: null },
    { mode: "PSK31", band: "12m", min: 24920000, max: 24922000, regex: null },
    { mode: "PSK31", band: "10m", min: 28120000, max: 28122000, regex: null },
    { mode: "PSK31", band: "4m", min: 70110000, max: 70120000, regex: null },
    { mode: "PSK31", band: "2m", min: 144137000, max: 144139000, regex: null },

    { mode: "RTTY", band: "80m", min: 3580000, max: 3600000, regex: null },
    { mode: "RTTY", band: "40m", min: 7040000, max: 7050000, regex: null },
    { mode: "RTTY", band: "30m", min: 10130000, max: 10140000, regex: null },
    { mode: "RTTY", band: "20m", min: 14080000, max: 14099000, regex: null },
    { mode: "RTTY", band: "15m", min: 21080000, max: 21100000, regex: null },
    { mode: "RTTY", band: "10m", min: 28080000, max: 28100000, regex: null },
    { mode: "RTTY", band: "4m", min: 70110000, max: 70150000, regex: null },
    { mode: "RTTY", band: "2m", min: 144110000, max: 144150000, regex: null },

    { mode: "AM", band: "160m", min: 1880000, max: 1900000, regex: null },
    { mode: "AM", band: "80m", min: 3870000, max: 3890000, regex: null },
    { mode: "AM", band: "40m", min: 7280000, max: 7300000, regex: null },
    { mode: "AM", band: "20m", min: 14280000, max: 14330000, regex: null },
    { mode: "AM", band: "15m", min: 21380000, max: 21430000, regex: null },
    { mode: "AM", band: "10m", min: 29000000, max: 29200000, regex: null },
    { mode: "AM", band: "6m", min: 50400000, max: 50500000, regex: null },
    { mode: "AM", band: "4m", min: 70250000, max: 70300000, regex: null },
    { mode: "AM", band: "2m", min: 144400000, max: 144450000, regex: null },

    { mode: "FM", band: "10m", min: 29500000, max: 29700000, regex: null },
    { mode: "FM", band: "6m", min: 51100000, max: 54000000, regex: null },
    { mode: "FM", band: "4m", min: 70250000, max: 70500000, regex: null },
    { mode: "FM", band: "2m", min: 144500000, max: 148000000, regex: null },

    { mode: "SSB", band: "160m", min: 1843000, max: 2000000, regex: null },
    { mode: "SSB", band: "80m", min: 3600000, max: 4000000, regex: null },
    { mode: "SSB", band: "60m", min: 5330000, max: 5406000, regex: null },
    { mode: "SSB", band: "40m", min: 7050000, max: 7300000, regex: null },
    { mode: "SSB", band: "20m", min: 14100000, max: 14350000, regex: null },
    { mode: "SSB", band: "17m", min: 18110000, max: 18168000, regex: null },
    { mode: "SSB", band: "15m", min: 21200000, max: 21450000, regex: null },
    { mode: "SSB", band: "12m", min: 24930000, max: 24990000, regex: null },
    { mode: "SSB", band: "10m", min: 28300000, max: 29300000, regex: null },
    { mode: "SSB", band: "6m", min: 50100000, max: 50300000, regex: null },
    { mode: "SSB", band: "4m", min: 70150000, max: 70250000, regex: null },
    { mode: "SSB", band: "2m", min: 144150000, max: 144275000, regex: null },

    { mode: "CW", band: "160m", min: 1800000, max: 1840000, regex: null },
    { mode: "CW", band: "80m", min: 3500000, max: 3570000, regex: null },
    { mode: "CW", band: "60m", min: 5330000, max: 5357000, regex: null },
    { mode: "CW", band: "40m", min: 7000000, max: 7040000, regex: null },
    { mode: "CW", band: "30m", min: 10100000, max: 10130000, regex: null },
    { mode: "CW", band: "20m", min: 14000000, max: 14070000, regex: null },
    { mode: "CW", band: "17m", min: 18068000, max: 18095000, regex: null },
    { mode: "CW", band: "15m", min: 21000000, max: 21070000, regex: null },
    { mode: "CW", band: "12m", min: 24890000, max: 24910000, regex: null },
    { mode: "CW", band: "10m", min: 28000000, max: 28070000, regex: null },
    { mode: "CW", band: "6m", min: 50000000, max: 50100000, regex: null },
    { mode: "CW", band: "4m", min: 70000000, max: 70150000, regex: null },
    { mode: "CW", band: "2m", min: 144000000, max: 144110000, regex: null },
];

// Used in RTSN
// K_BAND_PLAN.forEach((m) => (m.regex = new RegExp(m.mode, "i")));

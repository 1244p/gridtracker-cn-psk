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
// Feed spots are kept for an hour after they were last spotted, whatever is shown: Settings -> Feeds
// "Feed Spots Max Age" limits the map, the Feed Roster's "Roster Max Age" limits the Feed Roster
const FEED_KEEP_SECONDS = 3600;
// Feed Roster entries (same shape as GT.callRoster entries), separate from the Call Roster's WSJT-X decodes
GT.feedRoster = {};
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
  if (!GT.settings.app.dxFeeds) return;

  const now = timeNowSec();
  let added = false;
  for (const element of jsmesg.f.split(";"))
  {
    if (addFeedSpot(element.split("|"), now)) added = true;
  }
  pruneFeedCallsigns(now);

  if (added)
  {
    scheduleFeedRosterUpdate();
    if (GT.settings.map.dxcwFeed || (GT.settings.map.sotaMap && sotaActive())) scheduleDxcwRedraw();
  }
}

// Bands offered in the Feed Roster's Feeds tab; spots on bands outside the user's plan are hidden
const FEED_BANDS_US = ["2200m", "630m", "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "1.25m", "70cm", "33cm", "23cm"];
const FEED_BANDS_OTHER = ["2200m", "630m", "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "4m", "2m", "70cm", "23cm"];

function feedBandPlan()
{
  return isKnownCallsignUSplus(GT.myDXCC) ? FEED_BANDS_US : FEED_BANDS_OTHER;
}

// The same as Sets, for the per-spot checks (feedBandAllowed)
const FEED_BANDS_US_SET = new Set(FEED_BANDS_US);
const FEED_BANDS_OTHER_SET = new Set(FEED_BANDS_OTHER);

// DX Feeds is on and can run (Off-Air Services on, map online)
function feedsActive()
{
  return GT.settings.app.offAirServicesEnable == true && GT.settings.map.offlineMode == false && GT.settings.app.dxFeeds == true;
}

// Main button panel DX Feeds button: shows feed spots on the map
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
// By level (0 no rig on the band, 1 on the band, 2 on the band and mode), built once (sota.js has the summit icons)
const FEED_LEVEL_ICONS = [GT.feedIdleIcon, GT.feedOnBandIcon, GT.feedTargetIcon];

function scheduleDxcwRedraw()
{
  nodeTimers.clearTimeout(GT.dxcwRedrawTimeout);
  GT.dxcwRedrawTimeout = nodeTimers.setTimeout(redrawDxcwSpots, 250);
}

// The markers are redrawn when spots arrive. When the feed goes quiet (a lost connection, the PC asleep), this
// catches up: every 30 seconds, a redraw once a marker drawn has passed its max age (GT.dxcwNextExpiry, from
// redrawDxcwSpots), and the Feed Roster re-filtered by age if nothing has processed it meanwhile. Idle otherwise
// (from Matt's SOTA work)
GT.dxcwNextExpiry = 0;
const FEED_EXPIRY_CHECK_MS = 30000;

function feedExpiryCheck()
{
  if (!feedsActive()) return;
  if (GT.dxcwNextExpiry > 0 && timeNowSec() >= GT.dxcwNextExpiry) redrawDxcwSpots();
  if (Date.now() - GT.feedRosterProcessedAt >= FEED_EXPIRY_CHECK_MS) goProcessFeedRoster();
}
nodeTimers.setInterval(feedExpiryCheck, FEED_EXPIRY_CHECK_MS);

// A DXCC entity's center as { o: lon, a: lat } (like squareToCenter) from the DXCC geo data (data/dxcc.json);
// its lat / lon from data/dxcc-base.json (the same point) if the geo data ever has no center; null if unknown
function dxccCenter(dxcc)
{
  const info = GT.dxccInfo[dxcc];
  if (!(dxcc > 0) || !info) return null;
  const center = info.geo && info.geo.properties ? info.geo.properties.center : null;
  if (Array.isArray(center) && Number.isFinite(center[0]) && Number.isFinite(center[1]))
  {
    return { o: center[0], a: center[1] };
  }
  return (Number.isFinite(info.lon) && Number.isFinite(info.lat)) ? { o: info.lon, a: info.lat } : null;
}

// Where a feed spot goes on the map, as { o: lon, a: lat }, or null: on a known SOTA summit or POTA park, exactly there
// (lined up with the summit / park marker; the spot's grid is that square, but its center can be kilometers off); else
// its grid's center; with no grid, its DXCC entity's center
function feedSpotPosition(callObj)
{
  const summit = callObj.summitPlaced && GT.sota.summits[callObj.sota];
  if (summit) return { o: summit.lon, a: summit.lat };

  const park = callObj.pota && GT.pota.parks[callObj.pota];
  if (park)
  {
    const lat = Number(park.latitude);
    const lon = Number(park.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon) && (lat != 0 || lon != 0)) return { o: lon, a: lat };
  }

  return callObj.fullGrid.length >= 4 ? squareToCenter(callObj.fullGrid) : dxccCenter(callObj.dxcc);
}

// Draws both feed spot layers: DX Feeds (button panel DX Feeds button) and, while SOTA Chasing runs, the SOTA layer
// (its own button). A spot the SOTA or POTA layer shows (its summit / park marker) isn't drawn again on the DX Feeds
// layer while that layer is on; with it off, it's an ordinary DX Feeds spot
function redrawDxcwSpots()
{
  GT.dxcwRedrawTimeout = null;
  GT.layerSources.dxcwSpots.clear();
  GT.layerSources.sotaSpots.clear();
  GT.dxcwNextExpiry = 0;

  const sota = sotaActive();
  const showFeed = GT.settings.map.dxcwFeed == true;
  const showSota = sota && GT.settings.map.sotaMap == true;
  if ((!showFeed && !showSota) || !feedsActive()) return;

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

  // SOTA Chasing: spots on a known summit share one marker there (summitRef -> { hashes, level, best })
  const summits = {};
  // DX Feeds spot markers, grouped where they overlap before they're added
  const feedFeatures = [];

  // While the POTA layer shows, a DX Feeds spot it already shows isn't drawn again: same call + band + mode (the feed
  // spot's hash) as one of its POTA spots
  const potaShown = {};
  if (showFeed && GT.settings.app.potaFeatureEnabled && GT.settings.app.potaMapEnabled && GT.settings.map.offlineMode == false)
  {
    const nowMs = Date.now();
    for (const park in GT.pota.parkSpots)
    {
      if (!(park in GT.pota.parks)) continue;
      for (const call in GT.pota.parkSpots[park])
      {
        const report = GT.pota.parkSpots[park][call];
        if (nowMs < report.expire && validateMapBandAndMode(report.band, report.mode)) potaShown[call + report.band + report.mode] = true;
      }
    }
  }

  // A summit's spots are kept as long as the Feed Roster keeps them (its Max Age), so every SOTA spot in the roster is
  // on its summit's marker; SOTA activators are spotted rarely and stay on a summit for up to an hour. Other spots use
  // the map's Feed Spots Max Age
  const mapMaxAge = GT.settings.app.feedMaxAge;
  const sotaMaxAge = sotaSpotMaxAge();

  const now = timeNowSec();
  for (const hash in GT.feedCallsigns)
  {
    const callObj = GT.feedCallsigns[hash];
    const age = now - callObj.age;
    const onSummit = showSota && callObj.sota && callObj.sota in GT.sota.summits;
    if (age > (onSummit ? sotaMaxAge : mapMaxAge)) continue;
    // The bands and modes ticked in Settings -> Feeds (as in the Feed Roster), then the map's own Band / Mode filter
    if (!feedSpotShown(callObj) || !validateMapBandAndMode(callObj.band, callObj.mode)) continue;
    // When the first marker drawn expires (feedExpiryCheck redraws then)
    const expires = callObj.age + (onSummit ? sotaMaxAge : mapMaxAge) + 1;
    if (GT.dxcwNextExpiry == 0 || expires < GT.dxcwNextExpiry) GT.dxcwNextExpiry = expires;

    // 0 no rig on its band, 1 a rig on its band, 2 a rig on its band and mode
    const level = ((callObj.band + "|" + callObj.mode) in onBandMode) ? 2 : (callObj.band in onBand) ? 1 : 0;

    if (onSummit)
    {
      const group = summits[callObj.sota] || (summits[callObj.sota] = { hashes: [], level: -1, best: null });
      group.hashes.push(hash);
      // Its icon shows the spot a rig is closest to, the newest of those
      if (level > group.level || (level == group.level && callObj.age > summitSpotObj(group.best).age))
      {
        group.level = level;
        group.best = hash;
      }
      // Shown by its summit marker, so not drawn again on the DX Feeds layer (like spots the POTA layer shows)
      continue;
    }
    if (!showFeed || hash in potaShown) continue;

    // Its summit or park, else its grid, else its DXCC entity's center (the spot's grid stays empty, e.g. in the Feed Roster)
    const LL = feedSpotPosition(callObj);
    if (!LL || isNaN(LL.a)) continue;

    const feature = iconFeature(ol.proj.fromLonLat([LL.o, LL.a]), FEED_LEVEL_ICONS[level], level + 1, "feed");
    feature.feedHash = hash;
    // The spots it shows: more than one when they overlap at this zoom (see below)
    feature.feedHashes = [hash];
    // In a group, the spot a rig is closest to leads, the newest of those
    feature.rank = level * 1e10 + callObj.age;
    feature.level = level;
    // Grouped only with spots of the same DXCC entity
    feature.dxcc = callObj.dxcc;
    // Same click handling as RX spots: left-click sets the call, right-click shows the tooltip
    feature.size = 6;
    feedFeatures.push(feature);
  }

  // A marker with a spot of a call in a rig's DX Call is ringed
  const selected = rigDXcallSet();
  // Activators you're decoding: on their summit's marker too (not drawn as DX Feeds spots, not in the Feed Roster)
  if (showSota)
  {
    for (const hash in GT.sotaDecodeSpots)
    {
      const callObj = GT.sotaDecodeSpots[hash];
      if (!(callObj.sota in GT.sota.summits) || now - callObj.age > sotaMaxAge) continue;
      if (!feedSpotShown(callObj) || !validateMapBandAndMode(callObj.band, callObj.mode)) continue;
      const expires = callObj.age + sotaMaxAge + 1;
      if (GT.dxcwNextExpiry == 0 || expires < GT.dxcwNextExpiry) GT.dxcwNextExpiry = expires;
      const level = ((callObj.band + "|" + callObj.mode) in onBandMode) ? 2 : (callObj.band in onBand) ? 1 : 0;
      const group = summits[callObj.sota] || (summits[callObj.sota] = { hashes: [], level: -1, best: null });
      group.hashes.push(hash);
      if (level > group.level || (level == group.level && callObj.age > summitSpotObj(group.best).age))
      {
        group.level = level;
        group.best = hash;
      }
    }
  }

  const hasSelected = (hashes) => hashes.some((hash) => summitSpotObj(hash) && summitSpotObj(hash).DEcall in selected);

  // Spots that overlap at this zoom: one marker, the best of them, in the middle of the group; its tooltip lists them all.
  // Added to the layer in one go (one index update and render, not one per marker)
  const feedMarkers = [];
  for (const overlapping of groupOverlappingFeatures(feedFeatures))
  {
    const lead = overlapping[0];
    if (overlapping.length > 1)
    {
      lead.feedHashes = overlapping.map((feature) => feature.feedHash);
      centerGroupMarker(overlapping);
    }
    if (hasSelected(lead.feedHashes)) ringSelectedMarker(lead);
    feedMarkers.push(lead);
  }
  GT.layerSources.dxcwSpots.addFeatures(feedMarkers);

  // One marker per summit, at the summit; its icon shows the best of its spots, its tooltip lists them all
  const summitIcons = [GT.sotaIdleIcon, GT.sotaOnBandIcon, GT.sotaTargetIcon];
  const summitFeatures = [];
  for (const ref in summits)
  {
    const group = summits[ref];
    const summit = GT.sota.summits[ref];
    const feature = iconFeature(ol.proj.fromLonLat([summit.lon, summit.lat]), summitIcons[group.level], group.level + 1, "feed");
    feature.feedHash = group.best;
    feature.summitRef = ref;
    feature.summitHashes = group.hashes;
    // The summits it shows (more than one when they overlap at this zoom, see below): [{ ref, hashes }]
    feature.summitGroups = [{ ref, hashes: group.hashes }];
    feature.rank = group.level;
    // Grouped only with summits activated from the same DXCC entity (its activator's)
    feature.dxcc = summitSpotObj(group.best).dxcc;
    feature.size = 6;
    summitFeatures.push(feature);
  }

  // Summits that overlap at this zoom: one marker, the best of them, in the middle of the group; its tooltip lists them all
  const summitMarkers = [];
  for (const overlapping of groupOverlappingFeatures(summitFeatures))
  {
    const lead = overlapping[0];
    if (overlapping.length > 1)
    {
      lead.summitGroups = overlapping.flatMap((feature) => feature.summitGroups);
      lead.summitHashes = overlapping.flatMap((feature) => feature.summitHashes);
      centerGroupMarker(overlapping);
    }
    if (hasSelected(lead.summitHashes)) ringSelectedMarker(lead);
    summitMarkers.push(lead);
  }
  GT.layerSources.sotaSpots.addFeatures(summitMarkers);
}

// The calls in a rig's DX Call (any WSJT-X / JTDX, AC Log's entry tab): highlighted in the Feed Roster, ringed on the map
function rigDXcallSet()
{
  const calls = {};
  for (const id in GT.instances)
  {
    const instance = GT.instances[id];
    const dxCall = instance.valid && instance.open && instance.status ? String(instance.status.DXcall || "").trim() : "";
    if (dxCall) calls[dxCall] = true;
  }
  return calls;
}

// Map left-click on a DX Feeds or SOTA marker: worked like a Feed Roster click (workFeedCallObj). A marker standing for
// several spots (grouped, or a summit's) works the first one its tooltip lists, the newest
function leftClickFeedSpot(feature)
{
  let hashes = feature.feedHashes || [feature.feedHash];
  if (feature.summitGroups) hashes = feature.summitGroups.flatMap((group) => group.hashes);
  else if (feature.summitHashes) hashes = feature.summitHashes;

  let first = null;
  for (const hash of hashes)
  {
    const callObj = summitSpotObj(hash);
    if (callObj && (first == null || callObj.age > first.age)) first = callObj;
  }
  if (first) workFeedCallObj(first);
}

function feedBandAllowed(callObj)
{
  const plan = isKnownCallsignUSplus(GT.myDXCC) ? FEED_BANDS_US_SET : FEED_BANDS_OTHER_SET;
  return plan.has(callObj.band) && !(callObj.band in GT.settings.app.feeds.hiddenBands);
}

// Settings -> Feeds' Bands and Modes: a spot on a band or mode unticked there is left out of the Feed Roster and the
// map (DX Feeds and SOTA markers)
function feedSpotShown(callObj)
{
  return feedBandAllowed(callObj) && GT.settings.app.feeds.modes[callObj.mode] !== false;
}

function addFeedToRoster(hash, callObj, now)
{
  const entry = GT.feedRoster[hash];

  if (callObj.reset)
  {
    callObj.life = now;
    callObj.reset = false;
  }

  if (!entry)
  {
    GT.feedRoster[hash] = { message: FEED_MESSAGE, callObj: callObj, DXcall: callObj.DXcall, DEcall: callObj.DEcall, ignored: false };
  }
  else
  {
    entry.callObj = callObj;
    entry.DXcall = callObj.DXcall;
  }
}

function clearFeedCallsigns()
{
  const removed = Object.keys(GT.feedRoster).length > 0;
  GT.feedRoster = {};
  GT.feedCallsigns = {};
  GT.sotaActivators = {};
  GT.sotaDecodeSpots = {};
  if (removed) goProcessFeedRoster();
  redrawDxcwSpots();
}

// Called when the user ignores a spotter: drop the spots they currently own from the Feed Roster and map
function dropFeedSpotter(base)
{
  for (const hash in GT.feedCallsigns)
  {
    if (GT.feedCallsigns[hash].spotter.split("-")[0] === base)
    {
      delete GT.feedCallsigns[hash];
      delete GT.feedRoster[hash];
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

// Feed Roster callsign click
function workFeedSpot(hash)
{
  const entry = GT.feedRoster[hash];
  if (entry) workFeedCallObj(entry.callObj);
}

// A feed spot clicked (Feed Roster or map): a rig already on the spot's band and mode (WSJT-X, JTDX, AC Log or Log4OM)
// takes it; otherwise a connected AC Log, else a connected Log4OM, takes it, on any band and mode (with Enable Rig
// Control it tunes the rig to it); otherwise Gen Msgs on the active WSJT-X / JTDX
function workFeedCallObj(callObj)
{
  let instance = feedSpotInstance(callObj);
  if (instance == null && acLogCanWork(callObj)) instance = GT.acLogInstanceId;
  if (instance == null && log4OMCanWork(callObj)) instance = GT.log4OMInstanceId;
  if (instance == null)
  {
    setCallAndGrid(callObj.DEcall, callObj.grid, null);
    return;
  }

  if (GT.settings.map.focusRig && GT.activeInstance != instance && instance in GT.instances)
  {
    setRig(instance);
  }
  // AC Log and Log4OM aren't WSJT-X instances: their own APIs (acLog.js, log4om.js)
  if (instance == GT.acLogInstanceId)
  {
    acLogWorkSpot(callObj);
    return;
  }
  if (instance == GT.log4OMInstanceId)
  {
    log4OMWorkSpot(callObj);
    return;
  }
  setCallAndGrid(callObj.DEcall, callObj.grid, instance);
}

// Gen Msgs on a feed spot: a rig on the spot's band and mode if there is one, otherwise the active rig
function genFeedMessages(hash)
{
  const entry = GT.feedRoster[hash];
  if (!entry) return;

  setCallAndGrid(entry.DEcall, entry.callObj.grid, feedSpotInstance(entry.callObj));
}

// The WSJT-X / JTDX that Gen Msgs on a feed spot off its band and mode goes to (setCallAndGrid): the active rig, if it's
// one (AC Log has no Gen Msgs)
function feedGenMsgsInstance()
{
  const id = GT.activeInstance;
  return (id && id in GT.instances && GT.instances[id].valid && GT.instances[id].remote) ? id : null;
}

// A Feed Roster callsign click does something (workFeedSpot) even off every rig's band and mode: through a connected AC
// Log or Log4OM, else Gen Msgs on the active WSJT-X / JTDX
function feedSpotClickable(callObj)
{
  return acLogCanWork(callObj) || log4OMCanWork(callObj) || feedGenMsgsInstance() != null;
}

// Feed text ends up in roster innerHTML and onClick attributes, so anything unexpected is rejected
const FEED_MODE_REGEXP = /^[A-Z0-9-]{1,12}$/;
const FEED_SPOTTER_REGEXP = /^[A-Z0-9/#-]{1,20}$/;
const FEED_GRID_REGEXP = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/;
const FEED_OFFSET_REGEXP = /^[0-9]{1,9}$/;
// Roster filters read SR/DF/DT from the WSJT-X message; feed spots have none, so those filters pass them
const FEED_MESSAGE = Object.freeze({});
// POTA park references in spot comments ("US-1234", "K-0123", "4X-0001"); only references in the park list are used
const FEED_POTA_REF_REGEXP = /\b[A-Z0-9]{1,4}-\d{4,5}\b/g;
const FEED_CQ_POTA_REGEXP = /^CQ POTA\b/;
const FEED_CQ_REGEXP = /^CQ\b/i;
const FEED_CQ_CONTEST_REGEXP = /^CQ\s+CONTEST\b/i;

// A feed spot's POTA park and how recent that information is (ms): a park reference in the spot's comment (now);
// then, like a decode's (wsjtx.js), the call's current POTA spot (its spot time), otherwise its scheduled
// activation (0); then "?-????" for a "CQ POTA" spot (0).
// Unlike a decode, a feed spot doesn't refresh the POTA spot (someone else heard the activator, not us)
function feedPotaReference(DEcall, msg)
{
  const pota = GT.pota;
  const now = Date.now();
  const upper = msg.toUpperCase();

  for (const ref of upper.match(FEED_POTA_REF_REGEXP) || [])
  {
    if (ref in pota.parks)
    {
      return { park: ref, time: now };
    }
  }

  if (DEcall in pota.callSpots)
  {
    const park = pota.callSpots[DEcall];
    if (park in pota.parkSpots && pota.parkSpots[park][DEcall] && pota.parkSpots[park][DEcall].expire > now)
    {
      return { park, time: pota.parkSpots[park][DEcall].spotTime || 0 };
    }
  }
  else if (DEcall in pota.callSchedule)
  {
    for (const activation of pota.callSchedule[DEcall])
    {
      if (now < activation.end && now >= activation.start)
      {
        return { park: activation.id, time: 0 };
      }
    }
  }

  return { park: FEED_CQ_POTA_REGEXP.test(upper) ? "?-????" : null, time: 0 };
}

// A callsign without a skimmer suffix (-#, -2) or portable parts (/P, VE/W1AW): its longest "/" part,
// so a self-spot is caught when the spotter and the spotted call are written differently
function feedBaseCallsign(call)
{
  let base = "";
  for (const part of call.split("-")[0].split("/"))
  {
    if (part.length > base.length) base = part;
  }
  return base;
}

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

  // No frequency (so no band): not a spot to show. For a SOTA activator it means they've gone QRT, whatever else the
  // spot says (sota.js), so that's checked before the mode and spotter are
  if (band == "OOB" || !Object.prototype.hasOwnProperty.call(GT.bandColors, band))
  {
    if (sotaActive() && CALLSIGN_REGEXP.test(DEcall)) endSotaActivationOnQrt(DEcall, parts[6].trim(), true);
    return false;
  }

  if (!CALLSIGN_REGEXP.test(DEcall) || !FEED_MODE_REGEXP.test(mode) || !FEED_SPOTTER_REGEXP.test(spotter)) return false;
  // CW unticked in the Feed Roster: the server no longer sends it; this covers spots already in flight
  if (mode == "CW" && !feedCWWanted()) return false;
  // Spotters the user ignored in the Feed Roster (by base callsign, so W3LPL covers W3LPL-#)
  if (spotter.split("-")[0] in GT.settings.ignoredSpotters) return false;
  // The roster works in 4-character grids; the map places spots with the full 4 or 6
  const fullGrid = FEED_GRID_REGEXP.test(grid) ? grid : "";
  grid = fullGrid.substring(0, 4);

  // Kept raw like decoded messages: the roster escapes msg when it renders it
  let msg = parts[6].trim();
  // A SOTA activator spotted QRT has finished: their spots on that summit go (sota.js), and this one isn't added
  if (sotaActive() && endSotaActivationOnQrt(DEcall, msg)) return false;
  // Every mode seen is kept for Settings -> Feeds -> Modes, shown until the user unticks it
  const seenModes = GT.settings.app.feeds.modes;
  if (!(mode in seenModes))
  {
    seenModes[mode] = true;
    renderFeedModesSettings();
  }
  // The whole comment is kept (Watchers, the POTA park and CQ look at all of it); the Msg column and the map hover
  // shorten it on screen only

  // Calling CQ: the comment's first word is CQ (any case), except "CQ CONTEST"; shown in the Feed Roster's CQ column.
  // DXcall "CQ" also gets the hunting engine's CQ handling, like a decode
  const isCQ = FEED_CQ_REGEXP.test(msg) && !FEED_CQ_CONTEST_REGEXP.test(msg);
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
  // The spotter's (DE) DXCC, for the Feed Roster's DE DXCC column and exceptions (callsignToDxcc drops the -# / -2 suffix)
  if (callObj.spotter !== spotter)
  {
    callObj.spotterDxcc = callsignToDxcc(spotter);
    callObj.spotterCont = callObj.spotterDxcc > 0 && GT.dxccInfo[callObj.spotterDxcc] ? GT.dxccInfo[callObj.spotterDxcc].continent : "";
    callObj.selfSpot = feedBaseCallsign(spotter) === feedBaseCallsign(DEcall);
  }
  callObj.spotter = spotter;
  callObj.CQ = isCQ;
  if (GT.settings.app.potaFeatureEnabled)
  {
    // A known park sticks: a later spot without one ("?-????" or none) doesn't erase it, and only newer
    // information replaces it, so a move to another park is picked up but a stale POTA spot can't undo it
    const ref = feedPotaReference(DEcall, msg);
    const known = callObj.pota && callObj.pota !== "?-????";
    if (!known || (ref.park && ref.park !== "?-????" && ref.time >= callObj.potaTime))
    {
      callObj.pota = ref.park;
      callObj.potaTime = ref.time;
    }
  }
  else
  {
    callObj.pota = null;
  }
  if (sotaActive())
  {
    // The summit named in the note (feeds.js adds "SOTA <ref>" to Spothole's SOTA spots); a later spot without one
    // keeps the known summit. A spot naming none (a skimmer's, another band or mode) of an activator on a summit gets
    // that summit, as decodes do (from Matt's SOTA work)
    const summit = feedSotaReference(msg) || (callObj.sota ? null : sotaActivatorSummit(DEcall));
    if (summit) callObj.sota = summit;
    // Decodes of this activator (any form of the call) get the summit too
    noteSotaActivator(callObj);
  }
  else
  {
    callObj.sota = null;
  }
  // On a known summit: placed there, its grid the summit's
  placeFeedSpotAtSummit(callObj);
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

  // Same state/county lookups as decodes; not for a spot on a summit (those give the activator's home)
  if (!callObj.summitPlaced && GT.settings.callsignLookups.ulsUseEnable == true && isKnownCallsignUSplus(callObj.dxcc) && (callObj.state == null || callObj.cnty == null))
  {
    lookupKnownCallsign(callObj);
  }

  if (!callObj.summitPlaced && callObj.state == null && callObj.dxcc == 1 && GT.settings.callsignLookups.cacUseEnable && callObj.DEcall in GT.cacCallsigns)
  {
    callObj.state = "CA-" + GT.cacCallsigns[callObj.DEcall];
  }

  // Feed spots never trigger custom alerts; audio alerts come from the Feed Roster (Settings -> Audio Alerts -> Feed Roster)
  addFeedToRoster(hash, callObj, now);
  return true;
}

function pruneFeedCallsigns(now)
{
  if (now - GT.lastFeedPrune < 60) return;
  GT.lastFeedPrune = now;

  for (const hash in GT.feedCallsigns)
  {
    if (now - GT.feedCallsigns[hash].age > FEED_KEEP_SECONDS)
    {
      delete GT.feedCallsigns[hash];
    }
  }
  // Activators no longer spotted on a summit, nor decoded (sota.js)
  for (const call in GT.sotaActivators)
  {
    if (now - GT.sotaActivators[call].age > FEED_KEEP_SECONDS) delete GT.sotaActivators[call];
  }
  for (const hash in GT.sotaDecodeSpots)
  {
    if (now - GT.sotaDecodeSpots[hash].age > FEED_KEEP_SECONDS) delete GT.sotaDecodeSpots[hash];
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

// The feed mode groups wanted from the RTSN server: p (Phone), d (Digital), c (CW) while DX Feeds is on, none while
// it's off. CW only while the Feed Roster's Spots -> Modes -> CW is ticked: CW spots are most of the feed's traffic.
// It answers with { t: "f", m: "p" | "d" | "c", f: "spot;spot;..." } per group
function gtChatSendFeeds()
{
  const on = GT.settings.app.dxFeeds == true ? 1 : 0;
  sendGtJson(JSON.stringify({ t: "f", p: on, d: on, c: on && feedCWWanted() ? 1 : 0 }));
}

// Settings -> Feeds -> Modes -> CW is ticked (or not set yet)
function feedCWWanted()
{
  const modes = GT.settings.app.feeds && GT.settings.app.feeds.modes;
  return !modes || modes.CW !== false;
}

// From the CW tick box in Settings -> Feeds -> Modes: tell the server, and when unticked drop the CW spots held (roster and map) now
// rather than when they age out
function feedCWChanged()
{
  gtChatSendFeeds();
  if (feedCWWanted()) return;
  for (const hash in GT.feedCallsigns)
  {
    if (GT.feedCallsigns[hash].mode == "CW")
    {
      delete GT.feedCallsigns[hash];
      delete GT.feedRoster[hash];
    }
  }
  goProcessFeedRoster();
  redrawDxcwSpots();
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

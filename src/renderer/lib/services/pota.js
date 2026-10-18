// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

GT.pota = {
  parks: {},
  locations: {},
  parksTimeout: null,
  callSchedule: {},
  parkSchedule: {},
  scheduleTimeout: null,
  callSpots: {},
  parkSpots: {},
  spotsTimeout: null,
  mapParks: {},
};

GT.potaSpotTemplate = {
  activator: "",
  frequency: 0,
  mode: "",
  band: "",
  reference: "",
  spotTime: 0,
  expire: 0,
  spotter: "",
  comments: "",
  source: "GT",
  count: 1,
  activatorGrid: "",
  spotterGrid: ""
};

GT.parkTemplate = {
  feature: null
}

GT.potaUnknownPark = {
  name: "Unknown park (not yet spotted)",
  active: "0",
  entityId: "-1",
  locationDesc: "??-??",
  latitude: "0.0",
  longitude: "0.0",
  grid: ""
};

GT.gtParkOnInstance = new ol.style.Icon({
  src: "img/ParkOnInstance.png",
  scale: 0.5
});

GT.gtParkWorkedOnInstance = new ol.style.Icon({
  src: "img/ParkWorkedOnInstance.png",
  scale: 0.45
});

GT.gtParkOffInstance = new ol.style.Icon({
  src: "img/ParkOffInstance.png",
  scale: 0.4
});

function iconText(center, iconObj, zIndex, propName)
{
  var feature = new ol.Feature({
    geometry: new ol.geom.Point(center),
    textAlign: "center",
    justify: "center",
    prop: propName
  });

  if (GT.useTransform)
  {
    feature.getGeometry().transform("EPSG:3857", GT.settings.map.projection);
  }

  var iconStyle = new ol.style.Style({
    zIndex: zIndex,
    text: iconObj
  });

  feature.setStyle(iconStyle);
  return feature;
}

function initPota()
{
  potaFeatureEnabled.checked = GT.settings.app.potaFeatureEnabled;
  if (GT.settings.app.potaFeatureEnabled == true)
  {
    logGTqsoCheckBox.checked = true;
    loadGTCheckBox.checked = true;
    GT.settings.adifLog.startup.loadGTCheckBox = true;
    GT.settings.adifLog.qsolog.logGTqsoCheckBox = true;
  }

  potaButton.style.display = (GT.settings.app.potaFeatureEnabled && GT.settings.map.offlineMode == false) ? "" : "none";
  potaImg.style.filter = GT.settings.app.potaMapEnabled ? "" : "grayscale(1)";

  GT.layerSources.pota.clear();
  GT.pota.mapParks = {};
  
  potaHuntingTr.style.display = GT.settings.map.offlineMode ? "none" : "";
  
  if (GT.settings.app.potaFeatureEnabled && GT.settings.map.offlineMode == false)
  {
    getPotaParks();
  }
}

function changePotaEnable()
{
  potaHuntingTr.style.display = GT.settings.map.offlineMode ? "none" : "";
  GT.settings.app.potaFeatureEnabled = potaFeatureEnabled.checked;
  if (GT.settings.app.potaFeatureEnabled == true)
  {
    logGTqsoCheckBox.checked = true;
    loadGTCheckBox.checked = true;
    GT.settings.adifLog.startup.loadGTCheckBox = true;
    GT.settings.adifLog.qsolog.logGTqsoCheckBox = true;
  }

  potaButton.style.display = (GT.settings.app.potaFeatureEnabled && GT.settings.map.offlineMode == false) ? "" : "none";
  if (!GT.settings.app.potaFeatureEnabled || GT.settings.map.offlineMode == true)
  {
    GT.layerSources.pota.clear();
  }
  else
  {
    getPotaParks();
  }

  setVisualHunting();
  goProcessRoster();
}

function togglePotaMap()
{
  GT.settings.app.potaMapEnabled = !GT.settings.app.potaMapEnabled;
  potaImg.style.filter = GT.settings.app.potaMapEnabled ? "" : "grayscale(1)";

  redrawParks();
}

function redrawParks()
{
  GT.layerSources.pota.clear();

  if (GT.settings.app.potaFeatureEnabled && GT.settings.app.potaMapEnabled && GT.settings.map.offlineMode == false)
  {
    GT.pota.mapParks = {};
    makeParkFeatures();
  }
  // DX Feeds spots the POTA layer shows aren't drawn twice: redraw them with it (rtsn.js)
  scheduleDxcwRedraw();
}

function makeParkFeatures()
{
  // Every park's marker, then the ones that overlap at this zoom grouped into one (see below)
  const parkFeatures = [];
  try
  {
    let now = timeNowSec();
    let day = parseInt(now / 86400);
    let dayAsString = String(day);

    for (const park in GT.pota.parkSpots)
    {
      if (park in GT.pota.parks)
      {
        var parkObj = Object.assign({}, GT.parkTemplate);
        for (const call in GT.pota.parkSpots[park])
        {
          var report = GT.pota.parkSpots[park][call];
          if (parkObj.feature == null && validateMapBandAndMode(report.band, report.mode) && Date.now() < report.expire)
          {
            let parkIcon = GT.gtParkOffInstance;
            let zIndex = 1;
            for (let instance in GT.instances)
            {
              if (GT.instances[instance].valid && GT.instances[instance].status.Band == report.band && GT.instances[instance].status.MO == report.mode)
              {
                let hash = dayAsString + "." + park + "." + report.band + report.mode;
                if (hash in GT.tracker.worked.pota)
                {
                  parkIcon = GT.gtParkWorkedOnInstance;
                }
                else
                {
                  parkIcon = GT.gtParkOnInstance;
                }
                zIndex = 2;
                break;
              }
            }
            parkObj.feature = iconFeature(ol.proj.fromLonLat([Number(GT.pota.parks[park].longitude), Number(GT.pota.parks[park].latitude)]), parkIcon, zIndex, "parkFlag");
            parkObj.feature.key = park;
            parkObj.feature.parkKeys = [park];
            parkObj.feature.size = 22;
            parkObj.feature.rank = zIndex;
            parkObj.feature.parkIcon = parkIcon;
            // Grouped only with parks in the same DXCC entity
            parkObj.feature.dxcc = Number(GT.pota.parks[park].entityId);

            GT.pota.mapParks[park] = parkObj;
            parkFeatures.push(parkObj.feature);
          }
        }
      }
    }
  }
  catch (e)
  {
    console.error("exception: makeParkFeatures");
    console.error(e);
  }

  // A marker with a spot (one the map's Band / Mode filter shows) of a call in a rig's DX Call is ringed
  const selected = rigDXcallSet();
  const hasSelected = (keys) => keys.some((key) => Object.values(GT.pota.parkSpots[key] || {}).some((spot) =>
    spot.activator in selected && validateMapBandAndMode(spot.band, spot.mode)));

  // Parks that overlap at this zoom: one marker (a park on a rig's band and mode first) in the middle of the group; its
  // tooltip lists them all, left-click goes to the one shown. Added to the layer in one go
  const markers = [];
  for (const overlapping of groupOverlappingFeatures(parkFeatures))
  {
    const lead = overlapping[0];
    if (overlapping.length > 1)
    {
      lead.parkKeys = overlapping.map((feature) => feature.key);
      centerGroupMarker(overlapping);
    }
    if (hasSelected(lead.parkKeys)) ringSelectedMarker(lead);
    markers.push(lead);
  }
  GT.layerSources.pota.addFeatures(markers);
}

// A redraw of the POTA layer soon, coalescing several requests (parks are regrouped as a whole)
function scheduleParksRedraw()
{
  nodeTimers.clearTimeout(GT.pota.redrawTimeout);
  GT.pota.redrawTimeout = nodeTimers.setTimeout(redrawParks, 250);
}

function potaSpotFromDecode(callObj)
{
  const myCall = GT.settings.app.myCall;
  if (myCall === "" || myCall === "NOCALL") return;

  // Cache deep property lookups locally
  const pota = GT.pota;
  const deCall = callObj.DEcall;
  const park = callObj.pota;
  const callSpots = pota.callSpots;
  const parkSpots = pota.parkSpots;
  
  let parkSpotGroup = parkSpots[park];
  let targetSpot;
  let isProcessed = false;

  const hasCallSpot = callSpots[deCall] !== undefined;

  // 1. Try to update an existing spot
  if (hasCallSpot && parkSpotGroup !== undefined)
  {
    targetSpot = parkSpotGroup[deCall];
    if (targetSpot !== undefined) 
    {
      const newObj = spotFromCallObj(callObj, park, targetSpot.count);
      targetSpot = fillObjectFromTemplate(targetSpot, newObj);
      parkSpotGroup[deCall] = targetSpot;
      isProcessed = true;
    }
  }

  // 2. If not updated, check if it's a scheduled spot (Looks like it's new)
  if (!isProcessed && pota.callSchedule[deCall] !== undefined)
  {
    callSpots[deCall] = park;

    if (parkSpotGroup === undefined)
    {
      parkSpotGroup = {};
      parkSpots[park] = parkSpotGroup;
    }
    
    targetSpot = spotFromCallObj(callObj, park, 0);
    targetSpot.expire = targetSpot.spotTime + 300000;
    parkSpotGroup[deCall] = targetSpot;
    
    isProcessed = true;
  }

  if (isProcessed && GT.settings.app.potaMapEnabled)
  {
    // May or may not be on screen, so try
    addParkSpotFeature(park, targetSpot);
  }
}


// A POTA spot as a feed spot's fields, for feedSpotInstance / acLogWorkSpot: its frequency in Hz (the spot's is MHz,
// processPotaSpots), and its grid (the activator's, else the park's; 6 characters when known)
function potaSpotCallObj(spot, key)
{
  const park = GT.pota.parks[key];
  let grid = String(spot.activatorGrid || "").toUpperCase();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(grid)) grid = String((park && park.grid) || "").toUpperCase();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(grid)) grid = "";
  return { DEcall: spot.activator, band: spot.band, mode: spot.mode, freq: Math.round(Number(spot.frequency) * 1000000) || 0, grid: grid.substring(0, 4), fullGrid: grid, pota: key };
}

// Map left-click on a park (or parks grouped at this zoom): a spot a rig is already on the band and mode of goes to that
// rig (WSJT-X / JTDX: its call and grid; AC Log: its entry tab). Otherwise a connected AC Log gets the first spot the
// tooltip lists (with Enable Rig Control, the rig tuned to it)
function leftClickPota(feature)
{
  const keys = feature.parkKeys || [feature.key];
  // In the tooltip's order: one park's spots as listed, several parks' newest first
  const spots = [];
  for (const key of keys)
  {
    for (const call in GT.pota.parkSpots[key] || {})
    {
      const spot = GT.pota.parkSpots[key][call];
      if (validateMapBandAndMode(spot.band, spot.mode)) spots.push({ key, spot });
    }
  }
  if (keys.length > 1) spots.sort((a, b) => b.spot.spotTime - a.spot.spotTime);
  if (spots.length == 0) return;

  for (const { key, spot } of spots)
  {
    const callObj = potaSpotCallObj(spot, key);
    const instance = feedSpotInstance(callObj);
    if (instance == GT.acLogInstanceId)
    {
      acLogWorkSpot(callObj);
      return;
    }
    if (instance != null)
    {
      setCallAndGrid(callObj.DEcall, callObj.grid, instance);
      return;
    }
  }

  const first = potaSpotCallObj(spots[0].spot, spots[0].key);
  if (acLogCanWork(first)) acLogWorkSpot(first);
}

function reportPotaQSO(record)
{
  var report = {
    activator: record.CALL,
    spotter: record.STATION_CALLSIGN,
    frequency: record.FREQ,
    reference: record.POTA_REF,
    mode: record.MODE,
    source: "GT2",
    comments: record.COMMENT ? record.COMMENT : "",
    activatorGrid: record.GRIDSQUARE ? record.GRIDSQUARE : "",
    spotterGrid: record.MY_GRIDSQUARE ? record.MY_GRIDSQUARE : ""
  };
  
  if ("SUBMODE" in record)
  {
    report.mode = record.SUBMODE;
  }
 
  getPostJSONBuffer(
    "https://api.pota.app/spot",
    rbnReportResult,
    null,
    "https",
    443,
    report,
    10000,
    null,
    null
  );
}

function rbnReportResult(buffer, flag, cookies)
{
  // It worked! process latest spots!
  if (GT.pota.spotsTimeout)
  {
    nodeTimers.clearTimeout(GT.pota.spotsTimeout);
    GT.pota.spotsTimeout = null;
  }
  
  processPotaSpots(String(buffer));
  
  GT.pota.spotsTimeout = nodeTimers.setTimeout(getPotaSpots, 300000);
}

function spotFromCallObj(callObj, park, inCount, rbnTime)
{
  var callSpot = {
    activator: callObj.DEcall,
    activatorGrid: callObj.grid,
    spotter: GT.settings.app.myCall + "-#",
    spotterGrid: GT.settings.app.myGrid,
    frequency: Number((GT.instances[callObj.instance].status.Frequency / 1000000).toFixed(3)),
    reference: park,
    mode: callObj.mode,
    band: callObj.band,
    spotTime: Date.now(),
    source: "GT",
    count: inCount + 1,
    comments: "GT " + callObj.RSTsent + " dB " + GT.settings.app.myGrid + " via " + GT.settings.app.myCall + "-#"
  };
  return callSpot;
}

// A decode updated or added this park's spot (already in GT.pota.parkSpots): a park not on the map yet is added by
// redrawing the layer, which regroups the overlapping parks
function addParkSpotFeature(park, report)
{
  const parkObj = GT.pota.mapParks[park];
  if ((!parkObj || parkObj.feature == null) && validateMapBandAndMode(report.band, report.mode))
  {
    scheduleParksRedraw();
  }
}

function processPotaParks(buffer)
{
  if (GT.settings.app.potaFeatureEnabled)
  {
    try
    {
      var data = JSON.parse(buffer);
      var newParks = data.parks;
      for (const park in newParks)
      {
        var locations = newParks[park].locationDesc.split(",");
        for (const i in locations)
        {
          if (locations[i] in data.locations)
          {
            locations[i] = data.locations[locations[i]];
          }
        }
        newParks[park].locationDesc = locations.join(", ");
      }
      newParks["?-????"] = GT.potaUnknownPark;
      
      GT.pota.parks = newParks;
      GT.pota.locations = data.locations;
      getPotaSchedule();
      getPotaSpots();
    }
    catch (e)
    {
      // can't write, somethings broke
      console.error("Failed to load parks!");
      console.error(e);
    }
  }
}

function getPotaParks()
{
  if (GT.pota.parksTimeout)
  {
    nodeTimers.clearTimeout(GT.pota.parksTimeout);
    GT.pota.spotsTimeout = null;
  }

  if (GT.settings.map.offlineMode == false && GT.settings.app.potaFeatureEnabled)
  {
    getBuffer(
      "https://app2.gridtracker.org/dbs/pota.json?cb=" + Date.now(),
      processPotaParks,
      null,
      "https",
      443
    );
  }

  GT.pota.parksTimeout = nodeTimers.setTimeout(getPotaParks, 86400000)
}

// This is a shallow copy, don't use with objects that contain other objects or arrays
function fillObjectFromTemplate(template, input)
{
  var object = {};
  for (const key in template)
  {
    if (key in input)
    {
      object[key] = input[key];
    }
    else
    {
      // missing, use the template value
      object[key] = template[key];
    }
  }
  return object;
}

function processPotaSpots(buffer)
{
  if (GT.settings.app.potaFeatureEnabled)
  {
    try
    {
      var spots = JSON.parse(buffer);
      GT.pota.callSpots = {};
      GT.pota.parkSpots = {};
      for (const spot in spots)
      {
        if (spots[spot].reference in GT.pota.parks)
        {
          var newSpot = fillObjectFromTemplate(GT.potaSpotTemplate, spots[spot]);
          newSpot.spotTime = Date.parse(newSpot.spotTime + "Z");
          newSpot.frequency = parseInt(newSpot.frequency) / 1000;

          newSpot.expire = Date.now() + (Number(newSpot.expire) * 1000);
          newSpot.band = formatBand(newSpot.frequency);
          if (newSpot.spotter == newSpot.activator && newSpot.comments.match(/qrt/gi))
          {
            // don't add the spot, they have self-QRT'ed
          }
          else if (Date.now() > newSpot.expire)
          {
            // Spot is expired!
          }
          else
          {
            GT.pota.callSpots[newSpot.activator] = newSpot.reference;
            
            if (!(newSpot.reference in GT.pota.parkSpots))
            {
              GT.pota.parkSpots[newSpot.reference] = {};
            }
 
            GT.pota.parkSpots[newSpot.reference][newSpot.activator] = newSpot;
          }
        }
      }
      
      redrawParks();
    }
    catch (e)
    {
      // can't write, somethings broke
      console.error("processPotaSpots");
      console.error(e);
    }
  }
}

function getPotaSpots()
{
  if (GT.pota.spotsTimeout)
  {
    nodeTimers.clearTimeout(GT.pota.spotsTimeout);
    GT.pota.spotsTimeout = null;
  }

  if (GT.settings.map.offlineMode == false && GT.settings.app.potaFeatureEnabled)
  {
    getBuffer(
      "https://api.pota.app/spot/activator",
      processPotaSpots,
      null,
      "https",
      443
    );
  }

  GT.pota.spotsTimeout = nodeTimers.setTimeout(getPotaSpots, 300000);
}

function uniqueArrayFromArray(input)
{
  return [...new Set(input)];
}

function processPotaSchedule(buffer)
{
  if (GT.settings.app.potaFeatureEnabled)
  {
    try
    {
      var schedules = JSON.parse(buffer);
      GT.pota.callSchedule = {};
      GT.pota.parkSchedule = {};
      for (const i in schedules)
      {
        var newObj = {};
        newObj.id = schedules[i].reference;
        newObj.start = Date.parse(schedules[i].startDate + "T" + schedules[i].startTime + "Z");
        newObj.end = Date.parse(schedules[i].endDate + "T" + schedules[i].endTime + "Z");
        newObj.frequencies = schedules[i].frequencies;
        newObj.comments = schedules[i].comments;
        if (Date.now() < newObj.end)
        {
          if (newObj.id in GT.pota.parks)
          {
            (GT.pota.callSchedule[schedules[i].activator] = GT.pota.callSchedule[schedules[i].activator] || []).push(newObj);

            newObj = Object.assign({}, newObj);
            newObj.id = schedules[i].activator;
            (GT.pota.parkSchedule[schedules[i].reference] = GT.pota.parkSchedule[schedules[i].reference] || []).push(newObj);
          }
        }
        // else it is expired and no longer relevant
      }

      // Sanity dedupe checks
      for (const key in GT.pota.callSchedule)
      {
        GT.pota.callSchedule[key] = uniqueArrayFromArray(GT.pota.callSchedule[key]);
      }
      for (const key in GT.pota.parkSchedule)
      {
        GT.pota.parkSchedule[key] = uniqueArrayFromArray(GT.pota.parkSchedule[key]);
      }
    }
    catch (e)
    {
      // can't write, somethings broke
    }
  }
}

function getPotaSchedule()
{
  if (GT.pota.scheduleTimeout)
  {
    nodeTimers.clearTimeout(GT.pota.scheduleTimeout);
    GT.pota.scheduleTimeout = null;
  }

  if (GT.settings.map.offlineMode == false && GT.settings.app.potaFeatureEnabled)
  {
    getBuffer(
      "https://api.pota.app/activation",
      processPotaSchedule,
      null,
      "https",
      443
    );
  }
  GT.pota.scheduleTimeout = nodeTimers.setTimeout(getPotaSchedule, 900000);
}

function mouseOverPark(feature)
{
  createParkTipTable(feature);
  mouseParkMove(feature);

  myParktip.style.zIndex = 499;
  myParktip.style.display = "block";
  return true;
}

function mouseParkMove(feature)
{
  const positionInfo = myParktip.getBoundingClientRect();
  const mouseX = getMouseX();
  const mouseY = getMouseY();
  const halfWidth = positionInfo.width / 2;
  const windowWidth = window.innerWidth;

  let left = mouseX - halfWidth;
  if (windowWidth - mouseX < halfWidth) {
    left = mouseX - (10 + positionInfo.width);
  } else if (left < 0) {
    left = mouseX + 10;
  }

  myParktip.style.left = left + "px";
  myParktip.style.top = (mouseY - positionInfo.height - 12) + "px";
}

function mouseOutPark(feature)
{
  myParktip.style.zIndex = -1;
}

// Right-click a park marker: its tooltip pops out into the popup window, like a grid's (map/mouse.js)
function popOutParkTip(feature)
{
  createParkTipTable(feature);
  // Measured for the popup's size: shown, but behind the map until hovered
  myParktip.style.display = "block";
  renderTooltipWindow(feature, myParktip);
  mouseOutPark(feature);
}

// The park the marker shows, or (when parks overlap at this zoom, feature.parkKeys) all their spots in one table
function createParkTipTable(toolElement)
{
  const keys = toolElement.parkKeys || [toolElement.key];
  myParktip.innerHTML = keys.length > 1 ? parkGroupTipHtml(keys) : parkTipHtml(keys[0]);
}

// A spot's 4-character grid: the activator's when the spot gives one, else the park's main grid, else "-"
function potaSpotGrid(spot, park)
{
  if (spot.activatorGrid && spot.activatorGrid.length >= 4) return spot.activatorGrid.substring(0, 4).toUpperCase();
  return (park && park.grid && park.grid.length >= 4) ? park.grid.substring(0, 4).toUpperCase() : "-";
}

// Several parks under one marker: no park headers, just "POTA Spot × n" and one row per spot with its park after the
// grid, newest first
function parkGroupTipHtml(keys)
{
  const now = Date.now();
  const spots = [];
  for (const key of keys)
  {
    for (const call in GT.pota.parkSpots[key] || {})
    {
      const spot = GT.pota.parkSpots[key][call];
      if (validateMapBandAndMode(spot.band, spot.mode)) spots.push({ key, spot });
    }
  }
  spots.sort((a, b) => b.spot.spotTime - a.spot.spotTime);

  let rows = "";
  for (const { key, spot } of spots)
  {
    const { activator, spotter, frequency, count, spotTime, source, comments, band, mode } = spot;
    const grid = potaSpotGrid(spot, GT.pota.parks[key]);
    rows += `<tr><td style='color:yellow'>${lookupCallHtml(activator, grid == "-" ? "" : grid)}</td><td style='color:lightgreen'>${grid}</td>` +
      `<td style='color:#fbb6fc'>${key}</td>` +
      `<td style='color:cyan'>${spotter === activator ? "Self" : lookupCallHtml(spotter)}</td>` +
      `<td style='color:lightgreen'>${formatMhz(frequency)} <font color='yellow'>(${band})</font></td><td style='color:orange'>${mode}</td>` +
      `<td>${count}</td><td style='color:lightblue'>${toDHMS(~~((now - spotTime) / 1000))}</td><td>${source}</td><td>${comments}</td></tr>`;
  }
  return `<table id='potaSpotsTable' class='darkTable' style='margin: 0 auto;'>
    <tr><th colspan=10 style='color:#fbb6fc'>${I18N("gt.potaSpot.title")} &times; ${spots.length}</th></tr>
    <tr><th>Activator</th><th>${I18N("gt.callsignBox.Grid")}</th><th>POTA</th><th>Spotter</th><th>Freq</th><th>Mode</th><th>Count</th><th>When</th><th>Source</th><th>Comment</th></tr>
    ${rows}
  </table>`;
}

// One park's section: its header, then its spots, each with a 4-character grid (the activator's when the spot gives one,
// else the park's main grid)
function parkTipHtml(key)
{
  const park = GT.pota.parks[key];

  if (!park) return "";  // This should never happen, we're here because we have a park on the map with at least on spot

  const now = Date.now();

  const { name, entityId, locationDesc } = park;

  const altName = GT.dxccToAltName[+entityId] || "Unknown";

  // Header like the SOTA summit tooltip's: the park; where it is; distance and bearing (when it has a position). The grid
  // is in the spot rows
  const where = [locationDesc && locationDesc != "??-??" ? `<font color='lightblue'>${htmlEntities(locationDesc)}</font>` : "",
    `<font color='yellow'>${altName}</font>`].filter((part) => part).join(", ");
  const lat = Number(park.latitude);
  const lon = Number(park.longitude);
  let position = "";
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat != 0 || lon != 0))
  {
    const bearing = parseInt(MyCircle.bearing(GT.myLat, GT.myLon, lat, lon));
    const dist = parseInt(MyCircle.distance(GT.myLat, GT.myLon, lat, lon) * MyCircle.validateRadius(distanceUnit.value));
    position = `<font color='cyan'>${dist}${distanceUnit.value.toLowerCase()}</font> <font color='yellow'>${bearing}&deg;</font>`;
  }

  let html = `<div style='background-color:#000;color:#fbb6fc;font-weight:bold;font-size:12px;border:1px solid gray;margin:0px' class='roundBorder'>
    ${key} : <font color='cyan'>${htmlEntities(name)}</font><br>
    ${where}${position ? "<br>" + position : ""}</div>
    <table id='potaSpotsTable' class='darkTable' style='margin: 0 auto;'>
    <tr><th>Activator</th><th>${I18N("gt.callsignBox.Grid")}</th><th>Spotter</th><th>Freq</th><th>Mode</th><th>Count</th><th>When</th><th>Source</th><th>Comment</th></tr>`;

  const spots = GT.pota.parkSpots[key];
  for (const i in spots) {
    const spot = spots[i]; 
    const { band, mode } = spot;

    if (validateMapBandAndMode(band, mode)) {
      const { activator, spotter, frequency, count, spotTime, source, comments } = spot;
      const spotterDisplay = (spotter === activator) ? "Self" : spotter;
      const secondsAgo = ~~((now - spotTime) / 1000);
      const grid = potaSpotGrid(spot, park);
      // Callsigns look up when clicked, also popped out (lookupCallHtml, map/mouse.js)
      html += `<tr><td style='color:yellow'>${lookupCallHtml(activator, grid == "-" ? "" : grid)}</td><td style='color:lightgreen'>${grid}</td>` +
        `<td style='color:cyan'>${spotterDisplay == "Self" ? spotterDisplay : lookupCallHtml(spotter)}</td><td style='color:lightgreen'>${formatMhz(frequency)} <font color='yellow'>(${band})</font></td><td style='color:orange'>${mode}</td><td>${count}</td><td style='color:lightblue'>${toDHMS(secondsAgo)}</td><td>${source}</td><td>${comments}</td></tr>`;
    }
  }
  html += "</table>";
  return html;
}

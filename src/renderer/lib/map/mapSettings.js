// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Map settings: map sources and API keys, night map, colours, Gridsquare Colors, offline maps, pins (moved from GridTracker2.js)

function mapApiKeyInputChanged()
{
  let map = GT.maps[GT.settings.map.mapIndex];
  if ("keyId" in map)
  {
    let showUpdateButton = false;
    if (GT.settings.map.apiKeys[map.keyId] != mapApiKeyInput.value)
    {
      showUpdateButton = true;
    }
    GT.settings.map.apiKeys[map.keyId] = mapApiKeyInput.value;
    if (mapApiKeyInput.value == "")
    {
      showUpdateButton = false;
    }
    ValidateText(mapApiKeyInput);
    mapApiKeyApplyDiv.style.display = showUpdateButton ? "" : "none";
  }
}

function nightMapApiKeyInputChanged()
{
  let map = GT.maps[GT.settings.map.nightMapIndex];
  if ("keyId" in map)
  {
    let showUpdateButton = false;
    if (GT.settings.map.apiKeys[map.keyId] != nightMapApiKeyInput.value)
    {
      showUpdateButton = true;
    }
    GT.settings.map.apiKeys[map.keyId] = nightMapApiKeyInput.value;
    if (nightMapApiKeyInput.value == "")
    {
      showUpdateButton = false;
    }
    ValidateText(nightMapApiKeyInput);
    nightMapApiKeyApplyDiv.style.display = showUpdateButton ? "" : "none";
  }
}

function changeNightMapEnable(check)
{
  if (check.checked)
  {
    GT.settings.map.nightMapEnable = true;
    GT.nightTime = dayNight.refresh();
  }
  else
  {
    GT.settings.map.nightMapEnable = false;
  }

  // Settings -> Map: the Night column (night map, brightness and path colors), and the boxes' order for the wider layout
  for (const el of document.querySelectorAll(".nightMapOnly")) el.style.display = GT.settings.map.nightMapEnable ? "" : "none";
  mapSettingsGroups.classList.toggle("mapNightOn", GT.settings.map.nightMapEnable);
  changeMapLayer();
  styleAllFlightPaths();
  redrawSpots();
}

// Settings -> Map -> Group Overlapping Spots: POTA, SOTA and DX Feeds markers redrawn grouped or each on its own
// (redrawParks also redraws the feed spot layers)
function changeGroupSpots(check)
{
  GT.settings.map.groupSpots = check.checked;
  redrawParks();
}

function loadMapSettings()
{
  graylineValue.value = GT.settings.map.graylineOpacity;
  showDarknessTd.innerHTML = parseInt(graylineValue.value * 100) + "%";
  pathWidthTd.innerHTML = pathWidthValue.value = GT.settings.app.pathWidthWeight;
  qrzPathWidthTd.innerHTML = qrzPathWidthValue.value = GT.settings.app.qrzPathWidthWeight;

  mapTransValue.value = GT.settings.map.mapTrans;
  mapTransChange();

  mapTerminatorValue.value = GT.settings.map.terminatorDegreeIndex;
  mapTerminatorChange();

  gridDecay.value = GT.settings.app.gridsquareDecayTime;
  changeGridDecay();

  pathColorValue.value = GT.settings.map.pathColor;
  qrzPathColorValue.value = GT.settings.map.qrzPathColor;
  brightnessValue.value = GT.settings.map.mapOpacity;
  nightBrightnessValue.value = GT.settings.map.nightMapOpacity;

  nightPathColorValue.value = GT.settings.map.nightPathColor;
  nightQrzPathColorValue.value = GT.settings.map.nightQrzPathColor;

  mouseOverValue.checked = GT.settings.map.mouseOver;
  mergeOverlayValue.checked = GT.settings.map.mergeOverlay;

  offlineModeEnable.checked = GT.settings.map.offlineMode;

  allGridOpacityValue.value = GT.settings.map.allGridOpacity;
  
  mapSelect.value = GT.settings.map.mapIndex;
  mapNightSelect.value = GT.settings.map.nightMapIndex;

  animateValue.checked = GT.settings.map.animate;
  animateSpeedValue.value = 21 - GT.settings.map.animateSpeed;
  setAnimateView();
  splitQSLValue.checked = GT.settings.map.splitQSL;
  fitQRZvalue.checked = GT.settings.map.fitQRZ;
  qrzDxccFallbackValue.checked = GT.settings.map.qrzDxccFallback;
  CqHiliteValue.checked = GT.settings.map.CQhilite;
  focusRigValue.checked = GT.settings.map.focusRig;
  haltAllOnTxValue.checked = GT.settings.map.haltAllOnTx;

  trafficDecode.checked = GT.settings.map.trafficDecode;
  wantedByBandMode.checked = GT.settings.app.wantedByBandMode;
  includeExceptions.checked =  GT.settings.app.includeExceptions;
  includeCustomAlerts.checked = GT.settings.app.includeCustomAlerts;
  setWantedByBandModeRowView();
  
  warnOnSoundcardsChanged.checked = GT.settings.app.warnOnSoundcardsChange;

  setSpotImage();

  timezoneImg.style.filter = GT.settings.map.timezonesEnable == 1 ? "" : "grayscale(1)";
  radarImg.style.filter = GT.settings.map.usRadar ? "" : "grayscale(1)";
  predImg.src = GT.predImageArray[GT.settings.map.predMode];
  predImg.style.filter = GT.settings.map.predMode > 0 ? "" : "grayscale(1)";
  gridOverlayImg.style.filter = GT.settings.map.showAllGrids ? "" : "grayscale(1)";
  equatorImg.style.filter = GT.settings.map.equator ? "" : "grayscale(1)";
  rangeRingsImg.style.filter = GT.settings.map.showRangeRings ? "" : "grayscale(1)";

  applyBandColorSettings();

  setGridOpacity();
  setMapColors();
  setNightMapColors();

  if (GT.settings.app.myGrid.length > 3)
  {
    let LL = squareToCenter(GT.settings.app.myGrid);
    GT.settings.map.latitude = GT.myLat = LL.a;
    GT.settings.map.longitude = GT.myLon = LL.o;
  }
}

function changeMapNightPathValues()
{
  GT.settings.map.nightPathColor = nightPathColorValue.value;
  GT.settings.map.nightQrzPathColor = nightQrzPathColorValue.value;
  setNightMapColors();
  styleAllFlightPaths();
  
}

function changeMapNightValues()
{
  GT.settings.map.nightMapIndex = mapNightSelect.value;
  GT.settings.map.nightMapOpacity = nightBrightnessValue.value;

  
  changeMapLayer();
}

function setMapColors()
{
  let pathColor = pathColorValue.value == 0 ? "#000" : pathColorValue.value == 361 ? "#FFF" : "hsl(" + pathColorValue.value + ", 100%, 50%)";
  if (pathColorValue.value != 0)
  {
    pathColorDiv.style.color = "#000";
    pathColorDiv.style.backgroundColor = pathColor;
    pathColorDiv.style.textShadow = "-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF";
  }
  else
  {
    pathColorDiv.style.color = "#FFF";
    pathColorDiv.style.backgroundColor = pathColor;
    pathColorDiv.style.textShadow = "";
  }

  pathColor = qrzPathColorValue.value == 0 ? "#000" : qrzPathColorValue.value == 361 ? "#FFF" : "hsl(" + qrzPathColorValue.value + ", 100%, 50%)";
  if (qrzPathColorValue.value != 0)
  {
    qrzPathColorDiv.style.color = "#000";
    qrzPathColorDiv.style.backgroundColor = pathColor;
    qrzPathColorDiv.style.textShadow = "-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF";
  }
  else
  {
    qrzPathColorDiv.style.color = "#FFF";
    qrzPathColorDiv.style.backgroundColor = pathColor;
    qrzPathColorDiv.style.textShadow = "";
  }
}

function setNightMapColors()
{
  let pathColor = GT.settings.map.nightPathColor == 0 ? "#000" : GT.settings.map.nightPathColor == 361 ? "#FFF" : "hsl(" + GT.settings.map.nightPathColor + ", 100%, 50%)";
  if (GT.settings.map.nightPathColor != 0)
  {
    pathNightColorDiv.style.color = "#000";
    pathNightColorDiv.style.backgroundColor = pathColor;
    pathNightColorDiv.style.textShadow = "-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF";
  }
  else
  {
    pathNightColorDiv.style.color = "#FFF";
    pathNightColorDiv.style.backgroundColor = pathColor;
    pathNightColorDiv.style.textShadow = "";
  }

  pathColor = GT.settings.map.nightQrzPathColor == 0 ? "#000" : GT.settings.map.nightQrzPathColor == 361 ? "#FFF" : "hsl(" + GT.settings.map.nightQrzPathColor + ", 100%, 50%)";
  if (GT.settings.map.nightQrzPathColor != 0)
  {
    pathNightQrzColorDiv.style.color = "#000";
    pathNightQrzColorDiv.style.backgroundColor = pathColor;
    pathNightQrzColorDiv.style.textShadow = "-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF";
  }
  else
  {
    pathNightQrzColorDiv.style.color = "#FFF";
    pathNightQrzColorDiv.style.backgroundColor = pathColor;
    pathNightQrzColorDiv.style.textShadow = "";
  }
}

function changeOfflineMap()
{
  GT.settings.map.offlineMapIndex = offlineMapSelect.value;
  changeMapLayer();
}

function changeOfflineNightMap()
{
  GT.settings.map.offlineNightMapIndex = offlineMapNightSelect.value;
  changeMapLayer();
}

function changeMapValues()
{
  GT.settings.map.mapOpacity = brightnessValue.value;
  GT.settings.map.mapIndex = mapSelect.value;
  if (GT.settings.app.gtFlagImgSrc > 0 && GT.settings.map.offlineMode == false && GT.settings.app.offAirServicesEnable == true)
  {
    GT.layerVectors.gtflags.setVisible(true);
  }
  else
  {
    GT.layerVectors.gtflags.setVisible(false);
  }

  changeMapLayer();
}

function setGridsquareColor(name, newColor)
{
  document.getElementById(name + "gridValue").value = newColor;
}

function setGridsquareColorSettings()
{
  for (let key in GT.settings.legendColors)
  {
    setGridsquareColor(key, GT.settings.legendColors[key]);
  }
}

function resetGridsquareColors()
{
  for (let key in def_legendColors)
  {
    GT.settings.legendColors[key] = def_legendColors[key];
  }

  setGridsquareColorSettings();

  setPins();
  redrawGrids();
}

function changeGridsquareColor(source)
{
  let newColor = source.value;

  let name = source.id.replace("gridValue", "");

  GT.settings.legendColors[name] = newColor;

  if (GT.redrawGridsquareColorsTimeoutHandle != null)
  {
    nodeTimers.clearTimeout(GT.redrawGridsquareColorsTimeoutHandle);
  }
  GT.redrawGridsquareColorsTimeoutHandle = nodeTimers.setTimeout(() =>
  {
    setPins();
    redrawGrids();
  }, 500);
}

// Band colors (Settings -> Band Colors): GT.bandColors starts as the built-in table,
// GT.settings.bandColors holds only the bands the user changed
GT.defaultBandColors = null;
GT.redrawBandColorsTimeout = null;
const BAND_COLOR_REGEXP = /^[0-9A-Fa-f]{6}$/;

function applyBandColorSettings()
{
  if (GT.defaultBandColors == null) GT.defaultBandColors = { ...GT.bandColors };

  for (const band in GT.defaultBandColors)
  {
    const saved = GT.settings.bandColors[band];
    // Saved colors end up in HTML style attributes, so only plain 6-digit hex is used
    GT.bandColors[band] = (typeof saved === "string" && BAND_COLOR_REGEXP.test(saved)) ? saved : GT.defaultBandColors[band];
  }
  renderBandColorSettings();
}

function renderBandColorSettings()
{
  bandColorsDiv.innerHTML = GT.colorBands.map((band) =>
    `<div class="bandColorCell">` +
    `<b id="bandColorLabel_${band}" style="color:#${GT.bandColors[band]};">${band}</b><br />` +
    `<input type="color" value="#${GT.bandColors[band]}" oninput="changeBandColor('${band}', this)" />` +
    `</div>`
  ).join("");
}

function changeBandColor(band, input)
{
  const hex = input.value.substring(1).toUpperCase();
  GT.bandColors[band] = hex;

  if (hex === GT.defaultBandColors[band].toUpperCase())
  {
    delete GT.settings.bandColors[band];
  }
  else
  {
    GT.settings.bandColors[band] = hex;
  }

  document.getElementById("bandColorLabel_" + band).style.color = "#" + hex;

  nodeTimers.clearTimeout(GT.redrawBandColorsTimeout);
  GT.redrawBandColorsTimeout = nodeTimers.setTimeout(redrawBandColors, 500);
}

function resetBandColors()
{
  GT.settings.bandColors = {};
  applyBandColorSettings();
  redrawBandColors();
}

// Everything drawn with band colors; Stats and Lookup windows pick them up on their next render
function redrawBandColors()
{
  GT.redrawBandColorsTimeout = null;
  setPins();
  redrawGrids();
  redrawSpots();
  goProcessRoster();
  updateRosterFeeds();
}

function changeMapLayer()
{
  GT.map.removeLayer(GT.tileLayer);
  let maps, index, mapOpacity;

  if (GT.settings.map.offlineMode)
  {
    maps = GT.offlineMapsLayer;
    if (GT.settings.map.nightMapEnable && GT.nightTime)
    {
      index = GT.settings.map.offlineNightMapIndex;
      mapOpacity = Number(GT.settings.map.nightMapOpacity);
    }
    else
    {
      index = GT.settings.map.offlineMapIndex;
      mapOpacity = Number(GT.settings.map.mapOpacity);
    }

    mapApiKeyTr.style.display = "none";
    nightMapApiKeyTr.style.display = "none";
  }
  else
  {
    maps = GT.mapsLayer;
    if (GT.settings.map.nightMapEnable && GT.nightTime)
    {
      index = GT.settings.map.nightMapIndex;
      mapOpacity = Number(GT.settings.map.nightMapOpacity);
    }
    else
    {
      index = GT.settings.map.mapIndex;
      mapOpacity = Number(GT.settings.map.mapOpacity);
    }

    if ("keyId" in GT.maps[GT.settings.map.nightMapIndex])
    {
      nightMapApiKeyTr.style.display = "";
      nightMapApiKeyApplyDiv.style.display = "none";
      nightMapApiKeyInput.value = GT.settings.map.apiKeys[GT.maps[GT.settings.map.nightMapIndex].keyId];
      ValidateText(nightMapApiKeyInput);
    }
    else
    {
      nightMapApiKeyTr.style.display = "none";
    }

    if ("keyId" in GT.maps[GT.settings.map.mapIndex])
    {
      mapApiKeyTr.style.display = "";
      mapApiKeyApplyDiv.style.display = "none";
      mapApiKeyInput.value = GT.settings.map.apiKeys[GT.maps[GT.settings.map.mapIndex].keyId];
      ValidateText(mapApiKeyInput);
    }
    else
    {
      mapApiKeyTr.style.display = "none";
    }
  }

  GT.currentMapIndex = index;

  if (GT.maps[index].sourceType == "Group")
  {
    ProcessGroupMapSource(index);
    GT.tileLayer = new ol.layer.Group({ layers: maps[index] });
  }
  else
  {
    GT.tileLayer = new ol.layer.Tile({ source: maps[index] });
  }

  GT.tileLayer.setOpacity(mapOpacity);
  GT.map.getLayers().insertAt(0, GT.tileLayer);

  changeMapBackgroundColor(false);
  setAllGridOpacity();
}

function changeMapBackgroundColor(fromSettings = true)
{
  if (fromSettings == true)
  {
    GT.settings.map.backgroundColor[GT.currentMapIndex] = mapBackgroundColor.value;
  }
  else if (!(GT.currentMapIndex in GT.settings.map.backgroundColor))
  {
    GT.settings.map.backgroundColor[GT.currentMapIndex] = "#000000";
  }

  mapDiv.style.backgroundColor = mapBackgroundColor.value = GT.settings.map.backgroundColor[GT.currentMapIndex];

  // A different background (another map, day / night map, or the color itself): the rings around markers of calls in
  // a rig's DX Call use its opposite hue (ringSelectedMarker), so the POTA / SOTA / DX Feeds markers are redrawn
  if (GT.ringMapBackground != mapDiv.style.backgroundColor)
  {
    GT.ringMapBackground = mapDiv.style.backgroundColor;
    scheduleParksRedraw();
  }
}

// Map pins are drawn in the band colors: 12x20, rendered at 2x for sharpness and shown at half scale
const PIN_SCALE = 2;

// variant: "live" (diamond head), "worked" (plain) or "confirmed" (black V cap)
function drawBandPin(color, variant)
{
  const canvas = document.createElement("canvas");
  canvas.width = 12 * PIN_SCALE;
  canvas.height = 20 * PIN_SCALE;
  const g = canvas.getContext("2d");
  g.scale(PIN_SCALE, PIN_SCALE);

  // Needle
  g.strokeStyle = "#000";
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(6, 12);
  g.lineTo(6, 20);
  g.stroke();

  // Head: a diamond for live, otherwise a circle tapering to a point
  const head = new Path2D();
  if (variant == "live")
  {
    head.moveTo(6, 0.6);
    head.lineTo(11.4, 6.4);
    head.lineTo(6, 13.8);
    head.lineTo(0.6, 6.4);
  }
  else
  {
    const cx = 6, cy = 5.6, r = 5.1, tipY = 13.8;
    const a = Math.acos(r / (tipY - cy));
    head.moveTo(cx, tipY);
    head.arc(cx, cy, r, Math.PI / 2 + a, Math.PI / 2 - a + Math.PI * 2);
  }
  head.closePath();
  g.fillStyle = color;
  g.fill(head);
  g.strokeStyle = "#000";
  g.lineWidth = 1;
  g.stroke(head);

  if (variant == "confirmed")
  {
    g.fillStyle = "#000";
    g.beginPath();
    g.moveTo(0.8, 0);
    g.lineTo(11.2, 0);
    g.lineTo(11.2, 1.9);
    g.lineTo(6, 8.7);
    g.lineTo(0.8, 1.9);
    g.closePath();
    g.fill();
  }

  return new ol.style.Icon({
    img: canvas,
    scale: 1 / PIN_SCALE,
    anchorYUnits: "pixels",
    anchorXUnits: "pixels",
    anchor: [6 * PIN_SCALE, 18 * PIN_SCALE]
  });
}

function setPins()
{
  GT.colorPins = {};
  GT.colorQPins = {};
  GT.colorQPins.worked = {};
  GT.colorQPins.confirmed = {};
  for (const band of GT.colorBands)
  {
    const color = "#" + (GT.bandColors[band] || "888888");
    GT.colorPins[band] = drawBandPin(color, "live");
    GT.colorQPins.worked[band] = drawBandPin(color, "worked");
    GT.colorQPins.confirmed[band] = drawBandPin(color, "confirmed");
  }
  // MH4 pins with Mixed bands can cover many bands, so they use the Gridsquare Colors worked/confirmed colors
  GT.mixedPins = {
    worked: drawBandPin(GT.settings.legendColors.QSO, "worked"),
    confirmed: drawBandPin(GT.settings.legendColors.QSL, "worked")
  };
}

function registerLegendContextMenus()
{
  predButton.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const menu = new Menu();
    
    if (GT.settings.map.predMode > 0)
    {
      menu.append(new MenuItem({
        type: "checkbox",
        label: I18N("legend.title"),
        checked: GT.settings.map.predLegend,
        click: function ()
        {
          GT.settings.map.predLegend = !GT.settings.map.predLegend;
          predDiv.style.display = (GT.settings.map.predLegend) ? "" : "none";
        }
      }));

      menu.append(new MenuItem({ type: "separator" }));
    }
    
    GT.predLayers.forEach((layerKey, index) => {
      menu.append(new MenuItem({
        type: "radio",
        label: I18N(layerKey),
        checked: (GT.settings.map.predMode === index),
        click: function ()
        {
          directPredLayer(index);
        }
      }));
    });
    
    menu.popup();
  });


  buttonSpotsBoxDiv.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const menu = new Menu();
    if (GT.settings.app.spotView != 0)
    {
      menu.append(new MenuItem({
        type: "checkbox",
        label: I18N("legend.title"),
        checked: GT.settings.map.spotLegend,
        click: function ()
        {
          GT.settings.map.spotLegend = !GT.settings.map.spotLegend;
          spotsDiv.style.display = GT.settings.map.spotLegend ? "" : "none";
        }
      }));
      menu.append(new MenuItem({ type: "separator" }));
    }

    GT.spotLayers.forEach((layerKey, index) => {
      menu.append(new MenuItem({
        type: "radio",
        label: I18N(layerKey),
        checked: (GT.settings.app.spotView === index),
        click: function ()
        {
          directSpotLayer(index);
        }
      }));
    });
    
    menu.popup();
  });
}

function mapTransChange()
{
  GT.settings.map.mapTrans = mapTransValue.value;

  mapTransTd.innerHTML = String(100 - parseInt(((GT.settings.map.mapTrans * 255) / 255) * 100)) + "%";
  mapSettingsDiv.style.backgroundColor = "rgba(0,0,0, " + GT.settings.map.mapTrans + ")";
}

function togglePushPinMode()
{
  GT.pushPinMode = !GT.pushPinMode;
  GT.settings.app.pushPinMode = GT.pushPinMode;
  pinImg.src = GT.pinImageArray[GT.pushPinMode == false ? 0 : 1];

  gridModeDiv.style.display = GT.pushPinMode ? "" : "none";

  clearTempGrids();
  redrawGrids();
}

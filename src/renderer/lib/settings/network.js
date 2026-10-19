// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Settings: network - WSJT-X UDP port, multicast, UDP forwarding, ADIF broadcast, spotting, off-air services (moved from GridTracker2.js)

function timeoutSetUdpPort()
{
  GT.settings.app.wsjtUdpPort = udpPortInput.value;

  // Make sure the broadcast Port isn't on our recieve port!
  ValidatePort(adifBroadcastPort, adifBroadcastEnable, CheckAdifBroadcastPortIsNotReceivePort);

  lastMsgTimeDiv.innerHTML = I18N("gt.timeoutSetUdpPort");
  GT.setNewUdpPortTimeoutHandle = null;
}

function setUdpPort()
{
  if (GT.setNewUdpPortTimeoutHandle != null) { nodeTimers.clearTimeout(GT.setNewUdpPortTimeoutHandle); }
  lastMsgTimeDiv.innerHTML = I18N("gt.setUdpPort");
  GT.setNewUdpPortTimeoutHandle = nodeTimers.setTimeout(timeoutSetUdpPort, 1000);
}

function changeOffAirServicesEnable()
{
  GT.settings.app.offAirServicesEnable = offAirServicesEnable.checked;
  updateOffAirServicesViews();
}

function updateOffAirServicesViews()
{
  offAirServicesTr.style.display = GT.settings.map.offlineMode == true ? "none" : "";
  updateGTFlagViews();
  setMsgSettingsView();
  updateBandActivityViews();
  updateSpottingViews();
  updateFeedViews();
  setVisualHunting();
  goProcessRoster();
}

function updateFeedViews()
{
  const show = GT.settings.app.offAirServicesEnable == true && GT.settings.map.offlineMode == false;
  dxFeedsTr.style.display = show ? "" : "none";
  dxFeedsEnable.checked = GT.settings.app.dxFeeds;
  updateSotaViews();

  // Settings -> Feeds tab: only while DX Feeds is on (if it's the open tab when it goes, General opens instead)
  const active = feedsActive();
  feedsSettingsButton.style.display = active ? "" : "none";
  if (!active && feedsSettingsDiv.style.display === "block")
  {
    openSettingsTab(generalbut, "generalSettingsDiv");
  }
  feedMaxAge.value = GT.settings.app.feedMaxAge;
  feedMaxAgeTd.innerHTML = toDHMS(GT.settings.app.feedMaxAge);
  renderFeedSpotsSettings();

  // Main button panel: shown while DX Feeds is on, grey when the map option is off
  dxcwFeedButton.style.display = active ? "" : "none";
  dxcwFeedImg.style.filter = GT.settings.map.dxcwFeed ? "" : "grayscale(1)";

  redrawDxcwSpots();
  updateRosterFeeds();
}

function setFeedSettings()
{
  GT.settings.app.dxFeeds = dxFeedsEnable.checked;
  if (!GT.settings.app.dxFeeds)
  {
    clearFeedCallsigns();
  }
  gtChatSendFeeds();
  updateFeedViews();
}

function changeFeedMaxAge()
{
  GT.settings.app.feedMaxAge = parseInt(feedMaxAge.value);
  feedMaxAgeTd.innerHTML = toDHMS(GT.settings.app.feedMaxAge);
}

// Settings -> Feeds -> Modes, Bands and Allow (app.feeds, until v2.261017 the Feed Roster's Spots tab): which feed spots
// the Feed Roster and the map's DX Feeds and SOTA markers show (feedSpotShown), and what the Feed Roster may alert
// through. Drawn when the tab opens (the band plan follows your callsign) and with the other Feeds settings
function renderFeedSpotsSettings()
{
  const feeds = GT.settings.app.feeds;
  feedAlertScriptEnable.checked = feeds.alertScript;
  feedNotificationsEnable.checked = feeds.notifications;
  feedSpotBandsDiv.innerHTML = feedBandPlan().map((band) =>
    `<label class='feedBand' style='color:#${GT.bandColors[band]};'>` +
    `<input type='checkbox' ${band in feeds.hiddenBands ? "" : "checked"} onchange='feedSpotBandChanged(this, "${band}")' />${band}</label>`
  ).join("");
  GT.feedModesKey = null;
  renderFeedModesSettings();
}

// Every mode seen in feed spots, ticked or not, laid out like the Bands; also when a spot brings a new mode (rtsn.js).
// Redrawn only when the list or a tick changes, so a click isn't lost to a redraw
function renderFeedModesSettings()
{
  const modes = GT.settings.app.feeds.modes;
  const list = Object.keys(modes).sort();
  const key = list.map((mode) => mode + (modes[mode] === false ? "-" : "+")).join(",");
  if (key === GT.feedModesKey) return;
  GT.feedModesKey = key;
  feedSpotModesDiv.innerHTML = list.map((mode) =>
    `<label class='feedBand' style='color:#${GT.modeColors[mode] || "FFFFFF"};'>` +
    `<input type='checkbox' ${modes[mode] === false ? "" : "checked"} onchange='feedSpotModeChanged(this, "${mode}")' />${mode}</label>`
  ).join("");
}

function feedSpotModeChanged(checkbox, mode)
{
  GT.settings.app.feeds.modes[mode] = checkbox.checked;
  GT.feedModesKey = null;
  // CW decides whether the server sends CW spots at all
  if (mode === "CW") feedCWChanged();
  feedSpotsChanged();
}

function feedSpotBandChanged(checkbox, band)
{
  const hidden = GT.settings.app.feeds.hiddenBands;
  if (checkbox.checked) delete hidden[band];
  else hidden[band] = true;
  feedSpotsChanged();
}

// The Feed Roster and the map show the ticked bands and modes
function feedSpotsChanged()
{
  goProcessFeedRoster();
  redrawDxcwSpots();
}

function feedSpotAllowChanged()
{
  GT.settings.app.feeds.alertScript = feedAlertScriptEnable.checked;
  GT.settings.app.feeds.notifications = feedNotificationsEnable.checked;
}

function updateGTFlagViews()
{
  if (GT.settings.app.offAirServicesEnable == true && GT.settings.map.offlineMode == false)
  {
    gtFlagButton.style.display = "";
    if (GT.settings.app.gtFlagImgSrc > 0)
    {
      GT.layerVectors.gtflags.setVisible(true);
    }
    else
    {
      GT.layerVectors.gtflags.setVisible(false);
    }
  }
  else
  {
    gtFlagButton.style.display = "none";

    GT.layerVectors.gtflags.setVisible(false);
    clearGtFlags();
    // Clear list
    GT.rtsnPins = {};
    GT.rtsnCallsigns = {};
    clearFeedCallsigns();

    conditionsButton.style.background = "";
    conditionsButton.innerHTML = "<img src=\"img/conditions.png\" class=\"buttonImg\" />";

  }

  offAirServicesEnable.checked = GT.settings.app.offAirServicesEnable;
}

function setMulticastIp()
{
  GT.settings.app.wsjtIP = multicastIpInput.value;
}

function setMulticastEnable(checkbox)
{
  if (checkbox.checked == true)
  {
    multicastTD.style.display = "";
    if (ValidateMulticast(multicastIpInput))
    {
      GT.settings.app.wsjtIP = multicastIpInput.value;
    }
    else
    {
      GT.settings.app.wsjtIP = "";
    }
  }
  else
  {
    multicastTD.style.display = "none";
    GT.settings.app.wsjtIP = "";
  }
  GT.settings.app.multicast = checkbox.checked;

  setAdifBroadcastEnable(adifBroadcastEnable);
}

function setAdifBroadcastMulticast(checkbox)
{
  if (checkbox.checked == true)
  {
    adifBroadcastIpTD.style.display = "";
    if (ValidateMulticast(adifBroadcastIP))
    {
      GT.settings.app.adifBroadcastIP = adifBroadcastIP.value;
    }
    else
    {
      GT.settings.app.adifBroadcastIP = "";
    }
  }
  else
  {
    adifBroadcastIpTD.style.display = "none";
    GT.settings.app.adifBroadcastIP = "";
  }
  GT.settings.app.adifBroadcastMulticast = checkbox.checked;

  setAdifBroadcastEnable(adifBroadcastEnable);
}

function setAdifBroadcastIp()
{
  GT.settings.app.adifBroadcastIP = adifBroadcastIP.value;
  setAdifBroadcastEnable(adifBroadcastEnable);
}

function setAdifBroadcastPort()
{
  GT.settings.app.adifBroadcastPort = Number(adifBroadcastPort.value);
  setAdifBroadcastEnable(adifBroadcastEnable);
}

function setAdifBroadcastEnable(checkbox)
{
  if (checkbox.checked)
  {
    if (ValidatePort(adifBroadcastPort, null, CheckAdifBroadcastPortIsNotReceivePort))
    {
      if (GT.settings.app.adifBroadcastMulticast)
      {
        checkbox.checked = ValidateMulticast(adifBroadcastIP);
      }
      GT.settings.app.adifBroadcastEnable = checkbox.checked;
      return;
    }
  }

  GT.settings.app.adifBroadcastEnable = checkbox.checked = false;
}

function setUdpForwardEnable(checkbox)
{
  if (checkbox.checked)
  {
    if (ValidatePort(udpForwardPortInput, null, CheckForwardPortIsNotReceivePort) && ValidateForwardHosts(udpForwardIpInput, null))
    {
      GT.settings.app.wsjtForwardUdpEnable = checkbox.checked;
      return;
    }
  }
  checkbox.checked = false;
  GT.settings.app.wsjtForwardUdpEnable = checkbox.checked;
}

function setSpottingEnable()
{
  GT.settings.app.spottingEnable = spottingEnable.checked;

  if (GT.settings.app.spottingEnable == false)
  {
    GT.spotCollector = {};
    GT.decodeCollector = {};
  }
  GT.gtLiveStatusUpdate = true;
  updateSpottingViews();
}

function setForwardIp()
{
  let ips = udpForwardIpInput.value.split(",").map((ip) => ip.trim()).filter((ip) => ip);
  GT.forwardIPs = [...new Set(ips)];
  GT.settings.app.wsjtForwardUdpIp = GT.forwardIPs.join(",");
  if (ValidatePort(udpPortInput, null, CheckReceivePortIsNotForwardPort))
  {
    setUdpPort();
  }
  ValidatePort(udpForwardPortInput, null, CheckForwardPortIsNotReceivePort);
  // Hostnames among them: looked up once (wsjtxUdp.js), so a name that can't be found is reported here; after a short
  // pause, so typing "ft8battle.com" doesn't look up "ft8battle.c" and the rest on the way
  nodeTimers.clearTimeout(GT.forwardHostCheckTimer);
  GT.forwardHostCheckTimer = nodeTimers.setTimeout(checkForwardHostnames, 900);
}

function setForwardPort()
{
  GT.settings.app.wsjtForwardUdpPort = udpForwardPortInput.value;
  ValidateForwardHosts(udpForwardIpInput, null);
  if (ValidatePort(udpPortInput, null, CheckReceivePortIsNotForwardPort))
  {
    setUdpPort();
  }
}

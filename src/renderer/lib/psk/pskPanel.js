// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// PSK Reporter watch: the panel over the map. It owns the only settings writes of the feature (call sign, side, band,
// history window, lines, open/closed); pskWatcher.js knows nothing about the DOM and pskLayer.js only what has to be
// on the map, so the three files are the whole feature.

GT.pskWatchPanel = {
  built: false,
  lastTableMs: 0,
  maxRows: 100,
  tableOpen: false,
  spotEl: null,
  clickMap: null
};

function pskWatchEscape(text)
{
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pskWatchStatusText()
{
  if (pskWatchOffline())
  {
    return I18N("psk.status.offline");
  }
  switch (GT.pskWatch.status)
  {
    case "connected": return I18N("psk.status.connected");
    case "connecting": return I18N("psk.status.connecting");
    case "disconnected": return I18N("psk.status.disconnected");
    case "error": return I18N("psk.status.error") + (GT.pskWatch.lastError != "" ? ": " + GT.pskWatch.lastError : "");
    default: return I18N("psk.status.idle");
  }
}

function pskWatchStatusColor()
{
  if (pskWatchOffline())
  {
    return "#ffcc66";
  }
  switch (GT.pskWatch.status)
  {
    case "connected": return "#66ee66";
    case "connecting": return "#ffcc66";
    case "error": return "#ff6666";
    case "disconnected": return "#ff9966";
    default: return "#bbbbbb";
  }
}
function pskWatchPanelBody()
{
  let bands = '<option value="">' + I18N("psk.band.all") + "</option>";
  for (const band of Object.keys(GT.bandColors))
  {
    if (band == "OOB")
    {
      continue;
    }
    bands += '<option value="' + band + '">' + band + "</option>";
  }

  let history = "";
  for (const minutes of [15, 30, 60, 360, 1440])
  {
    history += '<option value="' + minutes + '">' + I18N("psk.history." + minutes) + "</option>";
  }

  return [
    '<div style="display:flex;align-items:center;gap:6px;">',
    '  <label for="pskWatchCall" style="width:52px;color:#bbbbbb;">' + I18N("psk.panel.call") + "</label>",
    '  <input id="pskWatchCall" type="text" spellcheck="false" placeholder="' + I18N("psk.panel.callPlaceholder") + '" style="flex:1;min-width:0;background:#111111;color:#eeeeee;border:1px solid #555555;padding:1px 3px;font-size:11px;" />',
    "</div>",
    '<div style="display:flex;align-items:center;gap:6px;">',
    '  <label for="pskWatchSide" style="width:52px;color:#bbbbbb;">' + I18N("psk.panel.side") + "</label>",
    '  <select id="pskWatchSide" style="flex:1;min-width:0;background:#111111;color:#eeeeee;border:1px solid #555555;font-size:11px;">',
    '    <option value="heard">' + I18N("psk.side.heard") + "</option>",
    '    <option value="hears">' + I18N("psk.side.hears") + "</option>",
    "  </select>",
    "</div>",
    '<div style="display:flex;align-items:center;gap:6px;">',
    '  <label for="pskWatchBand" style="width:52px;color:#bbbbbb;">' + I18N("psk.panel.band") + "</label>",
    '  <select id="pskWatchBand" style="width:110px;background:#111111;color:#eeeeee;border:1px solid #555555;font-size:11px;">' + bands + "</select>",
    '  <label for="pskWatchHistory" style="color:#bbbbbb;">' + I18N("psk.panel.history") + "</label>",
    '  <select id="pskWatchHistory" style="flex:1;min-width:0;background:#111111;color:#eeeeee;border:1px solid #555555;font-size:11px;">' + history + "</select>",
    "</div>",
    '<div style="display:flex;align-items:center;gap:8px;">',
    '  <label style="color:#bbbbbb;" title="' + I18N("psk.panel.showLinesHint") + '"><input id="pskWatchLines" type="checkbox" /> ' + I18N("psk.panel.showLines") + "</label>",
    '  <button id="pskWatchStart" type="button" style="background:#333333;color:#eeeeee;border:1px solid #666666;padding:1px 8px;font-size:11px;"></button>',
    '  <button id="pskWatchRefresh" type="button" style="background:#333333;color:#eeeeee;border:1px solid #666666;padding:1px 8px;font-size:11px;" title="' + I18N("psk.panel.refreshHint") + '">' + I18N("psk.panel.refresh") + "</button>",
    '  <span id="pskWatchCount" style="margin-left:auto;color:#cccccc;"></span>',
    "</div>",
    '<div id="pskWatchTableHead" style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#bbbbbb;border-top:1px solid #444444;padding-top:2px;">',
    '  <span id="pskWatchTableArrow">&#9656;</span>',
    '  <span>' + I18N("psk.panel.table") + "</span>",
    '  <span style="color:#777777;font-size:10px;">' + I18N("psk.panel.tableHint") + "</span>",
    "</div>",
    '<div id="pskWatchTableWrap" style="display:none;max-height:26vh;overflow:auto;border-top:1px solid #444444;">',
    '  <table id="pskWatchTable" style="width:100%;border-collapse:collapse;font-size:10px;white-space:nowrap;">',
    "    <thead>",
    '      <tr style="color:#aaaaaa;text-align:left;">',
    '        <th style="padding-right:6px;">' + I18N("psk.table.time") + "</th>",
    '        <th style="padding-right:6px;">' + I18N("psk.table.sender") + "</th>",
    '        <th style="padding-right:6px;">' + I18N("psk.table.receiver") + "</th>",
    '        <th style="padding-right:6px;">' + I18N("psk.table.band") + "</th>",
    '        <th style="padding-right:6px;">' + I18N("psk.table.mode") + "</th>",
    '        <th style="padding-right:6px;text-align:right;">' + I18N("psk.table.snr") + "</th>",
    '        <th style="text-align:right;">' + I18N("psk.table.freq") + "</th>",
    "      </tr>",
    "    </thead>",
    '    <tbody id="pskWatchRows"></tbody>',
    "  </table>",
    "</div>",
    '<div id="pskWatchHistoryNote" style="color:#ff9966;min-height:12px;"></div>',
    "</div>"
  ].join("\n");
}
function pskWatchPanelInit()
{
  if (GT.pskWatchPanel.built)
  {
    return;
  }
  const host = document.getElementById("pskPanelHost");
  if (host == null || GT.settings == null || GT.settings.psk == null)
  {
    return;
  }

  host.innerHTML = [
    '<div id="pskPanel" style="position:absolute;left:10px;bottom:10px;pointer-events:auto;width:430px;max-height:64vh;display:flex;flex-direction:column;background:rgba(16,16,16,0.93);border:1px solid #666666;border-radius:4px;color:#eeeeee;font-size:11px;z-index:1200;overflow:hidden;">',
    '  <div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:#2a2a2a;border-bottom:1px solid #555555;">',
    '    <span style="font-weight:bold;">' + I18N("psk.panel.title") + "</span>",
    '    <span id="pskWatchStatus" style="margin-left:auto;color:#bbbbbb;"></span>',
    '    <span id="pskWatchMin" style="cursor:pointer;padding:0 4px;" title="' + I18N("psk.panel.minimize") + '">&#8211;</span>',
    '    <span id="pskWatchClose" style="cursor:pointer;padding:0 4px;" title="' + I18N("psk.panel.close") + '">&#215;</span>',
    "  </div>",
    '  <div id="pskWatchBody" style="padding:6px;display:flex;flex-direction:column;gap:5px;overflow:hidden;">',
    pskWatchPanelBody(),
    "  </div>",
    "</div>"
  ].join("\n");

  const call = document.getElementById("pskWatchCall");
  call.value = GT.settings.psk.call || pskWatchCallsign();
  call.addEventListener("change", function()
  {
    pskWatchSetCall(call.value);
  });
  call.addEventListener("keydown", function(event)
  {
    if (event.key == "Enter")
    {
      pskWatchSetCall(call.value);
    }
  });

  const side = document.getElementById("pskWatchSide");
  side.value = GT.settings.psk.side == "hears" ? "hears" : "heard";
  side.addEventListener("change", function()
  {
    pskWatchSetSide(side.value);
  });

  const band = document.getElementById("pskWatchBand");
  band.value = GT.settings.psk.band || "";
  band.addEventListener("change", function()
  {
    GT.settings.psk.band = band.value;
    pskWatchPanelSave();
    pskWatchScheduleUpdate();
  });

  const historySelect = document.getElementById("pskWatchHistory");
  historySelect.value = String(pskWatchHistoryMinutes());
  historySelect.addEventListener("change", function()
  {
    GT.settings.psk.historyMinutes = parseInt(historySelect.value, 10) || 15;
    pskWatchPanelSave();
    pskWatchFetchHistory(false);
    pskWatchScheduleUpdate();
  });

  const lines = document.getElementById("pskWatchLines");
  lines.checked = GT.settings.psk.showLines != false;
  lines.addEventListener("change", function()
  {
    GT.settings.psk.showLines = lines.checked;
    pskWatchPanelSave();
    pskWatchScheduleUpdate();
  });

  document.getElementById("pskWatchStart").addEventListener("click", function()
  {
    if (GT.settings.psk.enabled == true)
    {
      pskWatchStop();
    }
    else
    {
      pskWatchStart();
    }
    pskWatchPanelSave();
    pskWatchUpdatePanel();
  });
  document.getElementById("pskWatchRefresh").addEventListener("click", function()
  {
    pskWatchFetchHistory(true);
    pskWatchUpdatePanel();
  });
  document.getElementById("pskWatchMin").addEventListener("click", function()
  {
    const body = document.getElementById("pskWatchBody");
    body.style.display = body.style.display == "none" ? "" : "none";
  });
  document.getElementById("pskWatchClose").addEventListener("click", function()
  {
    togglePskWatchPanel(false);
  });

  document.getElementById("pskWatchTableHead").addEventListener("click", function()
  {
    pskWatchTableToggle();
  });
  pskWatchTableApply(GT.settings.psk.tableOpen == true);

  GT.pskWatchPanel.built = true;
}

function pskWatchPanelSave()
{
  if (typeof saveGridTrackerSettings == "function")
  {
    saveGridTrackerSettings();
  }
}

function pskWatchSetCall(value)
{
  const call = String(value || "").trim().toUpperCase();
  document.getElementById("pskWatchCall").value = call;
  if (call == GT.settings.psk.call)
  {
    return;
  }
  GT.settings.psk.call = call;
  pskWatchPanelSave();
  pskWatchRestart();
  pskWatchUpdatePanel();
}

function pskWatchSetSide(value)
{
  const side = value == "hears" ? "hears" : "heard";
  if (side == GT.settings.psk.side)
  {
    return;
  }
  GT.settings.psk.side = side;
  pskWatchPanelSave();
  pskWatchRestart();
  pskWatchUpdatePanel();
}
function pskWatchTableRows(reports)
{
  const rows = [];
  const count = Math.min(reports.length, GT.pskWatchPanel.maxRows);
  for (let i = 0; i < count; i++)
  {
    const report = reports[i];
    const time = new Date(report.t * 1000).toLocaleTimeString();
    rows.push("<tr>" +
      '<td style="padding-right:6px;">' + pskWatchEscape(time) + "</td>" +
      '<td style="padding-right:6px;">' + pskWatchEscape(report.sc) + "</td>" +
      '<td style="padding-right:6px;">' + pskWatchEscape(report.rc) + "</td>" +
      '<td style="padding-right:6px;">' + pskWatchEscape(report.b) + "</td>" +
      '<td style="padding-right:6px;">' + pskWatchEscape(report.md) + "</td>" +
      '<td style="padding-right:6px;text-align:right;">' + report.rp + "</td>" +
      '<td style="text-align:right;">' + (report.f / 1000000).toFixed(3) + "</td>" +
      "</tr>");
  }
  return rows.join("");
}

function pskWatchUpdatePanel()
{
  if (!GT.pskWatchPanel.built)
  {
    return;
  }
  const status = document.getElementById("pskWatchStatus");
  status.textContent = pskWatchStatusText();
  status.style.color = pskWatchStatusColor();

  const reports = pskWatchVisibleReports();
  reports.sort(function(a, b)
  {
    return b.t - a.t;
  });
  document.getElementById("pskWatchCount").textContent = I18N("psk.panel.reports") + " " + reports.length;

  // The table is the expensive part; a report every few hundred milliseconds does not have to redraw it each time
  const nowMs = Date.now();
  if (nowMs - GT.pskWatchPanel.lastTableMs >= 1000)
  {
    GT.pskWatchPanel.lastTableMs = nowMs;
    if (GT.pskWatchPanel.tableOpen)
    {
      document.getElementById("pskWatchRows").innerHTML = pskWatchTableRows(reports);
    }
  }

  let history = "";
  if (GT.pskWatch.historyBusy)
  {
    history = I18N("psk.status.historyLoading");
  }
  else if (GT.pskWatch.historyError != "")
  {
    history = I18N("psk.status.historyFail") + " " + GT.pskWatch.historyError;
  }
  document.getElementById("pskWatchHistoryNote").textContent = history;

  document.getElementById("pskWatchStart").textContent = GT.settings.psk.enabled == true ? I18N("psk.panel.stop") : I18N("psk.panel.start");
  const img = document.getElementById("pskWatchImg");
  if (img != null)
  {
    img.style.filter = GT.settings.psk.enabled == true ? "" : "grayscale(1)";
  }
}

function togglePskWatchPanel(force)
{
  pskWatchPanelInit();
  const panel = document.getElementById("pskPanel");
  if (panel == null)
  {
    return;
  }
  const show = force != null ? force : panel.style.display == "none";
  panel.style.display = show ? "" : "none";
  GT.settings.psk.panelOpen = show;
  pskWatchPanelSave();
  if (show)
  {
    pskWatchUpdatePanel();
  }
}

function pskWatchPanelBoot()
{
  if (GT.settings == null || GT.settings.psk == null || document.getElementById("pskPanelHost") == null)
  {
    nodeTimers.setTimeout(pskWatchPanelBoot, 500);
    return;
  }
  pskWatchPanelInit();
  // A projection change builds a new ol map: the layers have to be put on it again
  nodeTimers.setInterval(function()
  {
    if (GT.settings == null || GT.settings.psk == null || GT.map == null)
    {
      return;
    }
    pskWatchMapBind();
    if (GT.pskWatchPanel.built && GT.settings.psk.enabled == true && GT.pskWatch.mapRef !== GT.map)
    {
      pskWatchRedrawLayer();
    }
  }, 3000);
  if (GT.settings.psk.panelOpen == true)
  {
    togglePskWatchPanel(true);
  }
  if (GT.settings.psk.enabled == true)
  {
    pskWatchStart();
  }
  pskWatchUpdatePanel();
}

// The table starts folded: the map is the point, the rows are a detail you ask for
function pskWatchTableApply(open)
{
  const wrap = document.getElementById("pskWatchTableWrap");
  const arrow = document.getElementById("pskWatchTableArrow");
  if (wrap == null || arrow == null)
  {
    return;
  }
  GT.pskWatchPanel.tableOpen = open == true;
  wrap.style.display = GT.pskWatchPanel.tableOpen ? "" : "none";
  arrow.innerHTML = GT.pskWatchPanel.tableOpen ? "&#9662;" : "&#9656;";
}

function pskWatchTableToggle()
{
  GT.settings.psk.tableOpen = GT.pskWatchPanel.tableOpen != true;
  pskWatchPanelSave();
  pskWatchTableApply(GT.settings.psk.tableOpen);
  if (GT.settings.psk.tableOpen == true)
  {
    pskWatchUpdatePanel();
  }
}

// A dot carries its whole report; a click shows it the way the pskreporter map does
function pskWatchSpotElement()
{
  if (GT.pskWatchPanel.spotEl != null && document.body.contains(GT.pskWatchPanel.spotEl))
  {
    return GT.pskWatchPanel.spotEl;
  }
  const el = document.createElement("div");
  el.id = "pskWatchSpotPopup";
  el.style.cssText = "position:fixed;z-index:2100;display:none;pointer-events:none;background:rgba(20,20,20,0.95);color:#eeeeee;border:1px solid #666666;border-radius:4px;padding:6px 8px;font-size:11px;line-height:15px;min-width:170px;max-width:300px;box-shadow:0 2px 10px rgba(0,0,0,0.65);";
  document.body.appendChild(el);
  GT.pskWatchPanel.spotEl = el;
  return el;
}

function pskWatchSpotHide()
{
  if (GT.pskWatchPanel.spotEl != null)
  {
    GT.pskWatchPanel.spotEl.style.display = "none";
  }
}

function pskWatchSpotShow(info, pixel)
{
  const el = pskWatchSpotElement();
  const time = new Date(info.t * 1000).toLocaleTimeString();
  const role = info.role == "receiver" ? I18N("psk.table.receiver") : I18N("psk.table.sender");
  el.innerHTML = [
    '<div style="font-weight:bold;margin-bottom:2px;">' + pskWatchEscape(info.sc) + " &rarr; " + pskWatchEscape(info.rc) + "</div>",
    '<div style="color:#cccccc;">' + pskWatchEscape(info.sl) + " &rarr; " + pskWatchEscape(info.rl) + "</div>",
    '<div style="color:#cccccc;">' + pskWatchEscape(info.b) + " " + pskWatchEscape(info.md) + " &middot; " + (info.f / 1000000).toFixed(3) + " MHz</div>",
    '<div style="color:#cccccc;">' + I18N("psk.table.snr") + " " + info.rp + " dB &middot; " + pskWatchEscape(time) + "</div>",
    '<div style="color:#888888;font-size:10px;margin-top:2px;">' + role + "</div>"
  ].join("");
  el.style.display = "block";

  // Beside the dot it belongs to, but never off the window: the map can be wider than the screen
  const rect = document.getElementById("mapDiv").getBoundingClientRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let left = rect.left + pixel[0] + 14;
  let top = rect.top + pixel[1] + 14;
  if (left + width > window.innerWidth - 8)
  {
    left = rect.left + pixel[0] - width - 14;
  }
  if (top + height > window.innerHeight - 8)
  {
    top = rect.top + pixel[1] - height - 14;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
}

// A projection change builds a new ol map, so the click handler is bound again to whatever GT.map is
function pskWatchMapBind()
{
  if (GT.map == null || GT.pskWatchPanel.clickMap === GT.map)
  {
    return;
  }
  const map = GT.map;
  GT.pskWatchPanel.clickMap = map;
  map.on("singleclick", function(evt)
  {
    let info = null;
    map.forEachFeatureAtPixel(evt.pixel, function(feature)
    {
      const candidate = feature.get("pskInfo");
      if (candidate != null)
      {
        info = candidate;
        return true;
      }
      return false;
    }, { hitTolerance: 4 });
    if (info == null || GT.settings.psk.enabled != true)
    {
      pskWatchSpotHide();
      return;
    }
    pskWatchSpotShow(info, evt.pixel);
  });
  map.on("movestart", pskWatchSpotHide);
}

pskWatchPanelBoot();

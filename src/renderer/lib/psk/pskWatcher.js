// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// PSK Reporter watch: the reception reports of one callsign, live from the PSK Reporter MQTT feed and as history
// from its retrieve API. A report carries both ends (sender and receiver), so the panel can show either "who hears
// this callsign" (the callsign is the sender) or "who this callsign hears" (it is the receiver).
//
// Deliberately self contained: nothing here is shared with RX Spots (lib/services/mqttPsk.js, lib/map/spots.js), so
// lib/psk can be lifted out or dropped as one folder.

GT.pskWatchUrl = "mqtt://mqtt.pskreporter.info:1883";

// Reports are dropped a day after they were heard, whatever window the panel shows, so switching to a longer window
// still has what was already received. 4000 reports is well past what the map can draw at once.
GT.pskWatchKeepSec = 86400;
GT.pskWatchMaxReports = 4000;

// PSK Reporter asks that the same retrieve query is not repeated inside five minutes; a forced refresh is the
// user's click and goes through regardless.
GT.pskWatchHistoryReuseMs = 300000;

GT.pskWatch = {
  client: null,
  topic: "",
  status: "idle", // idle | offline | connecting | connected | disconnected | error
  lastError: "",
  reports: new Map(), // key -> report
  keys: [], // report keys, oldest first
  historyCache: new Map(), // call|side|minutes -> { at, reports }
  historyBusy: false,
  historyError: "",
  mapRef: null, // the ol map the layers were built for (a projection change rebuilds it)
  updateTimer: null,
  pruneTimer: null
};

function pskWatchOffline()
{
  return GT.settings.map.offlineMode == true || GT.settings.app.spottingEnable == false;
}

// The callsign being watched: the panel's own, else the station's
function pskWatchCallsign()
{
  const call = String(GT.settings.psk.call || "").trim().toUpperCase();
  if (call.length > 2)
  {
    return call;
  }
  const own = String(GT.settings.app.stationCallsign || GT.settings.app.myRawCall || "").trim().toUpperCase();
  if (own.length > 2 && own != "NOCALL")
  {
    return own;
  }
  return "";
}

// PSK Reporter's MQTT topics: level 6 is the sender, level 8 the receiver, everything between is a wildcard. The
// callsign is dotted on the air (K5RSB/P is K5RSB.P).
function pskWatchTopic(call, side)
{
  const dotted = String(call).toUpperCase().replaceAll("/", ".");
  if (side == "hears")
  {
    return "pskr/filter/v2/+/+/+/+/" + dotted + "/#";
  }
  return "pskr/filter/v2/+/+/" + dotted + "/#";
}

function pskWatchSetStatus(status, error)
{
  GT.pskWatch.status = status;
  GT.pskWatch.lastError = error || "";
  if (typeof pskWatchUpdatePanel == "function")
  {
    pskWatchUpdatePanel();
  }
}

// One redraw and one panel refresh 300ms after the last change: a burst of reports costs one repaint, not hundreds
function pskWatchScheduleUpdate()
{
  if (GT.pskWatch.updateTimer != null)
  {
    return;
  }
  GT.pskWatch.updateTimer = nodeTimers.setTimeout(function()
  {
    GT.pskWatch.updateTimer = null;
    if (typeof pskWatchRedrawLayer == "function")
    {
      pskWatchRedrawLayer();
    }
    if (typeof pskWatchUpdatePanel == "function")
    {
      pskWatchUpdatePanel();
    }
  }, 300);
}

function pskWatchTrim()
{
  const cutoff = timeNowSec() - GT.pskWatchKeepSec;
  while (GT.pskWatch.keys.length > 0)
  {
    const oldest = GT.pskWatch.keys[0];
    const report = GT.pskWatch.reports.get(oldest);
    if (GT.pskWatch.keys.length <= GT.pskWatchMaxReports && report != null && report.t >= cutoff)
    {
      break;
    }
    GT.pskWatch.reports.delete(oldest);
    GT.pskWatch.keys.shift();
  }
}

function pskWatchAddReport(report)
{
  // One reception is one row, whether it came live or from the retrieve API, so the key does not use the feed's own
  // spot id: the same report fetched as history must not show up beside the live copy of itself.
  const key = report.sc + "|" + report.rc + "|" + report.f + "|" + report.t;
  if (GT.pskWatch.reports.has(key))
  {
    return false;
  }
  GT.pskWatch.reports.set(key, report);
  GT.pskWatch.keys.push(key);
  pskWatchTrim();
  return true;
}

// One live spot from the MQTT feed. The payload is {"sq":..,"f":Hz,"md":..,"rp":SNR,"t":unix,"sc":sender,
// "sl":senderLocator,"rc":receiver,"rl":receiverLocator,"b":band}
function pskWatchOnMessage(payload)
{
  let json = null;
  try
  {
    json = JSON.parse(payload.toString());
  }
  catch (err)
  {
    return;
  }
  const sc = String(json.sc || "").toUpperCase();
  const rc = String(json.rc || "").toUpperCase();
  const sl = String(json.sl || "").substring(0, 6).toUpperCase();
  const rl = String(json.rl || "").substring(0, 6).toUpperCase();
  const f = Number(json.f);
  const t = parseInt(json.t);
  if (sc == "" || rc == "" || sl.length < 4 || rl.length < 4 || isNaN(f) || isNaN(t))
  {
    return;
  }
  if (pskWatchAddReport({
    sq: json.sq || 0,
    sc: sc,
    sl: sl,
    rc: rc,
    rl: rl,
    f: f,
    md: String(json.md || "").toUpperCase(),
    rp: Number(json.rp) || 0,
    t: t,
    b: String(json.b || "").toLowerCase(),
    history: false
  }))
  {
    pskWatchScheduleUpdate();
  }
}

function pskWatchConnect()
{
  if (pskWatchOffline())
  {
    pskWatchSetStatus("offline");
    return;
  }
  const call = pskWatchCallsign();
  if (call == "")
  {
    pskWatchSetStatus("error", I18N("psk.status.noCall"));
    return;
  }

  const topic = pskWatchTopic(call, GT.settings.psk.side == "hears" ? "hears" : "heard");
  if (GT.pskWatch.client != null && GT.pskWatch.topic == topic)
  {
    return;
  }
  pskWatchDisconnect(true);
  GT.pskWatch.topic = topic;

  const mqtt = window.require("mqtt");
  const clientId = "GT2PSK_" + call.replace(/[^A-Z0-9]/g, "") + "_" + Math.random().toString(16).slice(3, 9);
  pskWatchSetStatus("connecting");

  const client = mqtt.connect(GT.pskWatchUrl, {
    clientId: clientId,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: 60000
  });
  GT.pskWatch.client = client;

  client.on("connect", function()
  {
    if (GT.pskWatch.client !== client)
    {
      return;
    }
    pskWatchSetStatus("connected");
    client.subscribe(topic, function(err)
    {
      if (err && GT.pskWatch.client === client)
      {
        pskWatchSetStatus("error", err.message);
      }
    });
  });
  client.on("message", function(msgTopic, payload)
  {
    if (GT.pskWatch.client !== client)
    {
      return;
    }
    pskWatchOnMessage(payload);
  });
  client.on("close", function()
  {
    if (GT.pskWatch.client === client)
    {
      pskWatchSetStatus("disconnected");
    }
  });
  client.on("error", function(err)
  {
    if (GT.pskWatch.client === client)
    {
      pskWatchSetStatus("error", err.message);
    }
  });
}

function pskWatchDisconnect(keepReports)
{
  if (GT.pskWatch.client != null)
  {
    const client = GT.pskWatch.client;
    GT.pskWatch.client = null;
    GT.pskWatch.topic = "";
    try
    {
      client.end(true);
    }
    catch (err)
    {
      console.error("PSK watch MQTT close failed: " + err);
    }
  }
  if (!keepReports)
  {
    GT.pskWatch.reports.clear();
    GT.pskWatch.keys = [];
  }
}

function pskWatchStart()
{
  GT.settings.psk.enabled = true;
  if (pskWatchOffline())
  {
    pskWatchSetStatus("offline");
    pskWatchScheduleUpdate();
    return;
  }
  // A fresh start drops whatever the last callsign left behind
  pskWatchDisconnect(false);
  pskWatchConnect();
  pskWatchFetchHistory(false);
  if (GT.pskWatch.pruneTimer == null)
  {
    // Reports age out while the panel is open even when no new spot arrives
    GT.pskWatch.pruneTimer = nodeTimers.setInterval(function()
    {
      pskWatchTrim();
      pskWatchScheduleUpdate();
    }, 60000);
  }
  pskWatchScheduleUpdate();
}

function pskWatchStop()
{
  GT.settings.psk.enabled = false;
  if (GT.pskWatch.pruneTimer != null)
  {
    nodeTimers.clearInterval(GT.pskWatch.pruneTimer);
    GT.pskWatch.pruneTimer = null;
  }
  pskWatchDisconnect(false);
  pskWatchSetStatus("idle");
  pskWatchScheduleUpdate();
}

// The callsign or the side changed: same as start, without touching the enabled flag
function pskWatchRestart()
{
  if (GT.settings.psk.enabled != true)
  {
    pskWatchScheduleUpdate();
    return;
  }
  if (pskWatchOffline())
  {
    pskWatchSetStatus("offline");
    pskWatchScheduleUpdate();
    return;
  }
  pskWatchDisconnect(false);
  pskWatchConnect();
  pskWatchFetchHistory(false);
  pskWatchScheduleUpdate();
}

function pskWatchHistoryMinutes()
{
  const minutes = parseInt(GT.settings.psk.historyMinutes, 10);
  if (isNaN(minutes) || minutes < 15)
  {
    return 15;
  }
  return Math.min(minutes, 1440);
}

function pskWatchFetchHistory(force)
{
  if (GT.settings.psk.enabled != true || pskWatchOffline())
  {
    return;
  }
  const call = pskWatchCallsign();
  if (call == "" || GT.pskWatch.historyBusy)
  {
    return;
  }

  const minutes = pskWatchHistoryMinutes();
  const side = GT.settings.psk.side == "hears" ? "hears" : "heard";
  const cacheKey = call + "|" + side + "|" + minutes;
  const cached = GT.pskWatch.historyCache.get(cacheKey);
  if (!force && cached != null && (Date.now() - cached.at) < GT.pskWatchHistoryReuseMs)
  {
    pskWatchApplyHistory(cached.reports);
    return;
  }

  const https = window.require("https");
  const zlib = window.require("zlib");
  const param = side == "hears" ? "receiverCallsign" : "senderCallsign";
  const url = "https://retrieve.pskreporter.info/query?" + param + "=" + encodeURIComponent(call) +
    "&flowStartSeconds=" + (-minutes * 60) + "&rptlimit=1000";

  GT.pskWatch.historyBusy = true;
  GT.pskWatch.historyError = "";

  const done = function(err)
  {
    GT.pskWatch.historyBusy = false;
    GT.pskWatch.historyError = err || "";
    if (typeof pskWatchUpdatePanel == "function")
    {
      pskWatchUpdatePanel();
    }
  };

  const req = https.get(url, {
    headers: {
      "User-Agent": "GridTracker/" + gtVersionStr + " (PSK Reporter watch)",
      "Accept-Encoding": "gzip"
    }
  }, function(res)
  {
    if (res.statusCode != 200)
    {
      res.resume();
      done("HTTP " + res.statusCode);
      return;
    }
    let stream = res;
    if (String(res.headers["content-encoding"] || "").toLowerCase() == "gzip")
    {
      stream = res.pipe(zlib.createGunzip());
    }
    const chunks = [];
    stream.on("data", function(chunk)
    {
      chunks.push(chunk);
    });
    stream.on("error", function(err)
    {
      done(err.message);
    });
    stream.on("end", function()
    {
      const reports = pskWatchParseHistory(Buffer.concat(chunks).toString("utf8"));
      GT.pskWatch.historyCache.set(cacheKey, { at: Date.now(), reports: reports });
      pskWatchApplyHistory(reports);
      done("");
    });
  });

  req.on("error", function(err)
  {
    done(err.message);
  });
  req.setTimeout(45000, function()
  {
    req.destroy(new Error("timeout"));
  });
}

// The retrieve API answers with <receptionReport ... /> elements; <activeReceiver> entries are receivers that
// uploaded a list and are not reports.
function pskWatchParseHistory(xmlText)
{
  const reports = [];
  let doc = null;
  try
  {
    doc = new DOMParser().parseFromString(xmlText, "text/xml");
  }
  catch (err)
  {
    return reports;
  }
  const nodes = doc.getElementsByTagName("receptionReport");
  for (let i = 0; i < nodes.length; i++)
  {
    const node = nodes[i];
    const sc = String(node.getAttribute("senderCallsign") || "").toUpperCase();
    const rc = String(node.getAttribute("receiverCallsign") || "").toUpperCase();
    const sl = String(node.getAttribute("senderLocator") || "").substring(0, 6).toUpperCase();
    const rl = String(node.getAttribute("receiverLocator") || "").substring(0, 6).toUpperCase();
    const f = Number(node.getAttribute("frequency"));
    const t = parseInt(node.getAttribute("flowStartSeconds"));
    if (sc == "" || rc == "" || sl.length < 4 || rl.length < 4 || isNaN(f) || isNaN(t))
    {
      continue;
    }
    reports.push({
      sq: 0,
      sc: sc,
      sl: sl,
      rc: rc,
      rl: rl,
      f: f,
      md: String(node.getAttribute("mode") || "").toUpperCase(),
      rp: Number(node.getAttribute("sNR")) || 0,
      t: t,
      b: String(formatBand(f / 1000000)).toLowerCase(),
      history: true
    });
  }
  return reports;
}

function pskWatchApplyHistory(reports)
{
  for (let i = 0; i < reports.length; i++)
  {
    pskWatchAddReport(reports[i]);
  }
  pskWatchScheduleUpdate();
}

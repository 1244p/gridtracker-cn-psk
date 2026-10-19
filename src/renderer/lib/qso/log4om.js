// Log4OM 2 remote control (Settings -> Logging -> Log4OM, Connect): Log4OM's UDP remote-control interface (Remote Control
// Interface v1.1, XML). Like AC Log (acLog.js), Log4OM is then a rig source: its radio's frequency, band and mode
// (GetRadioStatus, and the Radio Status Log4OM sends on its own when its "data output" is on), and a Feed Roster or map
// spot clicked goes to it (ClearUI + SetCallsign; with Enable Rig Control, the rig tuned too). The idea came from Matt's
// SOTA work, which sent SetTxFrequency / SetCallsign
//
// One UDP socket, bound to Log4OM's data-output port (2242, set in Log4OM): Log4OM sends its Radio Status there, and
// answers a request back to the port it came from, so requests sent from it to the remote-control port (2241) are
// answered there too. "Alive" every 5 seconds tells whether Log4OM is there (connected while it answered in the last 15)

GT.log4OMInstanceId = "Log4OM";
GT.log4OMSocket = null;
GT.log4OMTimer = null;
GT.log4OMLastAnswer = 0;
GT.log4OMStatus = {
  Id: GT.log4OMInstanceId,
  event: "Status",
  Frequency: 0,
  Band: "OOB",
  MO: "???",
  TxEnabled: 0,
  Transmitting: 0,
  Decoding: 0,
  DEcall: "",
  DEgrid: "",
  DXcall: "",
  DXgrid: "",
  Report: "-",
  instance: GT.log4OMInstanceId
};
const LOG4OM_MESSAGE_ID = "C0FC027F-D09E-49F5-9CA6-33A11E05A053";
const LOG4OM_ALIVE_SECONDS = 15;

// A remote-control request: name and, optionally, its fields ({ Frequency: 14074000 })
function log4OMSend(name, fields = {})
{
  if (!GT.log4OMSocket) return;
  let xml = `<RemoteControlRequest><MessageId>${LOG4OM_MESSAGE_ID}</MessageId><RemoteControlMessage>${name}</RemoteControlMessage>`;
  for (const key in fields) xml += `<${key}>${htmlEntities(String(fields[key]))}</${key}>`;
  xml += "</RemoteControlRequest>";
  const buffer = Buffer.from(xml, "utf8");
  try
  {
    GT.log4OMSocket.send(buffer, 0, buffer.length, Number(GT.settings.log4OM.rcPort) || 2241, GT.settings.log4OM.ip);
  }
  catch (e)
  {
    console.error("Log4OM send:", e);
  }
}

// A logger's own instance (AC Log, Log4OM), not a WSJT-X / JTDX: the status bar says CONNECTED for it, and it may have
// no frequency (no rig)
function isLoggerInstance(id)
{
  return id == GT.acLogInstanceId || id == GT.log4OMInstanceId;
}

// Log4OM answered within the last LOG4OM_ALIVE_SECONDS
function log4OMConnected()
{
  return GT.log4OMSocket != null && timeNowSec() - GT.log4OMLastAnswer <= LOG4OM_ALIVE_SECONDS;
}

// With Log4OM connected, any Feed Roster spot can be worked through it, whatever band and mode its radio is on
function log4OMCanWork(callObj)
{
  return GT.settings.log4OM.connect && log4OMConnected();
}

// The radio's mode as GridTracker's (a feed spot's): the sidebands are SSB
function log4OMSpotMode(mode)
{
  mode = String(mode || "").toUpperCase();
  return mode == "USB" || mode == "LSB" ? "SSB" : mode == "CWR" ? "CW" : mode;
}

// A spot clicked for Log4OM: its entry cleared and the call set (Log4OM ignores both while you've typed a call
// yourself). With Enable Rig Control, the rig tuned to the spot's frequency and mode first. Log4OM takes the spot's own
// mode (SSB, CW, FT8, FT4, RTTY, PSK31, ... it picks the rig's mode and sideband itself); one it refuses ("Invalid mode")
// is sent again as a radio mode (the AC Log rule: SSB on the band's sideband, data modes on USB; handleLog4OMMessage)
// After a frequency change Log4OM sets the mode from its own band plan (about 3 seconds later, once the rig reports the
// new frequency), replacing the one asked for: the mode is sent again at these delays (ms). A newer click cancels them
GT.log4OMModeFallback = null;
GT.log4OMModeRefused = false;
GT.log4OMModeTimers = [];
const LOG4OM_MODE_RESEND_MS = [1500, 3500];

function log4OMWorkSpot(callObj)
{
  for (const timer of GT.log4OMModeTimers) nodeTimers.clearTimeout(timer);
  GT.log4OMModeTimers = [];
  if (callObj.freq > 0 && GT.settings.log4OM.rigControl)
  {
    log4OMSend("SetTxFrequency", { Frequency: Math.round(callObj.freq) });
    const asked = String(callObj.mode || "").toUpperCase();
    const fallback = acLogRigMode(asked, callObj.freq);
    const setMode = () =>
    {
      // Once refused, the radio mode is what's asked for (handleLog4OMMessage)
      const mode = GT.log4OMModeRefused ? fallback : (asked || fallback);
      GT.log4OMModeFallback = mode != fallback ? fallback : null;
      log4OMSend("SetMode", { Mode: mode });
    };
    GT.log4OMModeRefused = false;
    setMode();
    GT.log4OMModeTimers = LOG4OM_MODE_RESEND_MS.map((ms) => nodeTimers.setTimeout(setMode, ms));
  }
  log4OMSend("ClearUI");
  log4OMSend("SetCallsign", { Callsign: callObj.DEcall });

  // Log4OM's entry can't be read back, so the Main Panel's DX call and grid are the ones sent (until the next click)
  const grid = String(callObj.fullGrid || callObj.grid || "").toUpperCase();
  GT.log4OMStatus.DXcall = String(callObj.DEcall || "").toUpperCase();
  GT.log4OMStatus.DXgrid = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(grid) ? grid : "";
  const instance = GT.instances[GT.log4OMInstanceId];
  if (instance && instance.open) handleInstanceStatus(GT.log4OMStatus);
}

// Settings -> Logging -> Log4OM: a green / red dot right of Connect, as AC Log's
function updateLog4OMConnectStatus()
{
  if (typeof log4OMConnectStatus == "undefined") return;
  let html = "";
  if (GT.settings.log4OM.connect)
  {
    html = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background-color:${log4OMConnected() ? "#00DD00" : "#FF3333"};margin-left:3px;vertical-align:middle;"></span>`;
  }
  if (log4OMConnectStatus.innerHTML != html) log4OMConnectStatus.innerHTML = html;
}

// Every second (ui.js): opens or closes the connection with the Connect setting, and notices Log4OM going away
function connectToLog4OM()
{
  if (GT.log4OMSocket && !GT.settings.log4OM.connect) closeLog4OM();
  if (!GT.settings.log4OM.connect || !(GT.settings.log4OM.ip.length > 4))
  {
    updateLog4OMConnectStatus();
    return;
  }
  if (!GT.log4OMSocket)
  {
    openLog4OM();
    return;
  }
  // No answer for a while: Log4OM closed (or its remote control turned off)
  const instance = GT.instances[GT.log4OMInstanceId];
  if (instance && instance.open && !log4OMConnected())
  {
    instance.open = false;
    handleClosed(GT.log4OMStatus);
  }
  updateLog4OMConnectStatus();
}

function openLog4OM()
{
  // Its locator, callsign and ports, before the socket binds to the data-output port
  readLog4OMConfig();
  const dgram = window.require("dgram");
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  GT.log4OMSocket = socket;
  socket.on("error", (e) =>
  {
    console.error("Log4OM socket:", e.message);
    closeLog4OM();
  });
  socket.on("message", (message) => handleLog4OMMessage(String(message)));
  socket.bind(Number(GT.settings.log4OM.rcOutputPort) || 2242, () =>
  {
    if (GT.log4OMSocket !== socket) return;
    log4OMSend("Alive");
    log4OMSend("GetRadioStatus");
    nodeTimers.clearInterval(GT.log4OMTimer);
    GT.log4OMTimer = nodeTimers.setInterval(() =>
    {
      log4OMSend("Alive");
      log4OMSend("GetRadioStatus");
    }, 5000);
  });
}

function closeLog4OM()
{
  nodeTimers.clearInterval(GT.log4OMTimer);
  GT.log4OMTimer = null;
  if (GT.log4OMSocket)
  {
    try { GT.log4OMSocket.close(); } catch (e) { /* already closed */ }
    GT.log4OMSocket = null;
  }
  GT.log4OMLastAnswer = 0;
  const instance = GT.instances[GT.log4OMInstanceId];
  if (instance && instance.open)
  {
    instance.open = false;
    handleClosed(GT.log4OMStatus);
  }
  updateLog4OMConnectStatus();
}

// ---- Log4OM's own settings: its station locator and callsign (the remote control sends no grid, and no callsign
// without a rig), and its remote-control ports. Only with Log4OM on this PC: its config.json, in the user folder its
// l4ong.status names (else %APPDATA%\Log4OM2\user), read when connecting (openLog4OM, before the socket is opened)
GT.log4OMConfig = { file: "", locator: "", callsign: "" };

function log4OMIsLocal()
{
  const ip = String(GT.settings.log4OM.ip || "").trim().toLowerCase();
  return ip == "127.0.0.1" || ip == "localhost";
}

function log4OMConfigFile()
{
  const base = path.join(process.env.APPDATA || "", "Log4OM2");
  try
  {
    const status = fs.readFileSync(path.join(base, "l4ong.status"), "utf8");
    const user = (status.match(/^\s*USER\s*=\s*(.+?)\s*$/m) || [])[1];
    if (user) return path.join(user, "config.json");
  }
  catch (e) { /* no status file: the default folder */ }
  return path.join(base, "user", "config.json");
}

// Reads the settings: the locator and callsign kept for the status (applyLog4OMConfig), the remote-control ports into
// GridTracker's Log4OM settings (rcPort; rcOutputPort, where the socket listens, while Log4OM's data output is on)
function readLog4OMConfig()
{
  if (!log4OMIsLocal()) return;
  try
  {
    const file = log4OMConfigFile();
    const config = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
    // The configuration Log4OM is running, else its first
    const users = Array.isArray(config.UserConfigs) ? config.UserConfigs : [];
    const user = users.find((u) => u.ConfigurationId == config.RunningConfigurationId) || users[0] || {};
    const locator = String(user.StationLocator || "").trim().toUpperCase().substring(0, 6);
    GT.log4OMConfig.file = file;
    GT.log4OMConfig.locator = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(locator) ? locator : "";
    GT.log4OMConfig.callsign = String(user.StationCallsign || "").trim().toUpperCase();
    const port = (value) => (Number(value) > 0 && Number(value) < 65536 ? Number(value) : 0);
    if (port(user.RemoteControlPort)) GT.settings.log4OM.rcPort = port(user.RemoteControlPort);
    if (user.RemoteControlDataOutputEnabled && port(user.RemoteControlOutputPort)) GT.settings.log4OM.rcOutputPort = port(user.RemoteControlOutputPort);
  }
  catch (e)
  {
    console.error("Log4OM settings:", e.message);
  }
}

// The status' grid from Log4OM's settings, and its callsign too while no radio status gives one; true if it changed
function applyLog4OMConfig()
{
  let changed = false;
  if (GT.log4OMConfig.locator && GT.log4OMStatus.DEgrid != GT.log4OMConfig.locator)
  {
    GT.log4OMStatus.DEgrid = GT.log4OMConfig.locator;
    changed = true;
  }
  if (!GT.log4OMStatus.DEcall && GT.log4OMConfig.callsign)
  {
    GT.log4OMStatus.DEcall = GT.log4OMConfig.callsign;
    changed = true;
  }
  return changed;
}

// The value of a simple <Tag>value</Tag> in Log4OM's XML ("" if absent)
function log4OMField(xml, tag)
{
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : "";
}

function handleLog4OMMessage(xml)
{
  // Any answer means Log4OM is there: its instance opens
  GT.log4OMLastAnswer = timeNowSec();
  if (!(GT.log4OMInstanceId in GT.instances))
  {
    addNewInstance(GT.log4OMInstanceId);
    const instance = GT.instances[GT.log4OMInstanceId];
    instance.crEnable = false;
    instance.canRoster = false;
    instance.oldStatus = null;
    instance.status = GT.log4OMStatus;
  }
  const instance = GT.instances[GT.log4OMInstanceId];

  // A mode Log4OM refused (log4OMWorkSpot): sent again now as a radio mode, and the re-sends use that too
  if (/<RemoteControlMessage>\s*SetMode\s*</i.test(xml))
  {
    if (/<Done>\s*false\s*</i.test(xml) && GT.log4OMModeFallback)
    {
      GT.log4OMModeRefused = true;
      log4OMSend("SetMode", { Mode: GT.log4OMModeFallback });
    }
    GT.log4OMModeFallback = null;
  }

  let changed = false;
  if (!instance.open)
  {
    instance.open = true;
    instance.valid = true;
    changed = true;
    updateRosterInstances();
  }
  if (applyLog4OMConfig()) changed = true;

  // Radio Status (GetRadioStatus' answer, and what Log4OM sends on its own): the frequency is in tens of Hz
  if (/<RadioInfo>/i.test(xml))
  {
    const call = log4OMField(xml, "OpCall").toUpperCase();
    const frequency = (Number(log4OMField(xml, "Freq")) || 0) * 10;
    const mode = log4OMSpotMode(log4OMField(xml, "Mode"));
    if (call && call != GT.log4OMStatus.DEcall) { GT.log4OMStatus.DEcall = call; changed = true; }
    if (frequency > 0 && (frequency != GT.log4OMStatus.Frequency || mode != GT.log4OMStatus.MO))
    {
      GT.log4OMStatus.Frequency = frequency;
      GT.log4OMStatus.Band = formatBand(frequency / 1000000);
      GT.log4OMStatus.MO = mode || GT.log4OMStatus.MO;
      changed = true;
    }
    // Only an explicit "true" (the document's own example shows "2")
    GT.log4OMStatus.Transmitting = /^true$/i.test(log4OMField(xml, "IsTransmitting")) ? 1 : 0;
  }
  if (changed) handleInstanceStatus(GT.log4OMStatus);
  updateLog4OMConnectStatus();
}

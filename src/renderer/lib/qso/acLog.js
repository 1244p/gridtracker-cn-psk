GT.acLogAPISocket = null;
GT.acLogInstanceId = "AC-Log";
GT.acLogStatus = {
  Id: GT.acLogInstanceId,
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
  instance: GT.acLogInstanceId
};

// Requests to AC Log, one at a time: the next is only sent once the previous one's expected reply has arrived (or
// it timed out, so a missing reply can't block the queue). The API connection's requests (acLogSocketRequest), the
// log downloads (grabAcLog) and logged QSOs (sendACLogMessage), the last two on their own connections, go through it.
// key: a request already waiting or in flight with the same key isn't queued again (the 5 second polls); log
// downloads have none, so every logged QSO is fetched. onSocket: sent on the API connection (dropped if it closes)
GT.acLogQueue = [];
GT.acLogInFlight = null;
// The API connection's request waiting for its reply: { type: "READBMFRESPONSE", done }
GT.acLogExpect = null;

function acLogRequest(start, key = null, timeoutMs = 10000, onSocket = false)
{
  if (key && ((GT.acLogInFlight && GT.acLogInFlight.key == key) || GT.acLogQueue.some((request) => request.key == key))) return;
  GT.acLogQueue.push({ start, key, timeoutMs, onSocket });
  runAcLogQueue();
}

function runAcLogQueue()
{
  if (GT.acLogInFlight || GT.acLogQueue.length == 0) return;
  const request = GT.acLogQueue.shift();
  GT.acLogInFlight = request;
  let finished = false;
  const done = () =>
  {
    if (finished) return;
    finished = true;
    nodeTimers.clearTimeout(timeout);
    GT.acLogInFlight = null;
    runAcLogQueue();
  };
  const timeout = nodeTimers.setTimeout(() =>
  {
    GT.acLogExpect = null;
    done();
  }, request.timeoutMs);
  request.start(done);
}

// A command on the API connection, answered by a responseType message (handleAcLogAPIMessage)
function acLogSocketRequest(command, responseType, key = null)
{
  acLogRequest((done) =>
  {
    if (!GT.acLogAPISocket) return done();
    GT.acLogExpect = { type: responseType, done };
    GT.acLogAPISocket.write(Buffer.from(command));
  }, key, 10000, true);
}

// Feed Roster modes AC Log has as they are; data modes (FT8, RTTY, ...), which it doesn't support, go on phone
const ACLOG_MODES = { CW: true, SSB: true, USB: true, LSB: true, AM: true, FM: true };

// The entry tab's mode (no Rig Control): AC Log's own names, "PH" for phone
function acLogEntryMode(mode)
{
  return Object.prototype.hasOwnProperty.call(ACLOG_MODES, mode) ? mode : "PH";
}

// The rig's mode (CHANGEMODE, with Rig Control): a radio mode, so SSB / PHONE are the band's sideband (LSB below
// 10 MHz, except 60m) and data modes USB
function acLogRigMode(mode, freqHz)
{
  if (mode == "SSB" || mode == "PHONE") return (freqHz < 10000000 && !(freqHz >= 5000000 && freqHz < 5500000)) ? "LSB" : "USB";
  return Object.prototype.hasOwnProperty.call(ACLOG_MODES, mode) ? mode : "USB";
}

// With AC Log connected, any Feed Roster spot can be worked through it, whatever band and mode AC Log is on now
function acLogCanWork(callObj)
{
  return GT.acLogAPISocket != null && GT.acLogInstanceId in GT.instances && GT.instances[GT.acLogInstanceId].open == true;
}

// A Feed Roster spot clicked for AC Log: a new entry tab with the spot's frequency, band and mode (data modes: phone),
// call (tabbed out, so AC Log looks it up) and grid. With Enable Rig Control (Settings, N3FJP Loggers) the rig is tuned
// to the frequency and mode instead of filling those fields.
// No reply is expected: the next poll and AC Log's CALLTABEVENT bring the result
function acLogWorkSpot(callObj)
{
  let command = aclAction("CLEAR");
  if (callObj.freq > 0 && GT.settings.acLog.rigControl)
  {
    command += valueToXmlField("CMD", "<CHANGEFREQ>" + valueToXmlField("VALUE", (callObj.freq / 1000000).toFixed(6)) +
      valueToXmlField("SUPPRESSMODEDEFAULT", "TRUE")) + "\r\n";
    command += valueToXmlField("CMD", "<CHANGEMODE>" + valueToXmlField("VALUE", acLogRigMode(callObj.mode, callObj.freq))) + "\r\n";
  }
  else
  {
    // AC Log's band field has no unit ("20", "70" for 70cm)
    if (callObj.freq > 0) command += aclUpdateControlValue("TXTENTRYFREQUENCY", (callObj.freq / 1000000).toFixed(6));
    const band = String(callObj.band || "").replace(/c?m$/, "");
    if (band) command += aclUpdateControlValue("TXTENTRYBAND", band);
    command += aclUpdateControlValue("TXTENTRYMODE", acLogEntryMode(callObj.mode));
  }
  command += aclUpdateControlValue("TXTENTRYCALL", callObj.DEcall);
  command += aclAction("CALLTAB");
  // The spot's grid as the Feed Roster has it (6 characters when known), after the tab out so AC Log's own call lookup
  // doesn't replace it. The 6-character grid when known (fullGrid: the spot's own, or its summit's), all upper case
  const grid = String((callObj.fullGrid && callObj.fullGrid.length >= 4 ? callObj.fullGrid : callObj.grid) || "").toUpperCase();
  if (/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(grid))
  {
    command += aclUpdateControlValue("TXTENTRYGRID", grid);
  }

  acLogRequest((done) =>
  {
    if (!GT.acLogAPISocket) return done();
    GT.acLogAPISocket.write(Buffer.from(command), () => done());
  }, null, 10000, true);
}

// Settings, N3FJP Loggers: a green / red dot right of Connect for AC Log connected or not; none with Connect off.
// A plain colored ● (not an emoji), which every platform's fonts have
function updateAcLogConnectStatus()
{
  if (typeof acLogConnectStatus == "undefined") return;
  let html = "";
  if (GT.settings.acLog.connect)
  {
    const connected = GT.acLogAPISocket != null && GT.acLogAPISocket.connecting == false;
    html = `<span style="color:${connected ? "#00DD00" : "#FF3333"};margin-left:2px;font-size:larger;line-height:1;">&#9679;</span>`;
  }
  if (acLogConnectStatus.innerHTML != html) acLogConnectStatus.innerHTML = html;
}

function connectToAcLogAPI()
{
  if (GT.acLogAPISocket && GT.settings.acLog.connect == false) closeAcLogAPI();
  if (GT.acLogAPISocket || GT.settings.acLog.connect == false) return;
  if (!(GT.settings.acLog.port > 0 && GT.settings.acLog.ip.length > 4)) return;

  const net = window.require("net");
  let workingBuffer = null;

  GT.acLogAPISocket = new net.Socket();
  GT.acLogAPISocket.on("error", function () {
    closeAcLogAPI();
  });

  GT.acLogAPISocket.connect(GT.settings.acLog.port, GT.settings.acLog.ip, function ()
  {
    updateAcLogConnectStatus();
    if (!(GT.acLogInstanceId in GT.instances))
    {
      addNewInstance(GT.acLogInstanceId);
      GT.instances[GT.acLogInstanceId].crEnable = false;
      GT.instances[GT.acLogInstanceId].canRoster = false;
      GT.instances[GT.acLogInstanceId].valid = false;
      GT.instances[GT.acLogInstanceId].oldStatus = null;
      GT.instances[GT.acLogInstanceId].status = GT.acLogStatus;
    }

    acLogSocketRequest("<CMD><OPINFO></CMD>\r\n", "OPINFORESPONSE", "opinfo");
    acLogSocketRequest("<CMD><READBMF></CMD>\r\n", "READBMFRESPONSE", "readbmf");
    acLogSocketRequest("<CMD><ALLFIELDSWITHVALUES></CMD>\r\n", "ALLFIELDSWVRESPONSE", "allfields");

    // AC Log doesn't announce band / mode changes, or a call typed into its entry tab without tabbing out: ask again
    // every 5 seconds while connected
    nodeTimers.clearInterval(GT.acLogBmfTimer);
    GT.acLogBmfTimer = nodeTimers.setInterval(() =>
    {
      if (!GT.acLogAPISocket) return;
      acLogSocketRequest("<CMD><READBMF></CMD>\r\n", "READBMFRESPONSE", "readbmf");
      acLogSocketRequest("<CMD><ALLFIELDSWITHVALUES></CMD>\r\n", "ALLFIELDSWVRESPONSE", "allfields");
    }, 5000);
  });

  GT.acLogAPISocket.on("data", function (data)  {
    if (!workingBuffer) workingBuffer = Buffer.from(data).toString();
    else workingBuffer += Buffer.from(data).toString();
    let end = workingBuffer.indexOf("\r\n");
    while (end > -1)
    {
      handleAcLogAPIMessage(workingBuffer.substring(0, end));
      workingBuffer = workingBuffer.substring(end+2);
      end = workingBuffer.indexOf("\r\n");
    }
  });

  GT.acLogAPISocket.on("end", function () 
  {
    closeAcLogAPI();
  });
}

function closeAcLogAPI()
{
  if (!GT.acLogAPISocket) return;
  nodeTimers.clearInterval(GT.acLogBmfTimer);
  GT.acLogBmfTimer = null;
  // A request waiting on this connection's reply won't get one: let the queue go on
  if (GT.acLogExpect)
  {
    const done = GT.acLogExpect.done;
    GT.acLogExpect = null;
    done();
  }
  // Its queued requests go too; log downloads (their own connections) stay
  GT.acLogQueue = GT.acLogQueue.filter((request) => !request.onSocket);
  if (GT.acLogInstanceId in GT.instances)
  {
    GT.instances[GT.acLogInstanceId].open = false;
    handleClosed(GT.acLogStatus);
  }
  GT.acLogAPISocket.destroy();
  GT.acLogAPISocket = null;
  updateAcLogConnectStatus();
}

// AC Log's BAND field as a GridTracker band ("15" -> "15m", "70" -> "70cm", "144" -> "2m"), or "" if unknown
function acLogBand(band)
{
  const text = String(band || "").trim().toLowerCase().replace(/m$/, "");
  if (!text) return "";
  if (text.endsWith("c")) return (text + "m") in GT.bandColors ? text + "m" : "";
  const n = Number(text);
  if (!(n > 0)) return "";
  // 70 / 33 / 23 / 13 are only centimeter bands
  if ([70, 33, 23, 13].includes(n)) return n + "cm";
  if ((n + "m") in GT.bandColors) return n + "m";
  // A frequency in MHz (144, 222, 432, ...)
  const fromFreq = formatBand(n);
  return fromFreq && fromFreq != "OOB" ? fromFreq : "";
}

// ALLFIELDSWITHVALUES' reply: the entry tab's call and grid as the DX call / grid (as CALLTABEVENT), so a call
// entered before GridTracker connected, or typed without tabbing out, still shows; cleared with the entry tab.
// Without a rig frequency (READBMF), the entry tab's band and mode too
function handleAcLogEntryFields(buffer)
{
  const fields = {};
  for (const part of buffer.split("</CMD>"))
  {
    const object = parseAcLogXML(part);
    if (object.CONTROL) fields[object.CONTROL.toUpperCase()] = (object.VALUE || "").trim();
  }

  // Only fields with a value are listed: no call field is an empty call
  let changed = false;
  const call = (fields.TXTENTRYCALL || "").toUpperCase();
  const grid = call.length > 0 && fields.TXTENTRYGRID ? fields.TXTENTRYGRID.substring(0, 4).toUpperCase() : "";
  if (call != GT.acLogStatus.DXcall || grid != GT.acLogStatus.DXgrid)
  {
    GT.acLogStatus.DXcall = call;
    GT.acLogStatus.DXgrid = grid;
    changed = true;
  }

  if (GT.acLogStatus.Frequency == 0)
  {
    const band = acLogBand(fields.TXTENTRYBAND);
    if (band && band != GT.acLogStatus.Band)
    {
      GT.acLogStatus.Band = band;
      changed = true;
    }
    if (fields.TXTENTRYMODE && fields.TXTENTRYMODE != GT.acLogStatus.MO)
    {
      GT.acLogStatus.MO = fields.TXTENTRYMODE;
      changed = true;
    }
  }

  if (changed && GT.instances[GT.acLogInstanceId].open) handleInstanceStatus(GT.acLogStatus);

  if (GT.acLogExpect && GT.acLogExpect.type == "ALLFIELDSWVRESPONSE")
  {
    const done = GT.acLogExpect.done;
    GT.acLogExpect = null;
    done();
  }
}

function handleAcLogAPIMessage(buffer)
{
  if (buffer.length > 0)
  {
    // The entry tab's fields all come on one line, one <CMD> per field
    if (buffer.startsWith("<CMD><ALLFIELDSWVRESPONSE>"))
    {
      handleAcLogEntryFields(buffer);
      return;
    }
    let object = parseAcLogXML(buffer.substring(0, buffer.indexOf("</CMD>")));
    if (object.type)
    {
      let updateStatus = false;
      if (object.type == "OPINFORESPONSE")
      {
        GT.acLogStatus.DEcall = (object.CALL || "").toUpperCase();
        GT.acLogStatus.DEgrid = (object.GRID || "").toUpperCase();
      }
      else if (object.type == "READBMFRESPONSE" && Number(object.FREQ) > 0 && object.MODE && object.MODE.length > 0)
      {
        // Polled every 5 seconds: only pass it on when something changed
        const frequency = Math.round(Number(object.FREQ) * 1000000);
        const changed = GT.acLogStatus.MO != object.MODE || GT.acLogStatus.Frequency != frequency;
        GT.acLogStatus.MO = object.MODE;
        GT.acLogStatus.Band = formatBand(Number(object.FREQ));
        GT.acLogStatus.Frequency = frequency;
        updateStatus = changed || GT.instances[GT.acLogInstanceId].open == false;
      }
      else if (object.type == "READBMFRESPONSE")
      {
        // No frequency (no rig interface): READBMF's band / mode don't follow the entry tab, which is what gets
        // logged, so its band and mode fields are used instead (handleAcLogEntryFields). The rig going away is a change
        updateStatus = GT.acLogStatus.Frequency != 0;
        GT.acLogStatus.Frequency = 0;
      }
      else if (object.type == "CALLTABEVENT")
      {
        GT.acLogStatus.DXcall = (object.CALL || "").toUpperCase();
        if (object.GRID)
        {
           GT.acLogStatus.DXgrid = object.GRID.substring(0, 4).toUpperCase();
        }
        else if (object.LAT && object.LON)
        {
          GT.acLogStatus.DXgrid = latLonToGridSquare(Number(object.LAT), Number(object.LON));
        }
        // Not the previous call's grid
        else GT.acLogStatus.DXgrid = "";
        updateStatus = true;
      }
      else if (object.type == "ENTEREVENT")
      {
        // Grab the last log entry in a 1/4 second
        nodeTimers.setTimeout(grabAcLog, 250, 1);
      }

      var notify = false;
      if (GT.instances[GT.acLogInstanceId].open == false) notify = true;
      GT.instances[GT.acLogInstanceId].open = true;
      GT.instances[GT.acLogInstanceId].valid = true;
      if (notify) updateRosterInstances();
      if (updateStatus) handleInstanceStatus(GT.acLogStatus);

      // The reply the queued request was waiting for: the next one can go (acLogRequest)
      if (GT.acLogExpect && object.type == GT.acLogExpect.type)
      {
        const done = GT.acLogExpect.done;
        GT.acLogExpect = null;
        done();
      }
    }
  }
}
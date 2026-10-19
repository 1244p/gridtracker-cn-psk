// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// WSJT-X / JTDX UDP handling (moved verbatim from GridTracker2.js)

// ---- Qt wire format: encoding ----

function encodeQBOOL(byteArray, offset, value)
{
  return byteArray.writeUInt8(value ? 1 : 0, offset);
}

function encodeQUINT32(byteArray, offset, value)
{
  if (value == -1) value = 4294967295;
  return byteArray.writeUInt32BE(value, offset);
}

function encodeQINT32(byteArray, offset, value)
{
  return byteArray.writeInt32BE(value, offset);
}

function encodeQUTF8(byteArray, offset, value)
{
  offset = encodeQUINT32(byteArray, offset, value.length);
  let wrote = byteArray.write(value, offset, value.length);
  return wrote + offset;
}

function encodeQDOUBLE(byteArray, offset, value)
{
  return byteArray.writeDoubleBE(value, offset);
}

// ---- Qt wire format: decoding ----

function createQtReader(buffer) {
  let offset = 0;

  return {
    remaining() {
      return buffer.length - offset;
    },

    u8() {
      const value = buffer.readUInt8(offset);
      offset += 1;
      return value;
    },

    u32() {
      const value = buffer.readUInt32BE(offset);
      offset += 4;
      return value;
    },

    i32() {
      const value = buffer.readInt32BE(offset);
      offset += 4;
      return value;
    },

    u64() {
      let value = 0;
      for (let i = 0; i < 8; i++)
      {
        value = value * 256 + buffer[offset+i];
      }
      offset += 8;
      return value;
    },

    f64() {
      const value = buffer.readDoubleBE(offset);
      offset += 8;
      return value;
    },

    utf8() {
      const len = buffer.readUInt32BE(offset);
      offset += 4;

      if (len === 0xffffffff) {
        return "";
      }

      const value = buffer.toString("utf8", offset, offset + len);
      offset += len;
      return value;
    },

    offset() {
      return offset;
    }
  };
}

// ---- Instance tracking ----

/**
 * Fast, Zero-GC string hashing using FNV-1a.
 * Converts "WSJT-X - HF" into a short anonymous hex string like "a8f3b2c1"
 */
function hashAppString(str) {
    if (typeof str !== 'string' || str.length === 0) return "0";

    let hash = 2166136261; // FNV offset basis (0x811C9DC5)

    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        // FNV prime multiplication done via bit shifts for max speed
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    // `>>> 0` forces V8 to treat the result as an unsigned 32-bit integer.
    // `.toString(16)` converts it to a clean hexadecimal string.
    return (hash >>> 0).toString(16);
}

function addNewInstance(instanceId)
{
  // Instantiate all properties immediately
  GT.instances[instanceId] = {
    valid: false,
    open: false,
    crEnable: true,
    canRoster: true,
    oldStatus: null,
    status: null,
    instanceKey: null,
    instanceHash: hashAppString(instanceId)
  };

  updateMultiRigViews();
}

// Settings -> General -> On QSO Reply (Halt TX on the others, switch view), a row of its own: shown while more than one
// WSJT-X / JTDX instance is open (a logger such as AC Log or Log4OM isn't one); called when an instance is added or closed
function updateMultiRigViews()
{
  const rigs = Object.keys(GT.instances).filter((id) => !isLoggerInstance(id)).length;
  multiRigCRDiv.style.display = haltTXDiv.style.display = rigs > 1 ? "" : "none";
}

// ---- Main WSJT-X listener ----

function checkWsjtxListener()
{
  if (GT.wsjtUdpServer == null || (GT.wsjtUdpSocketReady == false && GT.wsjtUdpSocketError == true))
  {
    GT.wsjtCurrentPort = -1;
    GT.wsjtCurrentIP = "none";
  }
  updateWsjtxListener(GT.settings.app.wsjtUdpPort);
}

function updateWsjtxListener(port)
{
  if (port == GT.wsjtCurrentPort && GT.settings.app.wsjtIP == GT.wsjtCurrentIP) { return; }
  if (GT.wsjtUdpServer != null)
  {
    if (multicastEnable.checked == true && GT.settings.app.wsjtIP != "")
    {
      try
      {
        GT.wsjtUdpServer.dropMembership(GT.settings.app.wsjtIP);
      }
      catch (e)
      {
        console.error(e);
      }
    }
    GT.wsjtUdpServer.close();
    GT.wsjtUdpServer = null;
    GT.wsjtUdpSocketReady = false;
  }
  if (GT.closing == true) return;
  GT.wsjtUdpSocketError = false;
  const dgram = window.require("dgram");
  GT.wsjtUdpServer = dgram.createSocket({
    type: "udp4",
    reuseAddr: true
  });
  if (multicastEnable.checked == true && GT.settings.app.wsjtIP != "")
  {
    GT.wsjtUdpServer.on("listening", function ()
    {
      GT.wsjtUdpServer.setBroadcast(true);
      GT.wsjtUdpServer.setMulticastTTL(3);
      let interfaces = os.networkInterfaces();
      for (let i in interfaces)
      {
        for (let x in interfaces[i])
        {
          if (interfaces[i][x].family == "IPv4")
          {
            GT.wsjtUdpServer.addMembership(GT.settings.app.wsjtIP, interfaces[i][x].address);
          }
        }
      }
      GT.wsjtUdpSocketReady = true;
    });
  }
  else
  {
    GT.settings.app.multicast = false;
    GT.wsjtCurrentIP = GT.settings.app.wsjtIP = "";
    GT.wsjtUdpServer.on("listening", function ()
    {
      GT.wsjtUdpServer.setBroadcast(true);
      GT.wsjtUdpSocketReady = true;
    });
  }
  GT.wsjtUdpServer.on("error", function ()
  {
    GT.wsjtUdpServer.close();
    GT.wsjtUdpServer = null;
    GT.wsjtUdpSocketReady = false;
    GT.wsjtUdpSocketError = true;
  });

  GT.wsjtUdpServer.on("message", function (message, remote)
  {
    if (GT.finishedLoading == false) return;

    if (!(remote.port in GT.lastWsjtMessageByPort))
    {
      GT.lastWsjtMessageByPort[remote.port] = Buffer.from([0x01]);
    }

    let testBuffer = Buffer.from(message);
    if (testBuffer.equals(GT.lastWsjtMessageByPort[remote.port]))
    {
      return;
    }

    GT.lastWsjtMessageByPort[remote.port] = testBuffer;

    if (typeof udpForwardEnable != "undefined" && udpForwardEnable.checked == true)
    {
      sendForwardUdpMessage(message, message.length);
    }

    const r = createQtReader(message);
    const newMessage = {};

    newMessage.magic_key = r.u32();
    if (newMessage.magic_key != 0xadbccbda) {
      return;
    }

    newMessage.schema_number = r.u32();
    newMessage.type = r.u32();
    newMessage.Id = r.utf8();

    const instanceId = newMessage.Id;

    if (!(instanceId in GT.instances)) {
      addNewInstance(instanceId);
      GT.instanceCount++;
    }

    const instance = GT.instances[instanceId];
    const wasClosed = instance.open === false;

    instance.open = true;
    instance.remote = remote;

    if (wasClosed) {
      updateRosterInstances();
    }

    switch (newMessage.type) {
      case 1: {
        newMessage.Frequency = r.u64();
        newMessage.Band = formatBand(Number(newMessage.Frequency) / 1000000);
        newMessage.MO = r.utf8();
        newMessage.DXcall = r.utf8();
        newMessage.Report = r.utf8();
        newMessage.TxMode = r.utf8();
        newMessage.TxEnabled = r.u8();
        newMessage.Transmitting = r.u8();
        newMessage.Decoding = r.u8();
        newMessage.RxDF = r.i32();
        newMessage.TxDF = r.i32();
        newMessage.DEcall = r.utf8();
        newMessage.DEgrid = r.utf8();
        newMessage.DXgrid = r.utf8();
        newMessage.TxWatchdog = r.u8();
        newMessage.Submode = r.utf8();
        newMessage.Fastmode = r.u8();

        newMessage.SopMode = r.remaining() > 0 ? r.u8() : -1;
        newMessage.FreqTol = r.remaining() > 0 ? r.i32() : -1;
        newMessage.TRP = r.remaining() > 0 ? r.i32() : -1;
        newMessage.ConfName = r.remaining() > 0 ? r.utf8() : null;
        newMessage.TxMessage = r.remaining() > 0 ? r.utf8() : null;
        newMessage.TxSymbols = r.remaining() > 0 ? r.utf8() : null;

        if (instance.status && newMessage.SopMode != instance.status.SopMode) GT.callRoster = {};
        instance.oldStatus = instance.status;
        instance.status = newMessage;
        instance.valid = true;
        break;
      }

      case 2: {
        if (!instance.valid) return;

        const status = instance.status;
        newMessage.NW = r.u8();
        newMessage.TM = r.u32();
        newMessage.SR = r.i32();
        newMessage.DT = r.f64();
        newMessage.DF = r.u32();
        newMessage.MO = r.utf8();
        newMessage.Msg = r.utf8();
        newMessage.LC = r.u8();
        newMessage.OA = r.u8();
        newMessage.OF = status.Frequency;
        newMessage.OC = status.DEcall;
        newMessage.OG = status.DEgrid;
        newMessage.OM = status.MO;
        newMessage.OB = status.Band;
        newMessage.SP = status.SopMode;
        break;
      }

      case 3: {
        if (!instance.valid) return;
        break;
      }

      case 5: {
        if (!instance.valid) return;

        newMessage.DateOff = r.u64();
        newMessage.TimeOff = r.u32();
        newMessage.timespecOff = r.u8();

        if (newMessage.timespecOff === 2) {
          newMessage.offsetOff = r.i32();
        }

        newMessage.DXCall = r.utf8();
        newMessage.DXGrid = r.utf8();
        newMessage.Frequency = r.u64();
        newMessage.MO = r.utf8();
        newMessage.ReportSend = r.utf8();
        newMessage.ReportRecieved = r.utf8();
        newMessage.TXPower = r.utf8();
        newMessage.Comments = r.utf8();
        newMessage.Name = r.utf8();
        newMessage.DateOn = r.u64();
        newMessage.TimeOn = r.u32();
        newMessage.timespecOn = r.u8();

        if (newMessage.timespecOn === 2) {
          newMessage.offsetOn = r.i32();
        }

        newMessage.Operatorcall = r.remaining() > 0 ? r.utf8() : "";
        newMessage.Mycall = r.remaining() > 0 ? r.utf8() : "";
        newMessage.Mygrid = r.remaining() > 0 ? r.utf8() : "";
        newMessage.ExchangeSent = r.remaining() > 0 ? r.utf8() : "";
        newMessage.ExchangeReceived = r.remaining() > 0 ? r.utf8() : "";
        break;
      }

      case 6: {
        if (!instance.valid) return;
        break;
      }

      case 10: {
        if (!instance.valid ) return;

        const status = instance.status;

        newMessage.NW = r.u8();
        newMessage.TM = r.u32();
        newMessage.SR = r.i32();
        newMessage.DT = r.f64();
        newMessage.Frequency = r.u64();
        newMessage.Drift = r.i32();
        newMessage.Callsign = r.utf8();
        newMessage.Grid = r.utf8();
        newMessage.Power = r.i32();
        newMessage.OA = r.u8();
        newMessage.OF = status.Frequency;
        newMessage.OC = status.DEcall;
        newMessage.OG = status.DEgrid;
        newMessage.OM = status.MO;
        newMessage.OB = status.Band;
        break;
      }

      case 12: {
        if (!instance.valid) return;
        newMessage.ADIF = r.utf8();
        break;
      }

      default:
        return;
    }

    if (instance.valid && newMessage.type in GT.wsjtHandlers) {
      newMessage.remote = remote;
      newMessage.instance = instanceId;

      GT.wsjtHandlers[newMessage.type](newMessage);
      if (GT.updateLastMsgTimer != null)
      {
        nodeTimers.clearTimeout(GT.updateLastMsgTimer);
      }
      GT.updateLastMsgTimer = nodeTimers.setTimeout(updateLastMsgTimeDiv, 500, newMessage.Id);
    }
  });
  GT.wsjtUdpServer.bind(port);
  GT.wsjtCurrentPort = port;
  GT.wsjtCurrentIP = GT.settings.app.wsjtIP;
}

// ---- Sending to WSJT-X ----

function wsjtUdpMessage(msg, length, port, address)
{
  if (GT.wsjtUdpServer)
  {
    GT.wsjtUdpServer.send(msg, 0, length, port, address);
  }
}

// ---- UDP forwarding ----

function startForwardListener()
{
  if (GT.forwardUdpServer != null)
  {
    GT.forwardUdpServer.close();
  }
  if (GT.closing == true) return;

  const dgram = window.require("dgram");
  GT.forwardUdpServer = dgram.createSocket({
    type: "udp4",
    reuseAddr: true
  });

  GT.forwardUdpServer.on("listening", function () { });
  GT.forwardUdpServer.on("error", function ()
  {
    GT.forwardUdpServer.close();
    GT.forwardUdpServer = null;
  });
  GT.forwardUdpServer.on("message", function (originalMessage, remote)
  {
    let offset = 0;
    const magicKey = originalMessage.readUInt32BE(offset);
    offset += 4;

    if (magicKey != 0xadbccbda) {
      return;
    }

    offset += 4; // schema_number
    offset += 4; // type

    const idLen = originalMessage.readUInt32BE(offset);
    offset += 4;

    const id = idLen === 0xffffffff ? "" : originalMessage.toString("utf8", offset, offset + idLen);

    if (id in GT.instances) {
      wsjtUdpMessage(
        originalMessage,
        originalMessage.length,
        GT.instances[id].remote.port,
        GT.instances[id].remote.address
      );
    }
  });
  GT.forwardUdpServer.bind(0);
}

function sendForwardUdpMessage(msg, length)
{
  if (GT.forwardUdpServer)
  {
    const port = GT.settings.app.wsjtForwardUdpPort;
    for (let i = 0; i < GT.forwardIPs.length; i++)
    {
      const host = GT.forwardIPs[i];
      if (!isForwardHostname(host))
      {
        GT.forwardUdpServer.send(msg, 0, length, port, host);
        continue;
      }
      // A hostname: sent to its cached address (no DNS per decode); none yet (or the last lookup failed): looked up,
      // at most every FORWARD_RESOLVE_RETRY_MS, and this message skipped
      const address = forwardHostAddress(host);
      if (!address) continue;
      // Its own callback: a failure drops the cached address (looked up again later) and doesn't close the socket
      GT.forwardUdpServer.send(msg, 0, length, port, address, (err) =>
      {
        if (err && GT.forwardHostCache[host] && GT.forwardHostCache[host].address == address)
        {
          GT.forwardHostCache[host].address = null;
        }
      });
    }
  }
}

// ---- Forward UDP Messages to hostnames: each name is looked up once and its address cached for an hour, or until a
// send fails ----
// host -> { address, expiresAt, pending, failed, retryAt }
GT.forwardHostCache = {};
const FORWARD_RESOLVE_RETRY_MS = 30000;
const FORWARD_RESOLVE_TTL_MS = 3600000;

function forwardHostAddress(host)
{
  const entry = GT.forwardHostCache[host];
  if (entry && entry.address)
  {
    // An hour old: looked up again in the background, the old address used meanwhile
    if (!entry.pending && Date.now() >= entry.expiresAt) resolveForwardHost(host);
    return entry.address;
  }
  if (!entry || (!entry.pending && Date.now() >= entry.retryAt)) resolveForwardHost(host);
  return null;
}

function resolveForwardHost(host)
{
  const entry = GT.forwardHostCache[host] || (GT.forwardHostCache[host] = { address: null, expiresAt: 0, pending: false, failed: false, retryAt: 0 });
  entry.pending = true;
  entry.retryAt = Date.now() + FORWARD_RESOLVE_RETRY_MS;
  window.require("dns").lookup(host, { family: 4 }, (err, address) =>
  {
    // A name removed from the setting meanwhile: forget it
    if (GT.forwardHostCache[host] !== entry) return;
    entry.pending = false;
    entry.failed = !!err;
    entry.address = err ? null : address;
    entry.expiresAt = err ? 0 : Date.now() + FORWARD_RESOLVE_TTL_MS;
    updateForwardResolveStatus();
  });
}

// Settings -> General -> Forward UDP Messages changed (setForwardIp): forget names no longer listed, look up the new
// ones now, so a name that can't be found (or no internet) is reported right away
function checkForwardHostnames()
{
  const names = GT.forwardIPs.filter((host) => isForwardHostname(host));
  for (const host in GT.forwardHostCache)
  {
    if (!names.includes(host)) delete GT.forwardHostCache[host];
  }
  for (const host of names)
  {
    if (!(host in GT.forwardHostCache)) resolveForwardHost(host);
  }
  updateForwardResolveStatus();
}

// The warning line in the Forward UDP Messages box: the names that couldn't be found
function updateForwardResolveStatus()
{
  if (typeof forwardResolveStatus == "undefined") return;
  const failed = Object.keys(GT.forwardHostCache).filter((host) => GT.forwardHostCache[host].failed);
  forwardResolveStatusRow.style.display = failed.length ? "" : "none";
  forwardResolveStatus.innerText = failed.length ? I18N("settings.general.Fwd.resolveFailed").replace("{0}", failed.join(", ")) : "";
}

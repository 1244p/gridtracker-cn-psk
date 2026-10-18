// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Log a POTA / SOTA QSO (from Matt's SOTA work): click a park or summit in the Feed Roster's POTA / SOTA column
// (feedHandLogAllowed in services/sota.js: no logger such as AC Log connected, no WSJT-X / JTDX on the spot's band and
// mode). For QSOs nothing else logs (CW, SSB). Prefilled from the row with its park and / or summit, every field
// editable; the main window logs it (logSotaChaseQso). Date and time are UTC

CR.sotaLog = { grid: "", closeTimer: null, busy: false };
// Modes whose signal reports are in dB, not RST
const SOTA_LOG_DB_MODES = new Set(["FT8", "FT4", "JT65", "JT9", "JT4", "Q65", "MSK144", "FST4", "FST4W", "JS8", "WSPR"]);

// Whether a row offers the dialog (the POTA and SOTA columns' click and hover): Feed Roster rows only
function sotaLogOffered(callObj)
{
  return isFeedRoster() && window.opener.feedHandLogAllowed(callObj);
}

function sotaLogStatus(message, isError)
{
  sotaLogStatusText.style.color = !message ? "#888" : (isError ? "#fa8" : "#8f8");
  sotaLogStatusText.textContent = message || "";
}

// The spot's frequency in MHz; 0 when it has none
function sotaLogFreqMhz(callObj)
{
  return callObj.freq > 0 ? callObj.freq / 1000000 : 0;
}

function openSotaLogDialog(hash)
{
  const entry = CR.callRoster[hash];
  const callObj = entry && entry.callObj;
  if (!callObj || !sotaLogOffered(callObj)) return;

  CR.sotaLog.grid = callObj.fullGrid || callObj.grid || "";
  CR.sotaLog.busy = false;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  sotaLogMyCall.value = GT.settings.app.myCall != "NOCALL" ? GT.settings.app.myCall : "";
  sotaLogCall.value = callObj.DEcall || "";
  sotaLogPark.value = window.opener.feedSpotPark(callObj);
  sotaLogRef.value = callObj.sota || "";
  // Now, not the spot's time: the QSO just happened (and can be corrected)
  sotaLogDate.value = now.getUTCFullYear() + "-" + pad(now.getUTCMonth() + 1) + "-" + pad(now.getUTCDate());
  sotaLogTime.value = pad(now.getUTCHours()) + ":" + pad(now.getUTCMinutes());
  const mhz = sotaLogFreqMhz(callObj);
  sotaLogFreq.value = mhz > 0 ? mhz.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") : "";
  // A band the row has stays selectable even if it isn't one of the map's bands
  const bands = Object.keys(GT.bandColors);
  if (callObj.band && !bands.includes(callObj.band)) bands.unshift(callObj.band);
  sotaLogBand.innerHTML = bands.map((band) => `<option value="${band}"${band === callObj.band ? " selected" : ""}>${band}</option>`).join("");
  const mode = (callObj.mode || "").toUpperCase();
  sotaLogMode.value = mode;
  // 59 phone; blank for the WSJT-style modes (their reports are dB); 599 for CW, RTTY, PSK and the like
  sotaLogRstS.value = sotaLogRstR.value = GT.modes_phone[mode] === true ? "59" : SOTA_LOG_DB_MODES.has(mode) ? "" : "599";
  sotaLogComment.value = "";

  sotaLogStatus("", false);
  sotaLogBox.style.display = "block";
  document.addEventListener("keydown", sotaLogKeyDown, true);
  sotaLogCall.focus();
}

function closeSotaLogDialog()
{
  if (CR.sotaLog.closeTimer)
  {
    clearTimeout(CR.sotaLog.closeTimer);
    CR.sotaLog.closeTimer = null;
  }
  sotaLogBox.style.display = "none";
  document.removeEventListener("keydown", sotaLogKeyDown, true);
  CR.sotaLog.busy = false;
}

// Esc cancels, Enter logs: it opens mid-QSO, so no reaching for the mouse
function sotaLogKeyDown(event)
{
  if (event.key === "Escape") { event.stopPropagation(); closeSotaLogDialog(); }
  else if (event.key === "Enter") { event.stopPropagation(); submitSotaLogQso(); }
}

// Band follows a typed frequency (left alone while it's half typed or out of band)
function sotaLogBandFromFreq()
{
  const mhz = Number(sotaLogFreq.value);
  if (!(mhz > 0)) return;
  const band = formatBand(mhz);
  if (band !== "OOB" && sotaLogBand.querySelector(`option[value="${band}"]`)) sotaLogBand.value = band;
}

function submitSotaLogQso()
{
  // Enter again while the confirmation shows would log it twice
  if (CR.sotaLog.busy) return;

  const result = window.opener.logSotaChaseQso({
    myCall: sotaLogMyCall.value,
    call: sotaLogCall.value,
    park: sotaLogPark.value,
    ref: sotaLogRef.value,
    dateUtc: sotaLogDate.value,
    timeUtc: sotaLogTime.value,
    freqMhz: sotaLogFreq.value.trim(),
    band: sotaLogBand.value,
    mode: sotaLogMode.value,
    rstSent: sotaLogRstS.value,
    rstRcvd: sotaLogRstR.value,
    comment: sotaLogComment.value,
    grid: CR.sotaLog.grid
  });
  if (!result || !result.ok)
  {
    sotaLogStatus(result ? result.message : "", true);
    return;
  }
  // The confirmation stays a moment, then the dialog closes (the roster repaints as the QSO is read back)
  CR.sotaLog.busy = true;
  sotaLogStatus(result.message, false);
  CR.sotaLog.closeTimer = setTimeout(closeSotaLogDialog, 1400);
}

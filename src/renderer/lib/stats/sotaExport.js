// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Logbook -> Export SOTA Chaser Log: the QSOs with a SOTA_REF between two times, in SOTA's chaser CSV upload layout
// (V2, my call, my summit (blank: chasing), date, time, band, mode, their call, their summit, notes; date and time in
// UTC). The dialog (gt_stats.html, #sotaExportBox) shows them first; edits and removed rows there change only the
// file, never the logbook. Each export remembers where it ended (app.sotaLastChaserExport) so the next one starts
// there, and the station of its newest QSO (app.sotaLastChaserExportCall), so a QSO on that very second isn't sent
// twice. From and To are the PC's local time; the file is UTC

GT.sotaExport = { rows: [] };

// SOTA's frequency field is a band label in MHz (QSOs reliably carry the band, not the frequency)
const SOTA_EXPORT_BANDS = {
  "2200m": "136kHz", "630m": "472kHz", "160m": "1.8MHz", "80m": "3.5MHz", "60m": "5MHz", "40m": "7MHz", "30m": "10MHz",
  "20m": "14MHz", "17m": "18MHz", "15m": "21MHz", "12m": "24MHz", "10m": "28MHz", "6m": "50MHz", "4m": "70MHz",
  "2m": "144MHz", "1.25m": "222MHz", "70cm": "432MHz", "33cm": "902MHz", "23cm": "1240MHz", "13cm": "2300MHz",
  "9cm": "3400MHz", "6cm": "5650MHz", "3cm": "10GHz"
};

function sotaExportWindow()
{
  return GT.statsWindowInitialized ? GT.statsWindowHandle.window : null;
}

function sotaExportDate(sec)
{
  const d = new Date(sec * 1000);
  return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCFullYear()).slice(-2);
}

function sotaExportTime(sec)
{
  const d = new Date(sec * 1000);
  return String(d.getUTCHours()).padStart(2, "0") + String(d.getUTCMinutes()).padStart(2, "0");
}

// <input type=datetime-local> values are local wall time
function sotaExportLocalInput(sec)
{
  if (!sec) return "";
  const d = new Date(sec * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

function sotaExportInputSeconds(value)
{
  const ms = value ? new Date(value).getTime() : NaN;
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

// The chases between fromSec and toSec, oldest first, as the strings the file gets
function sotaChaserQsos(fromSec, toSec)
{
  // The QSO that ended the last export, only while From is still exactly where that export ended (a range widened by
  // hand is a deliberate re-export)
  const lastSec = GT.settings.app.sotaLastChaserExport || 0;
  const lastCall = (fromSec && fromSec === lastSec) ? (GT.settings.app.sotaLastChaserExportCall || "") : "";
  const rows = [];
  for (const hash in GT.QSOhash)
  {
    const qso = GT.QSOhash[hash];
    if (!qso || !qso.sota) continue;
    const time = qso.time || 0;
    if ((fromSec && time < fromSec) || (toSec && time > toSec)) continue;
    if (lastCall && time === fromSec && String(qso.DEcall || "").toUpperCase() === lastCall) continue;
    rows.push({
      myCall: String(qso.DXcall || "").toUpperCase(),
      date: sotaExportDate(time),
      time: sotaExportTime(time),
      band: SOTA_EXPORT_BANDS[qso.band] || qso.band || "",
      mode: String(qso.mode || "").toUpperCase(),
      worked: String(qso.DEcall || "").toUpperCase(),
      summit: String(qso.sota || "").toUpperCase(),
      comment: qso.msg || "",
      at: time
    });
  }
  rows.sort((a, b) => a.at - b.at);
  return rows;
}

// Logbook header button (renderLogbookView, while SOTA Chasing is on)
function openSotaChaserExport()
{
  const win = sotaExportWindow();
  if (!win) return;
  win.sotaExportFrom.value = sotaExportLocalInput(GT.settings.app.sotaLastChaserExport || 0);
  win.sotaExportTo.value = sotaExportLocalInput(Math.floor(Date.now() / 1000));
  sotaExportPreview();
  win.sotaExportBox.style.display = "block";
}

function closeSotaChaserExport()
{
  const win = sotaExportWindow();
  if (win) win.sotaExportBox.style.display = "none";
}

function sotaExportPreview()
{
  const win = sotaExportWindow();
  if (!win) return;
  const toSec = sotaExportInputSeconds(win.sotaExportTo.value) || Math.floor(Date.now() / 1000);
  GT.sotaExport.rows = sotaChaserQsos(sotaExportInputSeconds(win.sotaExportFrom.value), toSec);
  renderSotaExportTable();
}

const SOTA_EXPORT_FIELDS = [["myCall", 6], ["date", 8], ["time", 5], ["band", 7], ["mode", 6], ["worked", 10], ["summit", 10], ["comment", 18]];

function renderSotaExportTable()
{
  const win = sotaExportWindow();
  if (!win) return;
  const rows = GT.sotaExport.rows;
  // The same station, summit, day, band and mode twice: highlighted, likely one QSO logged twice
  const dupKey = (row) => [row.worked, row.summit, row.date, row.band, row.mode].join("|");
  const counts = {};
  for (const row of rows) counts[dupKey(row)] = (counts[dupKey(row)] || 0) + 1;

  const escape = (text) => htmlEntities(String(text == null ? "" : text)).replace(/'/g, "&#39;");
  const html = ["<tr><th></th>" + ["myCall", "date", "time", "band", "mode", "worked", "summit", "comment"].map((key) =>
    `<th>${I18N("stats.sotaExport." + key)}</th>`).join("") + "</tr>"];
  for (let i = 0; i < rows.length; i++)
  {
    const dup = counts[dupKey(rows[i])] > 1;
    html.push(`<tr${dup ? ` class='sotaExportDup' title='${escape(I18N("stats.sotaExport.duplicate"))}'` : ""}>` +
      `<td align='center'><span class='sotaExportRemove' title='${escape(I18N("stats.sotaExport.remove"))}' onclick='window.opener.sotaExportDeleteRow(${i})'>&#10005;</span></td>` +
      SOTA_EXPORT_FIELDS.map(([field, size]) =>
        `<td><input class='inputTextValue' size='${size}' value='${escape(rows[i][field])}' oninput='window.opener.sotaExportEdit(${i}, "${field}", this.value)'></td>`).join("") +
      "</tr>");
  }
  win.sotaExportTable.innerHTML = html.join("");
  win.sotaExportCount.textContent = I18N("stats.sotaExport.count").replace("{0}", rows.length);
}

function sotaExportEdit(index, field, value)
{
  if (GT.sotaExport.rows[index]) GT.sotaExport.rows[index][field] = value;
}

function sotaExportDeleteRow(index)
{
  GT.sotaExport.rows.splice(index, 1);
  renderSotaExportTable();
}

function sotaCsvField(value)
{
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function sotaChaserCsv(rows)
{
  return rows.map((row) => ["V2", sotaCsvField(row.myCall), "", sotaCsvField(row.date), sotaCsvField(row.time), sotaCsvField(row.band),
    sotaCsvField(row.mode), sotaCsvField(row.worked), sotaCsvField(row.summit), sotaCsvField(row.comment)].join(",")).join("\r\n") + "\r\n";
}

function doSotaChaserExport()
{
  const win = sotaExportWindow();
  if (!win) return;
  const rows = GT.sotaExport.rows;
  if (!rows.length)
  {
    win.alert(I18N("stats.sotaExport.none"));
    return;
  }

  const myCall = (rows[0].myCall || "chaser").replace(/[^A-Z0-9]/gi, "");
  const stamp = sotaExportLocalInput(Math.floor(Date.now() / 1000)).replace("T", "_").replace(":", "");
  const result = electron.ipcRenderer.sendSync("saveTextFile", {
    title: I18N("stats.sotaExport.title"),
    defaultPath: `SOTA_chaser_${myCall}_${stamp}.csv`,
    content: sotaChaserCsv(rows),
    filters: [{ name: "CSV", extensions: ["csv"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (result && result.error)
  {
    win.alert(I18N("stats.sotaExport.failed").replace("{0}", result.error));
    return;
  }
  // Cancelled
  if (!result) return;

  // The next export starts where this one ended, without the newest QSO it sent
  GT.settings.app.sotaLastChaserExport = sotaExportInputSeconds(win.sotaExportTo.value) || Math.floor(Date.now() / 1000);
  let newest = null;
  for (const row of rows)
  {
    if (!newest || row.at > newest.at) newest = row;
  }
  GT.settings.app.sotaLastChaserExportCall = newest ? newest.worked : "";
  saveGridTrackerSettings();

  closeSotaChaserExport();
  addLastTraffic("<font style='color:lightgreen;'>" + I18N("stats.sotaExport.done").replace("{0}", rows.length) + "</font>");
}

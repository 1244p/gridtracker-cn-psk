const DEFAULT_COLUMN_ORDER = [
  "Callsign", "Band", "Mode", "Calling", "Spotter", "CQ", "Rig", "Wanted", "Grid", "Msg",
  "POTA", "SOTA", "DXCC", "DEDXCCv2", "Flag", "DXM", "State", "County", "Cont", "DEContv2",
  "dB", "Freq", "DT", "Dist", "Azim",
  "CQz", "ITUz", "PX",
  "LoTW", "eQSL", "OQRS",
  "Life", "Spot",  "Age", "UTC"
]

// Column colors (6-digit hex, no "#") are in each roster's own settings, CR.rosterSettings.colors, defaulting to
// k_callRosterColumnColors / k_feedRosterColumnColors in defaults.js and edited in Settings -> Colors. Saved colors end up in HTML style attributes,
// so only plain 6-digit hex is used; anything else falls back to the default
const ROSTER_COLOR_REGEXP = /^[0-9A-Fa-f]{6}$/;

// "#RRGGBB" for this roster's column
function rosterColor(column)
{
  const saved = CR.rosterSettings.colors && CR.rosterSettings.colors[column];
  if (typeof saved === "string" && ROSTER_COLOR_REGEXP.test(saved)) return "#" + saved;
  return "#" + (window.opener.defaultRosterColors(CR.profile.name)[column] || "EEEEEE");
}

// Feed Roster: ▲ before the callsign when a rig on the spot's band and mode can work it
function markWorkableFeed(callObj, html)
{
  return (isFeedRoster() && callObj.onRig) ? "&#9650;" + html : html;
}

const getterSimpleComparer = (getter) => (a, b) =>
{
  const aVal = getter(a);
  const bVal = getter(b);

  if (aVal == null) return 1;
  if (bVal == null) return -1;
  if (aVal > bVal) return 1;
  if (aVal < bVal) return -1;
  return 0;
}

const callObjSimpleComparer = (attr) => getterSimpleComparer((elem) => elem.callObj[attr])

const callObjLocaleComparer = (attr) => (a, b) =>
{
  if (a.callObj[attr] == null) return 1;
  if (b.callObj[attr] == null) return -1;
  return a.callObj[attr].localeCompare(b.callObj[attr]);
}

const callObjLocaleComparerWithRR73 = (attr) => (a, b) =>
{
  let valA = a.callObj[attr];
  if (a.callObj.CQ) valA = "0" + valA;
  if (CR.activeExceptions.wantRRCQ && a.callObj.RR73) {
    valA = "0CQ" + a.callObj.RR73;
  }

  let valB = b.callObj[attr];
  if (b.callObj.CQ) valB = "0" + valB;
  if (CR.activeExceptions.wantRRCQ && b.callObj.RR73) {
    valB = "0CQ" + b.callObj.RR73;
  }

  if (valA == null) return 1;
  if (valB == null) return -1;

  return valA.localeCompare(valB);
}

const ROSTER_COLUMNS = {

  Callsign: {
    compare: callObjLocaleComparer("DEcall"),
    tableHeader: () => ({ align: "left" }),
    tableData: (callObj) =>
    {
      let attrs = {
        title: callObj.awardReason,
        name: "Callsign",
        align: "left",
        onClick: `initiateQso("${callObj.hash}")`,
        rawAttrs: callObj.style.call,
        html: markWorkableFeed(callObj, formatCallsign((callObj.DEcallHTML || callObj.DEcall)))
      }

      let acks = GT.acknowledgedCalls || {};
      if (acks[callObj.DEcall])
      {
        attrs.html = `${attrs.html} <span class='acknowledged'><img class='ackBadge' src='img/emojis/${acks[callObj.DEcall].b}.png'></span>`
        attrs.title = `${acks[callObj.DEcall].message}`
      }

      return attrs
    }
  },

  Rig: {
    compare: callObjSimpleComparer("instance"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("Rig")};`,
      html: callObj.instance
    })
  },

  Band: {
    compare: callObjSimpleComparer("band"),
    tableData: (callObj) => ({
      style: `color: #${GT.bandColors[callObj.band]};`,
      html: callObj.band
    })
  },

  Mode: {
    compare: callObjSimpleComparer("mode"),
    tableData: (callObj) => ({
      style: `color: #${GT.modeColors[callObj.mode] || "FFFFFF"};`,
      html: callObj.mode
    })
  },

  Grid: {
    compare: callObjSimpleComparer("grid"),
    tableData: (callObj) => {
      const grid = callObj.grid ? callObj.grid.substring(0, 4) : "";
      return {
        rawAttrs: callObj.style.grid,
        onClick: `centerOn("${callObj.grid}")`,
        name: "Grid",
        html: (grid.length > 0 ? (!callObj.gridQualified ? `${grid} ◇` : (callObj.gridHTML ? callObj.gridHTML.replace(callObj.grid, grid) : grid)) : "&nbsp;")
      };
    }
  },

  Calling: {
    compare: callObjLocaleComparerWithRR73("DXcall"),
    tableData: (callObj) => ({
      rawAttrs: callObj.style.calling,
      name: callObj.CQ ? "CQ" : "Calling",
      html: (CR.activeExceptions.wantRRCQ && callObj.RR73) ? callObj.RR73 : formatCallsign(callObj.DXcallHTML || callObj.DXcall)
    })
  },

  // Feed Roster (in place of Calling): ✔ when the spot's comment says the station is calling CQ
  CQ: {
    compare: callObjSimpleComparer("CQ"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("CQ")};`,
      align: "center",
      html: callObj.CQ ? "&#10004;" : "&nbsp;"
    })
  },

  // Station that reported a DX Cluster / CW Skimmer spot; blank for WSJT-X decodes
  Spotter: {
    label: () => I18N("rosterColumns.Spotter.header"),
    compare: callObjLocaleComparer("spotter"),
    tableHeader: () => ({ html: I18N("rosterColumns.Spotter.header"), title: I18N("rosterColumns.Spotter.title") }),
    tableData: (callObj) => ({
      name: "Spotter",
      style: `color: ${rosterColor("Spotter")};`,
      html: callObj.spotter ? formatCallsign(callObj.spotterHTML || callObj.spotter) : "&nbsp;"
    })
  },

  Msg: {
    compare: callObjLocaleComparer("DXcall"),
    tableData: (callObj) => ({
      name: "Msg",
      // Shortened on screen only (a long feed spot comment ends in "…"), the whole message on hover; Watcher
      // matches inside it keep their own highlight
      class: "msgCol",
      title: callObj.msg,
      style: `color: ${rosterColor("Msg")};`,
      // The width limit is on this wrapper: a table cell's max-width is only a hint to the table layout
      html: `<div class="msgCut">${callObj.msgHTML || htmlEntities(callObj.msg)}</div>`
    })
  },

  // The Feed Roster calls it "DX DXCC", next to its "DE DXCC" (the spotter's)
  DXCC: {
    label: () => isFeedRoster() ? I18N("rosterColumns.DXCC.feedHeader") : "DXCC",
    compare: (a, b) => window.opener.myDxccCompare(a.callObj, b.callObj),
    tableHeader: () => ({ html: isFeedRoster() ? I18N("rosterColumns.DXCC.feedHeader") : "DXCC" }),
    tableData: (callObj) =>
    {
      const marks = dxccNewMarks(callObj);
      return {
        title: GT.dxccInfo[callObj.dxcc].pp + marks.title,
        name: `DXCC (${callObj.dxcc})`,
        rawAttrs: callObj.style.dxcc,
        // Like Grid: click centers the map on the entity and dazzles it (not in compact mode, where the tile click starts a QSO)
        onClick: CR.rosterSettings.compact ? null : `centerOnDxcc(${callObj.dxcc})`,
        html: marks.before + GT.dxccToAltName[callObj.dxcc] + marks.after
      };
    }
  },

  // Feed Roster: DXCC entity of the station that reported the spot. The key has "v2" because its default changed to
  // shown: saved settings for the old "DEDXCC" key are dropped at startup (GridTracker2.js)
  DEDXCCv2: {
    label: () => I18N("rosterColumns.DEDXCC.header"),
    compare: getterSimpleComparer((elem) => elem.callObj.spotterDxcc > 0 ? GT.dxccToAltName[elem.callObj.spotterDxcc] : null),
    tableHeader: () => ({ html: I18N("rosterColumns.DEDXCC.header"), title: I18N("rosterColumns.DEDXCC.title") }),
    tableData: (callObj) => ({
      title: callObj.spotterDxcc > 0 ? GT.dxccInfo[callObj.spotterDxcc].pp : "",
      name: "DEDXCC",
      // Like DX DXCC: click centers the map on the spotter's entity and dazzles it (not in compact mode)
      style: `color: ${rosterColor("DEDXCCv2")};` + ((CR.rosterSettings.compact || !(callObj.spotterDxcc > 0)) ? "" : " cursor: pointer;"),
      onClick: (CR.rosterSettings.compact || !(callObj.spotterDxcc > 0)) ? null : `centerOnDxcc(${callObj.spotterDxcc})`,
      html: callObj.spotterDxcc > 0 ? GT.dxccToAltName[callObj.spotterDxcc] : "&nbsp;"
    })
  },

  DXM: {
    compare: callObjSimpleComparer("dxm"),
    tableData: (callObj) => ({
      align: "center",
      rawAttrs: callObj.style.dxm,
      html: callObj.dxm ? callObj.dxm : "&nbsp;"
    })
  },

  Flag: {
    compare: (a, b) => window.opener.myDxccCompare(a.callObj, b.callObj),
    tableData: (callObj) => ({
      align: "center",
      style: "margin:0; padding:0;",
      html: `<img style='margin-bottom:-3px;height:14px' src='img/flags/16/${GT.dxccInfo[callObj.dxcc].flag}'>`
    })
  },

  State: {
    compare: callObjSimpleComparer("state"),
    tableData: (callObj) => ({
      align: "center",
      rawAttrs: callObj.style.state,
      html: callObj.state ? callObj.state.substr(3) : "&nbsp;",
      title: (callObj.state in GT.StateData) ? GT.StateData[callObj.state].name : null
    })
  },

  County: {
    // Not sure why this comparison uses substring, but this is what the original code did
    // Because we're sorting on the county name, the data contains  "CO,Adams", we don't want to sort by state.
    compare: getterSimpleComparer((elem) => elem.callObj.cnty && elem.callObj.cnty.substr(3)),
    tableData: (callObj) =>
    {
      let attrs = {
        align: "center",
        rawAttrs: callObj.style.cnty,
        html: callObj.cnty ? GT.cntyToCounty[callObj.cnty] : "&nbsp;"
      }
      if (callObj.cnty && callObj.cntyQual == false)
      {
        attrs.title = I18N("rosterColumns.County.title")
        attrs.onClick = `window.opener.lookupCallsign("${callObj.DEcall}", "${callObj.grid}")`
        attrs.html = attrs.html + " +" + String(GT.zipToCounty[callObj.zipcode].length - 1)
      }
      return attrs
    }
  },

  // The Feed Roster calls it "DX Cont", next to its "DE Cont" (the spotter's)
  Cont: {
    label: () => isFeedRoster() ? I18N("rosterColumns.Cont.feedHeader") : "Cont",
    compare: callObjSimpleComparer("cont"),
    tableHeader: () => ({ html: isFeedRoster() ? I18N("rosterColumns.Cont.feedHeader") : "Cont" }),
    tableData: (callObj) => ({
      align: "center",
      rawAttrs: callObj.style.cont,
      html: callObj.cont ? callObj.cont : "&nbsp;"
    })
  },

  // Feed Roster: continent of the station that reported the spot ("v2": see DEDXCCv2)
  DEContv2: {
    label: () => I18N("rosterColumns.DECont.header"),
    compare: callObjSimpleComparer("spotterCont"),
    tableHeader: () => ({ html: I18N("rosterColumns.DECont.header"), title: I18N("rosterColumns.DECont.title") }),
    tableData: (callObj) => ({
      align: "center",
      // Right-click: Ignore DE Cont
      name: "DECont",
      style: `color: ${rosterColor("DEContv2")};`,
      html: callObj.spotterCont || "&nbsp;"
    })
  },

  dB: {
    compare: callObjSimpleComparer("RSTsent"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("dB")};`,
      html: `<b>${callObj.RSTsent}</b>`
    })
  },

  Freq: {
    compare: callObjSimpleComparer("delta"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("Freq")};`,
      html: callObj.instance === GT.feedInstance ? (callObj.freq > 0 ? formatMhz(callObj.freq / 1000) : "&nbsp;") : callObj.delta
    })
  },

  DT: {
    compare: callObjSimpleComparer("dt"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("DT")};`,
      html: callObj.instance === GT.feedInstance ? "&nbsp;" : callObj.dt
    })
  },

  Dist: {
    compare: callObjSimpleComparer("distance"),
    tableHeader: () => ({ html: `Dist (${window.opener.distanceUnit.value.toLowerCase()})` }),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("Dist")};`,
      html: (callObj.distance > 0 ? Math.round(callObj.distance * MyCircle.validateRadius(window.opener.distanceUnit.value)) : "&nbsp;")
    })
  },

  Azim: {
    compare: callObjSimpleComparer("heading"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("Azim")};`,
      html: (callObj.distance > 0 ? Math.round(callObj.heading) : "&nbsp;")
    })
  },

  CQz: {
    compare: callObjSimpleComparer("cqz"),
    tableData: (callObj) => ({
      name: "CQz",
      rawAttrs: callObj.style.cqz,
      html: callObj.cqz
    })
  },

  ITUz: {
    compare: callObjSimpleComparer("ituz"),
    tableData: (callObj) => ({
      name: "ITUz",
      rawAttrs: callObj.style.ituz,
      html: callObj.ituz
    })
  },

  PX: {
    compare: callObjSimpleComparer("px"),
    tableData: (callObj) => ({
      rawAttrs: callObj.style.px,
      html: callObj.px ? callObj.px : "&nbsp;"
    })
  },

  LoTW: {
    compare: false,
    tableData: (callObj) =>
    {
      if (callObj.DEcall in GT.lotwCallsigns)
      {
        if (CR.activeExceptions.maxLoTW < 27)
        {
          let months = (CR.day - GT.lotwCallsigns[callObj.DEcall]) / 30;
          if (months > CR.activeExceptions.maxLoTW)
          {
            return {
              style: "color: yellow;",
              align: "center",
              title: `${I18N("rosterColumns.LoTW.NoUpdate")} ${toYM(Number(months))}`,
              html: "?"
            }
          }
          else
          {
            return {
              style: `color: ${rosterColor("LoTW")};`,
              align: "center",
              title: `${I18N("rosterColumns.LoTW.LastUpdate")}${
                window.opener.userDayString(GT.lotwCallsigns[callObj.DEcall] * 86400000)
              }`,
              html: "&#10004;"
            }
          }
        }
        else
        {
          return {
            style: `color: ${rosterColor("LoTW")};`,
            align: "center",
            title: `${I18N("rosterColumns.LoTW.LastUpdate")}${
              window.opener.userDayString(GT.lotwCallsigns[callObj.DEcall] * 86400000)
            }`,
            html: "&#10004;"
          }
        }
      }
      else
      {
        return {
          html: "&nbsp;"
        }
      }
    }
  },

  eQSL: {
    compare: false,
    tableData: (callObj) => ({
      style: `color: ${rosterColor("eQSL")};`,
      align: "center",
      html: (callObj.DEcall in GT.eqslCallsigns ? "&#10004;" : "&nbsp;")
    })
  },

  OQRS: {
    compare: false,
    tableData: (callObj) => ({
      style: `color: ${rosterColor("OQRS")};`,
      align: "center",
      html: (callObj.DEcall in GT.oqrsCallsigns ? "&#10004;" : "&nbsp;")
    })
  },

  Life: {
    compare: callObjSimpleComparer("life"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("Life")};`,
      class: "lifeCol",
      id: `lm${callObj.hash}`,
      html: toDHMS(timeNowSec() - callObj.life)
    })
  },

  UTC: {
    compare: callObjSimpleComparer("age"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("UTC")};`,
      html: (callObj.even ? "<font style='text-decoration: underline'>" : "") + callObj.UTC + (callObj.even ? "</font>" : "")
    })
  },

  Age: {
    compare: callObjSimpleComparer("age"),
    tableData: (callObj) => ({
      style: `color: ${rosterColor("Age")};`,
      class: "timeCol",
      id: `tm${callObj.hash}`,
      html: toDHMS(timeNowSec() - callObj.age)
    })
  },

  Spot: {
    compare: (a, b) =>
    {
      let cutoff = timeNowSec() - GT.settings.reception.viewHistoryTimeSec;

      if (a.callObj.spot.when <= cutoff) return -1;
      if (b.callObj.spot.when <= cutoff) return 1;

      let aSNR = Number(a.callObj.spot.snr);
      let bSNR = Number(b.callObj.spot.snr);

      if (aSNR > bSNR) return 1;
      if (aSNR < bSNR) return -1;

      if (a.callObj.spot.when > b.callObj.spot.when) return 1;
      if (a.callObj.spot.when < b.callObj.spot.when) return -1;

      return 0;
    },
    tableData: (callObj) => ({
      style: `color: ${rosterColor("Spot")};`,
      class: "spotCol",
      id: `sp${callObj.hash}`,
      html: getSpotString(callObj)
    })
  },

  POTA: {
    compare: callObjSimpleComparer("pota"),
    tableData: (callObj) => ({
      name: "POTA",
      rawAttrs: callObj.style.pota,
      title: potaColumnHover(callObj),
      // Feed Roster: log the QSO by hand, as for a summit (roster/sotaLogDialog.js)
      onclick: callObj.pota && sotaLogOffered(callObj) ? `openSotaLogDialog("${callObj.hash}")` : null,
      html: potaColumnRef(callObj)
    })
  },

  // While SOTA Chasing is on: the summit from a feed spot's note, or the one a decoded activator is spotted on
  SOTA: {
    compare: callObjSimpleComparer("sota"),
    tableData: (callObj) => ({
      name: "SOTA",
      rawAttrs: callObj.style.sota,
      title: sotaColumnHover(callObj),
      // Feed Roster: log the chase by hand while no logger is connected and no WSJT-X / JTDX is on its band and mode
      // (roster/sotaLogDialog.js)
      onclick: callObj.sota && sotaLogOffered(callObj) ? `openSotaLogDialog("${callObj.hash}")` : null,
      html: callObj.sota ? sotaColumnRef(callObj.sota) : "&nbsp;"
    })
  },

  Wanted: {
    compare: (a, b) => wantedColumnComparer(a.callObj, b.callObj),
    tableData: (callObj) => ({
      class: "wantedCol",
      style: `color: ${rosterColor("Wanted")};`,
      title: wantedColumnParts(callObj).map(entry => `• ${entry}`).join("\n"),
      html: wantedColumnParts(callObj).join(" - ", { html: true })
    })
  }
}

// DXCC column marks, whatever the Logbook choice, from everything worked: a star each side of an entity never worked
// (ATNO), else after it a diamond if it hasn't been worked on this band and a dot if not in this (exact) mode; the
// hover says which
function dxccNewMarks(callObj)
{
  if (!(callObj.dxcc > 0)) return { before: "", after: "", title: "" };
  const worked = GT.tracker.worked.dxcc;
  const base = callObj.dxcc + "|";
  if (!(base in worked))
  {
    const star = "<span class='dxccNew'>★</span>";
    return { before: star + " ", after: " " + star, title: "\n" + I18N("rosterColumns.DXCC.atno") };
  }
  let marks = "";
  let title = "";
  if (callObj.band && !((base + callObj.band) in worked))
  {
    marks += "◆";
    title += "\n" + I18N("rosterColumns.DXCC.newBand").replace("{0}", callObj.band);
  }
  if (callObj.mode && !((base + callObj.mode) in worked))
  {
    marks += "●";
    title += "\n" + I18N("rosterColumns.DXCC.newMode").replace("{0}", callObj.mode);
  }
  return { before: "", after: marks ? ` <span class='dxccNew'>${marks}</span>` : "", title };
}

function potaColumnRef(callObj)
{
  if (callObj.pota)
  {
    return callObj.pota;
  }
  else
  {
    return "&nbsp;";
  }
}

function potaColumnHover(callObj)
{
  let value = "";

  if (callObj.pota in GT.pota.parks)
  {
    value += callObj.pota + " - " + GT.pota.parks[callObj.pota].name + "\n";
  }  if (callObj.pota && sotaLogOffered(callObj)) value += I18N("sotaLog.hint");

  return value;
}

// A summit reference with dots for what it's worth to you (from Matt's SOTA work): before it, two dots for an
// association you've chased no summit in, one for an association with one; after it, a dot for a region you've chased
// no summit in. A reference that doesn't parse gets none
function sotaColumnRef(ref)
{
  const parts = window.opener.sotaRefParts(ref);
  const worked = GT.tracker.worked;
  if (!parts || !worked.sotaAssoc) return ref;
  const assocChased = worked.sotaAssoc[parts.assoc] || 0;
  const regionChased = worked.sotaRegion[parts.region] || 0;
  const dots = (count) => count > 0 ? `<span class='sotaMark'>${"<i></i>".repeat(count)}</span>` : "";
  const assocDots = dots(assocChased == 0 ? 2 : assocChased == 1 ? 1 : 0);
  const regionDots = dots(regionChased == 0 ? 1 : 0);
  return (assocDots ? assocDots + " " : "") + ref + (regionDots ? " " + regionDots : "");
}

// Like the POTA hover: "W7O/NC-039 - Clatskanie Mountain" then "2080 ft, Points: 1" (from SOTA's summit list; the height
// in the main window's distance units), then how many summits you've chased in its association and region
function sotaColumnHover(callObj)
{
  const summit = callObj.sota && GT.sota.summits[callObj.sota];
  if (!summit) return "";
  let text = callObj.sota + " - " + summit.name + "\n" + window.opener.sotaHeightText(summit.alt) + ", " + I18N("rosterColumns.SOTA.points").replace("{0}", summit.points);
  const parts = window.opener.sotaRefParts(callObj.sota);
  const worked = GT.tracker.worked;
  if (parts && worked.sotaAssoc)
  {
    text += "\n" + I18N("rosterColumns.SOTA.chased")
      .replace("{0}", worked.sotaAssoc[parts.assoc] || 0).replace("{1}", parts.assoc)
      .replace("{2}", worked.sotaRegion[parts.region] || 0).replace("{3}", parts.region);
  }
  if (sotaLogOffered(callObj)) text += "\n" + I18N("sotaLog.hint");
  return text;
}

WANTED_ORDER = ["call", "qrz", "watcher", "cont", "dxcc", "cqz", "ituz", "dxm", "state", "pota", "sota", "grid", "cnty", "wpx"];
WANTED_LABELS = {};

function wantedColumnParts(callObj, options)
{
  options = options || {};

  if (Object.keys(callObj.hunting).length == 0)
  {
    let sendBlank = (typeof options.html != "undefined" && options.html == true);
    return [(sendBlank ? "&nbsp;" : "")];
  }

  let parts = [];

  WANTED_ORDER.forEach(field =>
  {
    let wanted = callObj.hunting[field];

    if (wanted == "calling") { parts.push("Calling"); }
    // else if (wanted == "caller") { parts.push("Called"); }
    else if (wanted == "hunted" && field == "qrz") { parts.push("Caller"); }

    else if (wanted == "hunted" && field == "watcher") { parts.push(callObj.watcherKey); }
    else if (wanted == "hunted") { parts.push(`${options.html ? "<b>" : ""}New ${WANTED_LABELS[field]}${options.html ? "<b>" : ""}`); }
    else if (wanted == "worked") { parts.push(`Worked ${WANTED_LABELS[field]}`); }
    else if (wanted == "mixed") { parts.push(`${callObj.band} ${WANTED_LABELS[field]}`); }
    else if (wanted == "mixed-worked") { parts.push(`${callObj.band} ${WANTED_LABELS[field]}`); parts.push(`Worked ${WANTED_LABELS[field]}`); }
    else if (wanted == "worked-and-mixed") { parts.push(`Worked ${callObj.band} ${WANTED_LABELS[field]}`); }
  })

  if (parts[0] == "Calling" && parts[1] == "Caller")
  {
    parts.shift(); parts.shift();
    parts.unshift(`${options.html ? "<b>" : ""}Working${options.html ? "<b>" : ""}`);
  }

  return parts;
}

function wantedColumnWeighter(callObj, field)
{
  let wanted = callObj.hunting[field];

  // We use negative numbers so that sorting is "reversed" by default, placing most interesting items up top.
  if (wanted == "calling" || wanted == "caller") return -10;
  else if (wanted == "hunted") return -5;
  else if (wanted == "worked") return -4;
  else if (wanted == "mixed") return -3;
  else if (wanted == "mixed-worked") return -2;
  else if (wanted == "worked-and-mixed") return -1;
  else return 0;
}

function wantedColumnComparer(a, b)
{
  if (!a.hunting) return 1;
  if (!b.hunting) return -1;

  for (const index in WANTED_ORDER)
  {
    const field = WANTED_ORDER[index];
    const aWeight = wantedColumnWeighter(a, field);
    const bWeight = wantedColumnWeighter(b, field);

    if (aWeight < bWeight) return 1;
    if (aWeight > bWeight) return -1;
  }
  return 0;
}

function renderRoster(callRoster, rosterSettings)
{
  let columnOverrides = {
    Callsign: true
  }

  let visibleCallList = [];
  for (const entry in callRoster)
  {
    // entry should populate in general
    if (callRoster[entry].tx == true)
    {
      visibleCallList.push(callRoster[entry]);
    }
  }

  const feedRoster = isFeedRoster();
  // The Feed Roster's "heard" leaves out the spots its Ignores hide (processRosterFiltering), so the gap to "in roster"
  // is only what its filters and exceptions hide
  let totalCount = 0;
  for (const entry in callRoster)
  {
    if (!(feedRoster && callRoster[entry].ignored)) totalCount++;
  }
  let visibleCount = visibleCallList.length;
  let huntedCount = visibleCallList.filter(obj => Object.keys(obj.callObj.hunting).length > 0).length
  let countParts = [];

  if (totalCount != visibleCount)
  {
    countParts.push(`${totalCount} heard`);
  }

  countParts.push(`${visibleCount} in roster`);

  if (huntedCount != visibleCount)
  {
    countParts.push(`${huntedCount} wanted`);
  }

  window.document.title = `${feedRoster ? "Feed Roster" : "Call Roster"}: ${countParts.join(" • ")}`;
  let multiInstance = false;
  if (!feedRoster && listShortInstances().length > 0)
  {
    window.document.title += " | " + listShortInstances().join(" • ");
    multiInstance = true;
  }
  let multiBand = Object.keys(rosterSettings.bands).length > 1;
  let showBands = (CR.rosterSettings.columns.Band || multiBand);
  let showModes = (CR.rosterSettings.columns.Mode || (Object.keys(rosterSettings.modes).length > 1));

  columnOverrides.Band = showBands;
  columnOverrides.Mode = showModes;
  // The Feed Roster's SOTA column only while SOTA Chasing is on
  if (!sotaActive()) columnOverrides.SOTA = false;
  const rosterColumns = rosterColumnList(CR.rosterSettings.columns, columnOverrides);

  if (CR.rosterSettings.compact)
  {
    sortCallList(visibleCallList, "Age", false, rosterColumns);
  }
  else
  {
    sortCallList(visibleCallList, CR.rosterSettings.sortColumn, CR.rosterSettings.sortReverse);
  }

  let html = [CR.rosterSettings.compact ? renderCompactRosterHeaders() : renderNormalRosterHeaders(rosterColumns)];

  // The roster table only puts the rows in view into the page (renderVirtualRoster): a roster can hold many hundreds
  // of entries, and laying them all out on every update is most of its cost. The compact view is drawn whole
  const virtual = !CR.rosterSettings.compact;
  const virtualRows = [];

  // Feed spots can only be worked from a rig already on their band and mode (WSJT-X, JTDX or AC Log)
  const workableFeeds = feedRoster ? feedRigBandModes().bandModes : {};

  // Feed Roster: the calls in a rig's DX Call (any WSJT-X / JTDX, AC Log's entry tab), highlighted green like the Call
  // Roster's (no red: transmitting is that rig's own business)
  const rigDXcalls = feedRoster ? window.opener.rigDXcallSet() : {};
  // The same for every row, so asked once per render: a click off every rig's band and mode can go somewhere (a
  // connected AC Log, else Gen Msgs on the active WSJT-X / JTDX); and the row tooltips' text
  const feedClickable = feedRoster && window.opener.feedSpotClickable(null);
  const feedSpottedText = feedRoster ? I18N("renderRoster.feedSpotted") : "";
  const feedReadOnlyText = feedRoster ? I18N("renderRoster.feedReadOnly") : "";

  // Third loop: render all rows
  for (const x in visibleCallList)
  {
    let callObj = visibleCallList[x].callObj;

    // TODO: This is filtering
    if (callObj.shouldRosterAlert == false && rosterSettings.onlyHits == true && callObj.qrz == false)
    { continue; }

    let rowClass = "";
    let rowTitle = "";

    if (feedRoster)
    {
      // ▲: a rig is on the spot's band and mode. Other spots go to a connected AC Log, else Gen Msgs on the active
      // WSJT-X / JTDX, so those can be clicked as well, without the ▲
      callObj.onRig = (callObj.band + "|" + callObj.mode) in workableFeeds;
      callObj.readOnly = !callObj.onRig && !feedClickable;
      if (!callObj.readOnly)
      {
        rowTitle = feedSpottedText.replace("{spotter}", callObj.spotter);
      }
      else
      {
        rowClass = "feedReadOnly";
        rowTitle = feedReadOnlyText.replace("{spotter}", callObj.spotter).replace("{band}", callObj.band).replace("{mode}", callObj.mode);
      }
      rowTitle = htmlEntities(rowTitle).replace(/'/g, "&#39;");
      if (callObj.DEcall in rigDXcalls) callObj.style.call = "class='dxCaller'";
    }
    else if (callObj.DEcall == GT.instances[callObj.instance].status.DXcall)
    {
      if (GT.instances[callObj.instance].status.TxEnabled == 1)
      {
        callObj.style.call = "class='dxCalling'";
      }
      else
      {
        callObj.style.call = "class='dxCaller'";
      }
    }

    if (virtual)
    {
      virtualRows.push({ callObj, rowClass, rowTitle });
      continue;
    }
    html.push(CR.rosterSettings.compact ? renderCompactRosterRow(callObj, multiInstance || multiBand, rowClass, rowTitle) : renderNormalRosterRow(rosterColumns, callObj, rowClass, rowTitle));
  }

  if (virtual)
  {
    CR.virtualRoster = { rows: virtualRows, columns: rosterColumns, header: html[0].replace("class='rosterTable'", "class='rosterTable virtualRoster'"), first: 0, last: 0 };
    renderVirtualRoster();
    return;
  }
  CR.virtualRoster = null;

  html.push(CR.rosterSettings.compact ? renderCompactRosterFooter() : renderNormalRosterFooter());

  RosterTable.innerHTML = html.join("");
}

// ---- Roster virtual scrolling (normal view, both rosters) ----
// The rows from VIRTUAL_ROSTER_BUFFER above the window to as many below are in the page; spacer rows stand in for the
// rest, so the window (rosterBody) scrolls the whole list. Rows are one line (nowrap) of one height (table.virtualRoster
// in style_roster.css), measured from the rows drawn. Columns fit the rows drawn, so they can change width as the
// roster scrolls (like the Logbook)
const VIRTUAL_ROSTER_BUFFER = 20;
CR.virtualRoster = null;
CR.virtualRowHeight = 18;
CR.virtualHeaderHeight = 22;
CR.virtualScrollQueued = false;
CR.virtualScrollHooked = false;

// The rows the window shows now ({ shownFirst, shownLast }) and the range to draw, with the buffer ({ first, last });
// last indexes are exclusive
function virtualRosterRange(v)
{
  const rowHeight = CR.virtualRowHeight;
  const rowsTop = RosterTable.offsetTop + CR.virtualHeaderHeight;
  const viewTop = rosterBody.scrollTop - rowsTop;
  const count = v.rows.length;
  const shownFirst = Math.max(0, Math.min(count, Math.floor(viewTop / rowHeight)));
  const shownLast = Math.max(shownFirst, Math.min(count, Math.ceil((viewTop + rosterBody.clientHeight) / rowHeight)));
  return {
    shownFirst,
    shownLast,
    first: Math.max(0, shownFirst - VIRTUAL_ROSTER_BUFFER),
    last: Math.min(count, shownLast + VIRTUAL_ROSTER_BUFFER)
  };
}

function virtualSpacerRow(height, columns)
{
  return `<tr class='virtualSpacer' style='height:${height}px;'><td colspan='${columns}'></td></tr>`;
}

function renderVirtualRoster()
{
  const v = CR.virtualRoster;
  if (!v) return;
  if (!CR.virtualScrollHooked)
  {
    CR.virtualScrollHooked = true;
    rosterBody.addEventListener("scroll", virtualRosterScrolled, { passive: true });
    window.addEventListener("resize", virtualRosterScrolled);
  }

  const { first, last } = virtualRosterRange(v);
  v.first = first;
  v.last = last;

  const html = [v.header];
  if (first > 0) html.push(virtualSpacerRow(first * CR.virtualRowHeight, v.columns.length));
  for (let i = first; i < last; i++)
  {
    const row = v.rows[i];
    html.push(renderNormalRosterRow(v.columns, row.callObj, row.rowClass, row.rowTitle));
  }
  if (last < v.rows.length) html.push(virtualSpacerRow((v.rows.length - last) * CR.virtualRowHeight, v.columns.length));
  html.push(renderNormalRosterFooter());
  RosterTable.innerHTML = html.join("");

  // Measured from what was drawn, for the next range and spacers
  const table = RosterTable.firstElementChild;
  if (!table) return;
  const thead = table.tHead;
  if (thead) CR.virtualHeaderHeight = thead.getBoundingClientRect().height;
  const drawn = table.tBodies[0] ? table.tBodies[0].rows : [];
  let height = 0;
  let count = 0;
  for (let i = 0; i < drawn.length; i++)
  {
    if (drawn[i].className === "virtualSpacer") continue;
    height += drawn[i].getBoundingClientRect().height;
    count++;
  }
  if (count > 0) CR.virtualRowHeight = height / count;
}

// Scrolling or resizing: a redraw once the slice no longer covers the window (at most once a frame)
function virtualRosterScrolled()
{
  if (!CR.virtualRoster || CR.virtualScrollQueued) return;
  CR.virtualScrollQueued = true;
  window.requestAnimationFrame(() =>
  {
    CR.virtualScrollQueued = false;
    const v = CR.virtualRoster;
    if (!v) return;
    const { shownFirst, shownLast } = virtualRosterRange(v);
    if (shownFirst < v.first || shownLast > v.last) renderVirtualRoster();
  });
}

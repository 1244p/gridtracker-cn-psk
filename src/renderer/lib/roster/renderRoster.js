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

  let totalCount = Object.keys(callRoster).length;
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

  const feedRoster = isFeedRoster();
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

  // Feed spots can only be worked from a rig already on their band and mode (WSJT-X, JTDX or AC Log)
  const workableFeeds = feedRoster ? feedRigBandModes().bandModes : {};

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
      callObj.readOnly = !callObj.onRig && !window.opener.feedSpotClickable(callObj);
      if (!callObj.readOnly)
      {
        rowTitle = I18N("renderRoster.feedSpotted").replace("{spotter}", callObj.spotter);
      }
      else
      {
        rowClass = "feedReadOnly";
        rowTitle = I18N("renderRoster.feedReadOnly").replace("{spotter}", callObj.spotter).replace("{band}", callObj.band).replace("{mode}", callObj.mode);
      }
      rowTitle = htmlEntities(rowTitle).replace(/'/g, "&#39;");
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

    html.push(CR.rosterSettings.compact ? renderCompactRosterRow(callObj, multiInstance || multiBand, rowClass, rowTitle) : renderNormalRosterRow(rosterColumns, callObj, rowClass, rowTitle));
  }

  html.push(CR.rosterSettings.compact ? renderCompactRosterFooter() : renderNormalRosterFooter());

  RosterTable.innerHTML = html.join("");
}

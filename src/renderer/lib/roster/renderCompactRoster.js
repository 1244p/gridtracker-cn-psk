// Because the County is clickable we do not allow the whole compact div to trigger an initiateQSO
CR.isCompactCounty = false;

function renderCompactRosterHeaders()
{
  CR.isCompactCounty = (CR.rosterSettings.compactEntity == "County");
  return "<div id=\"buttonsDiv\" style=\"margin-left:0px;white-space:normal;\" onmouseenter='rosterInFocus()' onmouseleave='rosterNoFocus()'>";
}

function renderCompactRosterRow(callObj, showBand, rowClass = "", rowTitle = "")
{
  let title = rowTitle
    ? rowTitle + (callObj.grid.length ? ", " + callObj.grid : "") + ", " + toDHMS(timeNowSec() - callObj.age)
    : callObj.RSTsent + "&#13256;, " + parseInt(callObj.dt * 100) + "ms, " + callObj.delta + "hz" + (callObj.grid.length ? ", " + callObj.grid : "") + ", " + toDHMS(timeNowSec() - callObj.age);
  let bandView = showBand ? "<div style='color: #" + GT.bandColors[callObj.band] + ";float:right;display:inline-block;'>" + callObj.band + "</div>" : "";
  if (CR.rosterSettings.compactEntity == "Band")
  {
    bandView = "";
  }
  let onClick = " onClick='initiateQso(\"" + callObj.hash + "\")' id='" + callObj.hash + "' title='" + title + "' ";
  let wholeClick = (CR.isCompactCounty ? "" : onClick);
  let callsignClick = (CR.isCompactCounty ? onClick : "");
  let html = ["<div class='compact" + (rowClass ? " " + rowClass : "") + "' " + wholeClick + " >"];
  html.push("<div class='compactCallsign' " + callsignClick + " name='Callsign' " + callObj.style.call + " >" + markWorkableFeed(callObj, formatCallsign(callObj.DEcallHTML || callObj.DEcall)) + bandView + "</div>");
  html.push("<div class='compactData'>");
  html.push(renderEntryForColumn(CR.rosterSettings.compactEntity, callObj, "div"));
  html.push("</div></div>");
  return html.join("");
}

function renderCompactRosterFooter()
{
  return "</div>";
}

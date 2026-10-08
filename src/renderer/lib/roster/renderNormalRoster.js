function renderNormalRosterHeaders(columns)
{
  let html = "<table id='callTable' class='rosterTable' align=left onmouseenter='rosterInFocus()' onmouseleave='rosterNoFocus()' ><thead>";
  html += columns.map(column => renderHeaderForColumn(column)).join("");
  html += "</thead><tbody>";

  return html;
}

function renderNormalRosterRow(columns, callObj, rowClass = "", rowTitle = "")
{
  let html = `<tr id='${callObj.hash}'` + (rowClass ? ` class='${rowClass}'` : "") + (rowTitle ? ` title='${rowTitle}'` : "") + " >";
  html += columns.map(column => renderEntryForColumn(column, callObj)).join("");
  html += "</tr>";

  return html;
}

function renderNormalRosterFooter()
{
  return "</tbody></table>";
}

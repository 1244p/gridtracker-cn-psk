// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Stats window: the logbook tab (sorting, searching, filtering, rendering) and worked-before searches (moved from GridTracker2.js)

function updateLogbook()
{
  renderLogbookView();
}

function myCallCompare(a, b)
{
  return a.DEcall.localeCompare(b.DEcall);
}

function myGridCompare(a, b)
{
  return a.grid.localeCompare(b.grid);
}

function myModeCompare(a, b)
{
  return a.mode.localeCompare(b.mode);
}

function myDxccCompare(a, b)
{
  return GT.dxccToAltName[a.dxcc].localeCompare(GT.dxccToAltName[b.dxcc]);
}

function myTimeCompare(a, b)
{
  return a.time - b.time;
}

function myBandCompare(a, b)
{
  return a.band.localeCompare(b.band);
}

function myConfirmedCompare(a, b)
{
  if (a.confirmed && !b.confirmed) return 1;
  if (!a.confirmed && b.confirmed) return -1;
  return 0;
}

function myStateCompare(a, b)
{
  if (a.state && !b.state) return -1;
  if (!a.state && b.state) return 1;
  if (a.state > b.state) return 1;
  if (a.state < b.state) return -1;
  return 0;
}

function myCntyCompare(a, b)
{
  if (a.cnty && !b.cnty) return -1;
  if (!a.cnty && b.cnty) return 1;
  if (a.cnty > b.cnty) return 1;
  if (a.cnty < b.cnty) return -1;
  return 0;
}

function myPotaCompare(a, b)
{
  if (a.pota && !b.pota) return -1;
  if (!a.pota && b.pota) return 1;
  if (a.pota > b.pota) return 1;
  if (a.pota < b.pota) return -1;
  return 0;
}

function mySotaCompare(a, b)
{
  if (a.sota && !b.sota) return -1;
  if (!a.sota && b.sota) return 1;
  if (a.sota > b.sota) return 1;
  if (a.sota < b.sota) return -1;
  return 0;
}

function resetSearch()
{
  GT.lastSortIndex = 4;
  GT.qsoPages = 1;
  GT.qsoPage = 0;
  GT.lastSortType = 1;
  GT.searchWB = "";
  GT.gridSearch = "";
  GT.stateSearch = "";
  GT.cntySearch = "";
  GT.potaSearch = "";
  GT.sotaSearch = "";

  GT.filterBand = "Mixed";
  GT.filterMode = "Mixed";
  GT.filterDxcc = 0;
  GT.filterQSL = "All";

  GT.lastSearchSelection = null;
}

function renderLogbookByCall(callsign, event)
{
  event.preventDefault();

  resetSearch();
  GT.searchWB = callsign;
  if (event.shiftKey == true) GT.filterQSL = "true";
  openInfoTab("qsobox", "workedBoxDiv", renderLogbookView);
}

function renderLogbookSearchChanged(object, index)
{
  ValidateCallsign(object, null);
  GT.searchWB = object.value.toUpperCase();
  GT.lastSearchSelection = object.id;
  renderLogbookView(index, 0);
}

function renderLogbookSearchState(object, index)
{
  ValidateCallsign(object, null);
  GT.stateSearch = object.value.toUpperCase();
  GT.lastSearchSelection = object.id;
  renderLogbookView(index, 0);
}

function renderLogbookSearchCnty(object, index)
{
  ValidateCallsign(object, null);
  GT.cntySearch = object.value.toUpperCase();
  GT.lastSearchSelection = object.id;
  renderLogbookView(index, 0);
}

function renderLogbookSearchPOTA(object, index)
{
  ValidateCallsign(object, null);
  GT.potaSearch = object.value.toUpperCase();
  GT.lastSearchSelection = object.id;
  renderLogbookView(index, 0);
}

function renderLogbookSearchSOTA(object, index)
{
  ValidateCallsign(object, null);
  GT.sotaSearch = object.value.toUpperCase();
  GT.lastSearchSelection = object.id;
  renderLogbookView(index, 0);
}

function renderLogbookSearchGrid(object, index)
{
  ValidateCallsign(object, null);
  GT.gridSearch = object.value.toUpperCase();
  GT.lastSearchSelection = object.id;
  renderLogbookView(index, 0);
}

function filterBandFunction(event, index)
{
  GT.filterBand = this.value;
  GT.lastSearchSelection = this.id;
  renderLogbookView(index, 0);
}

function filterModeFunction(event, index)
{
  GT.filterMode = this.value;
  GT.lastSearchSelection = this.id;
  renderLogbookView(index, 0);
}

function filterDxccFunction(event, index)
{
  GT.filterDxcc = this.value;
  GT.lastSearchSelection = this.id;
  renderLogbookView(index, 0);
}

function filterQSLFunction(event, index)
{
  GT.filterQSL = this.value;
  GT.lastSearchSelection = this.id;
  renderLogbookView(index, 0);
}

function changeZday(element)
{
  GT.Zday = element.checked;
  renderLogbookView();
}

function renderLogbookView(sortIndex = null, nextPage = 0)
{
  try
  {
    const myObjects = GT.QSOhash;
    const bands = {};
    const modes = {};
    const dxccs = {};
    const confSrcs = {};

    // POTA / SOTA columns (parks hunted, POTA_REF; summits chased, SOTA_REF), and the SOTA export, only when the log has
    // such QSOs, whatever the POTA Hunting / SOTA Chasing settings; a hidden column's search box doesn't filter, and a
    // sort on it falls back to When
    let showPota = false;
    let showSota = false;
    for (const hash in myObjects)
    {
      const qso = myObjects[hash];
      if (qso.pota) showPota = true;
      if (qso.sota) showSota = true;
      if (showPota && showSota) break;
    }

    function startsWithCI(value, search)
    {
      return String(value).toLowerCase().startsWith(String(search).toLowerCase());
    }

    function includesCI(value, search)
    {
      return String(value).toLowerCase().includes(String(search).toLowerCase());
    }

    function matchesModeFilter(value)
    {
      if (GT.filterMode == "Mixed") return true;

      if (
        GT.filterMode == "Phone" &&
        value.mode in GT.modes_phone &&
        GT.modes_phone[value.mode]
      ) return true;

      if (
        GT.filterMode == "Digital" &&
        value.mode in GT.modes &&
        GT.modes[value.mode]
      ) return true;

      return value.mode == GT.filterMode;
    }

    function matchesQslFilter(value)
    {
      if (GT.filterQSL == "All") return true;

      if (GT.filterQSL == "false" || GT.filterQSL == "true")
      {
        return value.confirmed == (GT.filterQSL == "true");
      }

      return !!(value.confirmed && value.confSrcs && GT.filterQSL in value.confSrcs);
    }

    let mySort = sortIndex;

    if (mySort == null)
    {
      mySort = GT.lastSortIndex;
    }
    else
    {
      // The same column again reverses it; another column is sorted in the direction the list is in now
      if (mySort == GT.lastSortIndex && nextPage == 0)
      {
        GT.lastSortType ^= 1;
      }
    }

    if ((mySort == 7 && !showPota) || (mySort == 10 && !showSota)) mySort = 4;
    GT.lastSortIndex = mySort;

    const allList = Object.values(myObjects || {});
    let filtered = [];

    for (const value of allList)
    {
      if (GT.Zday && Math.floor(value.time / 86400) != GT.currentDay) continue;

      if (GT.searchWB.length > 0 && !includesCI(value.DEcall, GT.searchWB)) continue;

      if (GT.gridSearch.length > 0)
      {
        const x = startsWithCI(value.grid, GT.gridSearch);
        const y = Array.isArray(value.vucc_grids) &&
          value.vucc_grids.some(grid => startsWithCI(grid, GT.gridSearch));

        if (!x && !y) continue;
      }

      if (GT.stateSearch.length > 0)
      {
        if (!value.state || !includesCI(value.state, GT.stateSearch)) continue;
      }

      if (GT.cntySearch.length > 0)
      {
        if (!value.cnty) continue;
        if (!(value.cnty in GT.countyData)) continue;

        const countyName = GT.countyData[value.cnty].geo.properties.n;
        if (!includesCI(countyName, GT.cntySearch)) continue;
      }

      if (showPota && GT.potaSearch.length > 0)
      {
        if (!value.pota || !includesCI(value.pota, GT.potaSearch)) continue;
      }

      if (showSota && GT.sotaSearch.length > 0)
      {
        if (!value.sota || !includesCI(value.sota, GT.sotaSearch)) continue;
      }

      const pp = value.dxcc in GT.dxccInfo ? GT.dxccInfo[value.dxcc].pp : "?";
      bands[value.band] = value.band;
      modes[value.mode] = value.mode;
      dxccs[GT.dxccToAltName[value.dxcc] + " (" + pp + ")"] = value.dxcc;

      if (value.confirmed && value.confSrcs)
      {
        Object.assign(confSrcs, value.confSrcs);
      }

      if (GT.filterBand != "Mixed" && value.band != GT.filterBand) continue;
      if (!matchesModeFilter(value)) continue;
      if (GT.filterDxcc != 0 && value.dxcc != GT.filterDxcc) continue;
      if (!matchesQslFilter(value)) continue;

      filtered.push(value);
    }

    const sortFn = GT.sortFunction[GT.lastSortIndex];
    filtered.sort(function (a, b)
    {
      return (GT.lastSortType == 0) ? sortFn(a, b) : sortFn(b, a);
    });

    const ObjectCount = filtered.length;

    const workHead = `<b> Entries (${ObjectCount})</b>` +
      (showSota ? ` <div class='button sotaExportButton' title='${I18N("stats.sotaExport.button.hover").replace(/'/g, "&#39;")}' onclick='window.opener.openSotaChaserExport();'>${I18N("stats.sotaExport.button.label")}</div>` : "");

    setStatsDiv("workedHeadDiv", workHead);

    // Another sort, search or filter starts at the top; a refresh (a QSO logged, the window resized) keeps the place
    const signature = [mySort, GT.lastSortType, GT.searchWB, GT.gridSearch, GT.stateSearch, GT.cntySearch, GT.potaSearch,
      GT.sotaSearch, GT.filterBand, GT.filterMode, GT.filterDxcc, GT.filterQSL, GT.Zday].join("|");
    const statsWindow = GT.statsWindowInitialized ? GT.statsWindowHandle.window : null;
    const scrollTop = (statsWindow && signature === GT.logbookView.signature) ? statsWindow.workedListDiv.scrollTop : 0;
    GT.logbookView.signature = signature;

    if (myObjects != null)
    {
      // ▲ / ▼ after the sorted column's title, like the roster's headers (DXCC and Flag share a sort: DXCC shows it)
      const sortArrow = (index) => index == mySort ? `<div style='display:inline-block;margin:0px;padding:0px;'>&nbsp;${GT.lastSortType == 0 ? "▲" : "▼"}</div>` : "";
      const clearBtn = (val, id, func) => val ? `<img title='Clear' onclick='${id}.value="";window.opener.${func}(${id});' src='img/trash_24x48.png' style='width:30px;margin:0px;padding:0px;margin-bottom:-4px;cursor:pointer;' />` : "";

      // The search / filter row and the column titles are drawn here once; the rows go in the tbody, only the ones in
      // view (renderLogbookRows), so scrolling never redraws the search boxes being typed in
      let tableHtml = `<table id='logTable' style='white-space:nowrap;overflow:auto;overflow-x:hidden;' class='darkTable' align=center>
        <thead>
        <tr>
          <th><input type='text' id='searchWB' style='margin:0px' class='inputTextValue' value='${GT.searchWB}' size='8' oninput='window.opener.renderLogbookSearchChanged(this);' />${clearBtn(GT.searchWB, "searchWB", "renderLogbookSearchChanged")}</th>
          <th><input type='text' id='searchGrid' style='margin:0px' class='inputTextValue' value='${GT.gridSearch}' size='6' oninput='window.opener.renderLogbookSearchGrid(this);' />${clearBtn(GT.gridSearch, "searchGrid", "renderLogbookSearchGrid")}</th>
          <th><div id='bandFilterDiv'></div></th>
          <th><div id='modeFilterDiv'></div></th>
          <th><div id='qslFilterDiv'></div></th>
          <th></th>
          <th></th>
          ${GT.filterDxcc !== "0" 
            ? `<th style='border-right:none;'><div id='dxccFilterDiv'></div></th><th style='border-left:none;'><img title='Show All' onclick='window.opener.GT.filterDxcc=0;window.opener.renderLogbookView();' src='img/trash_24x48.png' style='width:30px;margin:0px;padding:0px;margin-bottom:-4px;cursor:pointer' /></th>`
            : `<th colspan='2'><div id='dxccFilterDiv'></div></th>`
          }
          <th><input type='text' id='searchState' style='margin:0px' class='inputTextValue' value='${GT.stateSearch}' size='3' oninput='window.opener.renderLogbookSearchState(this);' />${clearBtn(GT.stateSearch, "searchState", "renderLogbookSearchState")}</th>
          <th><input type='text' id='searchCnty' style='margin:0px' class='inputTextValue' value='${GT.cntySearch}' size='4' oninput='window.opener.renderLogbookSearchCnty(this);' />${clearBtn(GT.cntySearch, "searchCnty", "renderLogbookSearchCnty")}</th>
          ${showPota ? `<th><input type='text' id='searchPOTA' style='margin:0px' class='inputTextValue' value='${GT.potaSearch}' size='4' oninput='window.opener.renderLogbookSearchPOTA(this);' />${clearBtn(GT.potaSearch, "searchPOTA", "renderLogbookSearchPOTA")}</th>` : ""}
          ${showSota ? `<th><input type='text' id='searchSOTA' style='margin:0px' class='inputTextValue' value='${GT.sotaSearch}' size='6' oninput='window.opener.renderLogbookSearchSOTA(this);' />${clearBtn(GT.sotaSearch, "searchSOTA", "renderLogbookSearchSOTA")}</th>` : ""}
          <th><label>${I18N("gt.Zday")}</label>&nbsp;<input type='checkbox' id='Zday' ${GT.Zday ? "checked" : ""} onclick='window.opener.changeZday(Zday)'/></th>
        </tr>
        <tr>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(0);'>${I18N("gt.qsoPage.Station")}${sortArrow(0)}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(1);'>${I18N("gt.qsoPage.Grid")}${sortArrow(1)}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(5);'>${I18N("gt.qsoPage.Band")}${sortArrow(5)}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(2);'>${I18N("gt.qsoPage.Mode")}${sortArrow(2)}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(6);'>${I18N("gt.qsoPage.QSL")}${sortArrow(6)}</th>
          <th align=center>${I18N("gt.qsoPage.Sent")}</th>
          <th align=center>${I18N("gt.qsoPage.Rcvd")}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(3);'>${I18N("gt.qsoPage.DXCC")}${sortArrow(3)}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(3);'>${I18N("gt.qsoPage.Flag")}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(8);'>${I18N("roster.secondary.wanted.state")}${sortArrow(8)}</th>
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(9);'>${I18N("roster.secondary.wanted.county")}${sortArrow(9)}</th>
          ${showPota ? `<th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(7);'>POTA${sortArrow(7)}</th>` : ""}
          ${showSota ? `<th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(10);'>SOTA${sortArrow(10)}</th>` : ""}
          <th style='cursor:pointer;' align=center onclick='window.opener.renderLogbookView(4);'>${I18N("gt.qsoPage.When")}${sortArrow(4)}</th>
          ${GT.settings.callsignLookups.lotwUseEnable ? `<th>${I18N("gt.qsoPage.LoTW")}</th>` : ""}
          ${GT.settings.callsignLookups.eqslUseEnable ? `<th>${I18N("gt.qsoPage.eQSL")}</th>` : ""}
          ${GT.settings.callsignLookups.oqrsUseEnable ? `<th>${I18N("gt.qsoPage.OQRS")}</th>` : ""}
        </tr>
        </thead><tbody id='logTableBody'></tbody></table>`;

      // One QSO's row, built when it comes into view
      const rowHtml = (key) => {
        let confTitle = "", confTd = "";
        if (key.confirmed && key.confSrcs) {
          confTd = Object.keys(key.confSrcs).join("");
          confTitle = `title='${Object.keys(key.confSrcs).map(src => GT.confSrcNames[src]).join(", ")}'`;
        }

        // A state from an imported log can be free text ("CIUDAD DE BUENOS AIRES"): cut to the column's width
        // (#logTable .logClip), the whole of it in the hover, so one such QSO doesn't widen the column for good
        let stateTd = "<td></td>";
        if (key.state) {
          const stateTitle = htmlEntities(key.state in GT.StateData ? GT.StateData[key.state].name : key.state.substr(3)).replace(/'/g, "&#39;");
          stateTd = `<td align=center style='color:lightgreen' title='${stateTitle}'><div class='logClip'>${htmlEntities(key.state.substr(3))}</div></td>`;
        }
        let cntyTd = (key.cnty && key.cnty in GT.countyData) ? `<td align=center style='color:cyan'>${GT.countyData[key.cnty].geo.properties.n}</td>` : `<td></td>`;
        let potaTd = showPota ? (key.pota ? `<td align=center style='color:#fbb6fc'>${key.pota}</td>` : `<td></td>`) : "";
        let sotaTd = showSota ? (key.sota ? `<td align=center style='color:#40ffd8'>${key.sota}</td>` : `<td></td>`) : "";

        let lotwTd = GT.settings.callsignLookups.lotwUseEnable ? `<td align=center>${key.DEcall in GT.lotwCallsigns ? "&#10004;" : ""}</td>` : "";
        let eqslTd = GT.settings.callsignLookups.eqslUseEnable ? `<td align=center>${key.DEcall in GT.eqslCallsigns ? "&#10004;" : ""}</td>` : "";
        let oqrsTd = "";
        
        if (GT.settings.callsignLookups.oqrsUseEnable) {
          oqrsTd = key.DEcall in GT.oqrsCallsigns 
            ? (key.confirmed ? `<td>&#10004;</td>` : `<td style='cursor:pointer;' align='left' onClick='window.opener.openSite("https://clublog.org/logsearch/logsearch.php?log=${key.DEcall}&call=${key.DXcall}&SubmitLogSearch=Show+contacts");'>&#10004; &#128236;</td>`)
            : `<td></td>`;
        }

        return `<tr align=left>
          <td style='color:#ff0;cursor:pointer' onclick='window.opener.startLookup("${key.DEcall}","${key.grid}");'>${formatCallsign(key.DEcall)}</td>
          <td style='color:cyan;'>${key.grid}${key.vucc_grids.length ? ", " + key.vucc_grids.join(", ") : ""}</td>
          <td style='color:lightgreen'>${key.band}</td>
          <td style='color:lightblue'>${key.mode}</td>
          <td align=left ${confTitle}>${confTd}</td>
          <td>${key.RSTsent}</td>
          <td>${key.RSTrecv}</td>
          <td style='color:orange'>${GT.dxccToAltName[key.dxcc]} <font color='lightgreen'>(${key.dxcc in GT.dxccInfo ? GT.dxccInfo[key.dxcc].pp : "?"})</font></td>
          <td align=center style='margin:0;padding:0'><img style='padding-top:4px' src='img/flags/16/${key.dxcc in GT.dxccInfo ? GT.dxccInfo[key.dxcc].flag : "_United Nations.png"}'></td>
          ${stateTd}
          ${cntyTd}
          ${potaTd}
          ${sotaTd}
          <td style='color:lightblue'>${userTimeString(key.time * 1000)}</td>
          ${lotwTd}
          ${eqslTd}
          ${oqrsTd}
        </tr>`;
      };

      setStatsDiv("workedListDiv", tableHtml);

      statsValidateCallByElement("searchWB");
      statsValidateCallByElement("searchGrid");
      statsValidateCallByElement("searchState");
      statsValidateCallByElement("searchCnty");
      if (showPota) statsValidateCallByElement("searchPOTA");
      if (showSota) statsValidateCallByElement("searchSOTA");

      let newSelect = document.createElement("select");
      newSelect.id = "bandFilter";
      newSelect.title = I18N("gt.logbook.bandFilter");

      let option = document.createElement("option");
      option.value = "Mixed";
      option.text = "Mixed";
      newSelect.appendChild(option);

      Object.keys(bands)
        .sort(function (a, b)
        {
          return parseInt(a) - parseInt(b);
        })
        .forEach(function (key)
        {
          const option = document.createElement("option");
          option.value = key;
          option.text = key;
          newSelect.appendChild(option);
        });

      statsAppendChild("bandFilterDiv", newSelect, "filterBandFunction", GT.filterBand, true);

      newSelect = document.createElement("select");
      newSelect.id = "modeFilter";
      newSelect.title = I18N("gt.logbook.modeFilter");

      option = document.createElement("option");
      option.value = "Mixed";
      option.text = "Mixed";
      newSelect.appendChild(option);

      option = document.createElement("option");
      option.value = "Phone";
      option.text = "Phone";
      newSelect.appendChild(option);

      option = document.createElement("option");
      option.value = "Digital";
      option.text = "Digital";
      newSelect.appendChild(option);

      Object.keys(modes)
        .sort()
        .forEach(function (key)
        {
          const option = document.createElement("option");
          option.value = key;
          option.text = key;
          newSelect.appendChild(option);
        });

      statsAppendChild("modeFilterDiv", newSelect, "filterModeFunction", GT.filterMode, true);

      newSelect = document.createElement("select");
      newSelect.id = "dxccFilter";
      newSelect.title = I18N("gt.logbook.dxccFilter");

      option = document.createElement("option");
      option.value = 0;
      option.text = "All";
      newSelect.appendChild(option);

      Object.keys(dxccs)
        .sort()
        .forEach(function (key)
        {
          const option = document.createElement("option");
          option.value = dxccs[key];
          option.text = key;
          newSelect.appendChild(option);
        });

      statsAppendChild("dxccFilterDiv", newSelect, "filterDxccFunction", GT.filterDxcc, true);

      newSelect = document.createElement("select");
      newSelect.id = "qslFilter";
      newSelect.title = I18N("gt.logbook.qslFilter");

      option = document.createElement("option");
      option.value = "All";
      option.text = "All";
      newSelect.appendChild(option);

      option = document.createElement("option");
      option.value = true;
      option.text = "Yes";
      newSelect.appendChild(option);

      option = document.createElement("option");
      option.value = false;
      option.text = "No";
      newSelect.appendChild(option);

      Object.keys(confSrcs).forEach(function (key)
      {
        const option = document.createElement("option");
        option.value = key;
        option.text = GT.confSrcNames[key];
        newSelect.appendChild(option);
      });

      statsAppendChild("qslFilterDiv", newSelect, "filterQSLFunction", GT.filterQSL, true);

      statsFocus(GT.lastSearchSelection);
      setStatsDivHeight("workedListDiv", getStatsWindowHeight() - 6 + "px");

      GT.logbookView.rows = filtered;
      GT.logbookView.rowHtml = rowHtml;
      renderLogbookRows(scrollTop);
    }
    else
    {
      setStatsDiv("workedListDiv", "None");
    }
  }
  catch (e)
  {
    console.error(e);
  }
}

// ---- Logbook virtual scrolling ----
// The whole sorted, filtered list scrolls (no pages); only the rows from LOGBOOK_BUFFER above the view to as many below
// are in the page, spacer rows stand in for the rest. Rows are one height (#logTable in style.css), measured from the
// rows drawn. Columns fit the rows drawn, so they can change width as the list scrolls; that keeps the table within the
// window (the widest entries of a whole long log would add up to more)
// Rows drawn above and below the view: each redraw lays out the view plus twice this (about half a millisecond a row)
const LOGBOOK_BUFFER = 15;
GT.logbookView = { rows: [], rowHtml: null, first: 0, last: 0, rowHeight: 20, signature: "", scrollQueued: false };

// The rows in view now ({ shownFirst, shownLast }) and the range to draw with the buffer ({ first, last }) at a scroll
// position; last indexes are exclusive. The header stays at the top (sticky), so the row just under it is the one
// scrolled to the top of the list, and the rows have the list's height less the header's
function logbookRange(statsWindow, scrollTop)
{
  const view = GT.logbookView;
  const table = statsWindow.logTable;
  const headHeight = table && table.tHead ? table.tHead.getBoundingClientRect().height : 0;
  const count = view.rows.length;
  const shownFirst = Math.max(0, Math.min(count, Math.floor(scrollTop / view.rowHeight)));
  const shownLast = Math.max(shownFirst, Math.min(count, Math.ceil((scrollTop + statsWindow.workedListDiv.clientHeight - headHeight) / view.rowHeight)));
  return { shownFirst, shownLast, first: Math.max(0, shownFirst - LOGBOOK_BUFFER), last: Math.min(count, shownLast + LOGBOOK_BUFFER) };
}

function logbookSpacerRow(height)
{
  return `<tr class='logbookSpacer' style='height:${height}px;'><td colspan='99'></td></tr>`;
}

// The rows in view into the table's tbody, at a scroll position (kept across a refresh: the table was just replaced)
function renderLogbookRows(scrollTop = null)
{
  if (!GT.statsWindowInitialized) return;
  const statsWindow = GT.statsWindowHandle.window;
  const view = GT.logbookView;
  const body = statsWindow.document.getElementById("logTableBody");
  if (!body || !view.rowHtml) return;
  const list = statsWindow.workedListDiv;
  const top = scrollTop == null ? list.scrollTop : scrollTop;

  const { first, last } = logbookRange(statsWindow, top);
  view.first = first;
  view.last = last;
  const html = [];
  if (first > 0) html.push(logbookSpacerRow(first * view.rowHeight));
  for (let i = first; i < last; i++) html.push(view.rowHtml(view.rows[i]));
  if (last < view.rows.length) html.push(logbookSpacerRow((view.rows.length - last) * view.rowHeight));
  body.innerHTML = html.join("");
  if (scrollTop != null) list.scrollTop = scrollTop;

  // Measured from what was drawn, for the next range and spacers
  let height = 0;
  let count = 0;
  for (const row of body.rows)
  {
    if (row.className === "logbookSpacer") continue;
    height += row.getBoundingClientRect().height;
    count++;
  }
  if (count > 0) view.rowHeight = height / count;
}

// From the stats window: the list scrolled or the window resized. A redraw once the drawn rows no longer cover the
// view (at most once a frame)
function logbookScrolled()
{
  if (!GT.statsWindowInitialized || GT.logbookView.scrollQueued) return;
  const statsWindow = GT.statsWindowHandle.window;
  GT.logbookView.scrollQueued = true;
  statsWindow.requestAnimationFrame(() =>
  {
    GT.logbookView.scrollQueued = false;
    const view = GT.logbookView;
    const { shownFirst, shownLast } = logbookRange(statsWindow, statsWindow.workedListDiv.scrollTop);
    if (shownFirst < view.first || shownLast > view.last) renderLogbookRows();
  });
}

function searchWorked(dxcc, band, mode)
{
  resetSearch();
  GT.filterDxcc = dxcc;
  if (band.length > 0)
  {
    GT.filterBand = band;
  }
  if (mode.length > 0)
  {
    GT.filterMode = mode;
  }
  renderLogbookView();
}

function searchWorkedGrid(grid, band)
{
  resetSearch();
  GT.gridSearch = grid;
  if (band && band.length > 0)
  {
    GT.filterBand = band;
  }
  renderLogbookView();
}

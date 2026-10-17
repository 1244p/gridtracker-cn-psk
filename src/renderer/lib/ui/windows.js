// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Child windows: Conditions, Popup/tooltip, Band Activity and Alert windows (moved from GridTracker2.js)

function openConditionsWindow(show = true)
{
  if (GT.conditionsWindowHandle == null)
  {
    GT.conditionsWindowHandle = window.open("gt_conditions.html","gt_conditions");
  }
  else if (GT.conditionsWindowInitialized)
  {
    show ? electron.ipcRenderer.send("showWin", "gt_conditions") : electron.ipcRenderer.send("hideWin", "gt_conditions");
  }
}

function toggleConditionsWindow()
{
  if (GT.conditionsWindowInitialized)
  {
    electron.ipcRenderer.send("toggleWin", "gt_conditions");
  }
}

function initPopupWindow()
{
  if (GT.popupWindowHandle == null)
  {
    GT.popupWindowHandle = window.open("gt_popup.html", "gt_popup");
  }
}

// Pops a tooltip out into the popup window; tooltip is the map tooltip element it was built in (POTA parks have
// their own, myParktip)
function renderTooltipWindow(feature, tooltip = myTooltip)
{
  if (GT.popupWindowInitialized)
  {
    let positionInfo = tooltip.getBoundingClientRect();
    GT.popupWindowHandle.window.resizeTo(parseInt(positionInfo.width + 20), parseInt(positionInfo.height + 40));
    GT.popupWindowHandle.window.adifTable.innerHTML = tooltip.innerHTML;
    electron.ipcRenderer.send("showWin", "gt_popup");
  }
}

function showConditionsWindow(toggle = true)
{
  if (GT.settings.map.offlineMode == false)
  {
    if (toggle)
    {
      toggleConditionsWindow();
    }
    else
    {
      openConditionsWindow(true);
    }
  }
}

function toggleBaWindow()
{
  if (GT.baWindowHandle == null)
  {
    openBaWindow(true);
  }
  else
  {
    electron.ipcRenderer.send("toggleWin", "gt_bandactivity");
  }
}

function openBaWindow(show = true)
{
  if (GT.baWindowHandle == null)
  {
    GT.baWindowHandle = window.open("gt_bandactivity.html","gt_bandactivity");
  }
  else if (GT.baWindowInitialized)
  {
    show ? electron.ipcRenderer.send("showWin", "gt_bandactivity") : electron.ipcRenderer.send("hideWin", "gt_bandactivity");
  }
}

function openAlertWindow(show = true)
{
  if (GT.alertWindowHandle == null)
  {
    GT.alertWindowHandle = window.open("gt_alert.html", "gt_alert");
  }
  else if (GT.alertWindowInitialized)
  {
    show ? electron.ipcRenderer.send("showWin", "gt_alert") : electron.ipcRenderer.send("hideWin", "gt_alert");
  }
}

/**
 * PSTRotator is a third party application (windows-only) that interfaces with dozens of antenna rotators.
 * It offers a way for other apps to request rotation to a specific azimuth, or a grid square.
 *
 * Other rotator control apps, like [CatRotator](https://www.pianetaradio.it/blog/catrotator/) also support this API.
 *
 * The most comprehensive API details are in this Groups.io post:
 *   https://groups.io/g/PstRotator/message/5825
 *
 */
function pstrotatorServiceChanged()
{
  GT.settings.pstrotator.enable = pstrotatorCheckBox.checked;
  GT.settings.pstrotator.ip = pstrotatorIpInput.value;
  GT.settings.pstrotator.port = pstrotatorPortInput.value;

  
  if (GT.callRosterWindowInitialized)
  {
    GT.callRosterWindowHandle.window.setPstrotatorEnable(GT.settings.pstrotator.enable);
  }
}

function aimRotator(info)
{
  const { callObj } = info

  if (GT.settings.pstrotator.enable == true && GT.settings.pstrotator.port > 0 && GT.settings.pstrotator.ip.length > 4 && callObj.distance > 0)
  {
    // If we have a .grid, we have a .distance and .heading, so just send the heading
    let payload = `<PST><AZIMUTH>${Math.round(callObj.heading)}</AZIMUTH></PST>`;
    
    try
    {
      sendUdpMessage(payload, payload.length, parseInt(GT.settings.pstrotator.port), GT.settings.pstrotator.ip);
      if (callObj.DEcall)
      {
        addLastTraffic(`<font style='color:white'>${I18N("gt.rotator.aimAt").replace("{0}", callObj.DEcall)}</font>`);
      }
      else
      {
        addLastTraffic(`<font style='color:white'>${I18N("gt.rotator.aimTo").replace("{0}", callObj.heading)}</font>`);
      }
    }
    catch (e)
    {
      addLastTraffic("<font style='color:red'>" + I18N("gt.rotator.udpFailed") + "</font>");
    }
  }
}

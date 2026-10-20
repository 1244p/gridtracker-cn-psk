// The Santa Tracker's stops, for tools/santa_route.js: every DXCC entity, with each province of Canada and state of Mexico
// and the United States (state.json) in place of those countries; where GridTracker2 puts each one.
// Usage (repo root, dev copy running with the debug port):
//   node tools/cdp.mjs GridTracker2.html evalfile tools/santa_route_export.js > santa_stops.json
(() =>
{
  const BY_STATE = [1, 50, 291];
  const stops = [];

  // A Maidenhead square's center
  const center = (mh) => ({
    lat: (mh.charCodeAt(1) - 65) * 10 - 90 + parseInt(mh[3]) + 0.5,
    lon: (mh.charCodeAt(0) - 65) * 20 - 180 + parseInt(mh[2]) * 2 + 1
  });
  const km = (lat1, lon1, lat2, lon2) =>
  {
    const rad = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
  };

  for (const key in GT.dxccInfo)
  {
    const info = GT.dxccInfo[key];
    if (info.geo == "deleted" || !(info.lat || info.lon) || BY_STATE.includes(Number(info.dxcc))) continue;
    // Kiribati's Line Islands (UTC+14) are ahead of the date line: they come first
    stops.push({ key: "e:" + info.dxcc, name: info.name, lat: info.lat, lon: info.lon, ahead: info.lon < -150 && parseFloat(info.timezone) >= 12 });
  }

  // A state or province: the middle of its squares, moved to the nearest square that's in it
  for (const key in GT.StateData)
  {
    const state = GT.StateData[key];
    if (!BY_STATE.includes(state.dxcc) || !state.mh || state.mh.length == 0) continue;
    const centers = state.mh.map(center);
    const lat = centers.reduce((sum, c) => sum + c.lat, 0) / centers.length;
    const lon = centers.reduce((sum, c) => sum + c.lon, 0) / centers.length;
    let best = centers[0];
    for (const c of centers) if (km(lat, lon, c.lat, c.lon) < km(lat, lon, best.lat, best.lon)) best = c;
    stops.push({ key: "s:" + key, name: state.name, lat: best.lat, lon: best.lon, ahead: false });
  }
  return JSON.stringify(stops);
})()

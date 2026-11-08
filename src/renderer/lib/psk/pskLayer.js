// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// PSK Reporter watch: the map side. Two vector layers over the ground layer (great-circle links and endpoint dots),
// created on demand so mapCore.js needs no change for the feature: the layers are built the first time the watch
// draws, and rebuilt when the map itself was rebuilt (a projection change makes a new ol map).

// Nothing is drawn while the watch is off.

GT.pskWatchLayer = {
  linkStyles: new Map(),
  pointStyles: new Map(),
  maxDraw: 600
};

function pskWatchLayersEnsure()
{
  if (GT.map == null)
  {
    return false;
  }
  if (GT.pskWatch.mapRef === GT.map && GT.layerVectors.pskWatchLinks && GT.layerVectors.pskWatchPoints)
  {
    return true;
  }
  createGlobalMapLayer("pskWatchLinks");
  createGlobalMapLayer("pskWatchPoints");
  GT.map.addLayer(GT.layerVectors.pskWatchLinks);
  GT.map.addLayer(GT.layerVectors.pskWatchPoints);
  GT.pskWatch.mapRef = GT.map;
  return true;
}

// The award colours are tuned for thin lines on a dark map; filled pins in the same colour glare, so each band
// colour is pulled towards grey and darkened once and then used for both the pin and its link
function pskWatchMutedColor(hex)
{
  const value = parseInt(hex.slice(1), 16);
  if (isNaN(value))
  {
    return "#8a8a8a";
  }
  const r = (value >> 16) & 0xFF;
  const g = (value >> 8) & 0xFF;
  const b = value & 0xFF;
  const grey = (r + g + b) / 3;
  const mix = 0.5;
  const scale = 0.78;
  const to = function(channel)
  {
    return Math.round((channel * (1 - mix) + grey * mix) * scale).toString(16).padStart(2, "0");
  };
  return "#" + to(r) + to(g) + to(b);
}

function pskWatchBandColor(band)
{
  return pskWatchMutedColor("#" + (GT.bandColors[band] || "FFFF00"));
}

function pskWatchLinkStyle(color)
{
  const style = GT.pskWatchLayer.linkStyles.get(color);
  if (style != null)
  {
    return style;
  }
  const created = new ol.style.Style({
    stroke: new ol.style.Stroke({ color: color, width: 1 })
  });
  GT.pskWatchLayer.linkStyles.set(color, created);
  return created;
}

// The pskreporter map has always used a teardrop pin rather than a disc: the tip sits on the station and the
// round head carries the band colour, so the eye reads a place, not a blob
// (height is a screen size in pixels; the tip is the anchor, so the marker grows upward from the spot)
function pskWatchPointStyle(color, height)
{
  const key = color + "|" + height;
  const style = GT.pskWatchLayer.pointStyles.get(key);
  if (style != null)
  {
    return style;
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="25" viewBox="0 0 18 25">' +
    '<path d="M9 24.2 C9 24.2 1.5 15.1 1.5 9.3 A7.5 7.5 0 1 1 16.5 9.3 C16.5 15.1 9 24.2 9 24.2 Z" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.2"/>' +
    '<circle cx="9" cy="9.2" r="3.1" fill="#FFFFFF" fill-opacity="0.9"/>' +
    "</svg>";
  const created = new ol.style.Style({
    image: new ol.style.Icon({
      src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      anchor: [0.5, 1],
      anchorXUnits: "fraction",
      anchorYUnits: "fraction",
      scale: height / 25
    }),
    zIndex: 40
  });
  GT.pskWatchLayer.pointStyles.set(key, created);
  return created;
}

// A report's two ends as map coordinates; both grids have to be usable, otherwise the report is not drawn
function pskWatchReportEnds(report)
{
  const sender = squareToCenter(report.sl);
  const receiver = squareToCenter(report.rl);
  if (isNaN(sender.a) || isNaN(sender.o) || isNaN(receiver.a) || isNaN(receiver.o))
  {
    return null;
  }
  return { sender: sender, receiver: receiver };
}

// The reports the panel and the map agree on: enabled, inside the chosen window, on the chosen band
function pskWatchVisibleReports()
{
  const visible = [];
  if (GT.settings.psk.enabled != true)
  {
    return visible;
  }
  const now = timeNowSec();
  const windowSec = pskWatchHistoryMinutes() * 60;
  const band = GT.settings.psk.band || "";
  for (const report of GT.pskWatch.reports.values())
  {
    if (now - report.t > windowSec)
    {
      continue;
    }
    if (band != "" && report.b != band)
    {
      continue;
    }
    visible.push(report);
  }
  return visible;
}

function pskWatchRedrawLayer()
{
  if (!pskWatchLayersEnsure())
  {
    return;
  }
  const linkSource = GT.layerSources.pskWatchLinks;
  const pointSource = GT.layerSources.pskWatchPoints;
  linkSource.clear();
  pointSource.clear();

  const visible = pskWatchVisibleReports();
  if (visible.length == 0)
  {
    return;
  }
  // Newest first on show: the oldest are dropped when the map would carry too many
  visible.sort(function(a, b)
  {
    return b.t - a.t;
  });
  const draw = visible.slice(0, GT.pskWatchLayer.maxDraw);
  const showLines = GT.settings.psk.showLines != false;
  const lineFeatures = [];
  const pointFeatures = [];

  for (let i = 0; i < draw.length; i++)
  {
    const report = draw[i];
    const ends = pskWatchReportEnds(report);
    if (ends == null)
    {
      continue;
    }
    const color = pskWatchBandColor(report.b);

    if (showLines && report.sl.substring(0, 4) != report.rl.substring(0, 4))
    {
      const from = ol.proj.fromLonLat([ends.sender.o, ends.sender.a]);
      const to = ol.proj.fromLonLat([ends.receiver.o, ends.receiver.a]);
      const line = new ol.Feature({
        geometry: new ol.geom.LineString(flightPathCoords([from, to], 32)),
        prop: "pskWatchLink"
      });
      line.setStyle(pskWatchLinkStyle(color + "AA"));
      lineFeatures.push(line);
    }

    // Both ends carry the whole report, so a click on the dot can say what it stands for
    for (const end of [[ends.sender, 26, "sender"], [ends.receiver, 19, "receiver"]])
    {
      const geometry = new ol.geom.Point(ol.proj.fromLonLat([end[0].o, end[0].a]));
      if (GT.useTransform)
      {
        geometry.transform("EPSG:3857", GT.settings.map.projection);
      }
      const point = new ol.Feature({
        geometry: geometry,
        prop: "pskWatchPoint",
        pskInfo: {
          sc: report.sc, sl: report.sl, rc: report.rc, rl: report.rl,
          f: report.f, b: report.b, md: report.md, rp: report.rp, t: report.t,
          role: end[2]
        }
      });
      point.setStyle(pskWatchPointStyle(color, end[1]));
      pointFeatures.push(point);
    }
  }

  if (lineFeatures.length > 0)
  {
    linkSource.addFeatures(lineFeatures);
  }
  if (pointFeatures.length > 0)
  {
    pointSource.addFeatures(pointFeatures);
  }
}

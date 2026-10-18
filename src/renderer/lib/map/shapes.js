// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Map shape builders: grid, icon, line, rectangle, triangle and polygon features, ring geometry (moved from GridTracker2.js)

const K_CACHED_WORLD_RING = [];

(function initWorldRing() {
  const radius = 20047508;
  const radFactor = Math.PI / 180;
  for (let i = 0; i <= 360; i += 0.1) {
    let rad = i * radFactor;
    K_CACHED_WORLD_RING.push([radius * Math.cos(rad), radius * Math.sin(rad)]);
  }
})();

const K_RAD_FACTOR = Math.PI / 180;

const K_DEG_FACTOR = 180 / Math.PI; 

function gridFeature(key, objectData, propname, fillColor, borderColor, borderWidth)
{
  let style = new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: borderColor,
      width: borderWidth
    }),
    fill: new ol.style.Fill({
      color: fillColor
    })
  });

  objectData.setStyle(style);
  objectData.set("prop", propname);
  objectData.set("grid", key);
  objectData.size = 2;
  return objectData;
}

function iconFeature(center, iconObj, zIndex, propName)
{
  let feature = new ol.Feature({
    geometry: new ol.geom.Point(center),
    prop: propName
  });

  if (GT.useTransform)
  {
    feature.getGeometry().transform("EPSG:3857", GT.settings.map.projection);
  }

  let iconStyle = new ol.style.Style({
    zIndex: zIndex,
    image: iconObj
  });

  feature.setStyle(iconStyle);
  return feature;
}

// The map's background color (Settings, Map) with its hue turned 180 degrees (same saturation and lightness), for
// marks that stand out on it
function complementMapBackground()
{
  const background = String((GT.settings.map.backgroundColor && GT.settings.map.backgroundColor[GT.currentMapIndex]) || "#000000");
  // Worked out once per background (every ringed marker of a redraw asks)
  if (GT.complementCache && GT.complementCache.background === background) return GT.complementCache.color;
  const color = complementColor(background);
  GT.complementCache = { background, color };
  return color;
}

function complementColor(background)
{
  const hex = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#FFFFFF";
  const rgb = [0, 2, 4].map((i) => parseInt(hex.substring(i, i + 2), 16) / 255);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0)
  {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max == rgb[0]) h = 60 * (((rgb[1] - rgb[2]) / d) % 6);
    else if (max == rgb[1]) h = 60 * ((rgb[2] - rgb[0]) / d + 2);
    else h = 60 * ((rgb[0] - rgb[1]) / d + 4);
  }
  h = (h + 180 + 360) % 360;
  // Back from HSL
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

// A POTA / SOTA / DX Feeds marker for a call in a rig's DX Call (rigDXcallSet): ringed, not filled, just outside its
// icon. White, then the map background's opposite hue, then black outermost, so it shows on any map. Its own icon stays
// on top
function ringSelectedMarker(feature)
{
  const iconStyle = feature.getStyle();
  const icon = iconStyle.getImage();
  const size = icon.getSize();
  const radius = (size ? Math.ceil(Math.max(size[0], size[1]) * icon.getScale() / 2) : 12) + 3;
  const ring = (r, color) => new ol.style.Style({
    zIndex: iconStyle.getZIndex(),
    image: new ol.style.Circle({ radius: r, stroke: new ol.style.Stroke({ color, width: 2 }) })
  });
  feature.setStyle([ring(radius + 4, "#000000"), ring(radius + 2, complementMapBackground()), ring(radius, "#FFFFFF"), iconStyle]);
}

// Point markers whose icons would overlap at the current zoom, grouped (POTA parks, SOTA summits, DX Feeds spots): an array of groups,
// each an array of features, the first being the one to show (highest feature.rank). radiusPx: centers closer than
// this, in screen pixels, count as overlapping. Only markers with the same feature.dxcc are grouped: spots from
// different DXCC entities stay apart. With Settings -> Map -> Group Overlapping Spots off, every marker is its own group
function groupOverlappingFeatures(features, radiusPx = 22)
{
  const resolution = GT.mapView ? GT.mapView.getResolution() : 0;
  const sorted = features.slice().sort((a, b) => (b.rank || 0) - (a.rank || 0));
  if (!(resolution > 0) || !GT.settings.map.groupSpots) return sorted.map((feature) => [feature]);

  const radius = radiusPx * resolution;
  const radius2 = radius * radius;
  // Markers bucketed in cells one radius wide, so each is only compared with those in its own and the 8 cells around
  // (DX Feeds can have thousands). Cell keys are numbers (no string per lookup): even at the deepest zoom a cell row is
  // well under 2^25 cells, so cx * 2^26 + cy is unique and stays an exact integer
  const coords = sorted.map((feature) => feature.getGeometry().getCoordinates());
  const cells = new Map();
  const cellKey = (cx, cy) => cx * 67108864 + cy;
  for (let i = 0; i < coords.length; i++)
  {
    const key = cellKey(Math.floor(coords[i][0] / radius), Math.floor(coords[i][1] / radius));
    const cell = cells.get(key);
    if (cell) cell.push(i);
    else cells.set(key, [i]);
  }

  const groups = [];
  const taken = new Uint8Array(sorted.length);
  for (let i = 0; i < sorted.length; i++)
  {
    if (taken[i]) continue;
    taken[i] = 1;
    const x = coords[i][0];
    const y = coords[i][1];
    const dxcc = sorted[i].dxcc;
    const cx = Math.floor(x / radius);
    const cy = Math.floor(y / radius);
    const members = [];
    for (let dx = -1; dx <= 1; dx++)
    {
      for (let dy = -1; dy <= 1; dy++)
      {
        const cell = cells.get(cellKey(cx + dx, cy + dy));
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++)
        {
          const j = cell[k];
          if (taken[j] || sorted[j].dxcc !== dxcc) continue;
          const ox = coords[j][0] - x;
          const oy = coords[j][1] - y;
          if (ox * ox + oy * oy <= radius2)
          {
            taken[j] = 1;
            members.push(j);
          }
        }
      }
    }
    // The lead first, then the rest in rank order (most markers are alone)
    if (members.length == 0)
    {
      groups.push([sorted[i]]);
      continue;
    }
    members.sort((a, b) => a - b);
    groups.push([sorted[i], ...members.map((j) => sorted[j])]);
  }
  return groups;
}

// A group's marker (its first feature) goes to the middle of the group: the average of all their positions
function centerGroupMarker(group)
{
  if (group.length < 2) return;
  let x = 0, y = 0;
  for (const feature of group)
  {
    const [fx, fy] = feature.getGeometry().getCoordinates();
    x += fx;
    y += fy;
  }
  group[0].getGeometry().setCoordinates([x / group.length, y / group.length]);
}

function lineGeometry(points, steps)
{
  // Map coords into lat lngs
  let start = points[0];
  let end = points[1];
  let generator = new arc.GreatCircle({ x: start[0], y: start[1] }, { x: end[0], y: end[1] });
  let path = generator.Arc(steps, { offset: 10 });

  let line = [];
  let geom = path.geometries;
  let lonOff = 0;
  let lastc = 0;
  for (const j in geom) 
  {
    for (const i in geom[j].coords)
    {
      const c = geom[j].coords[i];
      if (isNaN(c[0])) continue;
      // wrapped?
      if (Math.abs(lastc - c[0]) > 270) (c[0] < lastc) ? lonOff += 360 : lonOff -= 360;
      lastc = c[0];
      line.push(ol.proj.fromLonLat([ lastc + lonOff, c[1]]));
    }
  }
  return line;
}

function lineString(points, count)
{
  let thing;
  if (GT.useTransform)
  {
    let line = lineGeometry(points, count);
    thing = new ol.geom.LineString(line);
  }
  else
  {
    let fromPoint = ol.proj.fromLonLat(points[0]);
    let toPoint = ol.proj.fromLonLat(points[1]);
    let pointsA = [ fromPoint, toPoint ];
    thing = new ol.geom.LineString(pointsA);
  }

  let rect = new ol.Feature({
    geometry: thing,
    prop: "lineString"
  });
  if (GT.useTransform)
  {
    rect.getGeometry().transform("EPSG:3857", GT.settings.map.projection);
  }
  return rect;
}

function rectangle(bounds, property = "grid")
{
  let thing = new ol.geom.Polygon([
    [
      ol.proj.fromLonLat([bounds[0][0], bounds[0][1]]),
      ol.proj.fromLonLat([bounds[0][0], bounds[1][1]]),
      ol.proj.fromLonLat([bounds[1][0], bounds[1][1]]),
      ol.proj.fromLonLat([bounds[1][0], bounds[0][1]])
    ]
  ]);
  let rect = new ol.Feature({
    prop: property,
    geometry: thing
  });
  if (GT.useTransform)
  {
    rect.getGeometry().transform("EPSG:3857", GT.settings.map.projection);
  }
  return rect;
}

function triangle(bounds, topLeft)
{
  let thing = null;

  if (topLeft)
  {
    thing = new ol.geom.Polygon([
      [
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]]),
        ol.proj.fromLonLat([bounds[0][0], bounds[1][1]]),
        ol.proj.fromLonLat([bounds[1][0], bounds[1][1]]),
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]])
      ]
    ]);
  }
  else
  {
    thing = new ol.geom.Polygon([
      [
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]]),
        ol.proj.fromLonLat([bounds[1][0], bounds[1][1]]),
        ol.proj.fromLonLat([bounds[1][0], bounds[0][1]]),
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]])
      ]
    ]);
  }

  let rect = new ol.Feature({
    prop: "grid",
    geometry: thing
  });
  if (GT.useTransform)
  {
    rect.getGeometry().transform("EPSG:3857", GT.settings.map.projection);
  }
  return rect;
}

function triangleToGrid(iQTH, feature)
{
  let LL = maidenheadToBounds(iQTH);
  let bounds = [
    [LL.lo1, LL.la1],
    [LL.lo2, LL.la2]
  ];

  let thing = new ol.geom.Polygon([
    [
      ol.proj.fromLonLat([bounds[0][0], bounds[0][1]]),
      ol.proj.fromLonLat([bounds[0][0], bounds[1][1]]),
      ol.proj.fromLonLat([bounds[1][0], bounds[1][1]]),
      ol.proj.fromLonLat([bounds[1][0], bounds[0][1]]),
      ol.proj.fromLonLat([bounds[0][0], bounds[0][1]])
    ]
  ]);

  feature.setGeometry(thing);
  if (GT.useTransform)
  {
    feature.getGeometry().transform("EPSG:3857", GT.settings.map.projection);
  }
}

function gridToTriangle(iQTH, feature, topLeft)
{
  let LL = maidenheadToBounds(iQTH);
  let bounds = [
    [LL.lo1, LL.la1],
    [LL.lo2, LL.la2]
  ];
  let thing = null;

  if (topLeft)
  {
    thing = new ol.geom.Polygon([
      [
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]]),
        ol.proj.fromLonLat([bounds[0][0], bounds[1][1]]),
        ol.proj.fromLonLat([bounds[1][0], bounds[1][1]]),
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]])
      ]
    ]);
  }
  else
  {
    thing = new ol.geom.Polygon([
      [
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]]),
        ol.proj.fromLonLat([bounds[1][0], bounds[1][1]]),
        ol.proj.fromLonLat([bounds[1][0], bounds[0][1]]),
        ol.proj.fromLonLat([bounds[0][0], bounds[0][1]])
      ]
    ]);
  }

  feature.setGeometry(thing);
  if (GT.useTransform)
  {
    feature.getGeometry().transform("EPSG:3857", GT.settings.map.projection);
  }
}

function pointInPolygon(point, vs) {
  let lon = point[0], lat = point[1];
  let poly = new Array(vs.length); // Pre-allocate memory for V8
  let curLon = vs[0][0];
  poly[0] = [curLon, vs[0][1]];
  
  let minLon = curLon;
  let maxLon = curLon;

  for (let i = 1; i < vs.length; i++) {
    let dl = vs[i][0] - vs[i - 1][0];
    if (Math.abs(dl) > 359) {
      // Explicit full-world sweep, keep it
    } else if (dl > 180) {
      dl -= 360;
    } else if (dl < -180) {
      dl += 360;
    }
    curLon += dl;
    poly[i] = [curLon, vs[i][1]];
    
    // V8 Optimization: Calculate min/max natively without spread/map arrays
    if (curLon < minLon) minLon = curLon;
    if (curLon > maxLon) maxLon = curLon;
  }

  let testLons = [lon, lon - 360, lon + 360];
  for (let i = 0; i < 3; i++) {
    let tLon = testLons[i];
    if (tLon >= minLon && tLon <= maxLon) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        let xi = poly[i][0], yi = poly[i][1];
        let xj = poly[j][0], yj = poly[j][1];
        let intersect = ((yi > lat) !== (yj > lat)) && (tLon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) return true;
    }
  }
  return false;
}

function segmentizeRing(ring, antiLon, antiLat) {
  let newRing = [];
  
  const aLatRad = antiLat * K_RAD_FACTOR;
  const cosALatRad = Math.cos(aLatRad);

  for (let i = 0; i < ring.length - 1; i++) {
    let p1 = ring[i];
    let p2 = ring[i + 1];

    let lat1 = Math.max(-89.99, Math.min(89.99, p1[1]));
    let lat2 = Math.max(-89.99, Math.min(89.99, p2[1]));
    let lon1 = p1[0];
    let lon2 = p2[0];
    
    newRing.push([lon1, lat1]);

    let dLon = lon2 - lon1;
    let dLat = lat2 - lat1;

    if (Math.abs(dLon) > 359) {
      // Keep perfect closure
    } else if (Math.abs(dLon) > 180) {
      dLon = dLon > 0 ? dLon - 360 : dLon + 360;
    }

    let dist = Math.sqrt(dLon * dLon + dLat * dLat);

    let lat1Rad = lat1 * K_RAD_FACTOR;
    let dLonRad1 = (lon1 - antiLon) * K_RAD_FACTOR;
    let a1 = Math.sin((aLatRad - lat1Rad) / 2) ** 2 + cosALatRad * Math.cos(lat1Rad) * Math.sin(dLonRad1 / 2) ** 2;
    // Replaced (180 / Math.PI) with K_DEG_FACTOR
    let dist1 = 2 * Math.asin(Math.sqrt(a1)) * K_DEG_FACTOR; 

    let lat2Rad = lat2 * K_RAD_FACTOR;
    let dLonRad2 = (lon2 - antiLon) * K_RAD_FACTOR;
    let a2 = Math.sin((aLatRad - lat2Rad) / 2) ** 2 + cosALatRad * Math.cos(lat2Rad) * Math.sin(dLonRad2 / 2) ** 2;
    // Replaced (180 / Math.PI) with K_DEG_FACTOR
    let dist2 = 2 * Math.asin(Math.sqrt(a2)) * K_DEG_FACTOR; 

    let distToAnti = Math.min(dist1, dist2);

    let currentMaxDegree = 0.5;
    if (distToAnti < 5.0) {
       currentMaxDegree = 0.05;
    } else if (distToAnti < 15.0) {
       currentMaxDegree = 0.1; 
    } else if (distToAnti < 30.0) {
       currentMaxDegree = 0.2; 
    }

    if (dist > currentMaxDegree) {
      let steps = Math.ceil(dist / currentMaxDegree);
      for (let j = 1; j < steps; j++) {
        let intLon = lon1 + dLon * (j / steps);
        let intLat = lat1 + dLat * (j / steps);
        
        if (intLon > 180) intLon -= 360;
        else if (intLon < -180) intLon += 360;
        
        newRing.push([intLon, intLat]);
      }
    }
  }
  
  let lastP = ring[ring.length - 1];
  newRing.push([lastP[0], Math.max(-89.99, Math.min(89.99, lastP[1]))]);
  return newRing;
}

function shapeFeature(
  key,
  geoJsonData,
  propname,
  fillColor,
  borderColor,
  borderWidth
) {
  let format = new ol.format.GeoJSON({ geometryName: key });
  let feature = format.readFeature(geoJsonData);
  let geometry = feature.getGeometry();

  if (GT.useTransform) {
    let antiLon = GT.myLon > 0 ? GT.myLon - 180 : GT.myLon + 180;
    let antiLat = -GT.myLat;
    
    let testLon = antiLon + 0.00013;
    let testLat = antiLat + 0.00017;
    if (testLat <= -89.9) testLat = -89.9;
    else if (testLat >= 89.9) testLat = 89.9;

    let type = geometry.getType();
    let invertedPolygons = []; 

    if (type === 'Polygon') {
      let rings = geometry.getCoordinates();
      if (pointInPolygon([testLon, testLat], rings[0])) invertedPolygons.push(0);
      geometry.setCoordinates(rings.map(ring => segmentizeRing(ring, antiLon, antiLat)));
    } else if (type === 'MultiPolygon') {
      let polys = geometry.getCoordinates();
      polys.forEach((poly, index) => {
        if (pointInPolygon([testLon, testLat], poly[0])) invertedPolygons.push(index);
      });
      geometry.setCoordinates(polys.map(poly => poly.map(ring => segmentizeRing(ring, antiLon, antiLat))));
      
    } else if (type === 'LineString') {
      let line = geometry.getCoordinates();
      geometry.setCoordinates(segmentizeRing(line, antiLon, antiLat));
      
    } else if (type === 'MultiLineString') {
      let lines = geometry.getCoordinates();
      geometry.setCoordinates(lines.map(line => segmentizeRing(line, antiLon, antiLat)));
    }

    geometry.transform('EPSG:4326', GT.settings.map.projection);

    // Apply inverted polygons (this will safely be skipped for lines because invertedPolygons.length === 0)
    if (invertedPolygons.length > 0) {
      // Deep copy the cached world ring to prevent OpenLayers mutation bugs
      let clonedWorldRing = K_CACHED_WORLD_RING.map(coord => [coord[0], coord[1]]);

      if (type === 'Polygon') {
        let rings = geometry.getCoordinates();
        rings.unshift(clonedWorldRing); 
        geometry.setCoordinates(rings);
      } else if (type === 'MultiPolygon') {
        let polys = geometry.getCoordinates();
        invertedPolygons.forEach(index => {
          polys[index].unshift(clonedWorldRing);
        });
        geometry.setCoordinates(polys);
      }
    }
  } else {
    geometry.transform('EPSG:4326', GT.settings.map.projection);
  }

  let style = new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: borderColor,
      width: borderWidth
    }),
    fill: new ol.style.Fill({
      color: fillColor // OpenLayers ignores fill on lines, so leaving this here is perfectly safe
    })
  });

  feature.setStyle(style);
  feature.set("prop", propname);
  feature.size = 2;
  return feature;
}

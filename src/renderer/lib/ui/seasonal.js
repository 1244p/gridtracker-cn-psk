// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Seasonal surprises: the Santa Tracker button (Dec 1 to 25, local time; Santa leaves at 00:00 on Dec 24, with a countdown until then) and the New Year fireworks (local midnight
// on Jan 1). Nothing here is in Settings or the button panel the rest of the year.

GT.santa = {
  active: false,
  year: 0,
  stops: [],
  timer: null,
  drawnSource: null,
  drawnIndex: -1,
  ticks: 0,
  labelText: null,
  lostAt: 0,
  clockOffset: 0,
  hiddenStyle: new ol.style.Style({}),
  marker: null,
  leg: null,
  markerStyle: null,
  where: null
};

GT.seasonalTimer = null;

GT.newYear = {
  running: false,
  lastYear: 0
};

const NEW_YEAR_SECONDS = 30;

// Nothing polls: one timer is set for the next time something changes (the Santa button's first and last moment, and
// midnight on Jan 1) and it sets the next one when it fires. A timer can only wait about 24 days, so a longer wait is
// split. The clock is also looked at again when the window gets focus, in case the PC slept through a change
const SEASONAL_MAX_WAIT = 2147483647;

function seasonalInit()
{
  nodeTimers.setTimeout(seasonalCheck, 1000);
  window.addEventListener("focus", seasonalCheck);
}

// Shows or hides the Santa button by the date, fires the fireworks at local midnight on Jan 1, and sets the next timer
function seasonalCheck()
{
  nodeTimers.clearTimeout(GT.seasonalTimer);
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const year = now.getFullYear();

  const show = month == 11 && day <= 25;
  santaButton.style.display = show ? "" : "none";
  if (!show && GT.santa.active) santaStop();

  // At the stroke of midnight, or within that first minute when GridTracker2 starts
  if (month == 0 && day == 1 && now.getHours() == 0 && now.getMinutes() == 0 && GT.newYear.lastYear != year)
  {
    newYearShow(year);
  }

  // The next change: the button's first moment (Dec 1) and last (the end of Dec 25), and the new year
  const moments = [
    new Date(year, 11, 1), new Date(year, 11, 26),
    new Date(year + 1, 11, 1), new Date(year + 1, 0, 1)
  ].map((date) => date.getTime() - now.getTime()).filter((ms) => ms > 0);
  // A few milliseconds past it, as a timer can fire just before its time
  GT.seasonalTimer = nodeTimers.setTimeout(seasonalCheck, Math.min(SEASONAL_MAX_WAIT, Math.min(...moments) + 25));
}

// ---- Santa Tracker

// The tour's clock. For real it runs at the speed of yours, from 00:00 on Dec 24 your time: that's when he leaves the North
// Pole, whatever your time zone, and then follows midnight west
function santaNow()
{
  const S = GT.santa;
  return Date.now() + S.clockOffset;
}

function santaRandom(seed)
{
  return function ()
  {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The route is a table made ahead of time (tools/santa_route.js): every DXCC entity, and each province of Canada and
// state of Mexico and the United States in place of those countries, the shortest way around while Santa still follows
// midnight west from the date line. Nothing is worked out here
function santaBuildTour(year)
{
  const table = requireJson("data/santa-route.json");
  const base = Date.UTC(year, 11, 24, 0, 0, 0);
  const stops = [];

  for (const [key, lat, lon, minutes] of table.stops)
  {
    let name;
    let flag;
    if (key.startsWith("e:"))
    {
      const info = GT.dxccInfo[key.slice(2)];
      if (!info) continue;
      name = info.name;
      flag = info.flag;
    }
    else
    {
      const state = GT.StateData[key.slice(2)];
      if (!state) continue;
      const country = GT.dxccInfo[state.dxcc];
      name = state.name;
      flag = country ? country.flag : "un.png";
    }
    stops.push({ key: key, t: base + minutes * 60000, lat: lat, lon: lon, name: name, flag: flag });
  }

  const pole = { lat: 90, lon: 0, name: I18N("santa.pole.label"), flag: "un.png", pole: true };
  stops.unshift({ ...pole, t: stops[0].t - 40 * 60000 });
  stops.push({ ...pole, t: stops[stops.length - 1].t + 40 * 60000 });
  return stops;
}

function santaDistanceKm(lat1, lon1, lat2, lon2)
{
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// The stop that is your location: your state or province, else your DXCC entity, else the stop nearest to you
function santaUserStop(stops)
{
  const grid = String(GT.settings.app.myGrid || "").toUpperCase().slice(0, 4);
  for (const postal of GT.gridToState[grid] || [])
  {
    const index = stops.findIndex((stop) => stop.key == "s:" + postal);
    if (index > -1) return index;
  }
  const entity = stops.findIndex((stop) => stop.key == "e:" + GT.myDXCC);
  if (entity > -1) return entity;

  let nearest = 1;
  for (let i = 1; i < stops.length - 1; i++)
  {
    if (santaDistanceKm(GT.myLat, GT.myLon, stops[i].lat, stops[i].lon) < santaDistanceKm(GT.myLat, GT.myLon, stops[nearest].lat, stops[nearest].lon)) nearest = i;
  }
  return nearest;
}

// Great circle between two points, f from 0 to 1
function santaSlerp(a, b, f)
{
  const rad = Math.PI / 180;
  const vec = (p) => [Math.cos(p.lat * rad) * Math.cos(p.lon * rad), Math.cos(p.lat * rad) * Math.sin(p.lon * rad), Math.sin(p.lat * rad)];
  const va = vec(a);
  const vb = vec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return { lat: a.lat, lon: a.lon };
  const k1 = Math.sin((1 - f) * omega) / Math.sin(omega);
  const k2 = Math.sin(f * omega) / Math.sin(omega);
  const v = [k1 * va[0] + k2 * vb[0], k1 * va[1] + k2 * vb[1], k1 * va[2] + k2 * vb[2]];
  return { lat: Math.asin(Math.max(-1, Math.min(1, v[2]))) / rad, lon: Math.atan2(v[1], v[0]) / rad };
}

// Where Santa is: at a stop for the first third of the way to the next one, then flying
function santaWhere(now)
{
  const stops = GT.santa.stops;
  const last = stops.length - 1;
  if (now <= stops[0].t) return { i: 0, from: stops[0], to: stops[1], lat: stops[0].lat, lon: stops[0].lon, flying: false };
  if (now >= stops[last].t) return { i: last, from: stops[last], to: null, lat: stops[last].lat, lon: stops[last].lon, flying: false };

  let i = 0;
  while (i < last - 1 && now >= stops[i + 1].t) i++;
  const from = stops[i];
  const to = stops[i + 1];
  const gap = to.t - from.t;
  const dwell = gap * 0.3;
  if (now < from.t + dwell) return { i: i, from: from, to: to, lat: from.lat, lon: from.lon, flying: false };

  let f = (now - from.t - dwell) / (gap - dwell);
  f = f * f * (3 - 2 * f);
  const p = santaSlerp(from, to, f);
  return { i: i, from: from, to: to, lat: p.lat, lon: p.lon, flying: true, f: f };
}

// The great circle from a to b between fractions f0 and f1 as a line. Like the flight paths, the longitude keeps going
// past 180 when the line crosses the date line, so it doesn't run back around the world
function santaArc(a, b, f0, f1)
{
  const steps = 40;
  const coords = [];
  let lonOff = 0;
  let lastLon = null;
  for (let i = 0; i <= steps; i++)
  {
    const p = santaSlerp(a, b, f0 + ((f1 - f0) * i) / steps);
    if (lastLon !== null && Math.abs(lastLon - p.lon) > 180) lonOff += p.lon < lastLon ? 360 : -360;
    lastLon = p.lon;
    coords.push(santaProject(p.lon + lonOff, p.lat));
  }
  return new ol.geom.LineString(coords);
}

// A place on the map. The projections that can show the poles show the North Pole itself; the flat map can't (it ends
// at 85 degrees), so there it's the top edge
function santaProject(lon, lat)
{
  if (GT.useTransform) return ol.proj.fromLonLat([lon, lat], GT.settings.map.projection);
  return ol.proj.fromLonLat([lon, Math.max(-85, Math.min(85, lat))]);
}

function santaPoint(lon, lat)
{
  return new ol.geom.Point(santaProject(lon, lat));
}

// The label under the sleigh: a rounded box with the text centered in it, drawn to a canvas (map text can't round its corners)
function santaLabelStyle(text)
{
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const font = "bold 13px sans-serif";
  const canvas = document.createElement("canvas");
  const c = canvas.getContext("2d");
  c.font = font;
  const metrics = c.measureText(text);
  const w = Math.ceil(metrics.width) + 18;
  const h = 22;
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  c.scale(dpr, dpr);

  c.fillStyle = "rgba(176, 24, 24, 0.92)";
  c.strokeStyle = "rgba(255, 255, 255, 0.85)";
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(0.5, 0.5, w - 1, h - 1, 11);
  c.fill();
  c.stroke();

  c.font = font;
  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  c.fillText(text, w / 2, h / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);

  return new ol.style.Style({
    image: new ol.style.Icon({
      img: canvas,
      imgSize: [canvas.width, canvas.height],
      scale: 1 / dpr,
      anchor: [0.5, 0],
      displacement: [0, -38]
    })
  });
}

let santaStarStyleShared = null;

function santaStarStyle()
{
  if (santaStarStyleShared) return santaStarStyleShared;
  return (santaStarStyleShared = new ol.style.Style({
    image: new ol.style.RegularShape({
      points: 5,
      radius: 6,
      radius2: 3,
      fill: new ol.style.Fill({ color: "#ffd23c" }),
      stroke: new ol.style.Stroke({ color: "#7a1010", width: 1 })
    })
  }));
}

// Mouse over a star: the DXCC entity, and the state or province when the stop is one
function santaStopOver(feature)
{
  const stop = GT.santa.stops[feature.get("santaIndex")];
  if (!stop) return false;

  let entity = stop.name;
  let place = "";
  let prefix = "";
  if (stop.key.startsWith("s:"))
  {
    const state = GT.StateData[stop.key.slice(2)];
    const country = state ? GT.dxccInfo[state.dxcc] : null;
    if (country) { entity = country.name; prefix = country.pp; place = stop.name; }
  }
  else
  {
    const info = GT.dxccInfo[stop.key.slice(2)];
    if (info) prefix = info.pp;
  }

  let html = `<div style='font-size:15px;color:cyan;' class='roundBorder'><img style='margin-bottom:-3px;height:14px' src='img/flags/16/${stop.flag}'> <font color='white'><b>${entity}</b></font>`;
  if (prefix) html += ` <font color='orange'>(${prefix})</font>`;
  if (place) html += `<br><font color='lightgreen'>${place}</font>`;
  html += "</div>";

  santaTooltip.innerHTML = html;
  santaStopMove(feature);
  santaTooltip.style.zIndex = 499;
  santaTooltip.style.display = "block";
  return true;
}

function santaStopMove()
{
  const box = santaTooltip.getBoundingClientRect();
  santaTooltip.style.left = getMouseX() - box.width / 2 + "px";
  santaTooltip.style.top = getMouseY() - box.height - 22 + "px";
}

function santaStopOut()
{
  santaTooltip.style.zIndex = -1;
}

// The route so far: a line and a star per stop. Rebuilt when Santa reaches a new stop (or the map is rebuilt)
function santaDrawRoute(where)
{
  const S = GT.santa;
  const source = GT.layerSources.santa;
  source.clear();

  const trail = new ol.style.Style({ stroke: new ol.style.Stroke({ color: "#e02a2a", width: 2, lineDash: [6, 5] }) });
  for (let j = 0; j <= where.i; j++)
  {
    const stop = S.stops[j];
    if (!stop.pole)
    {
      const star = new ol.Feature({ geometry: santaPoint(stop.lon, stop.lat), prop: "santaStop", santaIndex: j });
      star.setStyle(santaStarStyle());
      source.addFeature(star);
    }
    if (j > 1 && j <= where.i)
    {
      const line = new ol.Feature({ geometry: santaArc(S.stops[j - 1], stop, 0, 1), prop: "santaLeg" });
      line.setStyle(trail);
      source.addFeature(line);
    }
  }

  S.leg = new ol.Feature({ prop: "santaLeg" });
  S.leg.setStyle(trail);
  source.addFeature(S.leg);

  S.marker = new ol.Feature({ prop: "santa" });
  S.marker.setStyle(S.markerStyle);
  source.addFeature(S.marker);

  S.drawnSource = source;
  S.drawnIndex = where.i;
}

function santaTick()
{
  const S = GT.santa;
  if (!S.active) return;

  // Contact is lost when he reaches the stop two before yours: his last known place stays
  const lostAt = S.lostAt;
  const real = santaNow();
  const lost = real >= lostAt;
  const now = Math.min(real, lostAt);
  const where = santaWhere(now);
  S.where = where;

  if (S.drawnSource !== GT.layerSources.santa || S.drawnIndex != where.i) santaDrawRoute(where);

  const near = where.flying && where.f > 0.5 ? where.to : where.from;
  if (lost)
  {
    S.leg.setGeometry(null);
    S.marker.setGeometry(null);
  }
  else
  {
    // The line of the leg he's on, from the last stop to where he is
    S.leg.setGeometry(where.flying ? santaArc(where.from, where.to, 0, where.f) : null);
    S.marker.setGeometry(santaPoint(where.lon, where.lat));
    if (S.labelText != near.name)
    {
      S.labelText = near.name;
      S.markerStyle[1] = santaLabelStyle(near.name);
    }

    // The signal flickers in the last few seconds before it goes
    const secondsLeft = (lostAt - real) / 1000;
    S.ticks++;
    S.marker.setStyle(secondsLeft < 6 && S.ticks % 2 ? S.hiddenStyle : S.markerStyle);
  }

  santaUpdateLegend(now, where, near, lost);
  santaUpdateCountdown();
}

// Until he leaves, at 00:00 on Dec 24 your time: days, hours, minutes and seconds to go, top center of the map
function santaUpdateCountdown(real = Date.now())
{
  const left = new Date(GT.santa.year, 11, 24, 0, 0, 0).getTime() - real;
  if (left <= 0)
  {
    santaCountdown.style.display = "none";
    return;
  }

  const total = Math.ceil(left / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  santaCdDays.textContent = Math.floor(total / 86400);
  santaCdHours.textContent = pad(Math.floor((total % 86400) / 3600));
  santaCdMinutes.textContent = pad(Math.floor((total % 3600) / 60));
  santaCdSeconds.textContent = pad(total % 60);

  // Centered on the map, which is the window less the button panel
  const map = mapDiv.getBoundingClientRect();
  const main = document.getElementById("main").getBoundingClientRect();
  santaCountdown.style.left = map.left - main.left + map.width / 2 + "px";
  santaCountdown.style.display = "";
}

function santaUpdateLegend(now, where, near, lost)
{
  const S = GT.santa;
  const flag = (stop) => `<img style="margin-bottom:-3px;height:14px" src="img/flags/16/${stop.flag}"> `;
  santaOverTr.style.display = santaNextTr.style.display = lost ? "none" : "";
  santaLostTr.style.display = lost ? "" : "none";
  if (lost)
  {
    santaLastSeenText.innerHTML = flag(near) + near.name;
  }
  else
  {
    santaOverText.innerHTML = flag(near) + near.name;
    santaNextText.innerHTML = where.to ? flag(where.to) + where.to.name : "";
  }

  const first = S.stops[1].t;
  const lastStop = S.stops[S.stops.length - 2].t;
  const progress = Math.max(0, Math.min(1, (now - first) / (lastStop - first)));
  santaGiftsText.textContent = Math.floor(progress * 2300000000).toLocaleString();
}

function santaCenter()
{
  const where = GT.santa.where;
  if (!GT.santa.active || !where) return;
  const center = santaPoint(where.lon, where.lat).getCoordinates();
  GT.map.getView().animate({ center: center, duration: 600 });
}

function toggleSanta()
{
  if (GT.santa.active) santaStop();
  else santaStart();
}

function santaStart()
{
  const S = GT.santa;
  if (S.active) return;

  S.year = new Date().getFullYear();
  S.stops = santaBuildTour(S.year);
  // Moving on the stroke of 00:00 on Dec 24: after his short wait at the pole (a third of the way to the first stop)
  S.clockOffset = S.stops[0].t + (S.stops[1].t - S.stops[0].t) * 0.3 - new Date(S.year, 11, 24, 0, 0, 0).getTime();
  S.lostAt = S.stops[Math.max(1, santaUserStop(S.stops) - 2)].t;
  S.drawnSource = null;
  S.drawnIndex = -1;

  // The sleigh, and under it the name of the place (a rounded label)
  S.labelText = null;
  S.markerStyle = [new ol.style.Style({ image: new ol.style.Icon({ src: "img/santa_sleigh.png", scale: 0.5 }) }), null];
  GT.hoverFunctors.santaStop = { hover: santaStopOver, move: santaStopMove, out: santaStopOut };

  S.active = true;
  santaDiv.style.display = "";
  santaImg.style.filter = "";
  santaTick();
  S.timer = nodeTimers.setInterval(santaTick, 1000);
}

function santaStop()
{
  const S = GT.santa;
  if (!S.active) return;
  S.active = false;
  nodeTimers.clearInterval(S.timer);
  S.timer = null;
  if (GT.layerSources.santa) GT.layerSources.santa.clear();
  S.drawnSource = null;
  S.marker = null;
  S.leg = null;
  santaDiv.style.display = "none";
  santaCountdown.style.display = "none";
  santaImg.style.filter = "grayscale(1)";
}

// ---- New Year fireworks: rockets and bursts on a canvas over the map, and the greeting dancing around

function newYearShow(year)
{
  const N = GT.newYear;
  if (N.running) return;
  N.running = true;
  N.lastYear = new Date().getFullYear();

  const rect = mapDiv.getBoundingClientRect();
  const box = document.createElement("div");
  box.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:90;pointer-events:none;overflow:hidden;`;
  const backdrop = document.createElement("div");
  backdrop.style.cssText = "position:absolute;inset:0;background:rgba(2,2,22,0.5);opacity:0;transition:opacity 1.5s;";
  const fx = document.createElement("canvas");
  const txt = document.createElement("canvas");
  for (const c of [fx, txt]) c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
  box.append(backdrop, fx, txt);
  document.getElementById("main").appendChild(box);
  requestAnimationFrame(() => { backdrop.style.opacity = "1"; });

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0;
  let H = 0;
  const resize = () =>
  {
    const r = mapDiv.getBoundingClientRect();
    box.style.left = r.left + "px";
    box.style.top = r.top + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
    if (r.width != W || r.height != H)
    {
      W = r.width;
      H = r.height;
      for (const c of [fx, txt]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    }
  };
  resize();

  const fxc = fx.getContext("2d");
  const txc = txt.getContext("2d");
  const message = I18N("newyear.welcome.label").replace("{year}", year);
  const rockets = [];
  const sparks = [];
  const start = performance.now();
  let last = start;
  let launchIn = 0.2;
  let cancelled = false;

  const onKey = (event) => { if (event.key == "Escape") cancelled = true; };
  const onMapClick = () => { cancelled = true; };
  window.addEventListener("keydown", onKey);
  // A click on the map ends the show: it fades out
  mapDiv.addEventListener("pointerdown", onMapClick, true);
  let fadeStart = null;

  function launch()
  {
    rockets.push({
      x: W * (0.1 + Math.random() * 0.8),
      y: H,
      vx: (Math.random() - 0.5) * 60,
      vy: -(H * (0.75 + Math.random() * 0.35)),
      hue: Math.random() * 360
    });
  }

  function burst(x, y, hue)
  {
    const kind = Math.floor(Math.random() * 4);
    const count = kind == 2 ? 70 : 90;
    const speed = (Math.min(W, H) / 3.2) * (0.7 + Math.random() * 0.6);
    for (let i = 0; i < count; i++)
    {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
      let v = speed;
      if (kind == 0) v = speed * Math.random();
      if (kind == 3) v = speed * (i % 2 ? 1 : 0.55);
      sparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0,
        max: kind == 2 ? 2.6 + Math.random() : 1.3 + Math.random() * 0.8,
        hue: kind == 2 ? 42 : (hue + (kind == 3 && i % 2 ? 40 : 0) + Math.random() * 25) % 360,
        drag: kind == 2 ? 1.6 : 0.9,
        gravity: kind == 2 ? 130 : 70
      });
    }
  }

  function drawText(t)
  {
    txc.setTransform(dpr, 0, 0, dpr, 0, 0);
    txc.clearRect(0, 0, W, H);
    const alpha = Math.min(1, t / 1.2, (NEW_YEAR_SECONDS - t) / 2);
    if (alpha <= 0) return;

    let size = Math.max(36, Math.min(150, W * 0.09));
    txc.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    const fit = (W * 0.86) / txc.measureText(message).width;
    if (fit < 1)
    {
      size *= fit;
      txc.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    }

    const width = txc.measureText(message).width;
    const cx = W / 2 + Math.sin(t * 0.9) * Math.max(0, (W - width) / 2 - 10);
    const cy = H / 2 + Math.sin(t * 1.3 + 1) * H * 0.3;
    txc.globalAlpha = alpha;
    txc.translate(cx, cy);
    txc.rotate(Math.sin(t * 1.7) * 0.1);
    const pulse = 1 + 0.06 * Math.sin(t * 6);
    txc.scale(pulse, pulse);
    txc.textBaseline = "middle";
    txc.lineJoin = "round";
    txc.lineWidth = size * 0.1;
    txc.strokeStyle = "rgba(0, 0, 0, 0.8)";

    let x = -width / 2;
    let i = 0;
    for (const ch of message)
    {
      const w = txc.measureText(ch).width;
      const y = Math.sin(t * 5 + i * 0.6) * size * 0.14;
      txc.shadowColor = `hsl(${(t * 90 + i * 18) % 360}, 100%, 60%)`;
      txc.shadowBlur = 24;
      txc.fillStyle = `hsl(${(t * 90 + i * 18) % 360}, 100%, 62%)`;
      txc.strokeText(ch, x, y);
      txc.fillText(ch, x, y);
      x += w;
      i++;
    }
    txc.setTransform(1, 0, 0, 1, 0, 0);
    txc.globalAlpha = 1;
    txc.shadowBlur = 0;
  }

  function frame(now)
  {
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();

    // More and more rockets, and a finale in the last few seconds
    if (t < NEW_YEAR_SECONDS - 2 && !cancelled)
    {
      launchIn -= dt;
      if (launchIn <= 0)
      {
        const finale = t > NEW_YEAR_SECONDS - 6;
        launch();
        if (finale) { launch(); launch(); }
        launchIn = finale ? 0.18 : 0.55 - 0.25 * (t / NEW_YEAR_SECONDS) + Math.random() * 0.2;
      }
    }

    fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxc.globalCompositeOperation = "destination-out";
    fxc.fillStyle = `rgba(0, 0, 0, ${Math.min(1, dt * 7)})`;
    fxc.fillRect(0, 0, W, H);
    fxc.globalCompositeOperation = "lighter";

    for (let i = rockets.length - 1; i >= 0; i--)
    {
      const r = rockets[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy += H * 0.55 * dt;
      fxc.fillStyle = `hsl(${r.hue}, 100%, 75%)`;
      fxc.beginPath();
      fxc.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
      fxc.fill();
      if (r.vy > -H * 0.12)
      {
        burst(r.x, r.y, r.hue);
        rockets.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--)
    {
      const s = sparks[i];
      s.life += dt;
      if (s.life >= s.max)
      {
        sparks.splice(i, 1);
        continue;
      }
      const k = Math.exp(-s.drag * dt);
      s.vx *= k;
      s.vy = s.vy * k + s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const fade = 1 - s.life / s.max;
      fxc.fillStyle = `hsla(${s.hue}, 100%, ${55 + 30 * fade}%, ${fade})`;
      fxc.beginPath();
      fxc.arc(s.x, s.y, 1.2 + 1.8 * fade, 0, Math.PI * 2);
      fxc.fill();
    }
    fxc.globalCompositeOperation = "source-over";

    drawText(t);

    if (cancelled && fadeStart === null)
    {
      fadeStart = now;
      box.style.transition = "opacity 1.2s";
      box.style.opacity = "0";
    }
    if (t >= NEW_YEAR_SECONDS - 1) backdrop.style.opacity = "0";
    const over = t >= NEW_YEAR_SECONDS;
    if ((fadeStart !== null && now - fadeStart > 1300) || (over && sparks.length == 0 && rockets.length == 0) || t > NEW_YEAR_SECONDS + 4)
    {
      window.removeEventListener("keydown", onKey);
      mapDiv.removeEventListener("pointerdown", onMapClick, true);
      box.remove();
      N.running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

seasonalInit();

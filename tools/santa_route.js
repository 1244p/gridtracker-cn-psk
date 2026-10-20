// Plots the Santa Tracker's route (the table in resources/data/santa-route.json, which GridTracker2 reads as it is: nothing
// is computed at run time). Run it again only when the stops change.
// Usage (repo root):
//   node tools/cdp.mjs GridTracker2.html evalfile tools/santa_route_export.js > santa_stops.json   (dev copy running)
//   node tools/santa_route.js santa_stops.json            dry run: the route's length
//   node tools/santa_route.js santa_stops.json write      writes resources/data/santa-route.json
// The shortest way around every stop (a traveling salesman path from and back to the North Pole, found by simulated
// annealing), where each stop still comes within two hours of its own midnight, so Santa still moves west with it
// around the world. The table has each stop's key ("e:" DXCC entity, "s:" state / province), place and minutes after
// 00:00 UTC on Dec 24 (the year's own date is added at run time).
const fs = require("fs");

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^﻿/, ""));
const stopsIn = typeof input === "string" ? JSON.parse(input) : input;
const write = process.argv[3] === "write";
const n = stopsIn.length;
const POLE = { lat: 84, lon: 0 };
const WINDOW_HOURS = 2.0;
const PENALTY_KM_PER_HOUR = 20000;

// Deterministic, so the same stops give the same route
let seed = 20261224;
const rand = () =>
{
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const km = (a, b) =>
{
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Nodes 0..n-1 are the stops, n the North Pole where he starts and n + 1 where he ends
const nodes = stopsIn.concat([POLE, POLE]);
const START = n;
const END = n + 1;
const D = new Float32Array((n + 2) * (n + 2));
for (let a = 0; a < n + 2; a++) for (let b = 0; b < n + 2; b++) D[a * (n + 2) + b] = km(nodes[a], nodes[b]);
const dist = (a, b) => D[a * (n + 2) + b];

// Hours after 00:00 UTC on Dec 24 when it's midnight at the stop, and the times of the route's positions: those same
// times, in order
const midnight = stopsIn.map((s) => 24 - (s.lon + (s.ahead ? 360 : 0)) / 15);
const slots = midnight.slice().sort((a, b) => a - b);
const pen = (stop, pos) => Math.max(0, Math.abs(midnight[stop] - slots[pos]) - WINDOW_HOURS) * PENALTY_KM_PER_HOUR;

// A start: bands of longitude from the east, each swept north to south and back
const BAND = 10;
const order = stopsIn.map((s, i) => i).sort((a, b) => midnight[a] - midnight[b]);
const bands = {};
for (const i of order) (bands[Math.floor((midnight[i] - slots[0]) / (BAND / 15))] = bands[Math.floor((midnight[i] - slots[0]) / (BAND / 15))] || []).push(i);
let route = [];
Object.keys(bands).map(Number).sort((a, b) => a - b).forEach((band, k) =>
{
  const list = bands[band].sort((a, b) => (k % 2 ? 1 : -1) * (stopsIn[b].lat - stopsIn[a].lat));
  route = route.concat(list);
});

function windowCost(sub, lo)
{
  const hi = lo + sub.length - 1;
  let prev = lo == 0 ? START : route[lo - 1];
  let cost = 0;
  for (let k = 0; k < sub.length; k++)
  {
    cost += dist(prev, sub[k]) + pen(sub[k], lo + k);
    prev = sub[k];
  }
  return cost + dist(prev, hi == n - 1 ? END : route[hi + 1]);
}

function lengthKm(r)
{
  let total = dist(START, r[0]) + dist(r[n - 1], END);
  for (let i = 0; i < n - 1; i++) total += dist(r[i], r[i + 1]);
  return total;
}

function worstHours(r)
{
  let worst = 0;
  let over = 0;
  r.forEach((s, p) =>
  {
    const h = Math.abs(midnight[s] - slots[p]);
    worst = Math.max(worst, h);
    if (h > WINDOW_HOURS) over++;
  });
  return { worst, over };
}

// A random move: reverse a stretch, or move a stretch of up to three stops (either way round) a little way along
function candidate()
{
  const span = 2 + Math.floor(Math.exp(rand() * Math.log(80)));
  if (rand() < 0.5)
  {
    const lo = Math.floor(rand() * (n - 1));
    const hi = Math.min(n - 1, lo + span);
    if (hi <= lo) return null;
    return { lo, sub: route.slice(lo, hi + 1).reverse() };
  }
  const len = 1 + Math.floor(rand() * 3);
  const a = Math.floor(rand() * (n - len));
  const b = a + len - 1;
  const k = rand() < 0.5 ? Math.min(n - len, b + 1 + Math.floor(rand() * span)) : Math.max(0, a - 1 - Math.floor(rand() * span));
  let seg = route.slice(a, b + 1);
  if (rand() < 0.5) seg = seg.reverse();
  if (k > b) return { lo: a, sub: route.slice(b + 1, k + len).concat(seg) };
  if (k < a) return { lo: k, sub: seg.concat(route.slice(k, a)) };
  return null;
}

function anneal(iterations, t0, t1)
{
  for (let it = 0; it < iterations; it++)
  {
    const move = candidate();
    if (!move) continue;
    const old = windowCost(route.slice(move.lo, move.lo + move.sub.length), move.lo);
    const next = windowCost(move.sub, move.lo);
    const delta = next - old;
    const temp = t0 * Math.pow(t1 / t0, it / iterations);
    if (delta < 0 || rand() < Math.exp(-delta / temp))
    {
      for (let k = 0; k < move.sub.length; k++) route[move.lo + k] = move.sub[k];
    }
  }
}

const total = (r) => lengthKm(r) + r.reduce((sum, s, p) => sum + pen(s, p), 0);
const before = { km: lengthKm(route), ...worstHours(route) };
anneal(20000000, 400, 0.5);
anneal(6000000, 1, 0.01);
const after = { km: lengthKm(route), ...worstHours(route) };
console.log(`${n} stops`);
console.log(`start (bands of ${BAND} degrees): ${Math.round(before.km)} km, worst ${before.worst.toFixed(2)} h from its midnight, ${before.over} beyond ${WINDOW_HOURS} h`);
console.log(`route: ${Math.round(after.km)} km, worst ${after.worst.toFixed(2)} h from its midnight, ${after.over} beyond ${WINDOW_HOURS} h (cost ${Math.round(total(route))})`);

// The table
let last = -1;
const table = route.map((s, p) =>
{
  let minutes = Math.round(slots[p] * 600) / 10;
  if (minutes <= last) minutes = Math.round((last + 0.1) * 10) / 10;
  last = minutes;
  return [stopsIn[s].key, Math.round(stopsIn[s].lat * 10000) / 10000, Math.round(stopsIn[s].lon * 10000) / 10000, minutes];
});

if (write)
{
  const file = "resources/data/santa-route.json";
  const text = '{\r\n  "comment": "Santa Tracker route, made by tools/santa_route.js: [stop, lat, lon, minutes after 00:00 UTC on Dec 24]. Stops are e:<DXCC> or s:<state or province>.",\r\n  "stops": [\r\n' +
    table.map((row) => "    " + JSON.stringify(row)).join(",\r\n") + "\r\n  ]\r\n}\r\n";
  fs.writeFileSync(file, text);
  console.log("written " + file + " (" + table.length + " stops)");
}
else
{
  console.log("dry run: nothing written");
}

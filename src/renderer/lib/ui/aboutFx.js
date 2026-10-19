// GridTracker Copyright © 2026 GridTracker.org
// All rights reserved.
// See LICENSE for more information.

// Settings -> About: an animated map behind the title (Maidenhead squares lighting up in the gridsquare colors as if
// stations were heard, QSO paths arcing out from home, the grayline drifting by) and the panel's entrance animation.
// It runs only while the About tab is on screen: the loop stops itself once it isn't, and openSettingsTab /
// showSettingsBox (panel.js) start it again. With "reduce motion" set in the OS, or the map's Animate (Settings -> Map
// -> Paths) off, one still frame is drawn and the entrance doesn't play.

// A grid square is 2 deg of longitude by 1 deg of latitude: twice as wide as tall on a flat map
const ABOUT_FX_SQUARE_W = 30;
const ABOUT_FX_SQUARE_H = 15;
const ABOUT_FX_FIELD = 6;
// Worked, confirmed, QSX, CQ, CQ DX, QTH (the default gridsquare colors)
const ABOUT_FX_COLORS = ["#eeee00", "#ee0000", "#1111ee", "#00ff00", "#00ffff", "#ffa600"];
const AboutFx = { raf: 0, start: 0, last: 0, cells: [], paths: [], nextCell: 0, nextPath: 0, w: 0, h: 0 };

function startAboutFx()
{
  // Still, with no animation at all: "reduce motion" in the OS, or Settings -> Map -> Paths -> Animate off
  const still = GT.settings.map.animate == false || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  aboutDiv.classList.toggle("aboutStill", still);

  // Replay the entrance animation
  aboutDiv.classList.remove("aboutPlay");
  void aboutDiv.offsetWidth;
  if (!still) aboutDiv.classList.add("aboutPlay");

  if (AboutFx.raf) return;
  const now = performance.now();
  AboutFx.start = AboutFx.last = now;
  AboutFx.cells = [];
  AboutFx.paths = [];
  AboutFx.nextCell = now;
  AboutFx.nextPath = now + 700;

  if (still)
  {
    // A still frame: some squares lit, one path drawn
    aboutFxSize();
    for (let i = 0; i < 18; i++) aboutFxAddCell(now - 1500);
    if (AboutFx.cells.length) aboutFxAddPath(now - 1200, AboutFx.cells[0]);
    aboutFxDraw(now);
    return;
  }
  AboutFx.raf = requestAnimationFrame(aboutFxFrame);
}

function aboutFxShowing()
{
  return rootSettingsDiv.style.display == "inline-flex" && aboutDiv.style.display != "none";
}

function aboutFxSize()
{
  const canvas = aboutCanvas;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w != AboutFx.w || h != AboutFx.h || canvas.width != Math.round(w * dpr))
  {
    AboutFx.w = w;
    AboutFx.h = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  return dpr;
}

// The map pans slowly to the left; positions are in map pixels, drawn shifted by the pan
function aboutFxPan(now)
{
  return (now - AboutFx.start) * 0.008;
}

function aboutFxAddCell(now)
{
  const pan = aboutFxPan(now);
  const gx = Math.floor((pan + AboutFx.w * (0.25 + Math.random() * 0.75)) / ABOUT_FX_SQUARE_W);
  const gy = Math.floor(Math.random() * Math.max(1, AboutFx.h / ABOUT_FX_SQUARE_H));
  const cell = { gx, gy, color: ABOUT_FX_COLORS[Math.floor(Math.random() * 5)], born: now, life: 3200 + Math.random() * 2400 };
  AboutFx.cells.push(cell);
  if (AboutFx.cells.length > 60) AboutFx.cells.shift();
  return cell;
}

function aboutFxAddPath(now, cell)
{
  AboutFx.paths.push({ cell, born: now, grow: 900, hold: 900, fade: 800 });
  if (AboutFx.paths.length > 6) AboutFx.paths.shift();
}

// Home: a square near the left, fixed on screen
function aboutFxHome()
{
  return { x: Math.round(AboutFx.w * 0.16 / ABOUT_FX_SQUARE_W) * ABOUT_FX_SQUARE_W + ABOUT_FX_SQUARE_W / 2, y: Math.round(AboutFx.h * 0.68 / ABOUT_FX_SQUARE_H) * ABOUT_FX_SQUARE_H + ABOUT_FX_SQUARE_H / 2 };
}

function aboutFxFrame(now)
{
  if (!aboutFxShowing())
  {
    AboutFx.raf = 0;
    return;
  }
  if (now >= AboutFx.nextCell)
  {
    aboutFxAddCell(now);
    AboutFx.nextCell = now + 180 + Math.random() * 220;
  }
  if (now >= AboutFx.nextPath)
  {
    // A path to one of the newer squares, far enough from home to arc
    const home = aboutFxHome();
    const pan = aboutFxPan(now);
    const far = AboutFx.cells.filter((c) => now - c.born < 1200 && c.gx * ABOUT_FX_SQUARE_W - pan - home.x > AboutFx.w * 0.25);
    if (far.length) aboutFxAddPath(now, far[far.length - 1]);
    AboutFx.nextPath = now + 1100 + Math.random() * 900;
  }
  aboutFxDraw(now);
  AboutFx.raf = requestAnimationFrame(aboutFxFrame);
}

function aboutFxDraw(now)
{
  const dpr = aboutFxSize();
  const ctx = aboutCanvas.getContext("2d");
  const w = AboutFx.w, h = AboutFx.h, s = ABOUT_FX_SQUARE_W, sh = ABOUT_FX_SQUARE_H;
  const pan = aboutFxPan(now);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Night-sky backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#030b1c");
  bg.addColorStop(1, "#071a33");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Squares, with every sixth line brighter (fields)
  const first = Math.floor(pan / s);
  ctx.lineWidth = 1;
  for (let i = -ABOUT_FX_FIELD; i <= w / s + ABOUT_FX_FIELD; i++)
  {
    const x = Math.round(i * s - (pan % s)) + 0.5;
    const field = (first + i) % ABOUT_FX_FIELD == 0;
    ctx.strokeStyle = field ? "rgba(90, 160, 255, 0.28)" : "rgba(90, 160, 255, 0.09)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let j = 0; j <= h / sh; j++)
  {
    const y = j * sh + 0.5;
    ctx.strokeStyle = j % ABOUT_FX_FIELD == 0 ? "rgba(90, 160, 255, 0.28)" : "rgba(90, 160, 255, 0.09)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Lit squares: fade in, glow, fade out
  AboutFx.cells = AboutFx.cells.filter((c) => now - c.born < c.life);
  for (const c of AboutFx.cells)
  {
    const age = now - c.born;
    const a = Math.min(1, age / 300) * Math.min(1, (c.life - age) / 1200);
    const x = c.gx * s - pan, y = c.gy * sh;
    if (x < -s || x > w) continue;
    ctx.globalAlpha = 0.45 * a;
    ctx.fillStyle = c.color;
    ctx.fillRect(x + 1, y + 1, s - 1, sh - 1);
    ctx.globalAlpha = 0.9 * a;
    ctx.strokeStyle = c.color;
    ctx.strokeRect(x + 1.5, y + 1.5, s - 2, sh - 2);
  }
  ctx.globalAlpha = 1;

  // QSO paths: an arc from home that draws itself, holds, then fades
  const home = aboutFxHome();
  AboutFx.paths = AboutFx.paths.filter((p) => now - p.born < p.grow + p.hold + p.fade);
  for (const p of AboutFx.paths)
  {
    const age = now - p.born;
    const grown = Math.min(1, age / p.grow);
    const alpha = age < p.grow + p.hold ? 1 : 1 - (age - p.grow - p.hold) / p.fade;
    const tx = p.cell.gx * s - pan + s / 2, ty = p.cell.gy * sh + sh / 2;
    const cx = (home.x + tx) / 2;
    // The arc's control point, but never so high that the arc's peak (a quarter of each end plus half of it) leaves
    // the top of the map
    const cy = Math.max(Math.min(home.y, ty) - Math.abs(tx - home.x) * 0.35 - 20, (8 - 0.25 * (home.y + ty)) / 0.5);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = "#ff9a1f";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ff9a1f";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    let px = home.x, py = home.y;
    ctx.moveTo(px, py);
    const steps = 40;
    for (let k = 1; k <= steps * grown; k++)
    {
      const t = k / steps;
      px = (1 - t) * (1 - t) * home.x + 2 * (1 - t) * t * cx + t * t * tx;
      py = (1 - t) * (1 - t) * home.y + 2 * (1 - t) * t * cy + t * t * ty;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    // The signal's head while it travels
    if (grown < 1)
    {
      ctx.fillStyle = "#ffe0a0";
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Home square, pulsing
  const pulse = 0.5 + 0.5 * Math.sin((now - AboutFx.start) / 420);
  ctx.save();
  ctx.fillStyle = "rgba(255, 166, 0, " + (0.35 + 0.35 * pulse) + ")";
  ctx.shadowColor = "#ffa600";
  ctx.shadowBlur = 6 + 10 * pulse;
  ctx.fillRect(home.x - s / 2 + 1, home.y - sh / 2 + 1, s - 1, sh - 1);
  ctx.restore();

  // The grayline: a soft dark band drifting across
  const span = w + 400;
  const gx = ((now - AboutFx.start) * 0.02) % span - 200;
  const gray = ctx.createLinearGradient(gx - 160, 0, gx + 160, 0);
  gray.addColorStop(0, "rgba(0, 0, 10, 0)");
  gray.addColorStop(0.5, "rgba(0, 0, 10, 0.45)");
  gray.addColorStop(1, "rgba(0, 0, 10, 0)");
  ctx.fillStyle = gray;
  ctx.fillRect(0, 0, w, h);

  // Darken the left, where the title sits, so it reads over the map
  const veil = ctx.createLinearGradient(0, 0, w, 0);
  veil.addColorStop(0, "rgba(2, 8, 20, 0.55)");
  veil.addColorStop(0.55, "rgba(2, 8, 20, 0.15)");
  veil.addColorStop(1, "rgba(2, 8, 20, 0)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, w, h);
}

// Nine draw functions, one per scene "vis.kind". Same signature throughout:
//   fn(ctx, v, p, zone, palette)
// v = the block object from the scene spec, p = 0->1 progress within the
// scene's visual window, zone = {x,y,w,h}, palette = one of PALS. No block
// reads state outside its arguments, which is what makes adding a tenth
// block a self-contained job.
import { W, clamp, outExpo, outCubic, outBack, inOutCubic, niceMax, num, compactUSD, wrap } from './util.js';

export function counter(ctx, v, p, zone, P) {
  const e = outExpo(p);
  const val = (+v.from || 0) + ((+v.to || 0) - (+v.from || 0)) * e;
  const s = num(val, v.pre, v.suf);
  const size = s.length > 11 ? 150 : s.length > 8 ? 188 : 228;
  ctx.textAlign = "center"; ctx.font = '900 ' + size + 'px Archivo, sans-serif'; ctx.fillStyle = P.acc;
  ctx.fillText(s, W / 2, zone.y + zone.h / 2 + size * .18);
  const bw = 620, x = (W - bw) / 2, y = zone.y + zone.h / 2 + 140;
  ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fillRect(x, y, bw, 6);
  ctx.fillStyle = P.acc; ctx.fillRect(x, y, bw * e, 6);
  if (v.label) {
    ctx.font = '500 28px "IBM Plex Mono", monospace'; ctx.fillStyle = P.dim;
    ctx.fillText(String(v.label).toUpperCase(), W / 2, y + 70);
  }
}

export function bars(ctx, v, p, zone, P) {
  const rows = (v.rows || []).slice(0, 6); if (!rows.length) return;
  const ymax = niceMax(Math.max(...rows.map(r => +r.value || 0)) * 1.15);
  const n = rows.length, gap = 28, bw = (zone.w - gap * (n - 1)) / n, base = zone.y + zone.h - 70;
  ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(zone.x, base); ctx.lineTo(zone.x + zone.w, base); ctx.stroke();
  const span = Math.max(.25, 1 - (n - 1) * .1);
  rows.forEach((r, i) => {
    const e = outExpo(clamp((p - i * .1) / span, 0, 1));
    const h = ((+r.value || 0) / ymax) * (zone.h - 150) * e, x = zone.x + i * (bw + gap);
    ctx.fillStyle = r.hot ? P.hot : (i === n - 1 && !rows.some(q => q.hot) ? P.acc : P.acc2);
    ctx.fillRect(x, base - h, bw, Math.max(0, h));
    if (e > .02) {
      ctx.textAlign = "center"; ctx.font = '900 40px Archivo, sans-serif';
      ctx.fillStyle = r.hot ? P.hot : P.fg;
      ctx.fillText(num((+r.value || 0) * e, v.pre, v.suf), x + bw / 2, base - h - 24);
    }
    ctx.font = '500 24px "IBM Plex Mono", monospace'; ctx.fillStyle = P.dim; ctx.textAlign = "center";
    wrap(ctx, String(r.label || "").toUpperCase(), bw + 46).forEach((l, k) => ctx.fillText(l, x + bw / 2, base + 48 + k * 30));
  });
}

function strokeLine(ctx, arr, f, X, Y, col, w) {
  const idx = f * (arr.length - 1), i = Math.floor(idx), fr = idx - i;
  const a = arr[i], b = arr[Math.min(i + 1, arr.length - 1)], v = a + (b - a) * fr;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath();
  for (let k = 0; k <= i; k++) { const x = X(k, arr), y = Y(arr[k]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  const ex = X(i, arr) + (X(Math.min(i + 1, arr.length - 1), arr) - X(i, arr)) * fr;
  ctx.lineTo(ex, Y(v)); ctx.stroke();
  return { x: ex, y: Y(v), v };
}
function tip(ctx, name, val, x, y, col, size) {
  const cx = clamp(x, 200, W - 200); ctx.textAlign = "center";
  ctx.font = '500 23px "IBM Plex Mono", monospace'; ctx.fillStyle = col;
  ctx.globalAlpha *= .75; ctx.fillText(String(name || "").toUpperCase(), cx, y - size - 4);
  ctx.globalAlpha /= .75;
  ctx.font = '900 ' + size + 'px Archivo, sans-serif'; ctx.fillStyle = col;
  ctx.fillText(num(val, "$", ""), cx, y);
}

export function lines(ctx, v, p, zone, P) {
  let A = [], B = [], labA = "", labB = "", xa = "", xb = "";
  if (v.compound) {
    const c = v.compound, minAge = Math.min(+c.a.age, +c.b.age), end = Math.max(minAge + 1, +c.end || 65);
    const mk = (st, mo) => {
      const o = [], mr = (+c.rate || 8) / 100 / 12; let val = 0;
      const n = Math.round((end - minAge) * 12);
      for (let i = 0; i <= n; i++) { const age = minAge + i / 12; if (age >= st) val = val * (1 + mr) + (+mo); o.push(val); }
      return o;
    };
    A = mk(+c.a.age, +c.a.monthly); B = mk(+c.b.age, +c.b.monthly);
    labA = c.a.label; labB = c.b.label; xa = minAge; xb = end;
  } else {
    const s = v.series || []; A = (s[0] && s[0].values) || []; B = (s[1] && s[1].values) || [];
    labA = (s[0] && s[0].label) || ""; labB = (s[1] && s[1].label) || "";
    xa = (v.xLabels && v.xLabels[0]) || ""; xb = (v.xLabels && v.xLabels[1]) || "";
  }
  if (!A.length) return;
  const ymax = niceMax(Math.max(Math.max(...A), B.length ? Math.max(...B) : 0) * 1.1);
  const X = (i, arr) => zone.x + (i / (arr.length - 1)) * zone.w;
  const Y = val => zone.y + zone.h - 90 - (val / ymax) * (zone.h - 160);
  ctx.lineWidth = 2;
  for (let i = 0; i <= 3; i++) {
    const val = ymax * i / 3, y = Y(val);
    ctx.strokeStyle = "rgba(255,255,255,.09)";
    ctx.beginPath(); ctx.moveTo(zone.x, y); ctx.lineTo(zone.x + zone.w, y); ctx.stroke();
    if (i > 0) {
      ctx.fillStyle = "#5C6674"; ctx.font = '400 22px "IBM Plex Mono", monospace';
      ctx.textAlign = "right"; ctx.fillText(compactUSD(val), zone.x - 16, y + 8);
    }
  }
  ctx.textAlign = "center"; ctx.fillStyle = "#5C6674"; ctx.font = '400 22px "IBM Plex Mono", monospace';
  if (xa !== "") ctx.fillText(xa, zone.x, zone.y + zone.h - 30);
  if (xb !== "") ctx.fillText(xb, zone.x + zone.w, zone.y + zone.h - 30);
  const f = inOutCubic(p);
  const tB = B.length ? strokeLine(ctx, B, f, X, Y, P.acc2, 9) : null;
  const tA = strokeLine(ctx, A, f, X, Y, P.acc, 11);
  if (f > .02) {
    ctx.fillStyle = P.acc; ctx.beginPath(); ctx.arc(tA.x, tA.y, 15, 0, 7); ctx.fill();
    tip(ctx, labA, tA.v, tA.x, tA.y - 30, P.acc, 44);
    if (tB) {
      ctx.fillStyle = P.acc2; ctx.beginPath(); ctx.arc(tB.x, tB.y, 11, 0, 7); ctx.fill();
      tip(ctx, labB, tB.v, tB.x, tB.y + (Math.abs(tA.y - tB.y) < 150 ? 106 : 82), P.dim, 36);
    }
  }
}

export function stack(ctx, v, p, zone, P) {
  const segs = (v.segments || []).slice(0, 6); if (!segs.length) return;
  const tot = segs.reduce((n, s) => n + (+s.value || 0), 0) || 1;
  const barY = zone.y + 120, barH = 130; let x = zone.x;
  segs.forEach((s, i) => {
    const e = outExpo(clamp((p - i * .09) / .7, 0, 1));
    const w = (+s.value / tot) * zone.w * e;
    ctx.fillStyle = s.hot ? P.hot : (i % 2 ? P.acc2 : P.acc);
    ctx.fillRect(x, barY, w, barH);
    if (e > .5) {
      ctx.textAlign = "left"; ctx.font = '500 25px "IBM Plex Mono", monospace'; ctx.fillStyle = P.dim;
      const ly = barY + barH + 70 + i * 74;
      ctx.fillStyle = s.hot ? P.hot : (i % 2 ? P.acc2 : P.acc); ctx.fillRect(zone.x, ly - 22, 18, 18);
      ctx.fillStyle = P.dim; ctx.fillText(String(s.label || "").toUpperCase(), zone.x + 34, ly - 5);
      ctx.textAlign = "right"; ctx.font = '900 36px Archivo, sans-serif';
      ctx.fillStyle = s.hot ? P.hot : P.fg;
      ctx.fillText(num(+s.value, v.pre, v.suf), zone.x + zone.w, ly - 2);
    }
    x += w;
  });
}

export function grid(ctx, v, p, zone, P) {
  const total = clamp(+v.total || 10, 1, 40), filled = clamp(+v.filled || 0, 0, total);
  const cols = clamp(+v.cols || Math.ceil(Math.sqrt(total)), 1, 10);
  const rows = Math.ceil(total / cols);
  const cell = Math.min(zone.w / cols, (zone.h - 160) / rows);
  const r = cell * .34, ox = zone.x + (zone.w - cols * cell) / 2 + cell / 2, oy = zone.y + 40 + cell / 2;
  for (let i = 0; i < total; i++) {
    const cx = ox + (i % cols) * cell, cy = oy + Math.floor(i / cols) * cell;
    const on = i < filled;
    const e = outBack(clamp((p - i * (.75 / total)) / .28, 0, 1));
    ctx.beginPath(); ctx.arc(cx, cy, r * clamp(e, 0, 1.05), 0, 7);
    ctx.fillStyle = on ? P.hot : P.acc2; ctx.fill();
  }
  const big = filled + " / " + total;
  ctx.textAlign = "center"; ctx.font = '900 96px Archivo, sans-serif'; ctx.fillStyle = P.hot;
  ctx.fillText(big, W / 2, oy + rows * cell + 40);
  if (v.label) {
    ctx.font = '500 28px "IBM Plex Mono", monospace'; ctx.fillStyle = P.dim;
    wrap(ctx, String(v.label).toUpperCase(), 820).forEach((l, k) => ctx.fillText(l, W / 2, oy + rows * cell + 100 + k * 38));
  }
}

export function flow(ctx, v, p, zone, P) {
  const steps = (v.steps || []).slice(0, 5); if (!steps.length) return;
  const n = steps.length, gap = 34;
  const bh = Math.min(150, (zone.h - gap * (n - 1)) / n);
  steps.forEach((s, i) => {
    const e = outCubic(clamp((p - i * (.8 / n)) / .3, 0, 1));
    if (e <= 0) return;
    const y = zone.y + i * (bh + gap), hot = (+v.hot === i);
    ctx.globalAlpha *= e;
    ctx.strokeStyle = hot ? P.hot : P.acc2; ctx.lineWidth = hot ? 5 : 3;
    ctx.strokeRect(zone.x + 40, y, zone.w - 80, bh);
    if (hot) { ctx.fillStyle = "rgba(255,77,77,.10)"; ctx.fillRect(zone.x + 40, y, zone.w - 80, bh); }
    ctx.textAlign = "center"; ctx.font = '800 38px Archivo, sans-serif';
    ctx.fillStyle = hot ? P.hot : P.fg;
    const ls = wrap(ctx, String(s.label || s).toUpperCase(), zone.w - 140);
    ls.forEach((l, k) => ctx.fillText(l, W / 2, y + bh / 2 + 12 + (k - (ls.length - 1) / 2) * 44));
    if (i < n - 1) {
      ctx.strokeStyle = P.acc; ctx.lineWidth = 4; ctx.beginPath();
      ctx.moveTo(W / 2, y + bh + 6); ctx.lineTo(W / 2, y + bh + gap - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2 - 11, y + bh + gap - 18); ctx.lineTo(W / 2, y + bh + gap - 6);
      ctx.lineTo(W / 2 + 11, y + bh + gap - 18); ctx.stroke();
    }
    ctx.globalAlpha /= e;
  });
}

export function versus(ctx, v, p, zone, P) {
  const L = v.left || {}, R = v.right || {};
  const e = outExpo(p), mid = W / 2;
  ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(mid, zone.y + 40); ctx.lineTo(mid, zone.y + zone.h - 90); ctx.stroke();
  [[L, W * .27, P.acc], [R, W * .73, R.hot ? P.hot : P.fg]].forEach(([d, x, col]) => {
    const c = d.hot ? P.hot : col;
    ctx.textAlign = "center";
    ctx.font = '500 26px "IBM Plex Mono", monospace'; ctx.fillStyle = P.dim;
    wrap(ctx, String(d.label || "").toUpperCase(), 420).forEach((l, k) => ctx.fillText(l, x, zone.y + 70 + k * 34));
    const s = num((+d.value || 0) * e, d.pre, d.suf);
    ctx.font = '900 ' + (s.length > 7 ? 76 : 96) + 'px Archivo, sans-serif'; ctx.fillStyle = c;
    ctx.fillText(s, x, zone.y + zone.h / 2 + 30);
  });
  ctx.textAlign = "center"; ctx.font = '500 30px "IBM Plex Mono", monospace';
  ctx.fillStyle = P.dim; ctx.fillText("VS", mid, zone.y + zone.h / 2 + 30);
}

export function ticker(ctx, v, p, zone, P) {
  const items = (v.items || []).slice(0, 12); if (!items.length) return;
  const y = zone.y + zone.h / 2;
  ctx.font = '800 64px Archivo, sans-serif';
  const parts = []; let total = 0;
  items.forEach(t => { const s = String(t); const w = ctx.measureText(s).width + 90; parts.push({ s, w }); total += w; });
  const off = (p * total * 1.15) % total;
  ctx.textAlign = "left";
  for (let pass = 0; pass < 3; pass++) {
    let x = -off + pass * total;
    parts.forEach(pt => {
      if (x > -400 && x < W + 400) {
        const neg = /^-/.test(pt.s);
        ctx.fillStyle = neg ? P.hot : P.acc;
        ctx.fillText(pt.s, x, y + 22);
      }
      x += pt.w;
    });
  }
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, P.bg); g.addColorStop(.12, "rgba(0,0,0,0)");
  g.addColorStop(.88, "rgba(0,0,0,0)"); g.addColorStop(1, P.bg);
  ctx.fillStyle = g; ctx.fillRect(0, y - 90, W, 180);
}

export function text(ctx, v, p, zone, P) {
  const lines = (v.lines || [""]).slice(0, 5);
  ctx.textAlign = "left";
  const lh = 104; const startY = zone.y + zone.h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => {
    const e = outCubic(clamp((p - i * .16) / .34, 0, 1));
    if (e <= 0) return;
    const hot = (+v.hot === i);
    ctx.globalAlpha *= e;
    ctx.font = '900 ' + (hot ? 84 : 76) + 'px Archivo, sans-serif';
    ctx.fillStyle = hot ? P.hot : P.fg;
    ctx.fillText(String(l).toUpperCase(), zone.x - 40 + (1 - e) * 24, startY + i * lh);
    ctx.globalAlpha /= e;
  });
}

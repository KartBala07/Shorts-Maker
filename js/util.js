// Canvas dimensions and frame rate shared by the renderer, blocks and export.
export const W = 1080, H = 1920, FPS = 30;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
export const outExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
export const outCubic = x => 1 - Math.pow(1 - x, 3);
export const inOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const outBack = x => 1 + 2.0 * Math.pow(x - 1, 3) + 1.3 * Math.pow(x - 1, 2);

export function commas(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function num(n, pre, suf) {
  const a = Math.abs(n);
  const d = (a < 1000 && n % 1 !== 0) ? (+n).toFixed(1) : commas(n);
  return (pre || "") + d + (suf || "");
}

export function compactUSD(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return "$" + Math.round(n / 1e3) + "K";
  return "$" + Math.round(n);
}

export function niceMax(v) {
  if (v <= 0) return 1;
  const m = Math.pow(10, Math.floor(Math.log10(v))), n = v / m;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * m;
}

export function wrap(ctx, t, maxW) {
  const ws = String(t == null ? "" : t).split(/\s+/), out = [];
  let cur = "";
  for (const w of ws) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}

export function put(ctx, lines, x, y, lh, align) {
  ctx.textAlign = align || "left";
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

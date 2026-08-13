// Owns frame(t): resolves which scene is live at time t, computes local
// progress, draws the title/sub, and dispatches to the right block. The
// block call is wrapped in try/catch so one malformed block can't blank
// the frame.
import { W, H, clamp, seg, outCubic, wrap, put } from './util.js';
import { PALS } from './palettes.js';
import * as blocks from './blocks.js';

const BLOCK_FNS = {
  counter: blocks.counter,
  bars: blocks.bars,
  lines: blocks.lines,
  stack: blocks.stack,
  grid: blocks.grid,
  flow: blocks.flow,
  versus: blocks.versus,
  ticker: blocks.ticker,
  text: blocks.text
};

export function timings(spec, dur) {
  const s = spec.scenes || [];
  const tot = s.reduce((n, x) => n + (+x.dur || 1), 0) || 1;
  let acc = 0;
  return s.map(x => {
    const d = (+x.dur || 1) / tot * dur;
    const o = { scene: x, start: acc, end: acc + d, dur: d };
    acc += d;
    return o;
  });
}

export function sceneAt(spec, dur, t) {
  const T = timings(spec, dur);
  for (let i = 0; i < T.length; i++) {
    if (t < T[i].end || i === T.length - 1) {
      return { ...T[i], index: i, p: clamp((t - T[i].start) / T[i].dur, 0, 1) };
    }
  }
  return null;
}

export function frame(ctx, spec, dur, palKey, t) {
  const P = PALS[palKey] || PALS.terminal;
  ctx.globalAlpha = 1; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  const S = sceneAt(spec, dur, t);
  if (!S) return;
  const p = S.p;
  const inA = outCubic(seg(p, 0, .16));
  const outA = 1 - seg(p, .94, 1);
  const A = inA * outA;

  ctx.font = '800 60px Archivo, sans-serif'; ctx.fillStyle = P.fg; ctx.globalAlpha = A;
  const tl = wrap(ctx, String(S.scene.title || "").toUpperCase(), 900);
  const y1 = put(ctx, tl, 90, 300 + (1 - inA) * 26, 68, "left");
  if (S.scene.sub) {
    ctx.font = '500 28px "IBM Plex Mono", monospace'; ctx.fillStyle = P.dim;
    ctx.globalAlpha = A * outCubic(seg(p, .06, .22)) * .95;
    put(ctx, wrap(ctx, String(S.scene.sub).toUpperCase(), 900), 90, y1 + 36, 38, "left");
  }

  ctx.globalAlpha = A;
  const Z = { x: 130, y: 660, w: 820, h: 700 };
  const v = S.scene.vis || { kind: "text", lines: [""] };
  const vp = seg(p, .12, .90);
  try {
    (BLOCK_FNS[v.kind] || blocks.text)(ctx, v, vp, Z, P);
  } catch (e) { /* a bad block never kills the frame */ }
  ctx.globalAlpha = 1;
}

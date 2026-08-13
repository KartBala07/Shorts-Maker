import { W, H, FPS } from './util.js';
import { PALS } from './palettes.js';
import { MOODHINT, setMood, setVolume, startMusic, stopMusic, loadCustomTrack, clearCustomTrack } from './audio.js';
import { timings, frame } from './renderer.js';
import { recordShort } from './export.js';

const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const SEED = {
  meta: { palette: "terminal", mood: "pulse" },
  scenes: [
    { dur: 3, title: "Day trading is not a coin flip", sub: "It's worse than one",
      vis: { kind: "ticker", items: ["-$1,240", "-$860", "+$310", "-$2,105", "-$540", "+$95", "-$1,780"] } },
    { dur: 5, title: "Out of every 10 retail day traders", sub: "",
      vis: { kind: "grid", total: 10, filled: 7, cols: 5, label: "lose money over a year" } },
    { dur: 4, title: "And the ones who profit", sub: "",
      vis: { kind: "versus", left: { label: "Median winner", value: 1300, pre: "$" },
             right: { label: "Median loser", value: 4800, pre: "$", hot: true } } },
    { dur: 3, title: "The house isn't the market", sub: "",
      vis: { kind: "text", lines: ["It's the spread,", "the fees,", "and the tax bill."], hot: 2 } }
  ]
};

let spec = JSON.parse(JSON.stringify(SEED));
let dur = 15, raf = 0, playing = false, tStart = 0;
let palKey = "terminal";

function draw(t) { frame(ctx, spec, dur, palKey, t); }

/* ══════════ playback ══════════ */
function tick(now) {
  if (!tStart) tStart = now;
  const t = (now - tStart) / 1000;
  draw(Math.min(t, dur - .001));
  $("meter").textContent = t.toFixed(1) + "s";
  markLive(t);
  if (t < dur) raf = requestAnimationFrame(tick);
  else { playing = false; tStart = 0; stopMusic(); $("play").textContent = "Play"; }
}
function play() {
  cancelAnimationFrame(raf); stopMusic(); tStart = 0;
  if (reduced) { draw(dur * .5); return; }
  playing = true; $("play").textContent = "Playing";
  startMusic();
  raf = requestAnimationFrame(tick);
}
$("play").addEventListener("click", play);
$("dur").addEventListener("input", e => { dur = +e.target.value; $("durOut").textContent = dur; draw(dur * .35); drawTimeline(); });
$("vol").addEventListener("input", e => { setVolume(+e.target.value / 100); });

/* ══════════ export with sound ══════════ */
$("rec").addEventListener("click", async () => {
  const b = $("rec"); b.disabled = true; b.textContent = "Recording…";
  cancelAnimationFrame(raf);
  await recordShort({
    canvas: cv, fps: FPS, dur,
    renderFrame: draw,
    onTick: t => { $("meter").textContent = t.toFixed(1) + "s"; },
    onDone: blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "short-" + Date.now() + ".webm"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      b.disabled = false; b.textContent = "Export MP4-ready";
      say("Saved with the score baked in. CapCut imports .webm and exports MP4.", "ok");
    },
    onError: err => {
      b.disabled = false; b.textContent = "Export MP4-ready";
      say("Export failed: " + err.message, "err");
    }
  });
});

/* ══════════ timeline ══════════ */
function drawTimeline() {
  const tl = $("timeline"); tl.innerHTML = "";
  timings(spec, dur).forEach((T, i) => {
    const d = document.createElement("div"); d.className = "tcard";
    d.innerHTML = '<div class="kk">' + (T.scene.vis && T.scene.vis.kind || "text") + " · " + T.dur.toFixed(1) + 's</div>' +
                  '<div class="tt">' + esc(T.scene.title || "") + '</div>';
    d.addEventListener("click", () => {
      cancelAnimationFrame(raf); playing = false; stopMusic();
      draw(T.start + T.dur * .6); markLive(T.start + T.dur * .6);
    });
    tl.appendChild(d);
  });
}
function markLive(t) {
  const T = timings(spec, dur);
  [...$("timeline").children].forEach((c, i) => c.classList.toggle("live", T[i] && t >= T[i].start && t < T[i].end));
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function say(m, c) { const s = $("status"); s.textContent = m; s.className = c || ""; }

/* ══════════ controls ══════════ */
const sw = $("swatches");
Object.keys(PALS).forEach(k => {
  const b = document.createElement("button"); b.type = "button"; b.title = k;
  b.setAttribute("aria-pressed", k === palKey);
  b.innerHTML = '<i style="background:' + PALS[k].acc + '"></i><i style="background:' + PALS[k].hot + '"></i>';
  b.addEventListener("click", () => {
    palKey = k;
    [...sw.children].forEach(c => c.setAttribute("aria-pressed", c === b));
    draw(dur * .35);
  });
  sw.appendChild(b);
});
$("segMood").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  setMood(b.dataset.m);
  [...$("segMood").children].forEach(c => c.setAttribute("aria-pressed", c === b));
  $("moodHint").textContent = MOODHINT[b.dataset.m];
  if (playing) startMusic();
});
$("moodHint").textContent = MOODHINT.pulse;

/* ══════════ custom track ══════════ */
$("track").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await loadCustomTrack(file);
    $("clearTrack").hidden = false;
    say('Using "' + file.name + '" — mood buttons above are ignored while it\'s loaded.', "ok");
    if (playing) startMusic();
  } catch (err) {
    say("Couldn't load that file: " + err.message, "err");
  }
});
$("clearTrack").addEventListener("click", () => {
  clearCustomTrack();
  $("track").value = "";
  $("clearTrack").hidden = true;
  say("Removed. Back to the synthesized score.", "ok");
  if (playing) startMusic();
});

function applyJSON(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed.scenes || !parsed.scenes.length) throw new Error("needs a scenes array");
    spec = parsed;
    if (spec.meta && spec.meta.palette && PALS[spec.meta.palette]) palKey = spec.meta.palette;
    drawTimeline(); play(); say("Applied.", "ok");
  } catch (e) { say("That JSON didn't parse: " + e.message, "err"); }
}
$("apply").addEventListener("click", () => applyJSON($("json").value));
// Paste a scene spec straight in and it plays immediately — no Apply click needed.
$("json").addEventListener("paste", () => setTimeout(() => applyJSON($("json").value), 0));

/* ══════════ boot ══════════ */
function fit() {
  const w = $("stagewrap");
  const k = Math.min(w.clientWidth / W, w.clientHeight / H) * .94;
  cv.style.width = (W * k) + "px"; cv.style.height = (H * k) + "px";
}
addEventListener("resize", fit); fit();
addEventListener("keydown", e => {
  if (e.code === "Space" && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); play(); }
});
$("json").value = JSON.stringify(spec, null, 1);
drawTimeline();
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
  .then(() => draw(dur * .35));

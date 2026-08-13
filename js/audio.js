// A lookahead scheduler: every 25ms it looks 120ms into the future and
// schedules notes on the Web Audio clock. Never schedule with setTimeout
// alone; it drifts audibly within seconds.
export const MOODHINT = {
  pulse: "Low four-on-the-floor with a minor bass. Default for anything about loss or risk.",
  tick: "Sparse hats and a staccato bass. Nervous, good under counting numbers.",
  drift: "Pads only, no drums. Use when the visuals are already busy.",
  lift: "Arpeggio over a warm pad. For compounding and long-horizon stories."
};

const SCALES = { pulse: [0, 3, 5, 7, 10], tick: [0, 2, 3, 7, 8], drift: [0, 5, 7, 10, 12], lift: [0, 4, 7, 11, 14] };
const TEMPO = { pulse: 88, tick: 104, drift: 70, lift: 96 };
const ROOT = { pulse: 55, tick: 58, drift: 49, lift: 62 };

let ac = null, master = null, streamDest = null, schedTimer = null, noiseBuf = null;
let bpm = 88, step = 0, nextTime = 0, mood = "pulse", vol = .34;
let customBuffer = null, customSource = null, customName = "";

function ensureAudio() {
  if (ac) return ac;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = vol;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ac.destination);
  streamDest = ac.createMediaStreamDestination(); comp.connect(streamDest);
  const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ac;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function note(t, f, dur, type, gain, filt) {
  const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f, t);
  lp.type = "lowpass"; lp.frequency.setValueAtTime(filt || 1200, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + .05);
}
function pad(t, f, dur, gain) {
  [0, -.14, .14].forEach(det => {
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.detune.setValueAtTime(det * 100, t);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(700, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain / 3, t + .7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + .1);
  });
}
function kick(t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(44, t + .13);
  g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.0001, t + .24);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + .3);
}
function hat(t, g0) {
  const s = ac.createBufferSource(), g = ac.createGain(), hp = ac.createBiquadFilter();
  s.buffer = noiseBuf; hp.type = "highpass"; hp.frequency.value = 7200;
  g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
  s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + .08);
}

function playStep(s, t) {
  const sc = SCALES[mood], rt = ROOT[mood], bar = s % 16;
  const chord = Math.floor(s / 16) % 4;
  const deg = [0, 3, 4, 2][chord];
  if (mood === "pulse") {
    if (bar % 4 === 0) kick(t);
    if (bar % 2 === 0) note(t, hz(rt + sc[deg % sc.length] - 12), .42, "triangle", .34, 420);
    if (bar % 8 === 4) hat(t, .11);
    if (bar === 0) pad(t, hz(rt + 12 + sc[deg % sc.length]), 2.6, .16);
  } else if (mood === "tick") {
    hat(t, bar % 2 ? .05 : .13);
    if (bar % 4 === 0) note(t, hz(rt + sc[deg % sc.length] - 12), .18, "square", .2, 600);
    if (bar % 8 === 0) kick(t);
  } else if (mood === "drift") {
    if (bar === 0) {
      pad(t, hz(rt + sc[deg % sc.length]), 4.2, .22);
      pad(t, hz(rt + 12 + sc[(deg + 2) % sc.length]), 4.2, .14);
    }
    if (bar % 8 === 4) hat(t, .04);
  } else {
    if (bar % 4 === 0) kick(t);
    const step8 = bar % 8;
    note(t, hz(rt + 12 + sc[(step8 + deg) % sc.length]), .24, "square", .13, 1500);
    if (bar === 0) pad(t, hz(rt + sc[deg % sc.length]), 2.4, .18);
    if (bar % 2 === 1) hat(t, .06);
  }
}

export function setMood(m) { mood = m; }
export function getMood() { return mood; }

export function setVolume(v) {
  vol = v;
  if (master && ac) master.gain.setTargetAtTime(vol, ac.currentTime, .05);
}

export function startMusic() {
  ensureAudio();
  if (ac.state === "suspended") ac.resume();
  master.gain.setTargetAtTime(vol, ac.currentTime, .05);
  clearTimeout(schedTimer);
  if (customSource) { try { customSource.stop(); } catch { /* already stopped */ } customSource = null; }

  if (customBuffer) {
    customSource = ac.createBufferSource();
    customSource.buffer = customBuffer;
    customSource.connect(master);
    customSource.start(ac.currentTime);
    return;
  }

  step = 0; nextTime = ac.currentTime + .08;
  bpm = TEMPO[mood];
  (function sched() {
    while (nextTime < ac.currentTime + .12) {
      playStep(step, nextTime);
      nextTime += (60 / bpm) / 2; step++;
    }
    schedTimer = setTimeout(sched, 25);
  })();
}

export function stopMusic() {
  clearTimeout(schedTimer);
  if (customSource) { try { customSource.stop(); } catch { /* already stopped */ } customSource = null; }
  if (master && ac) master.gain.setTargetAtTime(0, ac.currentTime, .12);
}

// Bring-your-own-track: decoded once client-side from a file the visitor
// picks, never uploaded anywhere. Present -> overrides the synthesized
// score in startMusic() above; absent -> falls back to it.
export async function loadCustomTrack(file) {
  ensureAudio();
  const buf = await file.arrayBuffer();
  customBuffer = await ac.decodeAudioData(buf);
  customName = file.name;
  return customName;
}
export function clearCustomTrack() {
  if (customSource) { try { customSource.stop(); } catch { /* already stopped */ } customSource = null; }
  customBuffer = null; customName = "";
}
export function getCustomTrackName() { return customName; }

// Exposed for export.js, which needs the raw context/stream to route the
// score into the recorded file alongside the speakers.
export function initAudio() { return ensureAudio(); }
export function getStreamDestination() { return streamDest; }
export function resumeIfSuspended() {
  return (ac && ac.state === "suspended") ? ac.resume() : Promise.resolve();
}

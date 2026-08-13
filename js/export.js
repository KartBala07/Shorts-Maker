// captureStream() gives the video track; streamDest (a
// MediaStreamAudioDestinationNode the audio graph also connects to
// alongside ac.destination) gives the audio track. That's how the score
// lands in the file instead of only in the speakers.
import { initAudio, startMusic, stopMusic, getStreamDestination, resumeIfSuspended } from './audio.js';

export async function recordShort({ canvas, fps, dur, renderFrame, onTick, onDone, onError }) {
  try {
    initAudio();
    await resumeIfSuspended();
    const vTrack = canvas.captureStream(fps).getVideoTracks()[0];
    startMusic();
    const aTrack = getStreamDestination().stream.getAudioTracks()[0];
    const stream = new MediaStream([vTrack, aTrack]);
    const cand = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mime = cand.find(m => MediaRecorder.isTypeSupported(m));
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6, audioBitsPerSecond: 128e3 });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise(resolve => {
      rec.onstop = () => {
        stopMusic();
        resolve(new Blob(chunks, { type: mime }));
      };
    });
    rec.start();
    await new Promise(res => {
      const t0 = performance.now();
      (function step(now) {
        const t = (now - t0) / 1000;
        renderFrame(Math.min(t, dur - .001));
        onTick && onTick(t);
        if (t < dur) requestAnimationFrame(step); else res();
      })(t0);
    });
    setTimeout(() => rec.stop(), 300);
    const blob = await stopped;
    onDone && onDone(blob);
  } catch (err) {
    stopMusic();
    onError && onError(err);
  }
}

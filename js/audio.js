// Sound: each line's recording, started at its moment; and a score made for the episode, rendered once when it
// loads (a ukulele-like pluck over soft chords, brighter by day, slower at evening; birds by day, crickets at night),
// quieter under the dialogue.
let ac = null;
export const audioCtx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());

export async function loadVoices(T, base) {
  const ctx = audioCtx(), out = {};
  await Promise.all(T.lines.filter((l) => l.file).map(async (l) => { try { const b = await (await fetch(base + l.file)).arrayBuffer(); out[l.i] = await ctx.decodeAudioData(b); } catch (e) { /* silent line */ } }));
  return out;
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PROG = { bright: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], soft: [[57, 60, 64], [65, 69, 72], [60, 64, 67], [67, 71, 74]] };
export async function renderScore(T) {
  const sr = 22050, len = Math.ceil(T.len * sr), off = new OfflineAudioContext(2, len, sr), master = off.createGain(); master.gain.value = 0.22; master.connect(off.destination);
  // under the lines, the music steps back
  for (const l of T.lines) { master.gain.setTargetAtTime(0.11, Math.max(0, l.t0 - 0.2), 0.12); master.gain.setTargetAtTime(0.22, l.t1 + 0.2, 0.5); }
  const pluck = (t, f, v, d = 0.9, type = 'triangle') => { const o = off.createOscillator(), g = off.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05); };
  const pad = (t, f, v, d) => { for (const det of [-3, 3]) { const o = off.createOscillator(), g = off.createGain(); o.type = 'sine'; o.frequency.value = f; o.detune.value = det; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * 0.3); g.gain.linearRampToValueAtTime(0, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d); } };
  let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const sc of T.scenes) {
    const day = sc.tod === 'day', bpm = day ? 100 : 76, beat = 60 / bpm, prog = PROG[day ? 'bright' : 'soft'], t1 = sc.t1 ?? T.len;
    for (let t = sc.t0 + 0.4, bar = 0; t < t1 - 0.5; t += beat * 4, bar++) {
      const ch = prog[bar % 4];
      pad(t, NOTE(ch[0] - 12), 0.05, beat * 4); pad(t, NOTE(ch[1] - 12), 0.035, beat * 4);
      for (let i = 0; i < 8; i++) { if (!day && i % 2) continue; const n = ch[[0, 1, 2, 1, 0, 2, 1, 2][i]] + (i === 7 && bar % 2 ? 12 : 0); pluck(t + i * beat / 2, NOTE(n), i % 4 === 0 ? 0.16 : 0.1, day ? 0.7 : 1.2); }
      if (bar % 2 === 1) pluck(t + beat * 3.5, NOTE(ch[2] + 12), 0.08, 0.5, 'sine');
    }
    // the place's own sounds
    for (let t = sc.t0 + 1; t < t1; t += 0.6 + rnd() * 2.4) {
      if (day) { const o = off.createOscillator(), g = off.createGain(), f = 2600 + rnd() * 1400; o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.3 + rnd() * 0.4), t + 0.08); o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.16); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18); o.connect(g).connect(off.destination); o.start(t); o.stop(t + 0.2); }
      else { for (let k = 0; k < 3; k++) { const o = off.createOscillator(), g = off.createGain(), tt = t + k * 0.07; o.type = 'square'; o.frequency.value = 4200 + rnd() * 300; g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.006, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0002, tt + 0.05); o.connect(g).connect(off.destination); o.start(tt); o.stop(tt + 0.06); } }
    }
  }
  return off.startRendering();
}

export function makePlayer(T, voices, score) {
  const ctx = audioCtx(); let live = [];
  const stop = () => { for (const s of live) { try { s.stop(); } catch (e) { /* done */ } } live = []; };
  const start = (t) => {
    stop(); const now = ctx.currentTime + 0.05;
    if (score) { const s = ctx.createBufferSource(); s.buffer = score; s.connect(ctx.destination); s.start(now, Math.min(t, score.duration - 0.01)); live.push(s); }
    for (const l of T.lines) { const b = voices[l.i]; if (!b || l.t0 + b.duration < t) continue; const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 1.0; s.buffer = b; s.connect(g).connect(ctx.destination); if (l.t0 >= t) s.start(now + (l.t0 - t)); else s.start(now, t - l.t0); live.push(s); }
    return now;
  };
  return { start, stop, ctx };
}

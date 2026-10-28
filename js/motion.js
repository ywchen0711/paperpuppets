// How a puppet moves: its pose at any moment, worked out from the timeline alone (so the film can be scrubbed and
// every viewing is the same). Walking plants the feet (each foot stays where it lands while the body passes over it);
// standing breathes and shifts its weight; a turn squashes through the middle; gestures and feelings ease in and out
// over a quarter of a second and lay their changes over the rest; a line moves the mouth with the voice's loudness,
// shaping vowels, and the hands talk too; the eyes blink and look at whoever matters; the hair swings after the head.
import { makePose } from './rig.js';

const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (k) => k * k * (3 - 2 * k);
const noise = (t, s) => Math.sin(t * 1.3 + s * 10) * 0.5 + Math.sin(t * 2.1 + s * 3.7) * 0.3 + Math.sin(t * 3.7 + s * 7.1) * 0.2;
const hashT = (t, s) => { const v = Math.sin(t * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
// a gesture's weight: up over `inn`, held, down over `out`
const env = (t, t0, t1, inn = 0.25, out = 0.3) => (t < t0 || t > t1 ? 0 : Math.min(ss(t0, t0 + inn, t), 1 - ss(t1 - out, t1, t)));

export function xAt(A, t) {
  let x = null;
  for (const s of A.segs) {
    if (t < s.t0) { if (x == null) x = s.x0; break; }
    if (t <= s.t1) { const k = (t - s.t0) / (s.t1 - s.t0), d = s.t1 - s.t0, acc = Math.min(0.3, d / 3) / d; // ease in and out of the walk
      const u = k < acc ? (k * k) / (2 * acc * (1 - acc)) : k > 1 - acc ? 1 - ((1 - k) * (1 - k)) / (2 * acc * (1 - acc)) : (k - acc / 2) / (1 - acc);
      return { x: lerp(s.x0, s.x1, u), seg: s, u, dist: Math.abs(s.x1 - s.x0) * u };
    }
    x = s.x1;
  }
  return { x: x ?? 4, seg: null };
}
export const visible = (A, t) => { let v = false; for (const [tt, on] of A.vis) { if (tt <= t) v = on; else break; } return v; };
function facing(A, t) { // which way, and the turn squashing through 0 over 0.2 s
  let f = 1, prev = 1, tk = -9;
  for (const [tt, ff] of A.faceKeys) { if (tt > t) break; prev = f; f = ff; tk = tt; }
  const k = (t - tk) / 0.2; if (k < 1 && prev !== f) return prev * Math.cos(Math.PI * ease(cl(k))) || f * 0.01;
  return f;
}
function sitAt(A, t) { let v = 0, seat = 0.42; for (const s of A.sits) { if (t < s.t0) break; seat = s.seat; v = t >= s.t1 ? s.to : lerp(s.from, s.to, ease((t - s.t0) / (s.t1 - s.t0))); } return { v, seat }; }
function emoAt(A, t) { // the strongest feeling in play, and how strong
  let best = null, w = 0; for (const e of A.emos) { const k = env(t, e.t0, e.t1, 0.3, 0.5) * (e.k ?? 1); if (k > w) { w = k; best = e.emo; } } return [best, w];
}

// the loudness of a line at a moment (0..1): the recording's envelope, or a made-up rhythm of syllables
function voiceAt(T, t) {
  if (!T || t < T.t0 || t > T.t1) return 0;
  if (T.env) { const i = (t - T.t0) * 30, a = T.env[Math.floor(i)] || 0, b = T.env[Math.floor(i) + 1] || 0; return lerp(a, b, i % 1); }
  const s = (t - T.t0) * 7.5; return cl(0.55 + 0.45 * Math.sin(s * Math.PI * 2 + T.seed * 9)) * (1 - ss(T.t1 - 0.15, T.t1, t)) * Math.min(1, (t - T.t0) * 8) * (0.6 + 0.4 * Math.sin(s * 0.7));
}

export function poseAt(A, t, ctx) {
  const B = A.B, p = makePose(0, 1), P = xAt(A, t), sd = A.seed;
  p.x = P.x; p.f = facing(A, t);
  const fsign = p.f >= 0 ? 1 : -1;
  // ---- locomotion: speed from the walk, the feet planted along it
  const seg = P.seg, run = seg?.mode === 'run', speed = seg ? Math.abs(seg.x1 - seg.x0) / (seg.t1 - seg.t0) : 0;
  const moveW = seg ? Math.min(ss(seg.t0, seg.t0 + 0.25, t), 1 - ss(seg.t1 - 0.25, seg.t1, t)) : 0;
  const L = B.leg * (run ? 1.7 : 1.05); // a stride (both feet)
  const phase = seg ? (P.dist + sd * L) / L : 0;
  const standF = [B.leg * 0.08, 0], standB = [-B.leg * 0.07, 0];
  const footAt = (u) => { // one foot through a cycle: on the ground sliding back as the body passes, then lifted forward
    u = ((u % 1) + 1) % 1; const st = run ? 0.42 : 0.6, lift = B.leg * (run ? 0.28 : 0.13);
    if (u < st) return [L * 0.5 * (0.5 - u / st), 0, 0];
    const k = (u - st) / (1 - st); return [L * 0.5 * (-0.5 + ease(k)), Math.sin(Math.PI * k) * lift, -Math.sin(Math.PI * k) * 0.5];
  };
  const fF = footAt(phase), fB = footAt(phase + 0.5);
  p.feetIK = { F: [lerp(standF[0], fF[0], moveW), lerp(0, fF[1], moveW)], B: [lerp(standB[0], fB[0], moveW), lerp(0, fB[1], moveW)] };
  p.legF.foot = fF[2] * moveW; p.legB.foot = fB[2] * moveW;
  p.bob = moveW * (run ? 0.05 * Math.abs(Math.sin(phase * Math.PI * 2)) - 0.02 : -0.018 * Math.cos(phase * Math.PI * 4) - 0.008);
  p.lean = moveW * (run ? 0.2 : 0.05);
  const swing = Math.sin(phase * Math.PI * 2) * moveW * (run ? 0.9 : 0.45);
  p.armF.sh = 0.06 - swing; p.armB.sh = -0.04 + swing; p.armF.el = 0.15 + moveW * (run ? 1.3 : 0.25) + Math.max(0, -swing) * 0.3; p.armB.el = 0.12 + moveW * (run ? 1.3 : 0.25) + Math.max(0, swing) * 0.3;
  if (run) { p.armF.hand = p.armB.hand = 'fist'; }
  p.head = -p.lean * 0.6;
  // ---- standing: breathing, a slow shift of weight, the head never quite still
  const still = 1 - moveW, br = Math.sin(t * 2 * Math.PI * 0.27 + sd * 6);
  p.bob += still * 0.006 * br; p.torso += still * (0.012 * br + 0.02 * noise(t * 0.4, sd)); p.lean += still * 0.015 * noise(t * 0.25, sd + 1);
  p.head += 0.03 * noise(t * 0.7, sd + 2); p.tilt += 0.06 * noise(t * 0.5, sd + 3);
  p.armF.sh += still * 0.03 * noise(t * 0.5, sd + 4); p.armB.sh += still * 0.03 * noise(t * 0.5, sd + 5);
  if (still > 0.5) { const sh = 0.01 * noise(t * 0.3, sd + 6); p.feetIK.F[0] += sh; p.feetIK.B[0] += sh; }
  // ---- sitting: the hips on the seat; a child's legs swing
  const S = sitAt(A, t); if (S.v > 0) { p.sit = S.v; p.seat = S.seat; p.feetIK = null; p.legF.knee = 0; if (B.kind === 'kid') { p.legF.hip = 0.05 * Math.sin(t * 3 + sd * 5) * S.v; p.legB.hip = 0.05 * Math.sin(t * 3 + 2 + sd * 5) * S.v; } p.armF.sh = lerp(p.armF.sh, 0.5, S.v); p.armF.el = lerp(p.armF.el, 0.4, S.v); }
  // ---- the face at rest
  const F = p.face; F.mouth = { open: 0, wide: 0.3, round: 0, smile: 0.22 }; F.look = [1, 0];
  // blinking: every two to five seconds, now and then twice
  { const per = 3.4, k = Math.floor((t + sd * 7) / per), ph = (t + sd * 7) - k * per, at = 0.4 + hashT(k, sd) * 2.4, d = Math.abs(ph - at), d2 = Math.abs(ph - at - 0.28);
    F.blink = Math.max(1 - d / 0.07, hashT(k, sd + 1) < 0.25 ? 1 - d2 / 0.07 : 0, 0); }
  // ---- feelings: the body and the face
  const [emo, ew] = emoAt(A, t);
  if (emo) applyEmotion(p, emo, ew, t, sd);
  // ---- gestures
  for (const a of A.acts) { if (t < a.t0 - 0.05) break; if (t > a.t1 + 0.05) continue; gesture(p, a, t, B, ctx, A); }
  // ---- holding something: the near hand carries it before the chest
  const holds = ctx.holding?.(A.id, t);
  if (holds && moveW < 0.5 && !A.acts.some((a) => t >= a.t0 && t <= a.t1 && ['reach', 'give', 'point', 'wave', 'cheer'].includes(a.kind))) { const k = holds === 'cane' ? 0.25 : 1; p.armF.sh = lerp(p.armF.sh, holds === 'cane' ? 0.35 : 0.75, k); p.armF.el = lerp(p.armF.el, holds === 'cane' ? 0.2 : 1.1, k); p.armF.hand = 'fist'; }
  else if (holds) p.armF.hand = 'fist';
  // ---- speaking: the mouth with the voice, the head with the syllables, a hand that talks
  const T = A.talk.find((s) => t >= s.t0 - 0.05 && t <= s.t1 + 0.05);
  if (T) {
    const v = voiceAt(T, t), v2 = voiceAt(T, t - 0.12), w = env(t, T.t0, T.t1, 0.15, 0.2);
    const vow = Math.floor((t - T.t0) * 6 + T.seed * 10) % 5; // a rough vowel for each syllable: a, i, u, e, o
    F.mouth.open = cl(v * 0.95); F.mouth.round = [0, 0, 0.8, 0.1, 0.9][vow] * (v > 0.25 ? 1 : 0.3); F.mouth.wide = [0.6, 0.9, 0.1, 0.75, 0.2][vow];
    p.head += (v - v2) * 0.12 + w * 0.02 * Math.sin((t - T.t0) * 2.2); p.tilt += w * 0.05 * Math.sin((t - T.t0) * 1.1 + T.seed * 5);
    if (T.q) { p.tilt += w * 0.1; F.brow += w * 0.3; }
    const kind = Math.floor(T.seed * 5), gw = env(t, T.t0 + 0.2, T.t1 + 0.3, 0.45, 0.5) * (1 - moveW) * (S.v > 0.5 ? 0.6 : 1);
    if (gw > 0 && !holds) {
      const beat = v * 0.25;
      if (kind === 0 || kind === 3) { p.armF.sh = lerp(p.armF.sh, 0.9 + beat, gw); p.armF.el = lerp(p.armF.el, 0.9 - beat * 0.5, gw); p.armF.hand = 'open'; } // a hand out, explaining
      else if (kind === 1) { for (const a of [p.armF, p.armB]) { a.sh = lerp(a.sh, 0.75 + beat, gw); a.el = lerp(a.el, 1.0, gw); a.hand = 'open'; } } // both hands
      else if (kind === 2) { p.armF.sh = lerp(p.armF.sh, 0.55, gw); p.armF.el = lerp(p.armF.el, 2.1 + beat, gw); } // a hand to the chest
    }
  }
  // ---- where the eyes go: whoever this one watches, up at the tree, down
  const lk = lookTarget(A, t); if (lk) { const tgt = ctx.where?.(lk, t); if (tgt) { const dx = (tgt[0] - p.x) * fsign, dy = tgt[1] - B.H * 0.9; F.look = [cl(dx / 2, -1, 1) * 0.9 + 0.1 * Math.sign(dx), cl(dy / 1.5, -1, 1)]; if (dy > 0.6) p.head -= cl(dy / 3, 0, 0.35); } else if (lk === 'up') { F.look = [0.4, 1]; p.head -= 0.3; } else if (lk === 'down') { F.look = [0.3, -1]; p.head += 0.25; } }
  // ---- the hair, swinging after the head (a spring, run over the last moments)
  p.hair = hairSpring(A, t);
  return p;
}

function lookTarget(A, t) { let v = null; for (const [tt, w] of A.looks) { if (tt > t) break; v = w; } return v; }
function hairSpring(A, t) {
  let x = 0, vx = 0; const dt = 1 / 30;
  for (let tt = t - 1.2; tt <= t; tt += dt) { const a = (xAt(A, tt + dt).x - 2 * xAt(A, tt).x + xAt(A, tt - dt).x) / (dt * dt); vx += (-a * 0.05 - x * 60 - vx * 7) * dt; x += vx * dt; }
  const sp = Math.abs(xAt(A, t + 0.05).x - xAt(A, t - 0.05).x) * 10;
  return [cl(x * 3 + sp * 0.12, -1, 1), cl(sp * 0.15 + Math.sin(t * 9) * 0.03 * Math.min(1, sp), 0, 0.8)];
}

function applyEmotion(p, e, w, t, sd) {
  const F = p.face, M = F.mouth, L = (o, k, v) => { o[k] = lerp(o[k] ?? 0, v, w); };
  switch (e) {
    case 'happy': case 'excited': case 'proud':
      L(M, 'smile', 0.85); L(F, 'brow', 0.35); p.torso -= 0.04 * w; L(F, 'blush', 0.3);
      if (e === 'excited') { p.bob += w * 0.02 * Math.abs(Math.sin(t * 7)); L(F, 'eyes', 1.15); }
      if (e === 'proud') { L(p.armF, 'sh', 0.35); L(p.armF, 'el', -1.6); L(p.armB, 'sh', 0.3); L(p.armB, 'el', -1.5); p.torso -= 0.06 * w; L(F, 'blink', 0.35); }
      break;
    case 'laugh': L(M, 'smile', 1); L(M, 'open', 0.6); L(F, 'happyEyes', 1); p.head -= 0.18 * w; p.bob += w * 0.012 * Math.sin(t * 22); L(F, 'blush', 0.6); break;
    case 'sad': L(M, 'smile', -0.7); L(F, 'browIn', -0.9); L(F, 'brow', 0.15); p.head += 0.25 * w; p.torso += 0.07 * w; L(p.armF, 'sh', -0.02); L(p.armB, 'sh', 0.02); F.look = [0.6, -0.6]; break;
    case 'worried': L(M, 'smile', -0.25); L(F, 'browIn', -0.8); L(F, 'sweat', 0.6); break;
    case 'angry': case 'shout': L(M, 'smile', -0.6); L(F, 'browIn', 1.1); L(F, 'brow', -0.5); p.lean += 0.08 * w; p.armF.hand = p.armB.hand = 'fist'; L(p.armF, 'sh', 0.3); L(p.armB, 'sh', 0.25); L(p.armF, 'el', 0.6); if (e === 'shout') { L(M, 'wide', 1); } break;
    case 'surprised': L(F, 'eyes', 1.35); L(F, 'brow', 1.1); L(M, 'round', 1); L(M, 'smile', 0); p.torso -= 0.1 * w; p.head -= 0.08 * w; L(p.armF, 'sh', 0.7); L(p.armF, 'el', 1.4); L(p.armB, 'sh', 0.6); L(p.armB, 'el', 1.3); p.armF.hand = p.armB.hand = 'open'; break;
    case 'scared': L(F, 'eyes', 1.2); L(F, 'brow', 0.8); L(F, 'browIn', -1); L(M, 'smile', -0.4); p.lean -= 0.1 * w; L(p.armF, 'sh', 1.0); L(p.armF, 'el', 1.7); L(p.armB, 'sh', 0.9); L(p.armB, 'el', 1.7); L(F, 'sweat', 0.8); p.bob += w * 0.004 * Math.sin(t * 40); break;
    case 'shy': L(M, 'smile', 0.35); L(F, 'blush', 1); p.head += 0.22 * w; F.look = [0.2, -0.7]; L(p.armF, 'sh', 2.7); L(p.armF, 'el', 2.0); p.armF.hand = 'open'; break; // a hand to the back of the head
    case 'thinking': L(F, 'brow', 0.4); F.look = [0.5, 0.8]; L(p.armF, 'sh', 0.7); L(p.armF, 'el', 2.3); p.armF.hand = 'fist'; p.tilt += 0.12 * w; L(M, 'smile', 0); break; // a fist to the chin
    case 'calm': L(M, 'smile', 0.35); L(F, 'blink', 0.15); break;
  }
}

function gesture(p, a, t, B, ctx, A) {
  const k = (t - a.t0) / (a.t1 - a.t0), w = env(t, a.t0, a.t1, a.kind === 'nod' ? 0.1 : 0.25, 0.3) * (a.k ?? 1), F = p.face, M = F.mouth;
  const L = (o, key, v) => { o[key] = lerp(o[key] ?? 0, v, w); };
  switch (a.kind) {
    case 'wave': L(p.armF, 'sh', 2.6); p.armF.el = lerp(p.armF.el, 0.35 + 0.45 * Math.sin((t - a.t0) * 13), w); p.armF.hand = 'open'; L(M, 'smile', 0.9); break;
    case 'nod': p.head += w * 0.22 * Math.max(0, Math.sin(k * Math.PI * 2)); break;
    case 'tilt': p.tilt += w * 0.16; break;
    case 'shake': p.turn = (p.turn || 0) + w * 0.55 * Math.sin((t - a.t0) * 16); L(M, 'smile', -0.2); break;
    case 'bow': p.lean += w * 0.45; p.head += w * 0.3; break;
    case 'cheer': for (const r of [p.armF, p.armB]) { L(r, 'sh', 2.85); L(r, 'el', 0.15); r.hand = 'fist'; } p.bob += w * 0.06 * Math.abs(Math.sin(k * Math.PI * 3)); L(M, 'open', 0.7); L(M, 'smile', 1); L(F, 'happyEyes', 1); break;
    case 'laugh': L(M, 'open', 0.65); L(M, 'smile', 1); L(F, 'happyEyes', 1); p.head -= w * 0.18; p.bob += w * 0.015 * Math.sin(t * 24); L(p.armF, 'sh', 0.5); L(p.armF, 'el', 1.4); break;
    case 'think': L(p.armF, 'sh', 0.7); L(p.armF, 'el', 2.3); p.armF.hand = 'fist'; F.look = [0.5, 0.9]; p.tilt += w * 0.12; break;
    case 'cry': for (const r of [p.armF, p.armB]) { L(r, 'sh', 1.05); L(r, 'el', 2.45); r.hand = 'fist'; } L(F, 'tears', 1); L(M, 'smile', -0.8); L(M, 'open', 0.3 + 0.2 * Math.sin(t * 9)); p.head += w * 0.2; p.bob += w * 0.006 * Math.sin(t * 18); break;
    case 'reach': L(p.armF, 'sh', 2.95); L(p.armF, 'el', 0.05); L(p.armB, 'sh', 0.5); p.bob += w * 0.05; L(p.legF, 'foot', 0.5); p.lean -= w * 0.06; p.head -= w * 0.3; if (p.feetIK) { p.feetIK.F[1] += 0; } break;
    case 'give': L(p.armF, 'sh', 1.35); L(p.armF, 'el', 0.25); p.armF.hand = 'open'; p.lean += w * 0.06; break;
    case 'shrug': for (const r of [p.armF, p.armB]) { L(r, 'sh', 0.5); L(r, 'el', 1.6); r.hand = 'open'; } p.bob += w * 0.02; p.tilt += w * 0.1; L(F, 'brow', 0.6); break;
    case 'point': { const tgt = ctx.where?.(a.at, t); let ang = 1.5; if (tgt) { const dx = (tgt[0] - p.x) * (p.f >= 0 ? 1 : -1), dy = tgt[1] - B.H * 0.75; ang = Math.atan2(Math.max(0.2, dx), -dy); } L(p.armF, 'sh', ang); L(p.armF, 'el', 0); p.armF.hand = 'point'; break; }
    case 'jump': { // crouch, up, tuck, land, give
      const tt = t - a.t0, up = 0.28, air = 0.42, h = B.kind === 'kid' ? 0.42 : 0.3;
      if (tt < up) { p.crouch = Math.max(p.crouch || 0, ss(0, up, tt) * 0.9); p.armF.sh = lerp(p.armF.sh, -0.6, ss(0, up, tt)); p.armB.sh = lerp(p.armB.sh, -0.6, ss(0, up, tt)); }
      else if (tt < up + air) { const u = (tt - up) / air; p.y = 4 * h * u * (1 - u); p.feetIK = { F: [0.05, -0.02 + Math.sin(u * Math.PI) * 0.1], B: [-0.05, -0.02 + Math.sin(u * Math.PI) * 0.14] }; p.armF.sh = 2.7; p.armF.el = 0.2; p.armB.sh = 2.4; p.armB.el = 0.3; F.mouth.open = 0.4; F.eyes = 1.15; }
      else { const u = (tt - up - air) / (a.t1 - a.t0 - up - air); p.crouch = Math.max(p.crouch || 0, 0.7 * (1 - ss(0, 1, u))); }
      break;
    }
  }
}

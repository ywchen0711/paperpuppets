// The director: from a parsed script (js/script.js) and the length of each recorded line, the whole episode laid out
// in time: where everyone walks, which way they face, what they do and feel, who speaks when, how the others react,
// where the props are, and where the camera looks (an establishing shot for each place, two-shots and singles for a
// conversation, a close-up when a line is felt hard, a cut to the listener in a long speech, wide while people move).
import { SETS } from './sets.js';
import { bodyOf } from './rig.js';

export const STAGE_W = 8; // metres across the stage
const GESTURE = { wave: 1.7, nod: 0.9, shake: 1.1, bow: 1.4, cheer: 1.5, laugh: 1.8, think: 2.2, cry: 2.4, reach: 1.8, point: 1.5, give: 1.2, look: 0, turn: 0, face: 0, hold: 0, drop: 0.5, shrug: 1.2 };
const STRONG = new Set(['surprised', 'angry', 'scared', 'shout', 'excited', 'sad', 'laugh']);
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export function direct(ep, cast, voices = {}) {
  const T = { scenes: [], actors: {}, lines: [], shots: [], items: {}, len: 0 };
  const actor = (id) => {
    if (!T.actors[id]) { const spec = cast[id]; if (!spec || spec.kind === 'voice') return null; T.actors[id] = { id, spec, B: bodyOf(spec), segs: [], faceKeys: [], acts: [], emos: [], talk: [], looks: [], vis: [], sits: [], seed: hash(id) }; }
    return T.actors[id];
  };
  const item = (id) => (T.items[id] ||= { id, keys: [] });
  const st = {}; // what each actor is doing at the director's moment
  const S = (id) => (st[id] ||= { x: STAGE_W / 2, f: 1, here: false, sitting: false, hold: null });
  let t = 0;
  for (const sc of ep.scenes) {
    const set = SETS[sc.set] || SETS.park, scene = { t0: t, set: sc.set, tod: sc.tod, label: sc.label };
    T.scenes.push(scene);
    for (const id in st) if (st[id].here) { st[id].here = false; const A = actor(id); A?.vis.push([t, false]); }
    let prev = null, last = null, firstLine = true, shotN = 0;
    const shot = (o) => { const L = T.shots[T.shots.length - 1]; if (L && L.t0 > t - 1.6 && L.scene === scene && o.kind !== 'est') { if (o.force) T.shots.pop(); else return; } T.shots.push({ scene, ...o }); };
    shot({ t0: t, kind: 'est', ids: [] });
    t += 0.6;
    const here = () => Object.keys(st).filter((id) => st[id].here);
    for (const beat of sc.beats) {
      if (beat.kind === 'do') {
        let block = 0, moving = false;
        for (const a of beat.acts) {
          const d = doAct(a, t); block = Math.max(block, d.block); moving = moving || d.moving;
        }
        if (moving) shot({ t0: t, kind: 'wide', ids: here(), force: T.shots[T.shots.length - 1]?.kind !== 'wide' });
        t += block; continue;
      }
      // a line
      const who = beat.who, A = actor(who), v = voices[beat.i], dur = v?.dur ?? estimate(beat.zh), gap = firstLine ? 0.35 : 0.22;
      t += gap; const t0 = t, t1 = t + dur;
      const others = here().filter((id) => id !== who), listener = A ? (prev && prev !== who && others.includes(prev) ? prev : nearest(who, others, t0)) : null;
      T.lines.push({ t0, t1, who, emo: beat.emo, zh: beat.zh, en: beat.en, i: beat.i, file: v?.file || null, env: v?.env || null, listener });
      if (A) {
        A.talk.push({ t0, t1, env: v?.env || null, emo: beat.emo, seed: hash(beat.zh), q: /[?？]\s*$/.test(beat.zh) });
        if (beat.emo) A.emos.push({ t0: t0 - 0.25, t1: t1 + 0.7, emo: beat.emo });
        if (listener) { faceTo(who, listener, t0 - 0.2); faceTo(listener, who, t0 + 0.25 + hash(beat.zh + 'r') * 0.25); A.looks.push([t0 - 0.2, listener]); actor(listener)?.looks.push([t0 + 0.2, who]); }
        // the listener reacts: catches a strong feeling, nods at the end of a plain statement now and then
        if (listener && !st[listener].moving) {
          const L = actor(listener), hk = hash(beat.zh + listener);
          if (beat.emo === 'surprised' || beat.emo === 'scared') L.emos.push({ t0: t0 + 0.3, t1: t1 + 0.4, emo: beat.emo, k: 0.6 });
          else if (beat.emo === 'happy' || beat.emo === 'laugh' || beat.emo === 'excited') L.emos.push({ t0: t0 + 0.4, t1: t1 + 0.6, emo: 'happy', k: 0.7 });
          else if (beat.emo === 'sad' || beat.emo === 'worried') L.emos.push({ t0: t0 + 0.4, t1: t1 + 0.6, emo: 'worried', k: 0.7 });
          else if (beat.emo === 'angry' || beat.emo === 'shout') L.emos.push({ t0: t0 + 0.3, t1: t1 + 0.5, emo: 'scared', k: 0.5 });
          if (!/[?？!！]\s*$/.test(beat.zh) && hk < 0.55 && dur > 1.2) L.acts.push({ t0: t1 - 0.5, t1: t1 + 0.4, kind: 'nod', k: 0.6 });
          if (/[?？]\s*$/.test(beat.zh)) L.acts.push({ t0: t0 + 0.5, t1: t1 + 0.6, kind: 'tilt', k: 1 });
        }
        // the camera: a two-shot to open a conversation, then the speaker; close when it is felt hard; the listener's face in a long speech
        const strong = STRONG.has(beat.emo);
        if (last !== who) {
          if (firstLine || others.length === 0) shot({ t0: t0 - 0.15, kind: others.length ? 'two' : 'single', ids: listener ? [who, listener] : [who], who });
          else shot({ t0: t0 - 0.15, kind: strong ? 'close' : shotN % 3 === 2 && listener ? 'two' : 'single', ids: listener ? [who, listener] : [who], who });
          shotN++;
        } else if (strong && T.shots[T.shots.length - 1]?.kind !== 'close') shot({ t0: t0 - 0.1, kind: 'close', ids: [who], who });
        if (dur > 4.2 && listener) { shot({ t0: t0 + dur * 0.55, kind: 'single', ids: [listener], who: listener, react: true }); shot({ t0: t0 + dur * 0.55 + 1.7, kind: 'single', ids: [who], who, force: true }); }
        last = who; prev = who;
      } else if (!T.shots.length || T.shots[T.shots.length - 1].kind !== 'wide') shot({ t0: t0, kind: 'wide', ids: here() }); // a narrator over the scene
      firstLine = false; t = t1;
    }
    t += 1.2; scene.t1 = t;
  }
  T.len = t + 0.5;
  for (const A of Object.values(T.actors)) { A.acts.sort((a, b) => a.t0 - b.t0); A.faceKeys.sort((a, b) => a[0] - b[0]); }
  T.shots.sort((a, b) => a.t0 - b.t0); T.shots.forEach((s, i) => (s.t1 = T.shots[i + 1]?.t0 ?? T.len));
  return T;

  // ---------------------------------------------------------------- a stage direction at time t0: how long it holds the story up
  function doAct(a, t0) {
    if (a.verb === 'pause') return { block: a.d || 1 };
    if (!a.who) return itemAct(a, t0);
    const A = actor(a.who); if (!A) return { block: 0 };
    const s = S(a.who), sp = (A.spec.walk || 1) * (A.B.kind === 'kid' ? 1.15 : A.B.kind === 'elder' ? 0.8 : 1.2), run = 2.7 * (A.B.kind === 'elder' ? 0.6 : 1);
    const go = (x1, speed, mode) => {
      if (s.sitting) { stand(t0); t0 += 0.6; }
      const x0 = s.x, d = Math.abs(x1 - x0); if (d < 0.02) return 0;
      const dur = d / speed + (mode === 'run' ? 0.25 : 0.35); faceKey(a.who, t0, x1 > x0 ? 1 : -1);
      A.segs.push({ t0, t1: t0 + dur, x0, x1, mode }); s.x = x1; s.moving = true; s.until = t0 + dur; setTimeout0(() => (s.moving = false));
      return dur;
    };
    const stand = (tt) => { if (!s.sitting) return; A.sits.push({ t0: tt, t1: tt + 0.6, from: 1, to: 0, seat: s.seat }); s.sitting = false; };
    const X = (v) => (typeof v === 'number' ? v * STAGE_W : null);
    switch (a.verb) {
      case 'enter': {
        const set = SETS[T.scenes[T.scenes.length - 1].set] || SETS.park, x0 = a.side === 'right' ? STAGE_W + 0.8 : -0.8, x1 = X(a.to) ?? (a.side === 'right' ? STAGE_W * 0.72 : STAGE_W * 0.28);
        s.x = x0; s.here = true; s.f = a.side === 'right' ? -1 : 1; A.vis.push([t0, true]); faceKey(a.who, t0 - 0.01, s.f);
        if (a.item) holdItem(a.item, a.who, t0);
        const d = go(x1, a.run ? run : sp, a.run ? 'run' : 'walk'); return { block: d, moving: true };
      }
      case 'exit': { const x1 = a.side === 'right' ? STAGE_W + 1.0 : -1.0, d = go(x1, a.run ? run : sp, a.run ? 'run' : 'walk'); A.vis.push([t0 + d, false]); s.here = false; return { block: d, moving: true }; }
      case 'walk': case 'run': {
        let x1 = X(a.to); if (x1 == null && a.to && st[a.to]) { const o = st[a.to].x; x1 = o + (s.x < o ? -0.85 : 0.85); }
        if (x1 == null) return { block: 0 };
        return { block: go(x1, a.verb === 'run' ? run : sp, a.verb), moving: true };
      }
      case 'turn': faceKey(a.who, t0, -s.f); return { block: 0.3 };
      case 'face': { const o = st[a.at]; faceKey(a.who, t0, a.at === 'left' ? -1 : a.at === 'right' ? 1 : o ? (o.x > s.x ? 1 : -1) : s.f); return { block: 0.25 }; }
      case 'jump': A.acts.push({ t0, t1: t0 + 1.0, kind: 'jump' }); return { block: 1.0, moving: true };
      case 'sit': {
        const set = SETS[T.scenes[T.scenes.length - 1].set] || SETS.park, seats = (set.seats || []).map((q) => ({ x: q.x * STAGE_W, h: q.h }));
        const seat = seats.sort((p, q) => Math.abs(p.x - s.x) - Math.abs(q.x - s.x))[0] || { x: s.x, h: 0.42 };
        s.sitting = true; s.seat = seat.h; A.sits.push({ t0, t1: t0 + 0.7, from: 0, to: 1, seat: seat.h }); return { block: 0.8 };
      }
      case 'stand': stand(t0); return { block: 0.7 };
      case 'look': A.looks.push([t0, a.at]); if (a.at && st[a.at]) faceTo(a.who, a.at, t0); else if (a.at && T.items[a.at]) { const p = itemPlace(a.at); if (p) faceKey(a.who, t0, p[0] > s.x ? 1 : -1); } return { block: 0.3 };
      case 'hold': holdItem(a.item, a.who, t0); return { block: 0.3 };
      case 'drop': { const I = item(a.item); I.keys.push({ t: t0, dur: 0.6, to: { at: [s.x + s.f * 0.35, 0.05] } }); s.hold = null; return { block: 0.5 }; }
      case 'give': {
        const I = item(a.item); A.acts.push({ t0, t1: t0 + 1.3, kind: 'give' }); if (a.to) { faceTo(a.who, a.to, t0 - 0.1); faceTo(a.to, a.who, t0); actor(a.to)?.acts.push({ t0: t0 + 0.2, t1: t0 + 1.3, kind: 'give' }); }
        I.keys.push({ t: t0 + 0.55, dur: 0.4, to: { who: a.to } }); if (st[a.to]) st[a.to].hold = a.item; s.hold = null; return { block: 1.2 };
      }
      case 'point': { A.acts.push({ t0, t1: t0 + GESTURE.point, kind: 'point', at: a.at }); A.looks.push([t0, a.at]); const o = st[a.at]; if (o) faceTo(a.who, a.at, t0); else { const p = itemPlace(a.at); if (p) faceKey(a.who, t0, p[0] > s.x ? 1 : -1); } return { block: 0.5 }; }
      default: {
        const kind = { cheer: 'cheer', wave: 'wave', nod: 'nod', shake: 'shake', bow: 'bow', laugh: 'laugh', think: 'think', crie: 'cry', cry: 'cry', reach: 'reach', shrug: 'shrug' }[a.verb];
        if (!kind) { console.warn('what is', a.raw); return { block: 0 }; }
        A.acts.push({ t0, t1: t0 + GESTURE[kind], kind }); if (kind === 'reach') A.looks.push([t0, 'up']);
        return { block: kind === 'reach' ? GESTURE.reach : 0.45 };
      }
    }
  }
  function itemAct(a, t0) {
    const I = item(a.item), set = SETS[T.scenes[T.scenes.length - 1].set] || SETS.park;
    for (const id in st) if (st[id].hold === a.item) st[id].hold = null;
    if (a.verb === 'itemTo') { const p = set.places?.[a.place]; if (!p) return { block: 0 }; I.keys.push({ t: t0, dur: 1.3, to: { at: [p[0] * STAGE_W, p[1]], rot: p[2] || 0 }, arc: 1.6 }); return { block: 1.4, moving: true }; }
    if (a.verb === 'itemFall') { const x = (a.x ?? null) != null ? a.x * STAGE_W : null; I.keys.push({ t: t0, dur: 0.9, to: { at: [x, 0.06], rot: 0.3 }, fall: true }); return { block: 1.0, moving: true }; }
    if (a.verb === 'itemFly') { const who = Object.keys(st).find((id) => st[id].hold === a.item) || I.lastWho; I.keys.push({ t: t0, dur: 1.4, to: { fly: who } }); return { block: 1.2, moving: true }; }
    return { block: 0 };
  }
  function holdItem(id, who, t0) { const I = item(id); I.keys.push({ t: t0, dur: I.keys.length ? 0.4 : 0, to: { who } }); I.lastWho = who; S(who).hold = id; }
  function itemPlace(id) { const k = T.items[id]?.keys.at(-1)?.to; return k?.at || (k?.who ? [S(k.who).x, 1] : null); }
  function faceKey(id, tt, f) { const A = actor(id); if (!A) return; const s = S(id); if (A.faceKeys.length && A.faceKeys.at(-1)[1] === f && s.f === f) return; A.faceKeys.push([tt, f]); s.f = f; }
  function faceTo(id, other, tt) { const s = S(id), o = S(other); if (!s.here || !o.here || s.moving) return; const f = o.x > s.x ? 1 : -1; if (f !== s.f) faceKey(id, tt, f); }
  function nearest(id, ids, tt) { const s = S(id); return ids.slice().sort((a, b) => Math.abs(S(a).x - s.x) - Math.abs(S(b).x - s.x))[0] || null; }
  function setTimeout0(f) { f(); } // (the moving flag is only for the next few beats; positions are what count)
}

// how long a line takes when it has no recording yet: about a fifth of a second for each character of Chinese
export function estimate(zh) { const n = (zh || '').replace(/[，。！？、…—\s]/g, '').length; return Math.max(1.0, n * 0.21 + 0.5); }

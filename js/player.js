// The player: loads a series and an episode, has the director lay it out, and draws any moment of it — the set's
// layers through the camera, the puppets in their poses, the props, the subtitles — with the sound in time.
//   ?s=neighbours&ep=ep1   (?t=12 to start at a moment)
import { parseScript } from './script.js';
import { direct, STAGE_W } from './direct.js';
import { poseAt, xAt, visible } from './motion.js';
import { drawPuppet, joints, OUTLINE } from './rig.js';
import { SETS } from './sets.js';
import { PROPS } from './props.js';
import { loadVoices, renderScore, makePlayer, audioCtx } from './audio.js';

const $ = (id) => document.getElementById(id), q = new URLSearchParams(location.search);
const SID = q.get('s') || 'neighbours';
let lang = q.get('lang') === 'en' ? 'en' : 'zh';
const { SERIES } = await import(`../series/${SID}/series.js?v=1`);
const cast = SERIES.cast;
const cv = $('cv'), g = cv.getContext('2d');
let T = null, EP = null, voices = {}, player = null, playing = false, t0Wall = 0, tStart = 0, tNow = +(q.get('t') || 0);

// ---------------------------------------------------------------- the start screen
function startScreen() {
  $('st').textContent = SERIES.title[lang]; $('blurb').textContent = SERIES.blurb[lang];
  $('eps').innerHTML = SERIES.episodes.map((e, i) => `<button data-ep="${e.id}">${lang === 'zh' ? `第${'一二三四五六七八九十'[i] || i + 1}集` : `Episode ${i + 1}`}<b>${e[lang]}</b></button>`).join('');
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-ep]'); if (b) loadEpisode(b.dataset.ep, true); });

async function loadEpisode(id, autoplay) {
  $('start').classList.add('loading'); $('loading').hidden = false;
  const text = await (await fetch(`series/${SID}/episodes/${id}.txt?v=${Date.now() % 1e5}`)).text();
  EP = parseScript(text);
  const vj = await fetch(`series/${SID}/audio/${id}.json?v=${Date.now() % 1e5}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const vmap = {}; for (const l of vj?.lines || []) vmap[l.i] = { dur: l.dur, env: l.env, file: l.file };
  T = direct(EP, cast, vmap);
  window.TL = T;
  try { voices = await loadVoices(T, `series/${SID}/audio/`); } catch (e) { voices = {}; }
  let score = null; try { score = await renderScore(T); } catch (e) { console.warn('no score', e); }
  player = makePlayer(T, voices, score);
  $('start').hidden = true; $('ui').hidden = false; $('loading').hidden = true;
  $('eptitle').textContent = EP.title[lang] || '';
  if (autoplay) play(tNow);
  window.DONE = true;
}

// ---------------------------------------------------------------- playing
function play(t = tNow) { audioCtx().resume(); tStart = t; t0Wall = player.start(t) ; playing = true; $('pp').textContent = '❚❚'; }
function pause() { if (player) player.stop(); playing = false; $('pp').textContent = '▶'; }
function seek(t) { tNow = Math.max(0, Math.min(T.len, t)); if (playing) play(tNow); }
$('pp').onclick = () => (playing ? pause() : play(tNow >= T.len - 0.1 ? 0 : tNow));
$('bar').oninput = (e) => seek(+e.target.value * T.len);
$('lang').onclick = () => { lang = lang === 'zh' ? 'en' : 'zh'; $('lang').textContent = lang === 'zh' ? 'EN' : '中'; if (EP) $('eptitle').textContent = EP.title[lang]; startScreen(); };
$('fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : $('frame').requestFullscreen());
$('home').onclick = () => { pause(); $('ui').hidden = true; $('start').hidden = false; $('start').classList.remove('loading'); };
document.addEventListener('keydown', (e) => { if (!T || $('ui').hidden) return; if (e.code === 'Space') { e.preventDefault(); $('pp').click(); } if (e.code === 'ArrowRight') seek(tNow + 5); if (e.code === 'ArrowLeft') seek(tNow - 5); });

// ---------------------------------------------------------------- one moment
const W = () => cv.width, H = () => cv.height;
function resize() { const r = $('frame').getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
new ResizeObserver(resize).observe($('frame')); resize();

const sceneAt = (t) => { let s = T.scenes[0]; for (const x of T.scenes) if (t >= x.t0) s = x; return s; };
const shotAt = (t) => { let s = T.shots[0]; for (const x of T.shots) if (t >= x.t0) s = x; return s; };

// the camera: what a shot frames at a moment (the width of the view in metres, its centre), smoothed within the shot
function frameOf(s, t) {
  const A = (id) => T.actors[id], here = Object.values(T.actors).filter((a) => visible(a, t) && Math.abs(xAt(a, t).x - STAGE_W / 2) < STAGE_W);
  const aspect = H() / W();
  const fit = (x0, x1, w0, bottom) => { const w = Math.max(w0, x1 - x0), h = w * aspect; return { cx: (x0 + x1) / 2, cy: bottom + h / 2, w }; };
  if (s.kind === 'est') return { cx: STAGE_W / 2, cy: -0.6 + 11 * aspect / 2, w: 11 };
  if (s.kind === 'wide') { const xs = (s.ids.length ? s.ids.map(A) : here).filter((a) => a && visible(a, t)).map((a) => xAt(a, t).x); if (!xs.length) return { cx: STAGE_W / 2, cy: -0.9 + 9 * aspect / 2, w: 9 }; return fit(Math.min(...xs) - 1.6, Math.max(...xs) + 1.6, 5.8, -0.55); }
  const who = A(s.who) || A(s.ids[0]); if (!who) return frameOf({ kind: 'est' }, t);
  const x = xAt(who, t).x, Hh = who.B.H, f = poseFacing(who, t), sitting = who.sits.some((q) => t >= q.t0 && q.to === 1 && !who.sits.some((r) => r.t0 > q.t0 && r.t0 <= t && r.to === 0));
  const top = sitting ? Hh * 0.82 : Hh;
  if (s.kind === 'two') { const o = A(s.ids[1]); const xs = [x, o ? xAt(o, t).x : x]; const r = fit(Math.min(...xs) - 1.0, Math.max(...xs) + 1.0, 3.8, -0.35); return r; }
  if (s.kind === 'single') { const w = Math.max(2.3, Hh * 2.1), h = w * aspect; return { cx: x + f * w * 0.12, cy: top - h * 0.36, w }; }
  if (s.kind === 'close') { const w = Math.max(1.25, Hh * 1.05), h = w * aspect; return { cx: x + f * w * 0.1, cy: top - Hh * 0.13 - h * 0.08, w }; }
  return frameOf({ kind: 'est' }, t);
}
const poseFacing = (A, t) => { let f = 1; for (const [tt, ff] of A.faceKeys) { if (tt > t) break; f = ff; } return f; };
function camAt(t) {
  const s = shotAt(t), a = Math.max(s.t0, t - 0.8), n = 6; let cx = 0, cy = 0, w = 0;
  for (let i = 0; i < n; i++) { const tt = a + (t - a) * (i / (n - 1)), r = frameOf(s, tt); cx += r.cx; cy += r.cy; w += r.w; }
  cx /= n; cy /= n; w /= n; w *= 1 - 0.035 * Math.min(1, (t - s.t0) / 5); // a slow push in through the shot
  const aspect = H() / W(), h = w * aspect; cy = Math.max(cy, -1.05 + h / 2); // never below the front of the stage
  return { cx, cy, w, shot: s };
}

const posesCache = new Map();
function poseOf(A, t) { const k = A.id + ':' + t.toFixed(3); if (!posesCache.has(k)) { if (posesCache.size > 400) posesCache.clear(); posesCache.set(k, poseAt(A, t, CTX)); } return posesCache.get(k); }
// the world position of someone's near hand at a moment
function handOf(id, t, which = 'F') { const A = T.actors[id]; if (!A) return null; const p = poseOf(A, t), J = joints(A.spec, p), arm = which === 'B' ? J.armB : J.armF; const dx = arm.wx - arm.ex, dy = arm.wy - arm.ey, l = Math.hypot(dx, dy) || 1; return { x: p.x + (arm.wx + dx / l * 0.05) * p.f, y: p.y + arm.wy + dy / l * 0.05, ang: Math.atan2(dy, dx * Math.sign(p.f || 1)), f: Math.sign(p.f || 1), ux: dx / l * Math.sign(p.f || 1), uy: dy / l }; }
// where an item is: in a hand, on its way somewhere, up in a tree, flying on its string
function itemAt(I, t) {
  let cur = null;
  const target = (to, tt) => {
    if (to.who) { const h = handOf(to.who, tt, to.hand); return h ? { x: h.x, y: h.y, rot: 0, held: to.who, hand: h } : null; }
    if (to.fly) { const h = handOf(to.fly, tt); if (!h) return null; return { x: h.x + h.f * 1.9 + Math.sin(tt * 0.9) * 0.25, y: 3.1 + Math.sin(tt * 1.3) * 0.18, rot: Math.sin(tt * 1.1) * 0.25, string: h }; }
    if (to.at) return { x: to.at[0] ?? null, y: to.at[1], rot: to.rot || 0 };
    return null;
  };
  for (let i = 0; i < I.keys.length; i++) {
    const k = I.keys[i]; if (k.t > t) break;
    const from = cur ? { ...cur } : null, end = target(k.to, t) || cur;
    if (end && end.x == null && from) end.x = from.x;
    if (from && k.dur && t < k.t + k.dur) {
      const st = i > 0 ? evalBefore(I, k.t) : from, u = (t - k.t) / k.dur, e = k.fall ? u * u : u * u * (3 - 2 * u);
      const x = st.x + (end.x - st.x) * e, y = k.fall ? st.y + (end.y - st.y) * e + Math.sin(Math.PI * u) * 0.15 : st.y + (end.y - st.y) * e + Math.sin(Math.PI * u) * (k.arc || 0.3);
      cur = { x, y, rot: (k.fall ? u * 4 : u * 1.2) + (end.rot || 0) * e, moving: true };
    } else cur = end;
  }
  return cur;
}
// roughly where an item is (for eyes and pointing fingers, which need not know the hand exactly)
function roughItem(I, t) {
  let at = null; for (const k of I.keys) { if (k.t > t) break; const to = k.to;
    if (to.who) { const A = T.actors[to.who]; at = [xAt(A, t).x, A.B.H * 0.55]; } else if (to.fly) { const A = T.actors[to.fly]; at = [xAt(A, t).x + 1.9 * poseFacing(A, t), 3.1]; } else if (to.at) at = [to.at[0] ?? at?.[0] ?? STAGE_W / 2, to.at[1]]; }
  return at;
}
function evalBefore(I, tt) { const J = { ...I, keys: I.keys.filter((k) => k.t < tt) }; return itemAt(J, tt) || { x: STAGE_W / 2, y: 1, rot: 0 }; }
const CTX = {
  holding: (id, t) => { for (const I of Object.values(T.items)) { let h = null; for (const k of I.keys) { if (k.t > t) break; h = k.to.who || null; } if (h === id) return I.id; } return null; },
  where: (what, t) => { if (what == null) return null; if (T.actors[what]) { const A = T.actors[what]; return [xAt(A, t).x, A.B.H * 0.9]; } if (T.items[what]) return roughItem(T.items[what], t); if (!isNaN(+what)) return [+what * STAGE_W, 1]; return null; },
};

function draw(t) {
  posesCache.clear();
  const w = W(), h = H(), cam = camAt(t), sc = sceneAt(t), set = SETS[sc.set] || SETS.park, z = w / cam.w, z0 = w / 11;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const o = 0.022;
  const layerXf = (L) => { const k = L.k, zk = Math.pow(z, k) * Math.pow(z0, 1 - k), cx = STAGE_W / 2 + (cam.cx - STAGE_W / 2) * k, cy = cam.cy * (0.4 + 0.6 * k) + (1 - k) * 1.6; g.setTransform(zk, 0, 0, -zk, w / 2 - cx * zk, h / 2 + cy * zk); return { x0: cx - w / 2 / zk, x1: cx + w / 2 / zk, y0: cy - h / 2 / zk, y1: cy + h / 2 / zk, t }; };
  for (const L of set.layers) { if (L.front) continue; const v = layerXf(L); L.draw(g, v, sc.tod, o); }
  // the puppets, the farther from the camera's middle first, so the one in the middle of a shot is on top
  layerXf({ k: 1 });
  const vis = Object.values(T.actors).filter((A) => visible(A, t) && t >= sc.t0 - 0.01);
  const speaking = T.lines.find((l) => t >= l.t0 && t <= l.t1)?.who;
  vis.sort((a, b) => (a.id === speaking) - (b.id === speaking) || Math.abs(xAt(b, t).x - cam.cx) - Math.abs(xAt(a, t).x - cam.cx));
  const night = sc.tod === 'night' ? 0.55 : sc.tod === 'evening' ? 0.9 : 1;
  for (const A of vis) {
    const p = poseOf(A, t); g.save(); if (night < 1) g.filter = `brightness(${night}) saturate(${0.8 + night * 0.2})`;
    drawPuppet(g, A.spec, p); g.restore();
    // what it carries, in its hand
    for (const I of Object.values(T.items)) { const s = itemAt(I, t); if (s?.held === A.id) drawItem(I.id, s, t, night); }
  }
  for (const I of Object.values(T.items)) { const s = itemAt(I, t); if (s && !s.held) drawItem(I.id, s, t, night); }
  for (const L of set.layers) if (L.front) { const v = layerXf(L); L.draw(g, v, sc.tod, o); }
  // fading in to each place, and out of it
  g.setTransform(1, 0, 0, 1, 0, 0);
  const fade = Math.max(1 - (t - sc.t0) / 0.7, 1 - ((sc.t1 ?? T.len) - t) / 0.8, 0);
  if (fade > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`; g.fillRect(0, 0, w, h); }
  // subtitles
  const L = T.lines.find((l) => t >= l.t0 - 0.05 && t <= l.t1 + 0.25);
  const txt = L ? (lang === 'en' ? L.en || L.zh : L.zh) : '';
  if ($('sub').dataset.t !== txt) { $('sub').dataset.t = txt; $('sub').innerHTML = txt ? `<b style="color:${nameColor(L.who)}">${cast[L.who]?.name?.[lang] || ''}</b>${txt}` : ''; }
  // the title, over the first moments
  const ti = $('title'), show = t < 4.2 && EP; ti.style.opacity = show ? Math.min(1, (t - 0.3) * 2, (4.2 - t) * 2) : 0; if (show && ti.dataset.l !== lang) { ti.dataset.l = lang; ti.innerHTML = `<small>${SERIES.title[lang]}</small>${EP.title[lang]}`; }
}
function nameColor(id) { return cast[id]?.colors?.top || '#ffe0a0'; }
function drawItem(id, s, t, night) {
  const P = PROPS[id]; if (!P || s.x == null) return; g.save(); if (night < 1) g.filter = `brightness(${night})`;
  if (s.string) { g.strokeStyle = '#f8f8f0'; g.lineWidth = 0.008; g.beginPath(); g.moveTo(s.string.x, s.string.y); g.quadraticCurveTo((s.x + s.string.x) / 2, (s.y + s.string.y) / 2 - 0.4, s.x, s.y - 0.3); g.stroke(); }
  g.translate(s.x, s.y);
  if (P.along && s.hand) g.rotate(-Math.atan2(s.hand.ux, -s.hand.uy)); else g.rotate(-(s.rot || 0));
  P.draw(g, 0.02, t); g.restore();
}

function loop(now) {
  if (T) {
    if (playing) { tNow = tStart + (player.ctx.currentTime - t0Wall); if (tNow >= T.len) { tNow = T.len; pause(); } }
    draw(tNow); $('bar').value = tNow / T.len; $('time').textContent = `${fmt(tNow)} / ${fmt(T.len)}`;
  }
  requestAnimationFrame(loop);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
startScreen(); requestAnimationFrame(loop);
window.APP = { frame: (t) => { tNow = t; draw(t); }, load: loadEpisode, get T() { return T; } };
if (q.get('ep')) loadEpisode(q.get('ep'), false); else window.DONE = true;

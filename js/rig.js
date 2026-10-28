// The puppet: a 2D cut-out character on a skeleton of bones (hips, spine, neck, head; shoulder, elbow, wrist; hip,
// knee, ankle), drawn in flat colours with a soft outline, in three-quarter view, facing left or right.
// A pose is a plain object of angles (radians) and face settings; makePose() gives a neutral one.
//   drawPuppet(g, spec, pose)   g: a canvas context already in world units, y up, the puppet's feet at (pose.x, pose.y)
//
// Angles: a limb at 0 hangs straight down; positive turns it forward (the way the puppet faces). The elbow and knee
// add to their parent's angle (an elbow bent up is positive, a knee bent back is negative).

export const OUTLINE = '#2a2230';
const TAU = Math.PI * 2;

// the build of a character from its spec: kids have big heads and short legs, the old a little shorter and stooped
export function bodyOf(spec) {
  const kind = spec.age || 'adult', H = spec.height || (kind === 'kid' ? 1.25 : kind === 'elder' ? 1.58 : 1.72);
  const k = kind === 'kid' ? { head: 0.17, leg: 0.36, torso: 0.27, arm: 0.29, w: 0.2 } : kind === 'elder' ? { head: 0.118, leg: 0.43, torso: 0.3, arm: 0.33, w: 0.2 } : { head: 0.112, leg: 0.46, torso: 0.3, arm: 0.34, w: 0.18 };
  const build = { slim: 0.86, normal: 1, round: 1.28 }[spec.build || 'normal'] || 1;
  return {
    H, kind, R: H * k.head, leg: H * k.leg, torso: H * k.torso, upper: H * k.arm * 0.52, lower: H * k.arm * 0.48,
    tw: H * k.w * build, hw: H * k.w * 0.9 * Math.sqrt(build), aw: H * 0.052 * Math.sqrt(build), lw: H * 0.066 * Math.sqrt(build), foot: H * 0.085,
  };
}

export function makePose(x = 0, f = 1) {
  return {
    x, y: 0, f, // where the feet stand, and which way it faces (1 right, -1 left)
    bob: 0, lean: 0, torso: 0, crouch: 0, // the hips' rise and fall, the whole body's lean, the chest's bend, how far the knees give
    head: 0, tilt: 0, turn: 0, // the head's nod (positive forward), its tilt, and how far it turns toward us (-1 face on .. 0 three-quarter .. 1 profile)
    armF: { sh: 0.08, el: 0.12, hand: 'open' }, armB: { sh: -0.05, el: 0.1, hand: 'open' }, // the near arm and the far one
    legF: { hip: 0, knee: 0, foot: 0 }, legB: { hip: 0, knee: 0, foot: 0 }, feetIK: null, // or world positions for the two ankles: { F: [x, y], B: [x, y] }
    sit: 0, // 0 standing .. 1 sitting (on a seat at pose.seat height)
    seat: 0.42,
    face: { blink: 0, look: [1, 0], brow: 0, browIn: 0, eyes: 1, happyEyes: 0, mouth: { open: 0, wide: 0.3, round: 0, smile: 0.25 }, blush: 0, sweat: 0, tears: 0 },
    hair: [0, 0], // the spring of the hair and anything loose: a sideways and an up-down swing
  };
}

// ---------------------------------------------------------------- small helpers
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))))); return `rgb(${c[0]},${c[1]},${c[2]})`; };
export { shade };
const lerp = (a, b, k) => a + (b - a) * k;
function seg(g, x0, y0, x1, y1, w, col, line = OUTLINE, o = 0.022) { // a rounded limb segment: outline under, colour over
  g.lineCap = 'round';
  g.strokeStyle = line; g.lineWidth = w + o; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.stroke();
}
function poly(g, pts, fill, line = OUTLINE, o = 0.022, close = true) {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath();
  g.lineJoin = 'round'; g.lineWidth = o; g.strokeStyle = line; g.fillStyle = fill; g.fill(); g.stroke();
}
function blob(g, cx, cy, rx, ry, rot, fill, line = OUTLINE, o = 0.022) {
  g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, TAU); g.fillStyle = fill; g.fill(); g.lineWidth = o; g.strokeStyle = line; g.stroke();
}
// a smooth closed shape through points (Catmull-Rom as quadratic midpoints)
function smooth(g, pts) {
  const n = pts.length; g.beginPath();
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (i === 0) g.moveTo(m[0], m[1]); else g.quadraticCurveTo(a[0], a[1], m[0], m[1]); }
  const a = pts[0], b = pts[1]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); g.closePath();
}

// two-bone IK: from a hip to an ankle with bones of lengths a and b, the knee bending forward (sign +1) or back
export function ik2(hx, hy, tx, ty, a, b, bend = 1) {
  let dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy); const dm = Math.min(d, a + b - 1e-4), k = d > 1e-6 ? dm / d : 1; dx *= k; dy *= k; d = dm;
  const base = Math.atan2(dy, dx), cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), A = Math.acos(cosA) * bend;
  const kx = hx + Math.cos(base + A) * a, ky = hy + Math.sin(base + A) * a;
  return { kx, ky, ax: hx + dx, ay: hy + dy };
}

// ---------------------------------------------------------------- the puppet
export function joints(spec, p) {
  // all positions in the puppet's own frame: x forward (the way it faces), y up, feet at 0
  const B = bodyOf(spec), sit = p.sit || 0;
  const hipY = lerp(B.leg - (p.crouch || 0) * B.leg * 0.35, (p.seat ?? 0.42) + 0.02, sit) + (p.bob || 0), hipX = lerp(0, -B.leg * 0.08, sit);
  const lean = (p.lean || 0) + (B.kind === 'elder' ? 0.08 : 0), tor = lean + (p.torso || 0);
  const nx = hipX + Math.sin(tor) * B.torso, ny = hipY + Math.cos(tor) * B.torso; // the base of the neck
  const hang = (ox, oy, a1, a2, l1, l2) => { const ex = ox + Math.sin(a1) * l1, ey = oy - Math.cos(a1) * l1, wx = ex + Math.sin(a1 + a2) * l2, wy = ey - Math.cos(a1 + a2) * l2; return { ox, oy, ex, ey, wx, wy }; };
  const shY = ny - B.R * 0.18, shX = nx - Math.sin(tor) * B.R * 0.18;
  const armF = hang(shX + B.tw * 0.12, shY, (p.armF.sh || 0) + tor * 0.3, p.armF.el || 0, B.upper, B.lower);
  const armB = hang(shX - B.tw * 0.18, shY, (p.armB.sh || 0) + tor * 0.3, p.armB.el || 0, B.upper, B.lower);
  const legs = {};
  for (const [k, L, dx] of [['F', p.legF, 0.05], ['B', p.legB, -0.05]]) {
    const hx = hipX + dx * B.tw, hy = hipY, a = B.leg * 0.5;
    if (p.feetIK && !sit) { const [tx, ty] = p.feetIK[k]; const r = ik2(hx, hy, tx, ty + B.foot * 0.25, a, a, 1); legs[k] = { hx, hy, kx: r.kx, ky: r.ky, ax: r.ax, ay: r.ay, foot: L.foot || 0 }; }
    else {
      const t1 = sit ? lerp(L.hip || 0, Math.PI / 2 - 0.08, sit) : L.hip || 0, t2 = sit ? lerp(L.knee || 0, -Math.PI / 2 + 0.12, sit) : L.knee || 0;
      const kx = hx + Math.sin(t1) * a, ky = hy - Math.cos(t1) * a; let ax = kx + Math.sin(t1 + t2) * a, ay = ky - Math.cos(t1 + t2) * a;
      if (!sit && (p.crouch || 0) > 0 && !p.feetIK) { const r = ik2(hx, hy, hx + 0.02, B.foot * 0.25, a, a, 1); legs[k] = { hx, hy, kx: r.kx, ky: r.ky, ax: r.ax, ay: r.ay, foot: L.foot || 0 }; continue; }
      legs[k] = { hx, hy, kx, ky, ax, ay, foot: L.foot || 0 };
    }
  }
  const hd = (p.head || 0) * 0.8 + tor * 0.4, hx = nx + Math.sin(hd) * B.R * 0.9, hy = ny + B.H * 0.02 + Math.cos(hd) * B.R * 0.95;
  return { B, hipX, hipY, tor, nx, ny, armF, armB, legs, head: { x: hx, y: hy, a: hd + (p.tilt || 0) * 0.5 } };
}

export function drawPuppet(g, spec, p, opts = {}) {
  const J = joints(spec, p), B = J.B, o = Math.max(0.016, B.H * 0.014), C = spec.colors || {};
  const skin = spec.skin || '#f2c9a5', top = C.top || '#4a8fe0', bottom = C.bottom || '#3a4a6a', shoes = C.shoes || '#3a2a2a', hairC = spec.hair?.color || '#3a2a20';
  g.save(); g.translate(p.x, p.y); g.scale(p.f || 1, 1);
  // its shadow on the ground
  g.fillStyle = 'rgba(30,20,40,0.18)'; g.beginPath(); g.ellipse(0, 0.005 - p.y, B.H * 0.2 * (1 - Math.min(0.6, p.y * 1.2)), B.H * 0.03, 0, 0, TAU); g.fill();
  const back = (c) => shade(c, 0.82);
  const sleeveLong = ['hoodie', 'coat', 'sweater', 'long'].includes(spec.outfit?.top), skirt = ['skirt', 'dress'].includes(spec.outfit?.bottom) || spec.outfit?.top === 'dress';
  const arm = (A, near, hand) => {
    const sc = near ? top : back(top), skc = near ? skin : back(skin);
    seg(g, A.ox, A.oy, A.ex, A.ey, B.aw * 1.15, sc, OUTLINE, o);
    seg(g, A.ex, A.ey, A.wx, A.wy, B.aw * 0.95, sleeveLong ? sc : skc, OUTLINE, o);
    if (sleeveLong) { const dx = A.wx - A.ex, dy = A.wy - A.ey, l = Math.hypot(dx, dy) || 1; seg(g, A.wx - dx / l * 0.02, A.wy - dy / l * 0.02, A.wx, A.wy, B.aw * 1.05, shade(sc, 0.9), OUTLINE, o); }
    drawHand(g, A, B, skc, hand, o);
  };
  const leg = (L, near) => {
    const pc = near ? bottom : back(bottom), sk = near ? skin : back(skin), shorts = spec.outfit?.bottom === 'shorts' || skirt;
    seg(g, L.hx, L.hy, L.kx, L.ky, B.lw * 1.1, shorts ? sk : pc, OUTLINE, o);
    seg(g, L.kx, L.ky, L.ax, L.ay, B.lw * 0.95, shorts ? sk : pc, OUTLINE, o);
    if (shorts && !skirt) seg(g, L.hx, L.hy, lerp(L.hx, L.kx, 0.45), lerp(L.hy, L.ky, 0.45), B.lw * 1.25, pc, OUTLINE, o);
    // the shoe: along the ground, toes forward (or tilted on tiptoe)
    const fa = L.foot || 0; g.save(); g.translate(L.ax, L.ay); g.rotate(fa);
    blob(g, B.foot * 0.38, -B.foot * 0.05, B.foot * 0.62, B.foot * 0.3, 0, near ? shoes : back(shoes), OUTLINE, o); g.restore();
  };
  // far side first
  if (spec.hair?.style === 'long' || spec.hair?.style === 'ponytail') drawHairBack(g, spec, J, p, hairC, o);
  arm(J.armB, false, p.armB.hand); leg(J.legs.B, false); leg(J.legs.F, true);
  // the body: from the hips up to the shoulders, a little wider at the chest; a skirt or dress below the waist
  const tor = J.tor, cs = Math.cos(tor), sn = Math.sin(tor), at = (u, v) => [J.hipX + u * cs + v * sn, J.hipY - u * sn + v * cs];
  if (skirt) { const w = B.tw * 0.62, l = B.leg * (spec.outfit?.top === 'dress' ? 0.55 : 0.45); poly(g, [at(-w * 0.75, 0.04), at(w * 0.75, 0.04), [J.hipX + w * 1.25 + l * 0.05, J.hipY - l], [J.hipX - w * 1.15, J.hipY - l]], spec.outfit?.top === 'dress' ? top : bottom, OUTLINE, o); }
  const tw = B.tw / 2, body = [at(-tw * 0.95, -0.02), at(tw * 0.95, -0.02), at(tw * 1.05, B.torso * 0.55), at(tw * 0.9, B.torso * 0.98), at(-tw * 0.9, B.torso * 0.98), at(-tw * 1.05, B.torso * 0.55)];
  g.lineJoin = 'round'; smooth(g, body); g.fillStyle = spec.outfit?.top === 'dress' ? top : top; g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.stroke();
  if (!skirt) { g.fillStyle = shade(bottom, 1); g.beginPath(); const b2 = [at(-tw * 0.98, -0.03), at(tw * 0.98, -0.03), at(tw, B.torso * 0.12), at(-tw, B.torso * 0.12)]; b2.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.stroke(); }
  drawOutfit(g, spec, J, at, tw, o, top);
  // neck and head
  seg(g, J.nx, J.ny - 0.01, J.head.x - Math.sin(J.head.a) * B.R * 0.7, J.head.y - Math.cos(J.head.a) * B.R * 0.7, B.R * 0.42, skin, OUTLINE, o);
  drawHead(g, spec, J, p, skin, hairC, o, opts);
  arm(J.armF, true, p.armF.hand);
  g.restore();
  return J;
}

function drawHand(g, A, B, col, kind, o) {
  const dx = A.wx - A.ex, dy = A.wy - A.ey, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, r = B.aw * 0.68;
  const cx = A.wx + ux * r * 0.6, cy = A.wy + uy * r * 0.6;
  if (kind === 'point') { seg(g, cx, cy, cx + ux * r * 2.1, cy + uy * r * 2.1, r * 0.55, col, OUTLINE, o); }
  if (kind === 'open') { const a = Math.atan2(uy, ux) + 0.9; seg(g, cx, cy, cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05, r * 0.5, col, OUTLINE, o); } // the thumb
  blob(g, cx, cy, r * (kind === 'fist' ? 0.95 : 1.08), r * 0.95, Math.atan2(uy, ux), col, OUTLINE, o);
  if (kind === 'point' || kind === 'open') { const a = Math.atan2(uy, ux) + 0.9; g.strokeStyle = col; g.lineWidth = r * 0.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke(); }
}

function drawOutfit(g, spec, J, at, tw, o, top) {
  const t = spec.outfit?.top, B = J.B;
  if (t === 'hoodie') { g.strokeStyle = shade(top, 0.75); g.lineWidth = o * 0.8; g.beginPath(); const [x0, y0] = at(-tw * 0.5, B.torso * 0.35), [x1, y1] = at(tw * 0.5, B.torso * 0.35); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); poly(g, [at(-tw * 0.55, B.torso * 0.98), at(tw * 0.55, B.torso * 0.98), at(tw * 0.2, B.torso * 0.78), at(-tw * 0.2, B.torso * 0.78)], shade(top, 0.85), OUTLINE, o * 0.8); }
  if (t === 'coat') { g.strokeStyle = OUTLINE; g.lineWidth = o * 0.7; g.beginPath(); const [x0, y0] = at(tw * 0.15, -0.02), [x1, y1] = at(tw * 0.15, B.torso * 0.95); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); for (const v of [0.3, 0.55, 0.8]) { const [bx, by] = at(tw * 0.32, B.torso * v); blob(g, bx, by, 0.012, 0.012, 0, '#e8d8b0', OUTLINE, o * 0.5); } }
  if (t === 'tee' || !t) { const [cx, cy] = at(tw * 0.25, B.torso * 0.95); g.strokeStyle = shade(top, 0.7); g.lineWidth = o * 0.8; g.beginPath(); g.arc(cx, cy, B.tw * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  if (spec.outfit?.apron) { poly(g, [at(-tw * 0.55, -0.12), at(tw * 0.85, -0.12), at(tw * 0.7, B.torso * 0.7), at(-tw * 0.4, B.torso * 0.7)], spec.outfit.apron, OUTLINE, o); }
  if (spec.outfit?.scarf) { const [sx, sy] = at(0, B.torso * 0.93); blob(g, sx, sy, B.tw * 0.55, B.R * 0.22, J.tor, spec.outfit.scarf, OUTLINE, o); }
  if (spec.outfit?.badge) { const [bx, by] = at(tw * 0.5, B.torso * 0.7); blob(g, bx, by, 0.02, 0.02, 0, spec.outfit.badge, OUTLINE, o * 0.6); }
}

function drawHairBack(g, spec, J, p, col, o) {
  const B = J.B, h = J.head, R = B.R, s = spec.hair.style, [sw, su] = p.hair || [0, 0];
  g.save(); g.translate(h.x, h.y); g.rotate(-h.a);
  if (s === 'long') smooth(g, [[-R * 1.05, R * 0.4], [R * 0.6, R * 0.95], [R * 0.75, -R * 0.2], [R * 0.35 + sw * R * 0.3, -R * 1.65 + su * R * 0.2], [-R * 0.95 - sw * R * 0.6, -R * 1.75 + su * R * 0.2], [-R * 1.25 - sw * R * 0.4, -R * 0.4]]);
  else { // ponytail: from the back of the crown, swinging
    const bx = -R * 0.85, by = R * 0.35, ex = bx - R * 0.55 - sw * R * 0.8, ey = by - R * 1.15 + su * R * 0.3;
    g.beginPath(); g.moveTo(bx, by + R * 0.18); g.quadraticCurveTo(bx - R * 0.6, by + R * 0.1, ex, ey); g.quadraticCurveTo(bx - R * 0.1, by - R * 0.4, bx, by - R * 0.15); g.closePath();
  }
  g.fillStyle = shade(col, 0.9); g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.stroke();
  g.restore();
}

function drawHead(g, spec, J, p, skin, hairC, o, opts) {
  const B = J.B, R = B.R, h = J.head, F = p.face || {}, s = spec.hair?.style || 'short', turn = Math.max(-1, Math.min(1, p.turn || 0));
  g.save(); g.translate(h.x, h.y); g.rotate(-h.a);
  const fx = R * (0.16 + 0.26 * turn), ew = R * 0.4 * (1 - 0.35 * Math.max(0, turn)); // where the face is on the head, and how far apart the eyes
  // the ear, on the side we see
  blob(g, -R * 0.05 - fx * 0.5, -R * 0.05, R * 0.17, R * 0.24, 0, shade(skin, 0.95), OUTLINE, o);
  // the head itself: rounder for a child, a little longer for an adult, the jaw toward the face
  const jaw = B.kind === 'kid' ? 0.92 : 0.86;
  smooth(g, [[-R, R * 0.15], [-R * 0.82, R * 0.88], [R * 0.1, R * 1.05], [R * 0.92, R * 0.62], [R * 1.02 + fx * 0.05, -R * 0.18], [R * 0.62 + fx * 0.2, -R * jaw], [-R * 0.1, -R * 0.98], [-R * 0.88, -R * 0.55]]);
  g.fillStyle = skin; g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.stroke();
  // cheeks
  if ((F.blush || 0) > 0.02 || spec.cheeks) { g.fillStyle = `rgba(240,110,120,${0.18 + 0.4 * (F.blush || 0)})`; for (const ex of [fx - ew * 0.95, fx + ew * 0.95]) { g.beginPath(); g.ellipse(ex, -R * 0.3, R * 0.16, R * 0.09, 0, 0, TAU); g.fill(); } }
  drawFace(g, spec, R, fx, ew, F, turn, o);
  drawHairFront(g, spec, R, fx, hairC, o, p.hair || [0, 0], s);
  if (spec.glasses) { g.lineWidth = o * 0.9; g.strokeStyle = spec.glasses; for (const ex of [fx - ew, fx + ew * (1 - 0.25 * Math.max(0, turn))]) { g.beginPath(); g.arc(ex, R * 0.02, R * 0.2, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(fx - ew + R * 0.2, R * 0.04); g.lineTo(fx + ew - R * 0.2, R * 0.04); g.stroke(); }
  if (spec.hat) drawHat(g, spec.hat, R, o);
  g.restore();
}

function drawFace(g, spec, R, fx, ew, F, turn, o) {
  const look = F.look || [1, 0], blink = Math.max(0, Math.min(1, F.blink || 0)), big = F.eyes ?? 1, happy = F.happyEyes || 0;
  const eyeR = R * (spec.age === 'kid' ? 0.25 : 0.19) * (0.85 + 0.15 * big), iris = spec.eyes || '#3a2a20';
  for (const [i, ex] of [[0, fx - ew], [1, fx + ew * (1 - 0.25 * Math.max(0, turn))]]) {
    const sz = i === 0 ? 1 - 0.08 : 1 - 0.2 * Math.max(0, turn), ey = R * 0.0, rx = eyeR * 0.74 * sz, ry = eyeR * big * sz;
    if (happy > 0.5 || blink > 0.85) { // closed: an arc (smiling) or a line (blinking)
      g.strokeStyle = OUTLINE; g.lineWidth = o * 1.1; g.lineCap = 'round'; g.beginPath();
      if (happy > 0.5) g.arc(ex, ey - ry * 0.3, rx * 0.9, Math.PI * 0.15, Math.PI * 0.85); else { g.moveTo(ex - rx, ey - ry * 0.2); g.quadraticCurveTo(ex, ey - ry * 0.55, ex + rx, ey - ry * 0.2); }
      g.stroke(); continue;
    }
    g.fillStyle = '#fffdf8'; g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, TAU); g.fill();
    const px = ex + look[0] * rx * 0.35, py = ey + look[1] * ry * 0.3;
    g.save(); g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, TAU); g.clip();
    g.fillStyle = iris; g.beginPath(); g.ellipse(px, py, rx * 0.68, ry * 0.72, 0, 0, TAU); g.fill();
    g.fillStyle = '#140c14'; g.beginPath(); g.ellipse(px, py, rx * 0.36, ry * 0.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(px + rx * 0.22, py + ry * 0.28, rx * 0.2, ry * 0.18, 0, 0, TAU); g.fill();
    // the lid comes down from the top
    if (blink > 0.01) { g.fillStyle = shade(spec.skin || '#f2c9a5', 0.92); g.fillRect(ex - rx * 1.2, ey + ry * (1 - 2 * blink), rx * 2.4, ry * 2.2); }
    g.restore();
    g.lineWidth = o * 0.9; g.strokeStyle = OUTLINE; g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); // the upper lid line, thicker
    g.lineWidth = o * 0.5; g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, Math.PI * 0.95, Math.PI * 2.05); g.stroke();
    if (spec.lashes) { g.lineWidth = o * 0.7; g.beginPath(); g.moveTo(ex + rx * 0.8, ey + ry * 0.5); g.lineTo(ex + rx * 1.15, ey + ry * 0.75); g.stroke(); }
  }
  // brows: raised (positive), lowered and drawn in (angry: browIn), or lifted in the middle (worried: negative browIn)
  const br = F.brow || 0, bi = F.browIn || 0, by = R * 0.36 + br * R * 0.12;
  g.strokeStyle = spec.browColor || shade(spec.hair?.color || '#3a2a20', 0.8); g.lineWidth = R * 0.06; g.lineCap = 'round';
  for (const [s, ex] of [[-1, fx - ew], [1, fx + ew * (1 - 0.25 * Math.max(0, turn))]]) {
    const inner = ex - s * eyeR * 0.75, outer = ex + s * eyeR * 0.85; // inner end toward the nose
    g.beginPath(); g.moveTo(inner, by - bi * R * 0.1); g.quadraticCurveTo(ex, by + R * 0.04 + Math.abs(br) * 0.02, outer, by + bi * R * 0.06); g.stroke();
  }
  // nose: a small curve, toward the way it faces
  g.strokeStyle = shade(spec.skin || '#f2c9a5', 0.72); g.lineWidth = o * 0.75; g.lineCap = 'round'; g.beginPath(); g.moveTo(fx + R * 0.1, -R * 0.2); g.quadraticCurveTo(fx + R * 0.16, -R * 0.27, fx + R * 0.06, -R * 0.29); g.stroke();
  // the mouth: shut it is a line that curves with the smile; open, a dark shape the vowel gives its form
  const M = F.mouth || {}, op = Math.max(0, Math.min(1, M.open || 0)), sm = M.smile || 0, rd = M.round || 0, wd = M.wide ?? 0.3;
  const mx = fx + R * 0.02, my = -R * 0.5, mw = R * (0.2 + 0.16 * wd - 0.1 * rd) * (spec.age === 'kid' ? 1.05 : 1);
  if (op < 0.06) { g.strokeStyle = OUTLINE; g.lineWidth = o * 1.0; g.beginPath(); g.moveTo(mx - mw, my + sm * R * 0.06); g.quadraticCurveTo(mx, my - sm * R * 0.16, mx + mw, my + sm * R * 0.06); g.stroke(); }
  else {
    const mh = R * (0.06 + 0.3 * op) * (1 + 0.3 * rd), top = my + sm * R * 0.05;
    g.beginPath(); g.moveTo(mx - mw, top); g.quadraticCurveTo(mx, top - sm * R * 0.08 + mh * 0.1, mx + mw, top);
    g.quadraticCurveTo(mx + mw * 0.7, top - mh * 1.1, mx, top - mh * (1.15 + 0.15 * sm)); g.quadraticCurveTo(mx - mw * 0.7, top - mh * 1.1, mx - mw, top); g.closePath();
    g.fillStyle = '#5a1a24'; g.fill(); g.save(); g.clip();
    g.fillStyle = '#e8707a'; g.beginPath(); g.ellipse(mx, top - mh * 1.1, mw * 0.6, mh * 0.45, 0, 0, TAU); g.fill(); // the tongue
    if (op > 0.25) { g.fillStyle = '#ffffff'; g.fillRect(mx - mw, top - mh * 0.18, mw * 2, mh * 0.2); } // teeth
    g.restore(); g.lineWidth = o * 0.9; g.strokeStyle = OUTLINE; g.stroke();
  }
  if ((F.sweat || 0) > 0.1) { g.fillStyle = '#9ad4ff'; g.strokeStyle = OUTLINE; g.lineWidth = o * 0.6; g.beginPath(); g.moveTo(-R * 0.55, R * 0.62); g.quadraticCurveTo(-R * 0.7, R * 0.4, -R * 0.55, R * 0.35); g.quadraticCurveTo(-R * 0.4, R * 0.4, -R * 0.55, R * 0.62); g.fill(); g.stroke(); }
  if ((F.tears || 0) > 0.1) { g.fillStyle = 'rgba(150,210,255,0.85)'; g.beginPath(); g.ellipse(fx - ew + R * 0.08, -R * 0.28, R * 0.05, R * 0.12 * F.tears, 0, 0, TAU); g.fill(); }
}

function drawHairFront(g, spec, R, fx, col, o, [sw, su], s) {
  const c = col, dark = shade(col, 0.85);
  g.lineJoin = 'round';
  const fill = () => { g.fillStyle = c; g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.stroke(); };
  if (s === 'bald') { g.fillStyle = dark; g.beginPath(); g.ellipse(-R * 0.75, -R * 0.05, R * 0.25, R * 0.4, 0.3, 0, TAU); g.fill(); return; }
  if (s === 'bun') { blob(g, -R * 0.45, R * 1.12, R * 0.38, R * 0.32, 0.4, c, OUTLINE, o); }
  if (s === 'spiky') {
    g.beginPath(); g.moveTo(-R * 1.02, -R * 0.1); const n = 6;
    for (let i = 0; i <= n; i++) { const a = Math.PI * (0.95 - 0.85 * i / n), r1 = R * 1.08, r2 = R * (1.38 + (i % 2) * 0.08); g.lineTo(Math.cos(a) * r1 * 0.98, Math.sin(a) * r1); if (i < n) { const a2 = a - Math.PI * 0.85 / n / 2; g.lineTo(Math.cos(a2) * r2 + sw * R * 0.08, Math.sin(a2) * r2 + su * R * 0.05); } }
    g.lineTo(fx + R * 0.45, R * 0.42); g.quadraticCurveTo(R * 0.1, R * 0.62, -R * 0.55, R * 0.3); g.closePath(); fill(); return;
  }
  // a cap of hair over the crown, then the fringe over the forehead
  const fr = s === 'bob' || s === 'long' || s === 'ponytail' || s === 'bun' ? 0.32 : 0.45;
  g.beginPath(); g.moveTo(-R * 1.04, -R * (s === 'bob' ? 0.55 : 0.05)); g.quadraticCurveTo(-R * 1.15, R * 1.05, R * 0.05, R * 1.12); g.quadraticCurveTo(R * 0.95, R * 1.0, R * 1.02 + fx * 0.05, R * fr - R * 0.05);
  g.quadraticCurveTo(fx + R * 0.2, R * (fr + 0.05) + su * R * 0.04, fx - R * 0.15, R * (fr + 0.12)); g.quadraticCurveTo(fx - R * 0.3, R * (fr - 0.05), fx - R * 0.55 + sw * R * 0.05, R * (fr - 0.1));
  g.quadraticCurveTo(-R * 0.4, R * 0.5, -R * 0.62, R * 0.1);
  if (s === 'bob') g.quadraticCurveTo(-R * 0.6, -R * 0.4, -R * 0.75 + sw * R * 0.08, -R * 0.62); else g.lineTo(-R * 0.85, -R * 0.05);
  g.closePath(); fill();
  if (s === 'bob') { g.strokeStyle = dark; g.lineWidth = o * 0.6; g.beginPath(); g.moveTo(-R * 0.2, R * 0.95); g.quadraticCurveTo(-R * 0.6, R * 0.4, -R * 0.8, -R * 0.4); g.stroke(); }
  if (spec.hair?.clip) blob(g, fx - R * 0.6, R * 0.62, R * 0.1, R * 0.06, 0.3, spec.hair.clip, OUTLINE, o * 0.6);
}

function drawHat(g, hat, R, o) {
  if (hat.type === 'cap') { g.beginPath(); g.ellipse(0, R * 0.62, R * 1.05, R * 0.6, 0, Math.PI * 0.02, Math.PI * 0.98); g.closePath(); g.fillStyle = hat.color; g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.stroke(); poly(g, [[R * 0.5, R * 0.68], [R * 1.55, R * 0.55], [R * 1.5, R * 0.68], [R * 0.6, R * 0.8]], shade(hat.color, 0.85), OUTLINE, o); }
  if (hat.type === 'beanie') { g.beginPath(); g.ellipse(0, R * 0.55, R * 1.06, R * 0.72, 0, 0, Math.PI); g.closePath(); g.fillStyle = hat.color; g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.stroke(); blob(g, 0, R * 1.32, R * 0.18, R * 0.18, 0, shade(hat.color, 1.25), OUTLINE, o); }
}

// The places: each drawn in layers that slide past at different speeds as the camera moves (the sky not at all,
// far hills a little, the stage itself with the puppets, grass in front a little faster), in the light of the
// time of day. seats: where a puppet can sit (x across the stage 0..1, seat height). places: named spots for props.
import { OUTLINE, shade } from './rig.js';
const TAU = Math.PI * 2;
const SKY = {
  day: ['#8fd0f4', '#d8f0fb', '#fff4d8'], evening: ['#5a5aa8', '#f0907a', '#ffd49a'], night: ['#0f1838', '#28306a', '#4a4a80'],
};
const LIGHT = { day: 1, evening: 0.86, night: 0.55 };
const rnd = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646; };
const tint = (c, tod) => (tod === 'day' ? c : tod === 'evening' ? warm(c, 0.85, [255, 150, 110], 0.18) : warm(c, 0.5, [70, 80, 160], 0.3));
function warm(hex, k, col, m) { const c0 = hex.startsWith('rgb') ? hex.match(/\d+/g).map(Number) : (() => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; })(); const c = c0.map((v, i) => Math.round((v * k) * (1 - m) + col[i] * m)); return `rgb(${c.join(',')})`; }

function blobs(g, pts, fill, line = OUTLINE, o = 0.025) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); if (line) { g.lineWidth = o; g.strokeStyle = line; g.lineJoin = 'round'; g.stroke(); } }
function cloudShape(g, x, y, s, col) { g.fillStyle = col; g.beginPath(); for (const [dx, dy, r] of [[0, 0, 0.5], [0.55, 0.12, 0.42], [-0.55, 0.06, 0.38], [0.2, 0.32, 0.4], [-0.25, 0.28, 0.35]]) { g.moveTo(x + (dx + r) * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); } g.fill(); }
function tree(g, x, h, s, col, trunk, tod, o) { // a round, layered tree
  const L = (c) => tint(c, tod);
  g.lineWidth = o; g.strokeStyle = OUTLINE;
  g.fillStyle = L(trunk); g.beginPath(); g.moveTo(x - 0.14 * s, 0); g.quadraticCurveTo(x - 0.08 * s, h * 0.5, x - 0.1 * s, h * 0.78); g.lineTo(x + 0.1 * s, h * 0.78); g.quadraticCurveTo(x + 0.08 * s, h * 0.5, x + 0.16 * s, 0); g.closePath(); g.fill(); g.stroke();
  for (const [dx, dy, r, k] of [[-0.55, 0.85, 0.62, 0.9], [0.55, 0.9, 0.6, 0.92], [0, 1.15, 0.78, 1], [-0.3, 1.45, 0.55, 1.05], [0.35, 1.42, 0.5, 1.08]]) {
    g.fillStyle = L(shade(col, k)); g.beginPath(); g.arc(x + dx * s, h * 0.72 + dy * s * 0.9, r * s, 0, TAU); g.fill(); g.stroke();
  }
}
function bush(g, x, s, col, tod, o) { g.fillStyle = tint(col, tod); g.lineWidth = o; g.strokeStyle = OUTLINE; g.beginPath(); for (const [dx, dy, r] of [[-0.3, 0.2, 0.3], [0.1, 0.3, 0.36], [0.45, 0.18, 0.26]]) { g.moveTo(x + (dx + r) * s, dy * s); g.arc(x + dx * s, dy * s, r * s, 0, Math.PI, false); } g.closePath(); g.fill(); g.stroke(); }

export const SETS = {
  park: {
    name: { zh: '公園', en: 'The park' },
    seats: [{ x: 0.24, h: 0.42 }, { x: 0.33, h: 0.42 }],
    places: { tree: [0.665, 2.55, 0.5], ground: [0.6, 0.06] },
    music: 'bright',
    // layers, back to front: k is how fast it moves with the camera (0 still .. 1 with the puppets)
    layers: [
      { k: 0, draw(g, v, tod) { // the sky: a gradient, the sun or the moon, clouds drifting
        const [a, b, c] = SKY[tod] || SKY.day, gr = g.createLinearGradient(0, v.y1, 0, v.y0); gr.addColorStop(0, a); gr.addColorStop(0.6, b); gr.addColorStop(1, c);
        g.fillStyle = gr; g.fillRect(v.x0 - 1, v.y0 - 1, v.x1 - v.x0 + 2, v.y1 - v.y0 + 2);
        const cx = v.x0 + (v.x1 - v.x0) * 0.78, cy = v.y0 + (v.y1 - v.y0) * (tod === 'evening' ? 0.32 : 0.78);
        if (tod === 'night') { g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(cx, cy, 0.35, 0, TAU); g.fill(); g.fillStyle = SKY.night[0]; g.beginPath(); g.arc(cx + 0.14, cy + 0.08, 0.3, 0, TAU); g.fill();
          const r = rnd(7); g.fillStyle = '#ffffff'; for (let i = 0; i < 60; i++) g.fillRect(v.x0 + r() * (v.x1 - v.x0), v.y0 + (0.4 + r() * 0.6) * (v.y1 - v.y0), 0.025, 0.025); }
        else { g.fillStyle = tod === 'evening' ? '#ffb070' : '#fff2b0'; g.beginPath(); g.arc(cx, cy, tod === 'evening' ? 0.6 : 0.45, 0, TAU); g.fill(); g.fillStyle = tod === 'evening' ? 'rgba(255,190,120,0.25)' : 'rgba(255,250,200,0.3)'; g.beginPath(); g.arc(cx, cy, 0.9, 0, TAU); g.fill(); }
        const cc = tod === 'night' ? 'rgba(120,130,190,0.35)' : tod === 'evening' ? 'rgba(255,200,190,0.8)' : 'rgba(255,255,255,0.92)';
        for (let i = 0; i < 4; i++) { const w = v.x1 - v.x0, x = v.x0 + (((i * 0.31 + v.t * 0.006) % 1.2) - 0.1) * w; cloudShape(g, x, v.y0 + (v.y1 - v.y0) * (0.72 + 0.08 * (i % 2)), 0.5 + 0.2 * (i % 3), cc); }
      } },
      { k: 0.25, draw(g, v, tod) { // far hills
        const r = rnd(3); for (const [col, base, amp] of [['#9cc8a0', 1.6, 0.8], ['#7eb88a', 0.9, 0.6]]) { g.fillStyle = tint(col, tod); g.beginPath(); g.moveTo(-30, -1); for (let x = -30; x <= 40; x += 0.5) g.lineTo(x, base + amp * Math.sin(x * 0.35 + base * 3) * 0.6 + amp * Math.sin(x * 0.9 + 1) * 0.25); g.lineTo(40, -1); g.closePath(); g.fill(); }
      } },
      { k: 0.55, draw(g, v, tod, o) { // houses and trees behind the park
        const r = rnd(11);
        for (let i = -6; i < 14; i++) {
          const x = i * 1.9 + r() * 0.6, h = 1.2 + r() * 0.8, w = 1.2 + r() * 0.4, c = ['#f2c88a', '#e8a890', '#c8d4e8', '#f0e0b8', '#d8b8d8'][Math.floor(r() * 5)];
          if (r() < 0.45) { tree(g, x, 1.2 + r() * 0.6, 0.6, '#6aaa6a', '#8a6040', tod, o * 0.8); continue; }
          blobs(g, [[x - w / 2, 0], [x + w / 2, 0], [x + w / 2, h], [x - w / 2, h]], tint(c, tod), OUTLINE, o * 0.8);
          blobs(g, [[x - w / 2 - 0.12, h], [x + w / 2 + 0.12, h], [x, h + 0.55]], tint('#c8584a', tod), OUTLINE, o * 0.8);
          const lit = tod === 'night' ? '#ffd870' : tod === 'evening' ? '#ffe2a0' : '#bfe2f6';
          for (const [wx, wy] of [[-0.25, 0.55], [0.25, 0.55]]) blobs(g, [[x + wx - 0.13, h * wy], [x + wx + 0.13, h * wy], [x + wx + 0.13, h * wy + 0.26], [x + wx - 0.13, h * wy + 0.26]], lit, OUTLINE, o * 0.6);
        }
        g.fillStyle = tint('#88c07a', tod); g.fillRect(-40, -0.2, 90, 0.35); // a strip of lawn behind
      } },
      { k: 1, stage: true, draw(g, v, tod, o) { // the park itself: the grass, a path, the big tree, the bench, flowers
        const W = 8;
        g.fillStyle = tint('#9ed28a', tod); g.fillRect(-20, -3, 50, 3.02);
        g.fillStyle = tint('#e8d4a8', tod); g.beginPath(); g.moveTo(-20, -0.25); g.lineTo(30, -0.25); g.lineTo(30, -0.7); g.lineTo(-20, -0.7); g.fill(); // the path, in front of where they stand
        g.strokeStyle = tint('#d4bc8c', tod); g.lineWidth = 0.02; g.beginPath(); g.moveTo(-20, -0.25); g.lineTo(30, -0.25); g.stroke();
        tree(g, W * 0.665, 1.9, 1.25, '#5ea85a', '#8a5a3a', tod, o);
        // the bench
        const bx = W * 0.285, L = (c) => tint(c, tod);
        for (const dx of [-0.5, 0.5]) blobs(g, [[bx + dx - 0.04, 0], [bx + dx + 0.04, 0], [bx + dx + 0.04, 0.4], [bx + dx - 0.04, 0.4]], L('#5a4a4a'), OUTLINE, o);
        blobs(g, [[bx - 0.68, 0.38], [bx + 0.68, 0.38], [bx + 0.68, 0.46], [bx - 0.68, 0.46]], L('#c47a46'), OUTLINE, o);
        for (const y of [0.6, 0.76]) blobs(g, [[bx - 0.66, y], [bx + 0.66, y], [bx + 0.66, y + 0.08], [bx - 0.66, y + 0.08]], L('#c47a46'), OUTLINE, o);
        for (const dx of [-0.5, 0.5]) blobs(g, [[bx + dx - 0.035, 0.46], [bx + dx + 0.035, 0.46], [bx + dx + 0.035, 0.84], [bx + dx - 0.035, 0.84]], L('#5a4a4a'), OUTLINE, o);
        bush(g, W * 0.06, 0.9, '#6cb46a', tod, o); bush(g, W * 0.95, 1.0, '#64aa62', tod, o);
        const r = rnd(5); for (let i = 0; i < 26; i++) { const x = -4 + r() * 16, c = ['#ff8aa0', '#ffd24a', '#ffffff', '#b8a0ff'][i % 4]; g.fillStyle = tint(c, tod); g.beginPath(); g.arc(x, 0.04 + r() * 0.05, 0.035, 0, TAU); g.fill(); }
      } },
      { k: 1.18, front: true, draw(g, v, tod, o) { // grass in front of everything, at the bottom of the picture
        const r = rnd(9); g.fillStyle = tint('#7cbe6c', tod);
        for (let i = 0; i < 40; i++) { const x = -10 + i * 0.65 + r() * 0.3, h = 0.12 + r() * 0.12, y = -0.75 - r() * 0.15; g.beginPath(); g.moveTo(x - 0.08, y); g.quadraticCurveTo(x - 0.02, y + h * 0.6, x - 0.06, y + h); g.quadraticCurveTo(x + 0.03, y + h * 0.5, x + 0.08, y); g.fill(); }
      } },
    ],
    light: LIGHT,
  },
};

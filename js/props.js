// Props: things the puppets carry, throw, lose in trees and give each other. Each is drawn at a point, turned.
import { OUTLINE, shade } from './rig.js';
const TAU = Math.PI * 2;
function shape(g, pts, fill, o) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.lineJoin = 'round'; g.stroke(); }

export const PROPS = {
  kite: { size: 0.22, draw(g, o, t) { // a diamond kite, its tail of bows fluttering
      const s = 0.22; g.strokeStyle = OUTLINE; g.lineWidth = o * 0.7; g.beginPath(); g.moveTo(0, -s * 1.1);
      for (let i = 1; i <= 6; i++) { const y = -s * 1.1 - i * 0.07, x = Math.sin(t * 6 + i) * 0.04 * i; g.lineTo(x, y); } g.stroke();
      for (let i = 1; i <= 3; i++) { const y = -s * 1.1 - i * 0.14, x = Math.sin(t * 6 + i * 2) * 0.08 * i; shape(g, [[x - 0.05, y + 0.03], [x, y], [x - 0.05, y - 0.03]], '#ffd24a', o * 0.6); shape(g, [[x + 0.05, y + 0.03], [x, y], [x + 0.05, y - 0.03]], '#ffd24a', o * 0.6); }
      shape(g, [[0, s * 1.2], [s * 0.75, 0], [0, -s * 1.1], [-s * 0.75, 0]], '#ff6a6a', o);
      shape(g, [[0, s * 1.2], [s * 0.75, 0], [0, 0]], '#4ab0ff', o * 0.6); shape(g, [[0, -s * 1.1], [-s * 0.75, 0], [0, 0]], '#4ab0ff', o * 0.6);
    } },
  cookies: { size: 0.16, draw(g, o) { // a little paper bag of cookies
      shape(g, [[-0.11, 0], [0.11, 0], [0.13, 0.2], [-0.13, 0.2]], '#e8cfa0', o);
      for (const [x, y] of [[-0.05, 0.22], [0.05, 0.24], [0, 0.27]]) { g.fillStyle = '#c88a4a'; g.beginPath(); g.arc(x, y, 0.05, 0, TAU); g.fill(); g.lineWidth = o * 0.6; g.strokeStyle = OUTLINE; g.stroke(); g.fillStyle = '#5a3420'; g.fillRect(x - 0.01, y, 0.015, 0.015); }
    } },
  cane: { size: 0.9, along: true, draw(g, o) { // a walking stick with a crook: drawn from the hand along the arm
      g.lineCap = 'round'; g.strokeStyle = OUTLINE; g.lineWidth = 0.05 + o; g.beginPath(); g.moveTo(0, 0.1); g.lineTo(0, -0.85); g.stroke(); g.strokeStyle = '#8a5a34'; g.lineWidth = 0.05; g.stroke();
      g.strokeStyle = OUTLINE; g.lineWidth = 0.05 + o; g.beginPath(); g.arc(-0.07, 0.1, 0.07, 0, Math.PI); g.stroke(); g.strokeStyle = '#8a5a34'; g.lineWidth = 0.05; g.stroke();
    } },
  ball: { size: 0.14, draw(g, o) { g.fillStyle = '#ff7a4a'; g.beginPath(); g.arc(0, 0.14, 0.14, 0, TAU); g.fill(); g.lineWidth = o; g.strokeStyle = OUTLINE; g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 0.025; g.beginPath(); g.arc(0, 0.14, 0.09, 0.4, 2.6); g.stroke(); } },
};

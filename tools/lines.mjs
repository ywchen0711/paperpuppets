// Lists an episode's lines and the cast's voices, for tools/voices.py:
//   node tools/lines.mjs neighbours ep1 > tools/lines.json
import fs from 'fs';
import { parseScript } from '../js/script.js';
const [sid, ep] = process.argv.slice(2);
const { SERIES } = await import(`../series/${sid}/series.js`);
const E = parseScript(fs.readFileSync(new URL(`../series/${sid}/episodes/${ep}.txt`, import.meta.url), 'utf8'));
const lines = E.scenes.flatMap((s) => s.beats.filter((b) => b.kind === 'line'));
const voices = Object.fromEntries(Object.entries(SERIES.cast).map(([k, c]) => [k, c.voice]));
process.stdout.write(JSON.stringify({ series: sid, ep, lines: lines.map((l) => ({ i: l.i, who: l.who, emo: l.emo, zh: l.zh })), voices }, null, 1));

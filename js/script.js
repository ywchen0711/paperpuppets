// The script format: plain text, one beat a line.
//
//   title: 卡在樹上的風箏 | The Kite in the Tree
//   == park day                         a new scene: the set and the time of day (day, evening, night)
//   [mia enters left to 0.3]            stage directions in brackets; several at once with ';'
//   mia (happy): 嗨！ | Hi!              a line: who, how (optional), the words, and | the English
//   narrator: 第二天早上。                 a voice with no puppet
//   # a comment
//
// Directions (x is across the stage, 0 left .. 1 right; WHO is a cast id, ITEM a prop):
//   WHO enters left|right [to X] [running] [holding ITEM]     WHO exits left|right [running]
//   WHO walks|runs to X     WHO walks to WHO2     WHO turns     WHO faces WHO2|left|right
//   WHO jumps   WHO sits   WHO stands   WHO waves   WHO nods   WHO shakes   WHO bows   WHO cheers   WHO laughs
//   WHO points at WHO2|ITEM|X     WHO looks at WHO2|ITEM|up|down     WHO reaches up     WHO thinks     WHO cries
//   WHO holds ITEM     WHO gives ITEM to WHO2     WHO drops ITEM     ITEM to PLACE     ITEM falls [to X]     ITEM flies
//   pause 1.5
// A direction holds up the story until it is done (walking, jumping, sitting); gestures overlap the next line.
// Feelings for lines: happy, sad, angry, surprised, scared, shy, thinking, laugh, shout, calm, worried, proud, excited.

export function parseScript(text) {
  const ep = { title: { zh: '', en: '' }, scenes: [] }; let sc = null, n = 0;
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    let m;
    if ((m = line.match(/^title:\s*(.*)$/i))) { const [zh, en] = m[1].split('|').map((s) => s.trim()); ep.title = { zh, en: en || zh }; continue; }
    if ((m = line.match(/^==\s*(\S+)\s*(\S+)?\s*(?:\|\s*(.*))?$/))) { sc = { set: m[1], tod: m[2] || 'day', label: m[3] || '', beats: [] }; ep.scenes.push(sc); continue; }
    if (!sc) { sc = { set: 'park', tod: 'day', beats: [] }; ep.scenes.push(sc); }
    if ((m = line.match(/^\[(.*)\]$/))) { sc.beats.push({ kind: 'do', acts: m[1].split(';').map((s) => parseAct(s.trim())).filter(Boolean) }); continue; }
    if ((m = line.match(/^([a-z0-9_]+)\s*(?:\(([^)]*)\))?\s*[:：]\s*(.*)$/i))) {
      const [zh, en] = m[3].split('|').map((s) => s.trim());
      sc.beats.push({ kind: 'line', who: m[1], emo: (m[2] || '').trim() || null, zh, en: en || '', i: n++ });
    }
  }
  return ep;
}

function parseAct(s) {
  if (!s) return null; let m;
  if ((m = s.match(/^pause\s+([\d.]+)$/))) return { verb: 'pause', d: +m[1] };
  const w = s.split(/\s+/), who = w[0], verb = w[1] || '', rest = w.slice(2).join(' ');
  const num = (str) => { const k = str.match(/(-?[\d.]+)/); return k ? +k[1] : null; };
  const after = (key) => { const k = rest.match(new RegExp(`${key}\\s+(\\S+)`)); return k ? k[1] : null; };
  const a = { who, verb: verb.replace(/s$/, '').replace(/^shake$/, 'shake').replace(/^reache$/, 'reach'), raw: s };
  if (verb === 'goes' || verb === 'walks' || verb === 'runs') { a.verb = verb === 'runs' ? 'run' : 'walk'; const t = after('to'); a.to = t && isNaN(+t) ? t : num(t || rest); }
  else if (verb === 'enters' || verb === 'exits') { a.verb = verb === 'enters' ? 'enter' : 'exit'; a.side = /right/.test(rest) ? 'right' : 'left'; const t = after('to'); a.to = t != null ? +t : null; a.run = /running/.test(rest); a.item = after('holding'); }
  else if (verb === 'points' || verb === 'looks') { a.verb = verb === 'points' ? 'point' : 'look'; a.at = after('at') || rest.trim() || null; }
  else if (verb === 'faces') a.at = rest.trim();
  else if (verb === 'holds' || verb === 'drops') { a.verb = verb === 'holds' ? 'hold' : 'drop'; a.item = rest.trim(); }
  else if (verb === 'gives') { a.verb = 'give'; a.item = w[2]; a.to = after('to'); }
  else if (verb === 'reaches') { a.verb = 'reach'; }
  else if (verb === 'to' || verb === 'falls' || verb === 'flies') { a.item = who; a.who = null; a.verb = verb === 'to' ? 'itemTo' : verb === 'falls' ? 'itemFall' : 'itemFly'; a.place = verb === 'to' ? rest.trim() : null; a.x = verb === 'falls' ? num(rest) : null; }
  return a;
}

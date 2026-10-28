// A series: its name, its cast (how each puppet looks, its voice) and its episodes (scripts in episodes/*.txt).
// voice: [neural voice, pitch in Hz, speed in %] for edge-tts (tools/voices.py).
export const SERIES = {
  id: 'neighbours',
  title: { zh: '隔壁的阿樂', en: 'Leo Next Door' },
  blurb: { zh: '小米家隔壁搬來了一個新鄰居。風箏、餅乾和一棵很高的樹——兩個孩子的夏天，從這裡開始。', en: 'A new boy has moved in next door to Mia. A kite, some cookies and a very tall tree: a summer for two children begins here.' },
  episodes: [
    { id: 'ep1', zh: '卡在樹上的風箏', en: 'The Kite in the Tree' },
  ],
  cast: {
    mia: {
      name: { zh: '小米', en: 'Mia' }, age: 'kid', skin: '#f7d6b8', eyes: '#4a2c1a', lashes: true, cheeks: true,
      hair: { style: 'ponytail', color: '#3d2418', clip: '#ffcf3a' },
      outfit: { top: 'tee', bottom: 'skirt' }, colors: { top: '#ff8a5c', bottom: '#3d5fa8', shoes: '#f2ece0' },
      voice: ['zh-CN-XiaoyiNeural', 6, 2], walk: 1.05,
    },
    leo: {
      name: { zh: '阿樂', en: 'Leo' }, age: 'kid', skin: '#eec39c', eyes: '#2a1c14', glasses: '#2a3a5a',
      hair: { style: 'spiky', color: '#1e1a24' },
      outfit: { top: 'hoodie', bottom: 'pants' }, colors: { top: '#4cb07c', bottom: '#47526e', shoes: '#cf4b3b' },
      voice: ['zh-CN-YunxiaNeural', 0, 0], walk: 1.0,
    },
    grandma: {
      name: { zh: '奶奶', en: 'Grandma' }, age: 'elder', skin: '#f0cfb2', eyes: '#3a2a20', glasses: '#8a6a4a', build: 'round',
      hair: { style: 'bun', color: '#d4d0d6' }, browColor: '#b8b2b8',
      outfit: { top: 'coat', bottom: 'skirt', apron: '#f6efe2' }, colors: { top: '#a274b4', bottom: '#5c4c6e', shoes: '#6a4a3a' },
      voice: ['zh-TW-HsiaoChenNeural', -18, -12], walk: 0.6,
    },
    narrator: { name: { zh: '旁白', en: 'Narrator' }, kind: 'voice', voice: ['zh-TW-HsiaoYuNeural', -4, -8] },
  },
};

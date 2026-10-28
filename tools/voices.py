"""Records an episode's lines with neural voices (edge-tts) and measures each one's loudness for the mouths.

    node tools/lines.mjs neighbours ep1 > tools/lines.json
    python tools/voices.py tools/lines.json        # -> series/neighbours/audio/ep1/NNN.mp3 and audio/ep1.json

Each character has a voice, a pitch and a speed (series.js); a feeling changes them a little (raised and quick when
excited or angry, high when surprised, slow and low when sad or thinking), and no two lines are quite alike. The
loudness is measured thirty times a second (0..1), which is what moves the mouth. Needs edge-tts and ffmpeg.
"""
import asyncio, hashlib, json, os, subprocess, sys, array
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
L = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'lines.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'series', L['series'], 'audio'); EPD = os.path.join(OUT, L['ep']); os.makedirs(EPD, exist_ok=True)
CACHE = os.path.join(HERE, 'voice_cache'); os.makedirs(CACHE, exist_ok=True)
FEEL = {'happy': (6, 4, 5), 'excited': (12, 10, 12), 'laugh': (8, 4, 6), 'surprised': (16, 6, 10), 'scared': (10, 10, 0), 'sad': (-10, -14, -8), 'worried': (-4, -6, -4),
        'thinking': (-6, -10, -4), 'shy': (2, -8, -12), 'angry': (6, 10, 15), 'shout': (10, 12, 20), 'calm': (0, -6, 0), 'proud': (4, -2, 5)}

async def say(text, voice, pitch, rate, vol, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    await edge_tts.Communicate(text, voice, rate=f'{rate:+d}%', pitch=f'{pitch:+d}Hz', volume=f'{vol:+d}%').save(path)

def envelope(path):
    """loudness 30 times a second, 0..1, from the decoded audio"""
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', '12000', '-f', 's16le', '-'], capture_output=True).stdout
    a = array.array('h'); a.frombytes(raw[: len(raw) // 2 * 2]); n = 400; out = []
    for i in range(0, len(a), n):
        seg = a[i:i + n]; out.append((sum(x * x for x in seg) / max(1, len(seg))) ** 0.5)
    peak = max(out) if out else 1
    return [round(min(1.0, (v / peak) ** 0.7 * 1.15), 2) for v in out], len(a) / 12000

async def main():
    res = []
    for l in L['lines']:
        v = L['voices'].get(l['who'])
        if not v or not l['zh'].strip(' .…'): continue
        voice, pitch, rate = v; dp, dr, dv = FEEL.get(l['emo'] or '', (0, 0, 0))
        if l['zh'].rstrip().endswith(('！', '!')) and l['emo'] not in ('angry', 'shout', 'excited'): dp += 4; dr += 4; dv += 6
        h = int(hashlib.sha1(l['zh'].encode()).hexdigest()[:4], 16); dp += h % 5 - 2; dr += (h >> 3) % 5 - 2
        text = l['zh'].replace('……', '…').replace('——', '…')
        key = hashlib.sha1(f'{voice}|{pitch + dp}|{rate + dr}|{dv}|{text}'.encode()).hexdigest()[:16]; raw = os.path.join(CACHE, key + '.mp3')
        for k in range(6):
            try: await asyncio.wait_for(say(text, voice, pitch + dp, rate + dr, dv, raw), 30); break
            except Exception as e:
                if os.path.exists(raw): os.remove(raw)
                await asyncio.sleep(2 + k)
        if not os.path.exists(raw): print('  no recording:', l['who'], l['zh']); continue
        dst = os.path.join(EPD, f"{l['i']:03d}.mp3"); open(dst, 'wb').write(open(raw, 'rb').read())
        env, dur = envelope(raw)
        res.append({'i': l['i'], 'who': l['who'], 'dur': round(dur, 3), 'file': f"{L['ep']}/{l['i']:03d}.mp3", 'env': env})
        print(f"  {l['i']:3d} {l['who']:8s} {dur:5.2f}s {l['zh']}")
    json.dump({'ep': L['ep'], 'lines': res}, open(os.path.join(OUT, L['ep'] + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(len(res), 'lines')

asyncio.run(main())

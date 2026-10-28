# 紙偶小劇場 Paper Puppets

用 2D 紙偶動畫做連續劇的框架：**寫劇本，其他的交給程式**。導演程式會自己排走位、轉身、表情、聽的人的反應、鏡頭（開場遠景、雙人鏡頭、單人、特寫、反應鏡頭）、道具和時間；配音用神經語音錄好，嘴型跟著聲音動；配樂在瀏覽器裡現場合成。

A framework for making a series in 2D cut-out puppet animation: write the script, and the director lays out the blocking, turns, feelings, the listeners' reactions, the camera (an establishing shot, two-shots, singles, close-ups, reaction cuts), the props and the timing; the lines are recorded with neural voices and the mouths follow them; the score is made in the browser.

**線上看：** https://ywchen0711.github.io/paperpuppets/ — 第一部《隔壁的阿樂》第一集〈卡在樹上的風箏〉。

## 做一集新的

1. 在 `series/<系列>/episodes/` 寫一個 `epN.txt`，並加進 `series.js` 的 `episodes`。
2. 錄配音：

       node tools/lines.mjs neighbours ep2 > tools/lines.json
       python tools/voices.py tools/lines.json

3. 打開 `?s=neighbours&ep=ep2`。沒錄配音也能看（台詞用估計的長度，嘴巴照節奏動）。

## 劇本格式

```
title: 卡在樹上的風箏 | The Kite in the Tree
== park day | 公園・午後                 新的一場：場景、時間（day / evening / night）
[leo enters left to 0.42 running holding kite]
leo (excited): 飛起來！快飛起來呀！ | Fly! Come on, fly!
[kite to tree]
[mia sits; leo sits]                      分號：同時做
narrator: 新的鄰居，新的朋友。             只有聲音的旁白
```

舞台指示（x 是舞台的左右位置，0 最左、1 最右）：

| 指示 | |
|---|---|
| `WHO enters left/right [to X] [running] [holding ITEM]`、`WHO exits left/right` | 進場、出場 |
| `WHO walks/runs to X`、`WHO walks to WHO2` | 走、跑（腳步會踩在地上） |
| `WHO turns`、`WHO faces WHO2/left/right`、`WHO looks at WHO2/ITEM/up/down` | 轉身、看 |
| `WHO jumps / sits / stands` | 跳（先蹲再跳、落地緩衝）、坐、站起來 |
| `WHO waves / nods / shakes / bows / cheers / laughs / thinks / cries / shrugs / reaches up` | 手勢 |
| `WHO points at WHO2/ITEM/X` | 指 |
| `WHO holds ITEM`、`WHO gives ITEM to WHO2`、`WHO drops ITEM` | 拿、給、放下 |
| `ITEM to PLACE`、`ITEM falls [to X]`、`ITEM flies` | 道具飛到某處（例如樹上）、掉下來、像風箏一樣飛 |
| `pause 1.5` | 停一下 |

台詞的情緒：happy、excited、sad、worried、angry、shout、surprised、scared、shy、thinking、laugh、calm、proud。情緒會改變姿勢、臉、聲音的音高和速度，也會讓聽的人有反應。

## 角色、場景、道具

- **角色**（`series/<系列>/series.js`）：年齡（kid / adult / elder）、體型、膚色、眼睛、髮型（short、spiky、bob、long、ponytail、bun、bald）、髮色、衣服（tee、hoodie、coat、dress；pants、shorts、skirt；圍裙、圍巾）、眼鏡、帽子、聲音與走路速度。`gallery.html` 可以看所有角色。
- **場景**（`js/sets.js`）：一層一層的背景，鏡頭移動時遠的慢、近的快；有可以坐的位置（`seats`）和道具可以去的地方（`places`）。
- **道具**（`js/props.js`）：風箏、拐杖、餅乾、球。

## 程式

| 檔案 | |
|---|---|
| `js/script.js` | 讀劇本 |
| `js/direct.js` | 導演：時間、走位、轉身、反應、鏡頭 |
| `js/motion.js` | 動作：踩地的走路與跑步、呼吸與重心、轉身、跳、坐、手勢、情緒、說話的嘴型與手勢、眨眼、視線、頭髮的彈簧 |
| `js/rig.js` | 紙偶：骨架、雙骨 IK、畫身體與臉 |
| `js/player.js`、`js/audio.js` | 播放：鏡頭、畫面、字幕、配音與配樂 |
| `tools/voices.py` | 配音（edge-tts）與嘴型用的音量曲線 |

所有東西都只由時間決定，所以可以隨意拖時間軸，每次看都一樣。

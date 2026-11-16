---
"@edv4h/usketch-session-respond": minor
---

答えにかけら (`parts`) を付けられるようにした。始めるときの `maxParts` (0〜50、既定 0) で許し、`submit(text, tag?, parts?)` で出す。`flattenResponseParts` でかけら 1 つずつの答えに開いて並べられる。答えの長さの上限も `maxText` (1〜2,000、既定 280) で決められる。いまの使い方は何も変わらない。

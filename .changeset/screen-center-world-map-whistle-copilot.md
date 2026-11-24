---
"@edv4h/usketch-plugin-map": patch
"@edv4h/usketch-plugin-whistle": patch
"@edv4h/usketch-plugin-ai-copilot": patch
---

画面中央のワールド座標を共通の `screenCenterWorld` で求めるようにした。ビューポートが回転しているとき、map の拠点入場バナー・whistle の笛の位置と画面外インジケーター・ai-copilot に送る viewportCenter が画面中央からずれていたのを直す。

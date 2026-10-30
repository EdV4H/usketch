---
"@edv4h/usketch-dom-renderer": minor
---

perf(dom-renderer): 画面の 2 倍より外の図形をマウントしないカリングを追加した（`viewportCull` オプション / `SET_VIEWPORT_CULL_EVENT` で ON/OFF と範囲を調整）。パン・ズームのたびに画面外の簡略表示まで Paint し直していたため、図形数に比例してフレーム時間が伸びていた。Mode 7 などが `bg-grid:set-overscan` で知らせる画面外の表示範囲は描画を残す。あわせて親子順の並べ替えをビューポート変更ごとに行わないようにした

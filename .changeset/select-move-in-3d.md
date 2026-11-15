---
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-tool-select": minor
---

3D ビューのまま Shape を選んで動かせるようになりました（3D 標準対応 P7、#1304）。

- mode7: 選択ツールのとき、Shape の上で押すとキャンバスへ通します。地面のドラッグは今までどおりカメラの移動、地面のクリックで選択を外し、Shape のダブルクリックで平面に戻ります（文字の編集・リサイズ・回転は平面で）
- tool-select: 3D で見えている間は、平面に描かれたリサイズ・回転などのハンドルを掴みません

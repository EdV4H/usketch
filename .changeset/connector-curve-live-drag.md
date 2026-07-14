---
"@edv4h/usketch-plugin-shape-connector": patch
---

コネクタの曲線(curve)の制御点をドラッグ調整する際、曲がり具合がドラッグ中は変化せず離した瞬間に反映されて分かりにくかった問題を修正。制御点ハンドルの `onMove` で `controlPoint` を store にライブ更新するようにし、曲線とハンドルがポインタに追従するようにした。undo 用の履歴は従来どおり `onUp` で1コマンドだけコミット(before=ドラッグ開始時の元値 / after=最終位置)。

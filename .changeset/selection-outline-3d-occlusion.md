---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-plugin-tool-select": minor
---

3D 表示の選択枠で、地形に隠れた部分を薄い点線で描くようにしました（#1304）。丘の向こうの Shape を選んでも、枠が地形を突き抜けて見えなくなります。輪郭を地形で切り分ける `quadOutlineRuns` と、`view3dPickService` の `outlineRunsOf` を追加しました。

隠れた部分の見せ方は選択ツールの `occludedOutline` オプションで選べます。`"dashed"`（既定）は薄い点線、`"hidden"` は描きません。実行中は `select:configure` イベントに `{ occludedOutline }` を渡して切り替えられます。

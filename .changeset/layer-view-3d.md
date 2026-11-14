---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-dom-renderer": patch
"@edv4h/usketch-gpu-renderer": patch
"@edv4h/usketch-plugin-bg-dots": patch
"@edv4h/usketch-plugin-bg-grid": patch
"@edv4h/usketch-plugin-character": patch
"@edv4h/usketch-plugin-comments": patch
"@edv4h/usketch-plugin-dashboard": patch
"@edv4h/usketch-plugin-domain-design": patch
"@edv4h/usketch-plugin-elevation": patch
"@edv4h/usketch-plugin-follow-me": patch
"@edv4h/usketch-plugin-laser": patch
"@edv4h/usketch-plugin-map": patch
"@edv4h/usketch-plugin-portal": patch
"@edv4h/usketch-plugin-presence-activity": patch
"@edv4h/usketch-plugin-shape-3d": patch
"@edv4h/usketch-plugin-shape-connector": patch
"@edv4h/usketch-plugin-shape-frame": patch
"@edv4h/usketch-plugin-shape-freedraw": patch
"@edv4h/usketch-plugin-snap": patch
"@edv4h/usketch-plugin-spotlight": patch
"@edv4h/usketch-plugin-sync-ywebsocket": patch
"@edv4h/usketch-plugin-tool-select": patch
"@edv4h/usketch-plugin-tool-vim": patch
"@edv4h/usketch-plugin-voice-notes": patch
"@edv4h/usketch-plugin-whistle": patch
---

層が 3D 表示での見え方を宣言できるようにし、描画距離をコアの状態にしました（3D 標準対応 P2a、#1466）。絵は変わりません。

- **shared**: `Layer.view3d`（`tilt` / `depth` / `screen` / `hidden`、型 `LayerView3d`）と `SelectionForeground.view3d` を追加。`View3dState.drawDistance`、`view3dOverscanPx`、`LayerRenderContext.view3dOverscan` を追加
- **canvas-engine**: 層の wrapper に `data-view3d` を付け、3D 表示中は背景を奥まで敷く幅（オーバースキャン）を `view3dOverscan` で各層に渡します。カメラの高さが毎フレーム変わっても、この値が変わらなければ層を描き直しません
- **mode7**: 描画距離をコアの状態に置きます。`view3d` を宣言した層も傾けます（`tiltLayerIds` を渡したときはその一覧のまま）。`hidden` を宣言した層は 3D の間は出しません
- **bg-grid / elevation**: オーバースキャンを `view3dOverscan` から読みます（`bg-grid:set-overscan` イベントも次のメジャーまで読みます）
- **各プラグイン**: Mode 7 が既定で傾けていた層に `view3d` を宣言しました（崖・3D Shape・キャラは `depth`）

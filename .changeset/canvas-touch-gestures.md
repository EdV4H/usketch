---
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-shared": minor
---

canvas-engine: タッチ（マルチポインタ）ジェスチャ対応 (#1004)。

`Canvas` が 2 本指を `pointerId` で追跡し、**ピンチ＝ズーム / 2 本指ドラッグ＝パン**を `store.zoomTo`（中点中心・距離比）/ `store.panBy`（中点移動）で viewport に反映（wheel と同じ経路・クランプ共有）。ジェスチャ中はツールへの配送を抑止し、全指が離れるまで再開しない。単一タッチは「移動 or タップ確定まで pending」にして 2 本目の指が来ても描画/選択が誤発火しない。Safari の `gesturestart`/`gesturechange` は握り潰しから**ズーム変換**へ置換（ブラウザ標準ズームの抑止は維持）。

- **`CanvasPointerEvent`** に `pointerId?` / `pointerType?` を追加（optional・後方互換）。ツールがタッチ/ペン/マウスを区別可能に。
- **`Canvas`** に `touchGestures?: boolean` prop（既定 `true`）。マウス/ペン/wheel の既存挙動は不変（touch のみ新経路）。ジェスチャ中は `canvas:gesture` イベントを emit。
- ジェスチャ計算 `gestureStep` / `pointerDistance` / `pointerMidpoint` を純関数として公開・ユニットテスト。

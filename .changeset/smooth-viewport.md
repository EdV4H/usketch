---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-keyboard-shortcuts": patch
"@edv4h/usketch-plugin-tool-vim": patch
"@edv4h/usketch-plugin-whistle": patch
"@edv4h/usketch-plugin-follow-me": patch
"@edv4h/usketch-plugin-debug-hud": patch
---

ロジック起点のビューポート移動（ズーム変更・特定位置へのジャンプ・zoom-to-fit）をスムーズにアニメーションさせ、デフォルト ON にした。連続的なインタラクション（ホイールズーム・ドラッグパン・ミニマップドラッグ）は従来どおり即時。

- store: `animateViewportTo(target, opts?)` を追加（rAF による eased 補間、`prefers-reduced-motion`・rAF 不在・無効時は即時フォールバック、割り込みは即時系メソッドが cancel）。`fitToBounds` は既定でアニメ化。`createBoardStore({ viewportAnimation })` と `setViewportAnimation` / `getViewportAnimation` で enabled/duration/easing を調整可能（既定: 有効・350ms・ease-in-out-cubic）。
- shared: 各プラグインが個別実装していたジャンプ計算を共通 helper `centerOnWorld` / `zoomBy` / `zoomToLevel` / `fitContent` / `screenCenterWorld` / `getScreenSize` に集約（すべて既定でアニメ）。
- keyboard-shortcuts / tool-vim / whistle / follow-me / debug-hud を共通 helper に移行。follow-me は追従の応答性のため短めのアニメ（180ms）。

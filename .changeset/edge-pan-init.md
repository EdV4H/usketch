---
"@edv4h/usketch-plugin-edge-pan": minor
---

feat(edge-pan): Shape ドラッグ中に端へ寄せると画角が自動スライドするプラグインを追加

- 新規プラグイン `@edv4h/usketch-plugin-edge-pan`（tldraw の edge scrolling 相当）。Shape を掴んで
  画角の端の帯へ寄せると、`BoardStore.panBy` で毎フレーム画角をその方向へパン。速度は帯の奥ほど速い。
- 掴んでいる Shape はカーソル下に留まる: パン後に合成 `canvas:pointermove`（screenPoint 据え置き・
  worldPoint のみ新画角で再計算）を発行し、ドラッグ中のツールに位置を再計算させる。プラグイン自身は
  Shape を書き換えないため Undo を汚さず、select 以外のドラッグ系ツールにも効く。
- 挙動はすべてホストが `EdgePanOptions` で設定可能（`enabled` / `edgeSize` / `maxSpeed` / `axes` /
  `curve`）。数値・真偽・enum は getter（`() => value`）でライブ変更も可。加えて共有 HUD に設定を登録し、
  end-user が上書きできる（HUD 上書きが options より優先）。
- パンは viewport constraint を通るため、スクロール制限のある盤面ではその範囲内でのみスライドする。

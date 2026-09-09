---
"@edv4h/usketch-plugin-edge-pan": minor
---

feat(edge-pan): Shape ドラッグ中に端へ寄せると画角が自動スライドするプラグインを追加

- 新規プラグイン `@edv4h/usketch-plugin-edge-pan`（tldraw の edge scrolling 相当）。Shape を掴んで
  画角の端の帯へ寄せると、`BoardStore.panBy` で毎フレーム画角をその方向へパン。速度は帯の奥ほど速い。
- 掴んでいる Shape はカーソル下に留まる: パンした分だけドラッグ中の Shape（root＋子孫）を
  ワールド空間で直接移動（移動量 = 実パン量 ÷ zoom）。移動は transient（コマンド化しない）ので
  Undo を汚さず、drop 時に select ツールが最終位置を 1 コマンドとして確定する。
- Snap 併用対応: snap は `store.updateShape` をモンキーパッチしてガイドへスナップするため、追従移動が
  貼り付いて止まってしまう。edge-pan は setup 時に掴んだパッチ前の生 `updateShape` で追従してこれを
  回避する（要: edge-pan を snap より先に登録）。
- 挙動はすべてホストが `EdgePanOptions` で設定可能（`enabled` / `edgeSize` / `maxSpeed` / `axes` /
  `curve`）。数値・真偽・enum は getter（`() => value`）でライブ変更も可。加えて共有 HUD に設定を登録し、
  end-user が上書きできる（HUD 上書きが options より優先）。
- パンは viewport constraint を通るため、スクロール制限のある盤面ではその範囲内でのみスライドする。

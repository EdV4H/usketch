---
"@edv4h/usketch-plugin-snap": minor
---

snap: 等間隔（distribution）スナップを追加 — ドラッグ中に隣接シェイプとの間隔を等しくする位置へ吸着

これまでの Snap はエッジ/中心の1次元整列のみで、**等間隔スナップが無かった**。tldraw の
gap snapping に倣い、2つの挙動を追加:

- **gap 複製（等間隔配置）**: 既存の隙間 L を反対側に複製。例: 2つのシェイプが 100px 空いていれば、
  3つ目をドラッグすると 100px の隙間になる位置へ吸着（3連の等間隔）。同じ長さの隙間は**全部ハイライト**。
- **gap 中央**: シェイプより広い隙間の中央へ吸着し、左右の間隔を等しくする。

対象は「同じ行/列」のシェイプ（直交方向の範囲が重なるもの）に限定。整列スナップと軸ごとに競合した
場合は**より近い方**を採用。ガイドは両端キャップ付きの実線セグメントで、点線の整列線と区別できる。
リサイズ中は無効。

- 既定 **ON**。`snap:configure({ distributeSnap: false })` または `createSnapPlugin({ distributeSnap: false })` で無効化可能。
- 公開型: `SpacingGuide` / `GapSegment` / `SnapResult.gaps` / `SnapSettings.distributeSnap`。
- 純ロジックは `engine/distribute.ts`（単体テスト付き）。

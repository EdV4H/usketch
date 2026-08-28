---
"@edv4h/usketch-plugin-dashboard": minor
"@edv4h/usketch-web": patch
---

feat(dashboard): Canvas 全体を sortable なグリッドにする新プラグインを追加

適用したボードをダッシュボード化し、トップレベルの任意の既存 Shape をグリッドの
アイテムとしてセルにスナップ整列する。1つをドラッグして差し込むと他アイテムが
ライブでリフローする（sortable）。

- 設定（列数/セルサイズ/間隔/余白/原点）はデータのみの `dashboard-config`
  シングルトン Shape に保存され、Yjs 同期・Undo に自然に乗る
- 並び順は幾何から導出（row-major の reading order）。`order[]` を持たず、
  位置が同期されれば順序も同期・リロード安定
- during-drag reflow はドラッグ中の Shape を触らず、他アイテムのみ rAF スロットルで
  再パック。ドロップ時に 1 つの undoable command で確定
- 操作は純関数（`grid.ts` / `order.ts`）として公開し、runtime・サービス・HUD が
  同じ経路を通る。ホスト向け API は `dashboardService`（`ctx.services`）で公開
- HUD に「ダッシュボード化 / 解除 / 整列」アクションと設定グループを登録

`apps/web` では `autoCreate: false` で登録し、メインボードを勝手にグリッド化せず
HUD の「ダッシュボード化」で opt-in する。

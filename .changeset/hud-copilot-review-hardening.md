---
"@edv4h/usketch-plugin-debug-hud": patch
"@edv4h/usketch-plugin-shape-connector": patch
---

Copilot レビュー指摘の堅牢性修正（#702 マージ後の追随分）:

- **debug-hud / Control パネル**: Action 実行を `try/catch` + Promise `.catch` で内包し、`finally` で UI 再評価（`isActive`/`isEnabled`）を必ず実行（unhandled rejection 防止・実行後の状態反映を保証）。`Clear canvas` は本番でも HUD が出るため確認ダイアログを追加（0 件は no-op）。
- **shape-connector**: `setConnectorAnchor` が両端接続時しか動かず、片端未接続の connector で HUD action が silent no-op だった問題を修正（anchor フィールドは常に更新、座標再計算は両端接続時のみ）。

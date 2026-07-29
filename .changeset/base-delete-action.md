---
"@edv4h/usketch-plugin-map": minor
---

拠点をレジストリごと削除する「アクティブ拠点を削除」アクションを HUD に追加。アクティブ拠点を選んで実行すると、その拠点が一覧から消え領地も消える（ビーコンアイコンの `meta.baseId` も解除、アイコン自体は残す）。undo 可能。`deleteBase(deps, baseId)` を base-ops に追加。

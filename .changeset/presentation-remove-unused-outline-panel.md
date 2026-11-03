---
"@edv4h/usketch-plugin-presentation": patch
---

どこからも import されていない旧スライド一覧パネル `slide-outline-panel.tsx` を削除。スライド一覧は `present-edit-overlay` のサムネ一覧に置き換わっており、パッケージの公開 export にも含まれていなかったため、挙動・公開 API の変化はなし。

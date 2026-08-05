---
"@edv4h/usketch-plugin-deep-link": minor
"@edv4h/usketch-web": patch
---

URLで選択shape・表示位置を共有できるディープリンク機能を追加（Figmaの `?node-id` 相当）

- 新規プラグイン `usketch-plugin-deep-link`: `?shape=<id,...>` で選択をライブ同期（`history.replaceState`）、読込時に選択＋自動フレーミング。CRDT未同期のshapeは出現までリトライ。
- `?x&y&zoom` で厳密なカメラ位置を復元（自動フレーミングより優先）。
- 共有ダイアログに「この表示へのリンクをコピー」を追加（現在の選択＋pan/zoomを含むURLを生成）。

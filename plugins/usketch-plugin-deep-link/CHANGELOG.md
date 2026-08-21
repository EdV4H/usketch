# @edv4h/usketch-plugin-deep-link

## 0.2.4

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-core@2.4.2
  - @edv4h/usketch-store@3.5.4

## 0.2.3

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-core@2.4.1
  - @edv4h/usketch-store@3.5.3

## 0.2.2

### Patch Changes

- 316ac35: deep-link: URL にカメラが含まれるとき `viewport:claimed`（source: "deep-link", priority: 100）を
  emit するように。他のカメラ系プラグイン（start-position 等）が疎結合に「ディープリンクが優先」を
  判断できる。挙動の追加のみで、既存の復元動作は不変。

## 0.2.1

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-core@2.4.0
  - @edv4h/usketch-store@3.5.2

## 0.2.0

### Minor Changes

- a6b9a5d: URLで選択shape・表示位置を共有できるディープリンク機能を追加（Figmaの `?node-id` 相当）
  - 新規プラグイン `usketch-plugin-deep-link`: `?shape=<id,...>` で選択をライブ同期（`history.replaceState`）、読込時に選択＋自動フレーミング。CRDT未同期のshapeは出現までリトライ。
  - `?x&y&zoom` で厳密なカメラ位置を復元（自動フレーミングより優先）。
  - 共有ダイアログに「この表示へのリンクをコピー」を追加（現在の選択＋pan/zoomを含むURLを生成）。

---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
---

ショートカット基盤を拡張（後方互換）。

- combo に `Mod` トークンを追加。プラットフォームのアクセラレータ（macOS=Cmd / その他=Ctrl）に正規化されるため、`Mod+Z` の 1 定義で Cmd+Z・Ctrl+Z 両対応になる。
- `ShortcutRegistry.register(combo, callback, meta?)` にメタデータ（`label` / `category`）を追加。
- `ShortcutRegistry.list()` を追加。登録済みショートカット（combo + meta）を返し、ホスト側でチートシートや設定 UI を組めるようにする。
- コアの Undo/Redo を `Mod+Z` / `Mod+Shift+Z` へ移行（メタ付き）。

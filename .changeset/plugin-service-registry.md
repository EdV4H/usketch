---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-plugin-markdown-to-shape": minor
---

プラグイン間拡張点を汎用サービススロット化。`PluginContext` から機能専用の `markdownConverters` フィールドを削除し、代わりに汎用の `services`（`ServiceRegistry`: `provide`/`get`/`has`）を追加。Markdown→shape 変換レジストリは core から `usketch-plugin-markdown-to-shape` へ移動し、同プラグインが `ctx.services` に `markdown-converters` キーで provide して own するようになった。カーネル契約（core）が単一機能の関心を持たなくなり、今後の拡張点（export/import 等）も同じスロットに載せられる。

BREAKING: `ctx.markdownConverters` を使っていたコードは `getMarkdownConverters(ctx)`（`@edv4h/usketch-plugin-markdown-to-shape` からエクスポート）に置き換える。provide 側（プラグイン）は consumer より先に setup される必要がある。

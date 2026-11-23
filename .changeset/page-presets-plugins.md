---
"@edv4h/usketch-sync": minor
"@edv4h/usketch-plugin-pages": minor
---

ページごとにプラグインを選べるようにしました。

- sync: `PageMeta` に `preset`（作るときに選んだプリセット名）と `plugins`（このページに入れるプラグインの id）を足しました。`createPage` で渡せ、`setPagePlugins(root, pageId, { preset, plugins })` で変えられます（`null` で消す）。名前変更・並べ替え・複製でも残ります。何を読むかはホストが決めます。
- pages: `createPagesPlugin({ pagePlugins })` にプリセットと選べるプラグイン（`conflicts` つき）を渡すと、HUD のページパネルに「プリセットから新しいページ」と「このページのプラグイン」が出ます。`PagesApi` に `create({ preset })` と `setPlugins(pageId, plugins | null)` を足しました。ページの追加は `page.create`、プラグインの変更は `page.manage` の権限があるときだけ出します（権限を渡していないホストでは今までどおり出ます）。

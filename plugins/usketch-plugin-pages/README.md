# @edv4h/usketch-plugin-pages

マルチページのボードで、HUD にページパネルを出すプラグイン。

- ページの一覧・切り替え・追加・名前変更・並べ替え・複製・削除・復元（削除は印を付けるだけで、戻せる。最後の 1 枚は削除できない）
- アクション: `pages:new` / `pages:next` / `pages:prev` / `pages:duplicate`
- キー: `Alt+PageDown`（次のページ）/ `Alt+PageUp`（前のページ）。ID は `usketch-plugin-pages:next` / `:prev`

```ts
import { createPagesPlugin, getPagesApi } from "@edv4h/usketch-plugin-pages";

createPagesPlugin({
	rootDoc, // ページ一覧があるルート doc
	pageId, // 今開いているページ（切り替えるとホストがプラグインごと作り直す）
	switchPage: (id) => navigateToPage(id),
	openPageDoc: (id) => pageDocs.open(id), // createPageDocManager の open（複製に使う）
});

// HUD を通さずに使う
getPagesApi(app.services)?.create({ open: true });
```

ページ一覧の読み書きは `@edv4h/usketch-sync` の純関数（`createPage` / `renamePage` / `reorderPage` / `deletePage` / `restorePage`）、
ページの複製は `duplicatePage(root, pageId, openPageDoc)` でも行える。

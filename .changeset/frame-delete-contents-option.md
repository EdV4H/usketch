---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-shape-frame": minor
"@edv4h/usketch-plugin-tool-select": minor
---

feat(frame): フレーム削除時に中のアイテムも削除するかを選べるオプションを追加。フレーム選択中の HUD「削除時に中身も削除」で切り替え（デフォルトは従来どおり中身ごと削除）。オフにしたフレームを削除すると、中のアイテムはその場に残り、フレームの親（通常はキャンバス直下）に付け替わる。

- shared: `ShapeDefinition.container.deleteChildren`（boolean / predicate、デフォルト `true`）と `shouldDeleteContainerChildren` を追加。
- store: コンテナだけを削除して子を親に付け替える `createDeleteKeepChildrenCommand` を追加。
- tool-select: Delete / Backspace で `deleteChildren` を尊重する。
- shape-frame: `FrameShapeData.deleteContents` と純関数 `getFrameShapes` / `shouldDeleteFrameContents` / `setFrameDeleteContents` を公開。

# @edv4h/usketch-plugin-pages

## 0.1.0

### Minor Changes

- fc74276: `@edv4h/usketch-plugin-pages` を npm に公開する。uSketch を組み込んだ利用先も、HUD のページパネルを使える（手順はドキュメントの「マルチページへの移行」）。
- 3c434bc: マルチページ: ページの操作と pages プラグイン
  
  - `@edv4h/usketch-sync`: `renamePage` / `reorderPage` / `deletePage`（印を付けるだけ、最後の 1 枚は消せない）/ `restorePage` を追加
  - `@edv4h/usketch-plugin-pages`（新規）: HUD のページパネル（一覧・切り替え・追加・名前変更・並べ替え・複製・削除・復元）、`getPagesApi`、アクションとキー（`Alt+PageDown` / `Alt+PageUp`）
- 59d9186: マルチページ: シェイプを別のページへ移す・コピーする
  
  - `@edv4h/usketch-plugin-pages`
    - ページパネルに「選択中の N 個を別のページへ」（移す / コピー）を追加。API は `moveShapes` / `copyShapes`、純関数は `moveShapesToPage` / `copyShapesToPage`
    - 子シェイプと、両端が含まれるコネクタも一緒に移す。移さなかったものへの参照（親・コネクタの端）は外す
    - 移したシェイプは id を変えずに移動先の一番手前へ置く。移動元のページ doc の `movedOut` に印を残し、同時編集で戻ってきたものは消す（`watchMovedOutShapes`）
  - `@edv4h/usketch-plugin-portal`: `pageId` / `legacyPageId` オプション。ページを使うボードでは、今のページで作ったポータルだけを出す
    - 他のページのシェイプを指すポータルを「シェイプが無い」とみなして消さない

### Patch Changes

- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [572a76b]
- Updated dependencies [3c434bc]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0
  - @edv4h/usketch-sync@1.5.0
  - @edv4h/usketch-store@3.12.0

---
"@edv4h/usketch-plugin-pages": minor
"@edv4h/usketch-plugin-portal": minor
---

マルチページ: シェイプを別のページへ移す・コピーする

- `@edv4h/usketch-plugin-pages`
  - ページパネルに「選択中の N 個を別のページへ」（移す / コピー）を追加。API は `moveShapes` / `copyShapes`、純関数は `moveShapesToPage` / `copyShapesToPage`
  - 子シェイプと、両端が含まれるコネクタも一緒に移す。移さなかったものへの参照（親・コネクタの端）は外す
  - 移したシェイプは id を変えずに移動先の一番手前へ置く。移動元のページ doc の `movedOut` に印を残し、同時編集で戻ってきたものは消す（`watchMovedOutShapes`）
- `@edv4h/usketch-plugin-portal`: `pageId` / `legacyPageId` オプション。ページを使うボードでは、今のページで作ったポータルだけを出す
  - 他のページのシェイプを指すポータルを「シェイプが無い」とみなして消さない

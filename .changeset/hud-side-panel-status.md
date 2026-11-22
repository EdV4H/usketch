---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-plugin-debug-hud": minor
---

HUD に、プラグインの UI を置ける場所を 2 つ足しました。どちらも HUD を閉じていても画面に残ります。

- サイドパネル: `ctx.hud.registerPanel({ ..., placement: "side" })` で、画面の右にタブで並ぶパネルになります。`openSidePanel` / `toggleSidePanel` / `closeSidePanel` / `getOpenSidePanel` で開け閉めします。
- 状態表示: `ctx.hud.registerStatus({ id, get, subscribe })` で、画面の上の真ん中に短い文（色とボタン 1 つ付き）を出します。接続の状態や「追従中」のような今の状態を知らせるのに使います。`requires` で権限の無い人には隠せます。

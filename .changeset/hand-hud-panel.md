---
"@edv4h/usketch-plugin-shape-card": minor
---

手札(Hand)を独自の下部固定トレイから Control HUD の「Hand」パネルへ移行

プラグインUIはHUDに登録する方針に合わせ、独自トレイUI（`ctx.layers.register("card-hand")` の画面下部固定オーバーレイ）を廃止し、`ctx.hud.registerPanel` で「Hand」パネルとして登録。カード面サムネ＋「場に出す」ボタン＋他者枚数を HUD 内に表示する（挙動・privacyモデルは不変）。

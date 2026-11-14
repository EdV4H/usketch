---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
---

高さの窓口を 1 つにしました（3D 標準対応 P3a、#1469）。今の動きは変わりません。

- **shared**: `boardHeight(services)` を追加。地面（`ground`）と固体（`solid`）の提供元を `register({ id, kind, priority, active, heightAt })` で登録し、`groundAt` / `solidAt` / `surfaceAt` / `owner` / `subscribe` で読みます。地面は優先度が一番高い有効な提供元が答え、固体は全部の中で一番高いものです
- **core**: プラグインの `ctx.height` と `app.height` に同じ窓口を入れます（`ctx.height` は次のメジャーまで省略可。古い core と組むプラグインは `boardHeight(ctx.services)` を使います）
- `groundHeightService` / `solidHeightService` は次のメジャーまでこの窓口の互換層です。窓口が答え、まだこれらを provide するプラグインの高さも窓口に入ります

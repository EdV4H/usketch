# @edv4h/usketch-plugin-croupier

## 0.1.0

### Minor Changes

- a8f4b3a: 新規プラグイン。croupier（`@edv4h/croupier-core`）のゲームをボード上で遊べるようにする。テーブルシェイプがゲームとエンジンの snapshot を持ち、参加者ごとに座席シェイプを置く。ルールはホストアプリが渡すゲーム定義（Values Card など）に任せ、通常のシェイプ同期だけで動く（ゲームサーバー不要）。手番制のゲームだけに対応する（全員が同時に動くゲームは書き込みがぶつかるため非対応）。不在のプレイヤーの手番はホストのクライアントがゲームの bot で進め、ホストが抜けたら次の参加者に移る。

### Patch Changes

- Updated dependencies [ca67108]
  - @edv4h/usketch-store@3.11.1

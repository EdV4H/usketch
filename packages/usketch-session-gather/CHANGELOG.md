# @edv4h/usketch-session-gather

## 0.5.3

### Patch Changes

- Updated dependencies [3566290]
  - @edv4h/usketch-shared@4.30.0
  - @edv4h/usketch-plugin-session@0.4.3

## 0.5.2

### Patch Changes

- Updated dependencies [66e8499]
  - @edv4h/usketch-shared@4.29.0
  - @edv4h/usketch-plugin-session@0.4.2

## 0.5.1

### Patch Changes

- Updated dependencies [3d0a677]
  - @edv4h/usketch-shared@4.28.0
  - @edv4h/usketch-plugin-session@0.4.1

## 0.5.0

### Minor Changes

- 4a5a904: 集合に「呼ぶ人」(`audience`: userId の一覧) を足した。一覧に無い人は対象外になり、聞かれず、カメラも動かず、参加者にも入らない。`GatherState.inAudience` と `isGatherAudience` で判定できる。`audience` を渡さなければ、いままで通り全員が対象。

## 0.4.1

### Patch Changes

- Updated dependencies [b01b7f0]
  - @edv4h/usketch-session-protocol@0.4.0
  - @edv4h/usketch-plugin-session@0.4.0

## 0.4.0

### Minor Changes

- 699c677: 集合に `viewOnly` を足した。参加しているあいだ、主催者以外は見ることとリアクションだけにしてほしい、という印 (session は強制せず、ホストの UI が絞る)。`isViewOnlyForMe` で、いまこの端末を絞るかを判断できる。

## 0.3.0

### Minor Changes

- f8f6a92: 集合に背景 (`backdrop`: 16 進の色と http(s) の画像 URL) を持たせる。ホストの UI が演出やイベント中の画面の後ろに出すのに使う

## 0.2.0

### Minor Changes

- b109078: 集合に、みんなへの問いかけ (`prompt`、省ける) を持たせられるようにしました。`start({ ..., prompt })` で渡すと、`getState().gather.prompt` で全員が読めます。

## 0.1.0

### Minor Changes

- c9b2693: 新しいセッション型「集合」(`gather`) を足しました。誰かが始めると、ボードにいる全員がその場所 (選んだ図形・フレーム、または主催者が見ている範囲) に集まります。始まったあとに開いた人も同じ場所に入ります。
  
  - 集め方: `gather` (一度連れて行くだけ) と `stay` (離れるまで場所の中にとどめる)
  - 開いている人は 3 秒のカウントダウンのあと動き、あとから開いた人はすぐ入ります。ディープリンクで開いた人・発表中など自分でカメラを動かしている人は動かしません
  - 離れる・戻る、時間の制限 (主催者の端末が時間で終える)、複数ページのボードではページを移ってから集める
  - HUD のカードは持たず、ホストが `getGatherApi(app.services)` で自分の UI を描きます
  - サーバーの転送でも、Yjs の共有ドキュメントの転送でも動きます
  - 参加を確かめるモード (`confirmJoin`): 主催者以外は「参加しますか」と聞かれ (`invited`)、`accept()` で参加します。`enterDelayMs` で、参加してから動くまでの間 (演出を流す間) を空けられます
  - 参加すると session に `join` を記録し、`getState().participants` で参加した人と順番が分かります

### Patch Changes

- Updated dependencies [3bcacb7]
  - @edv4h/usketch-plugin-session@0.3.0
  - @edv4h/usketch-session-protocol@0.3.0

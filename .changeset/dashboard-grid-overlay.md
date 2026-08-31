---
"@edv4h/usketch-plugin-dashboard": minor
---

feat(dashboard): セルまたぎ（span）配置・グリッド領域オーバーレイ・enable 時の原点シード

- **アイテムサイズを span で扱う**: 各アイテムは自身の width/height に応じて整数セル分
  （`cols × rows`）を占有し、大きいものは複数セルをまたぐ（実ダッシュボードのタイルと同じ）。
  後続は first-fit / 非 dense でその周りに流し込む。従来は 1 アイテム＝1 セル固定でサイズが
  自由なため、はみ出しや隙間が発生していた。`packSpans` / `spanOf` / `cellXY` /
  `targetIndexFromPoint` を追加し、`packGrid` / `packGridWithGap` / `indexFromPoint` を置換。
- **グリッド領域オーバーレイ**: 配置先セルを描画するレイヤーを追加。どこにアイテムが
  スナップされるか一目で分かる。HUD「グリッド表示」でトグル、非ダッシュボードボードでは
  自動非表示。描画のみ（同期なし）の Layer として実装。
- **enable 時の原点シード**: グリッド原点を既存アイテムの左上（min x/y − padding）へ
  シードするように。原点が world (0,0) 固定だったため、離れた場所で作業していると「整列」で
  アイテムが画面外へ飛び発火していないように見えることがあった。初回 enable のみシード。

---
"@edv4h/usketch-shape-utils": patch
---

editable-text: 再編集時にテキストが空になる不具合を修正し、ダブルクリック判定を 400ms に緩和。

- contentEditable への既存テキストの流し込みを `data-focused` フラグではなく `document.activeElement === el`（編集中か）でガードするよう変更。blur 以外の経路（Escape / 選択解除 / プログラム的な選択クリア）で編集を抜けたあと、再利用される同一 DOM ノードにフラグが残留し、次回編集時にエディタが空で開いてしまう問題を解消（`deleteWhenEmpty` 系 shape ではその後の入力で破壊的になり得た）。
- ダブルクリックの同一 shape 判定ウィンドウを 300ms → 400ms に拡大（select tool と一致）。300ms は OS の標準ダブルクリックより短く、やや遅いダブルクリックで編集に入れず 3 クリック目が必要になっていた。

---
"@edv4h/usketch-store": patch
---

perf(store): `createDeleteWithChildrenCommand` が子孫を集めるとき、子孫 1 件ごとにストア全体を走査していたのを、parentId ごとの子の索引を 1 回だけ作って辿るようにした。接続コネクタの判定も配列の `includes` から `Set` に変えた。子の多いフレーム・グループを削除するときの、削除以外の処理時間が 1000 子で約 12ms から約 0.4ms になる。削除・Undo の順序は変わらない。parentId が循環しているデータでも無限再帰せずに終わるようになった。

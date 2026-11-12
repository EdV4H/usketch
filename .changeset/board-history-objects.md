---
"@edv4h/usketch-shared": minor
---

Git 風のボード履歴の部品を追加。シェイプを正規化 JSON にして SHA-256 で content-address する `snapshotShapes` / `createBlob` / `createTree` / `createCommit`、ハッシュ比較だけで変化したシェイプを出す `diffTrees`、フィールド単位の `diffShapeFields`、過去の版に戻す編集を計算する `planRestore` と、それを BoardStore に適用する `applyRestorePlan` / 1 手で undo できる `createRestoreCommand` を公開する。Web Crypto だけに依存するので、ブラウザ・Workers・Node.js 19+ のどこでも同じハッシュになる。

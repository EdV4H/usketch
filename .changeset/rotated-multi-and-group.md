---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-tool-helpers": minor
"@edv4h/usketch-plugin-shape-group": minor
---

回転した Shape を含む複数選択の回転・リサイズとグループの回転を直す

- 複数選択の回転で、選んだフレームやグループの中身、`attachable.follow` で貼り付いた付箋も一緒に回るようにした（1 つだけ選んだときの回転でも貼り付いた付箋が付いてくる）。
- 複数選択のリサイズで、回転した Shape が歪まないようにした。90° 刻みの Shape は見た目の向きどおりに伸び（90° / 270° では幅と高さが入れ替わる）、それ以外の角度の Shape は縦横比を保って拡大縮小する。反転したときは、90° 刻み以外の Shape の回転も鏡像になる。
- `ShapeDefinition.rotatable` と `isShapeRotatable` を追加。省略時は `resizable` に従うので既存の定義の挙動は変わらない。グループは `rotatable: true` になり、単体で選んでも回転できる。
- `computeGroupBounds(children, rotation?)` は回転した子を見た目の角で囲み、回転したグループにはそのグループの向きでの外枠を返す。

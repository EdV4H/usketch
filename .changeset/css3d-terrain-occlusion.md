---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-css3d-renderer": minor
"@edv4h/usketch-plugin-character": minor
---

3D 表示で、丘や崖の陰に入った看板やキャラクターを薄くするようにしました（3D 標準対応 P6b）。これまでは標高の丘の向こうにあるものが丘の手前に描かれていました。

- **shared**: 視点の位置 `cameraEye(view)` と、地面が点を隠すかを調べる `isOccluded(point, view, heightAt)` を追加しました。レンダラーが「地形の陰」を答える `view3dOcclusionService`（`hidden` / `look` / `subscribe`）と `occludedStyle`・`OCCLUDED_OPACITY` も追加しました
- **css3d-renderer**: `view3dOcclusionService` を出し、3D の Shape は上端が陰に入ると薄くします（箱は面ごと、自前の 3D 表現は隠す）。オプション `occlusion`（`"fade"` 既定 / `"hide"` / `"none"`）、`setOcclusion` / `getOcclusion`、HUD の「地形の陰」を追加しました。答えは 100ms 使い回し、1 フレームで調べ直すのは 40 個までです
- **character**: 体の中ほどが陰に入ると、描き手に `occluded`（`"fade"` / `"hide"`）を渡します。`"hide"` のときはプラグインが隠し、影も一緒に薄く／隠します

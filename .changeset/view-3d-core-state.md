---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-character": patch
---

3D 表示の状態（カメラと 3D の度合い）をコアの状態にしました（3D 標準対応 P1、#1304）。

- **shared**: `Camera3d`（pitch / fov / horizon / height）と `View3dState`（camera ＋ amount）、範囲 `CAMERA_3D_LIMITS`、`createView3dCell` / `view3dCellOf` を追加。`BoardStore` に `getView3d` / `setView3d` / `subscribeView3d` を追加（次のメジャーまでは省略可）。`View3dApi` に `turn()`（3D 表示が viewport を回した角度）を追加
- **store**: `createBoardStore` が 3D 表示の状態を持ちます。viewport と同じく見る人ごとで同期しません。通知は `subscribe` とは別です
- **mode7**: カメラと遷移量をコアの状態に置きます。yaw は傾ける層を回すのをやめ、3D の間は viewport の回転（`Viewport.rotation`）として地平線の中央を軸に回し、平らに戻るときに回した分だけ戻します。絵は変わりません。`getRenderedCamera()` と `view3dService` の `camera().yaw` は常に `0` になります
- **character**: 追従カメラが 3D 表示の回転（`turn()`）を足して追従するので、3D 中に yaw を変えても追従が止まらず、yaw が保たれます

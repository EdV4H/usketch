# @edv4h/usketch-plugin-portal

## 0.4.0

### Minor Changes

- 59d9186: マルチページ: シェイプを別のページへ移す・コピーする
  
  - `@edv4h/usketch-plugin-pages`
    - ページパネルに「選択中の N 個を別のページへ」（移す / コピー）を追加。API は `moveShapes` / `copyShapes`、純関数は `moveShapesToPage` / `copyShapesToPage`
    - 子シェイプと、両端が含まれるコネクタも一緒に移す。移さなかったものへの参照（親・コネクタの端）は外す
    - 移したシェイプは id を変えずに移動先の一番手前へ置く。移動元のページ doc の `movedOut` に印を残し、同時編集で戻ってきたものは消す（`watchMovedOutShapes`）
  - `@edv4h/usketch-plugin-portal`: `pageId` / `legacyPageId` オプション。ページを使うボードでは、今のページで作ったポータルだけを出す
    - 他のページのシェイプを指すポータルを「シェイプが無い」とみなして消さない

### Patch Changes

- b86508c: 層が 3D 表示での見え方を宣言できるようにし、描画距離をコアの状態にしました（3D 標準対応 P2a、#1466）。絵は変わりません。
  
  - **shared**: `Layer.view3d`（`tilt` / `depth` / `screen` / `hidden`、型 `LayerView3d`）と `SelectionForeground.view3d` を追加。`View3dState.drawDistance`、`view3dOverscanPx`、`LayerRenderContext.view3dOverscan` を追加
  - **canvas-engine**: 層の wrapper に `data-view3d` を付け、3D 表示中は背景を奥まで敷く幅（オーバースキャン）を `view3dOverscan` で各層に渡します。カメラの高さが毎フレーム変わっても、この値が変わらなければ層を描き直しません
  - **mode7**: 描画距離をコアの状態に置きます。`view3d` を宣言した層も傾けます（`tiltLayerIds` を渡したときはその一覧のまま）。`hidden` を宣言した層は 3D の間は出しません
  - **bg-grid / elevation**: オーバースキャンを `view3dOverscan` から読みます（`bg-grid:set-overscan` イベントも次のメジャーまで読みます）
  - **各プラグイン**: Mode 7 が既定で傾けていた層に `view3d` を宣言しました（崖・3D Shape・キャラは `depth`）
- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0

## 0.3.15

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0

## 0.3.14

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0

## 0.3.13

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0

## 0.3.12

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0

## 0.3.11

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0

## 0.3.10

### Patch Changes

- 13418ff: ポータルのパネルを memo 化し、パン・ズーム・ホバー・選択の変化のたびにピン留めした図形を描き直さないようにした（パネルの位置・サイズやピン留めした図形自体が変わったときだけ再描画する）。

## 0.3.9

### Patch Changes

- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
  - @edv4h/usketch-shared@4.19.0

## 0.3.8

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0

## 0.3.7

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0

## 0.3.6

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0

## 0.3.5

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0

## 0.3.4

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0

## 0.3.3

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0

## 0.3.2

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0

## 0.3.1

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0

## 0.3.0

### Minor Changes

- e26d4da: Portal に「取り込む（Canvasから取り除いて保持）」機能を追加（手札と同型のstash/restore）

  既存の「📌 選択をポータル」（盤面に残したままミラー）に加え、新規「📥 選択を取り込む」を追加。選択 shape を **Canvas から取り除き、そのスナップショットを Portal パネルに保持**する。パネルの「⤴ 戻す」で元の位置へ復帰。いずれも Undo/Redo 可能。保持ポータルは既存の🔒/👥トグルで共有も可能。保持中の shape は Portal 内が唯一の実体のため、閉じる/全解除では破棄せず盤面に戻す（データ消失防止）。

## 0.2.5

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0

## 0.2.4

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0

## 0.2.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0

## 0.2.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0

## 0.2.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 0.2.0

### Minor Changes

- 20519c8: ポータルパネルの chrome（ヘッダ/枠）を差し替え可能に。`createPortalPlugin({ components: { Chrome } })` に独自コンポーネントを渡せる（`PortalChromeProps`: entry/shared/title/toggleShared/remove/dragHandleProps/resizeHandleProps/children）。ドラッグ移動・リサイズ・シェイプ内容は、custom Chrome が `dragHandleProps`/`resizeHandleProps` を配線し `children` を描画すれば保持される。`DefaultPortalChrome`/`PortalChrome` を export。

## 0.1.0

### Minor Changes

- 96f8822: ポータルプラグイン `usketch-plugin-portal` を追加（issue #709）。任意のシェイプを**画面の固定位置にピン留め**して、pan/zoom に関係なく常時表示できる（picture-in-picture）。既存シェイプの描画定義（`ctx.shapes.get(type).render`）をそのまま再利用するため、タイマー等の**インタラクティブなシェイプはポータル上でもボタン操作が効く**。
  - **既定は個人ビュー**（位置/サイズを localStorage に per-user 保存）、パネルの🔒/👥トグルで**全員共有**（共有 `Y.Doc` の `portals` マップ＝既存 DO で同期・永続、サーバ改修不要）に昇格できる。
  - Debug HUD の Controls（group "Portal"）から「選択をポータル」「自分のポータルを全解除」。各パネルはドラッグ移動/リサイズ/共有トグル/クローズ可能。対象シェイプが消えるとポータルも消える。

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0

# @edv4h/usketch-plugin-mode7

## 0.2.0

### Minor Changes

- b133c5f: feat(mode7): ファミコン Mode 7 風に Canvas を擬似3D地平面ビューで見るプラグインを追加

  `@edv4h/usketch-plugin-mode7` を新規追加。実際の Shape をそのまま「奥へ傾く地平面」に見せる
  ビューモード（編集ではなく閲覧）。ON/OFF トグル、既定 OFF。
  - **CSS 3D 変換を板コンテンツ層のラッパに注入**（`perspective()+rotateX(pitch)+rotateZ(yaw)`）。
    `data-layer-id` で識別できる外側ラッパ（React 非管理の transform）に当てるので再レンダで消えない。
    対象は allow 方式（既定 `dom-shapes`/`gpu-shapes`/`bg-grid`/`bg-dots`/`island-metaball`、options で増減可）
    なので HUD/選択ハンドル等の UI 層は傾かない。
  - **sky / fog / capture の3オーバーレイ層**（傾けない）。capture 層が板ポインタを捕捉して
    3D 下での編集破綻を防ぎ、ドラッグ=地上移動(viewport pan)・wheel=ズームでカメラを操作。
  - カメラ（pitch/yaw/fov/horizon）と見た目（空色/フォグ）を **HUD＋アクション＋サービス API** で設定。
    アクションは `mode7:<action>` emit でも起動可（`toggle`/`pitch-*`/`yaw-*`/`fov-*`/`reset`）。
    ショートカットは opt-in（`event.key` 照合の layout 依存を避け既定なし、`shortcuts` で割当）。
  - 状態はビュー限定（per-viewer・非永続・非同期）＝ shape 化しない（presentation と同類）。
  - `createMode7Plugin({ enabledInitially, camera, look, tiltLayerIds, shortcuts })`。
  - 純関数（camera/transform）ユニットテスト 20 件。

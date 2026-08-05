# @edv4h/usketch-plugin-portal

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

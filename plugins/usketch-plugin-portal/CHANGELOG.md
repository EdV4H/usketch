# @edv4h/usketch-plugin-portal

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

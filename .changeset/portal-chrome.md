---
"@edv4h/usketch-plugin-portal": minor
---

ポータルパネルの chrome（ヘッダ/枠）を差し替え可能に。`createPortalPlugin({ components: { Chrome } })` に独自コンポーネントを渡せる（`PortalChromeProps`: entry/shared/title/toggleShared/remove/dragHandleProps/resizeHandleProps/children）。ドラッグ移動・リサイズ・シェイプ内容は、custom Chrome が `dragHandleProps`/`resizeHandleProps` を配線し `children` を描画すれば保持される。`DefaultPortalChrome`/`PortalChrome` を export。

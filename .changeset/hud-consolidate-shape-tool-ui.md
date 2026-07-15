---
"@edv4h/usketch-plugin-tool-select": minor
"@edv4h/usketch-plugin-shape-connector": minor
"@edv4h/usketch-plugin-shape-wireframe": minor
"@edv4h/usketch-plugin-domain-design": minor
"@edv4h/usketch-plugin-shape-basic": minor
"@edv4h/usketch-plugin-export": minor
"@edv4h/usketch-plugin-shape-freedraw": minor
"@edv4h/usketch-plugin-shape-card": minor
---

shape/tool 系の操作を Action レジストリに完全移行し、追従設定 UI を撤去（Control HUD に一本化）。ホストアプリに専用 UI を足さなくても操作できる。

- **新規 Action**（`ctx.actions.register`、Control HUD が自動 UI 化）:
  - tool-select: 選択オブジェクトの `fill`/`stroke`/`strokeWidth`/`opacity`、`Bring to front`/`Send to back`/`Delete`（group "Selection"）。→ 追従 StylePanel を置換。
  - connector: 選択コネクタの `arrowHead`/`pathType`/`sourceAnchor`/`targetAnchor`（端点再計算込み）。→ 追従 ConnectorPropertyBar を置換。
  - wireframe / domain-design / basic-shape: サブタイプ選択。
  - export: PNG / SVG / JSON。
- **撤去した追従設定 UI**（機能は Action として存続）:
  - freedraw の設定 palette レイヤー（`freedraw-cursor` は維持）。
  - card の操作メニュー（`card-menu` レイヤー / CardActionMenu）。手札トレイは維持。
- 直接操作ハンドル（resize/rotate・connector 端点/アンカー/ラベル編集）は対象外で維持。

apps/web 側では Toolbar のツール列/undo-redo/背景/StylePanel と ConnectorPropertyBar プラグインを撤去（Cloud/AI・theme・command palette・zoom は据え置き）。

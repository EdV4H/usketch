---
"@edv4h/usketch-plugin-map": minor
---

「チーム」機能を「拠点」に全面改名。UI 表記だけでなく内部識別子も刷新した（shape 型 `team-map`→`base-map`、`TeamMapShapeData`→`BaseMapShapeData`、`TeamInfo`→`BaseInfo`、`teamStateStore`→`baseStateStore`、マップツールの `team` サブモード→`base` など）。

破壊的変更: 旧 `team-map` 型で保存済みの拠点データは読み込まれなくなる（shape 型が変わるため）。`@edv4h/usketch-plugin-map` から re-export していた `TeamInfo` / `TeamMapShapeData` などの型名も変更。

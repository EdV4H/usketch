---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-shape-freedraw": minor
"@edv4h/usketch-plugin-shape-text": minor
"@edv4h/usketch-plugin-shape-image": minor
"@edv4h/usketch-plugin-shape-basic": minor
"@edv4h/usketch-plugin-shape-sticky": minor
"@edv4h/usketch-plugin-shape-connector": minor
"@edv4h/usketch-plugin-ai-agent": minor
"@edv4h/usketch-plugin-ai-copilot": minor
"@edv4h/usketch-plugin-ai-recognize": minor
"@edv4h/usketch-plugin-debug-hud": minor
---

ShapeDefinition に shape 自身を AI / 認識 / debug 用に表現する optional な
拡張ポイント API を追加した。これまで `ai-agent` / `ai-copilot` / `ai-recognize`
/ `debug-hud` が shape 固有フィールド (`text`, `points`, `src`, `cornerRadius`
等) を読むために使っていた inline cast を、shape プラグイン側の自己宣言に
置き換える。

新 API (`packages/shared` の `ShapeDefinition`):

- `serializeForAi?(shape, ctx?) => Record<string, unknown>` — LLM プロンプト
  埋め込み向けのフラットな表現。慣習として `text: string` は人間可読 label、
  `pointCount: number` は頂点数として cross-shape に解釈される。
- `serializeForRecognition?(shape, ctx?) => unknown` — 手書き / OCR 認識用
  表現。戻り値は `unknown` で、認識対象外なら `null`。呼び出し側 (ai-recognize)
  が `isRecognitionStroke` / `isRecognitionImage` で形を確認する。これにより
  shape プラグインが ai-recognize ドメイン型を import せずに済む。
- `debugFields?(shape) => Record<string, unknown>` — debug HUD shapes panel
  用の人間可読フィールドマップ。`serializeForAi` と違い圧縮しない。

実装した shape プラグインと対応する method:

| Plugin | serializeForAi | serializeForRecognition | debugFields |
|---|---|---|---|
| `shape-freedraw` | ✅ pointCount | ✅ stroke | ✅ pointCount/firstPoint/lastPoint |
| `shape-text` | ✅ text/fontSize | — (null) | ✅ text/fontSize/fontFamily/isEditing |
| `shape-image` | ✅ srcKind/srcLength/srcOrigin (summary, base64 直送回避) | ✅ image | ✅ src |
| `shape-basic` (rectangle) | ✅ cornerRadius | — | ✅ cornerRadius |
| `shape-sticky` | ✅ text/stickyColor | — | ✅ text/fontSize/stickyColor/isEditing |
| `shape-connector` | — | — | ✅ sourceId/targetId/anchors/arrowHead/pathType |

汎用プラグイン側の切替:

- `ai-agent/canvas-serializer.ts`: `serializeShape` と `findNearbyLabels` を
  registry 経由 (`registry.get(type).serializeForAi(...)`) に書き換え。
  `(shape as { text? }).text` 等の cast を削除。
- `ai-copilot/plugin.tsx`: 「直近 10 shape の text を LLM に送る」処理を
  serializeForAi 経由に。書き込み側の cast (suggestion → ShapeData) は
  別軸の課題として OOS で残置。
- `ai-recognize`: 新規 `contract.ts` に `RecognitionStroke` / `RecognitionImage`
  型と type guard を追加。シリアライザは `stroke-serializer.ts` に改名
  (関数 `serializeStrokesForRecognition`) して registry + type guard 経由に
  切替。
- `debug-hud/panels/shapes-panel.tsx`: `debugFields` 実装 shape はそれを使い、
  未実装 shape は `KNOWN_KEYS` 補集合で fallback。`KNOWN_KEYS` は常時表示用の
  8 キー (id / type / x / y / width / height / style / rotation) のままで、
  `meta` / `parentId` / `zIndex` / `createdAt` / `updatedAt` は fallback の
  custom セクションに表示される。`x-*` 拡張は startsWith で補集合から除外。

排除した cast: 9 箇所 (5 ファイル)。書き込み側の `ai-copilot:67,70` は
`applySuggestion?(partial) => Partial<ShapeData>` のような対称 API として
別 issue で扱う予定。

Closes #584.

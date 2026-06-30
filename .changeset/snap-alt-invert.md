---
"@edv4h/usketch-plugin-snap": minor
---

Alt(Option) キーの挙動を選べる `altBehavior` を追加（#636）。`"invert"` にすると、
`enabled: false`（スナップ無効）でも Alt 押下中だけ一時的にスナップを効かせられる。

- `createSnapPlugin({ altBehavior: "invert" })` または `snap:configure({ altBehavior })` で設定。
- 既定は `"suppress"`（従来どおり Alt 押下中は無条件抑止）で後方互換。
- `SnapSettings.altBehavior` を追加。

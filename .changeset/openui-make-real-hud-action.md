---
"@edv4h/usketch-plugin-tool-openui": minor
---

Make Real の選択追従フローティングボタン（`openui-make-real` fixed レイヤー）を撤去し、Control HUD の **AI** グループの Action `openui:make-real` に統合。`isEnabled` は「非 openui の shape を選択中」で、実行時に選択範囲を PNG スナップショットして vision リクエストを送る挙動は不変。ホストアプリに追従 UI を足さなくても Control HUD だけで実行できる。

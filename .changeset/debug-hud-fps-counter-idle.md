---
"@edv4h/usketch-plugin-debug-hud": patch
---

Control HUD の FPS カウンタを、HUD を開いて FPS 表示が購読している間だけ rAF で回すようにした。これまではプラグイン setup 時から HUD が非表示（既定）でも毎フレーム回り続けていた。開き直すたびに計測とグラフの履歴はリセットされ、最初の 1 秒は「– FPS」と表示する。

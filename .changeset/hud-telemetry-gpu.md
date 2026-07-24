---
"@edv4h/usketch-gpu-renderer": minor
"@edv4h/usketch-plugin-debug-hud": patch
---

HUD テレメトリ移設（第1弾）: GPU 統計を gpu-renderer 所有の HUD パネルへ移設。

- gpu-renderer が `ctx.hud.registerPanel` で「GPU」パネル（Active/Inactive＋counts）を登録するようになり、Debug/Control HUD 側の GPU 専用セクション（`"gpu-renderer:stats"` イベントへのハードコード結合）を除去。
- GPU 統計は Controls ドックの gpu-renderer プラグインセクションに表示される（GeneralPanel からは削除）。GPU 描画ロジックは無変更。

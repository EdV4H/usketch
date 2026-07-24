---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-plugin-debug-hud": minor
---

Debug/Control HUD をプラグイン自動判定＋宣言的コントロール基盤にリファクタ（基盤のみ。GPU/Sync/Members/Board-meta のハードコード除去は後続）。

- **プラグイン属性付け（自動判定）**: `createApp` が各プラグインに scoped context を渡し、`ctx.actions` / 新設 `ctx.hud` への登録に **所有プラグイン id を透過的に付与**（プラグイン側の変更不要）。`ActionRegistry.getOrdered()` が `pluginId` を返すように拡張。
- **`ctx.hud`（新設 `HudRegistry`）**: プラグインが宣言的に HUD へ貢献する口。
  - `registerSettings(descriptor)` — **ライブ双方向 settings**（`fields`＋`get/set/subscribe`）。スライダー等が現在値を追従し即反映。
  - `registerPanel(panel)` — 任意 React のカスタムパネル（テレメトリ/独自 UI 用）。
- **`ctx.plugins`（`PluginInfoRegistry`）**: アクティブなプラグインの `{id,name}` 読み取りビュー。
- **HUD 描画**: Controls を**プラグインごとのセクション**に再編。各プラグイン配下に settings（ライブ）＋actions＋カスタムパネルを集約し、`action.group` はサブ見出しへ（複数プラグインが同一 group を共有していた重複帰属を解消）。
- 既存の `ctx.actions.register` は無変更＝全既存プラグイン互換（プラグイン単位で自動整列される）。
- app の viewport-LOD コントロールを `ctx.hud.registerSettings` へ移行（ライブスライダー化）。

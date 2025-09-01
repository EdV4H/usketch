# CI障害修正計画

## 概要
GitHub ActionsのCIパイプラインで複数の障害が発生しています。本ドキュメントでは、各障害の原因と修正計画を記載します。

## 検出された問題

### 1. Lint/Format Check の失敗

#### 問題詳細
Biomeによるリントチェックで以下の警告が検出されています：

- **useLiteralKeys** (4件)
  - `packages/canvas-core/src/canvas.ts`: dataset["selected"]などの記法
  - `packages/ui-components/src/selection-layer.ts`: dataset["resizeHandle"]の記法
  
- **noUnusedImports** (2件)
  - `packages/tools/src/adapters/toolManagerAdapter.ts`: ToolBehaviorsの未使用インポート
  - `packages/tools/src/configs/default-tools.ts`: whiteboardStoreの未使用インポート
  
- **noUnusedVariables** (1件)
  - `packages/tools/src/adapters/toolManagerAdapter.ts`: previousToolId変数が未使用
  
- **noUnusedFunctionParameters** (1件)
  - `packages/tools/src/configs/default-tools.ts`: nextToolIdパラメータが未使用
  
- **noUnusedPrivateClassMembers** (1件)
  - `packages/tools/src/utils/snapEngine.ts`: privateなthresholdが未使用

#### 修正方針
1. dataset記法を`dataset.property`形式に修正
2. 未使用のインポートを削除
3. 未使用の変数・パラメータを削除または`_`プレフィックスを付与
4. 未使用のprivateメンバーを削除

### 2. Type Check の失敗

#### 問題詳細
Turboの実行で`bad grpc status code: The operation was cancelled`エラーが発生。
個別パッケージでの`tsc --noEmit`は成功しているため、Turbo環境特有の問題の可能性。

#### 修正方針
1. Turboのキャッシュをクリア（`turbo run clean`）
2. node_modulesの再インストール
3. 必要に応じてTurboの設定を調整

### 3. Unit Tests の失敗

#### 問題詳細
以下のパッケージでテストファイルが見つからない：
- `@usketch/shared-types`: テストファイルなし
- `@usketch/canvas-core`: テストファイルなし

#### 修正方針
1. テストが不要なパッケージは`package.json`から`test`スクリプトを削除
2. または、ダミーのテストファイルを追加
3. または、CI設定でテストが必須でないパッケージを除外

### 4. E2E Tests の不安定性

#### 問題詳細
Playwrightテストがworkerプロセスの予期しない終了（SIGINT）で失敗。

#### 修正方針
1. Playwright設定の調整（タイムアウト、並列度）
2. CI環境でのヘッドレスブラウザ設定の確認
3. メモリ制限の調整

## 実装計画

### Phase 1: 即座に修正可能な問題（優先度：高）

1. **Lintエラーの修正**
   - `pnpm format`で自動修正可能な項目を修正
   - 手動で未使用インポート・変数を削除

2. **テストスクリプトの調整**
   - テストが不要なパッケージから`test`スクリプトを削除
   - または、CI設定でスキップ

### Phase 2: 環境設定の調整（優先度：中）

1. **Turbo設定の最適化**
   - キャッシュクリア
   - 並列実行の調整
   
2. **Playwright設定の調整**
   - CI環境向けの設定追加
   - タイムアウト値の増加

### Phase 3: 長期的な改善（優先度：低）

1. **テストカバレッジの向上**
   - 各パッケージに適切なテストを追加
   
2. **CI/CDパイプラインの最適化**
   - ジョブの依存関係の見直し
   - キャッシュ戦略の改善

## 修正実施チェックリスト

- [ ] Lintエラーを自動修正（`pnpm format`）
- [ ] 残りのLintエラーを手動修正
- [ ] テストスクリプトの調整
- [ ] Turboキャッシュのクリア
- [ ] CI設定ファイルの更新
- [ ] PRの更新とCI再実行
- [ ] 全てのチェックがパスすることを確認

## 参考リンク

- [PR #9](https://github.com/EdV4H/dom-base-whiteboard-handson/pull/9)
- [CI実行結果](https://github.com/EdV4H/dom-base-whiteboard-handson/actions/runs/17318455272)

## 更新履歴

- 2025-08-29: 初版作成
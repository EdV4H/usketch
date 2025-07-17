# E2E Migration Checklist

## 移行前の準備

- [x] 現在のE2Eテスト構成を確認
- [x] apps/e2eディレクトリ構造を作成
- [x] package.jsonを作成（monorepo対応）
- [x] Playwright設定をmonorepo環境用に更新
- [x] 環境変数設定ファイルを作成

## 設定ファイルの移行

- [x] playwright.config.tsを更新
  - [x] webServerコマンドをpnpmワークスペース対応に
  - [x] ベースURLの環境変数化
  - [x] レポート設定の拡張
  - [x] グローバルセットアップ/ティアダウンの追加

- [x] TypeScript設定
  - [x] tsconfig.jsonを作成
  - [x] @whiteboard/tsconfigを継承

## Page Object Modelの整理

- [x] WhiteboardPageクラスを作成
  - [x] 既存のヘルパー関数を統合
  - [x] セレクタを現在の実装に合わせて更新
  - [x] プラットフォーム対応のキーボードショートカット

- [x] ToolbarPageクラスを作成
  - [x] ツール選択機能
  - [x] アクション実行機能
  - [x] 状態確認機能

## テストの移行

- [x] whiteboard.spec.tsを移行
  - [x] ヘルパー関数をPage Objectに置き換え
  - [x] カスタムフィクスチャを使用
  - [x] より包括的なテストケースに拡張

- [x] zoom.spec.tsを移行
  - [x] ズーム機能のテストを整理
  - [x] パン機能のテストを追加
  - [x] 限界値のテストを追加

## 新機能の追加

- [x] カスタムテストフィクスチャ
  - [x] 自動初期化
  - [x] テストデータ管理
  - [x] エラーハンドリング

- [x] CI/CD対応
  - [x] GitHub Actions用レポーター
  - [x] JUnit/JSONレポート出力
  - [x] アーティファクト保存設定

## 移行後のタスク

### 1. 既存のe2eディレクトリを削除
```bash
rm -rf /Users/yusukemaruyama/Projects/dom-base-whiteboard-handson/e2e
rm /Users/yusukemaruyama/Projects/dom-base-whiteboard-handson/playwright.config.ts
```

### 2. ルートpackage.jsonのスクリプトを更新
```json
{
  "scripts": {
    "test:e2e": "pnpm --filter e2e test",
    "test:e2e:ui": "pnpm --filter e2e test:ui"
  }
}
```

### 3. CI設定を更新
GitHub ActionsやCI/CDパイプラインで以下のコマンドを使用：
```bash
pnpm turbo test:e2e --filter=e2e
```

### 4. 開発者向けドキュメントを更新
READMEやCONTRIBUTING.mdにE2Eテストの新しい実行方法を記載。

## 検証項目

- [ ] `pnpm --filter e2e test`でテストが実行される
- [ ] `pnpm --filter e2e test:ui`でUIモードが起動する
- [ ] whiteboardアプリが自動的に起動する
- [ ] すべてのテストがパスする
- [ ] レポートが正しく生成される

## 注意事項

1. **セレクタの更新**
   - 現在の実装では`data-shape="true"`を使用
   - `data-testid`属性を段階的に追加することを推奨

2. **プラットフォーム対応**
   - キーボードショートカットはMac/Windows両対応

3. **環境変数**
   - `.env.test`ファイルはgitignoreに追加済み
   - `.env.test.example`を参考に各開発者が作成

4. **ブラウザのインストール**
   - 初回は`pnpm --filter e2e test:install`を実行
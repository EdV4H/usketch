# @whiteboard/e2e

E2Eテストスイート for Whiteboard Application

## 概要

このパッケージは、Playwrightを使用したホワイトボードアプリケーションのE2Eテストを提供します。
monorepo環境に最適化されており、`@whiteboard/whiteboard`アプリケーションに対してテストを実行します。

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. Playwrightブラウザのインストール

```bash
pnpm test:install
```

### 3. 環境変数の設定

```bash
cp .env.test.example .env.test
# 必要に応じて.env.testを編集
```

## テストの実行

### 基本的なテスト実行

```bash
# ヘッドレスモードで実行
pnpm test

# UIモードで実行（インタラクティブ）
pnpm test:ui

# ヘッドモードで実行（ブラウザを表示）
pnpm test:headed

# デバッグモードで実行
pnpm test:debug
```

### 特定のテストファイルを実行

```bash
# 特定のテストファイル
pnpm test tests/features/whiteboard.spec.ts

# 特定のテストスイート
pnpm test -g "Whiteboard Basic Functionality"
```

### テストレポート

```bash
# レポートを表示
pnpm test:report
```

## ディレクトリ構造

```
apps/e2e/
├── fixtures/              # テストフィクスチャとPage Objects
│   ├── test-base.ts      # カスタムテストインスタンス
│   └── pages/            # Page Object Models
│       ├── whiteboard-page.ts
│       └── toolbar-page.ts
├── tests/                # テストファイル
│   └── features/         # 機能別テスト
│       ├── whiteboard.spec.ts
│       └── zoom.spec.ts
├── test-results/         # テスト結果（gitignore）
├── playwright-report/    # HTMLレポート（gitignore）
└── playwright.config.ts  # Playwright設定
```

## Page Object Model

### WhiteboardPage

ホワイトボードの主要な操作を提供：

```typescript
const { whiteboardPage } = fixtures;

// 図形を描画
await whiteboardPage.drawShape('rectangle', 100, 100, 300, 200);

// 図形を選択
await whiteboardPage.selectShape(0);

// ズーム操作
await whiteboardPage.zoomIn();
await whiteboardPage.zoomOut();
```

### ToolbarPage

ツールバーの操作を提供：

```typescript
const { toolbarPage } = fixtures;

// ツールを選択
await toolbarPage.selectTool('rectangle');

// アクションを実行
await toolbarPage.undo();
await toolbarPage.clearCanvas();
```

## カスタムフィクスチャ

### 自動セットアップ

```typescript
test('example test', async ({ whiteboardPage, toolbarPage }) => {
  // whiteboardPageは自動的に初期化され、準備完了状態
  // toolbarPageも利用可能
});
```

### テストデータ

```typescript
test('with test data', async ({ testData }) => {
  // 事前定義されたテストデータを使用
  const { shapes, colors } = testData;
});
```

## CI/CD統合

### GitHub Actions

```yaml
- name: Run E2E tests
  run: pnpm turbo test:e2e --filter=e2e
```

### 環境変数

- `CI`: CI環境での実行を示す
- `WHITEBOARD_URL`: テスト対象のURL
- `DEBUG`: デバッグ出力の有効化

## デバッグ

### Playwrightインスペクター

```bash
# インスペクターを起動
pnpm test:debug
```

### トレースビューア

失敗したテストのトレースを確認：

```bash
npx playwright show-trace test-results/trace.zip
```

### スクリーンショット

失敗時のスクリーンショットは`test-results/`に保存されます。

## ベストプラクティス

1. **Page Objectパターンの使用**
   - UI操作をPage Objectに集約
   - テストコードをクリーンに保つ

2. **適切な待機処理**
   - `waitForReady()`で初期化を待つ
   - アニメーション完了を待つ

3. **データ属性の使用**
   - `data-testid`属性でテスト用セレクタを定義
   - 実装の変更に強いテストを作成

4. **並列実行**
   - テストは独立して実行可能に
   - 状態を共有しない

## トラブルシューティング

### ブラウザが起動しない

```bash
# ブラウザを再インストール
pnpm test:install
```

### タイムアウトエラー

`playwright.config.ts`でタイムアウトを調整：

```typescript
timeout: 60 * 1000, // 60秒
```

### ポート競合

`.env.test`で別のポートを指定：

```
WHITEBOARD_URL=http://localhost:5174
```
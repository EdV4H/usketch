# Turborepo移行計画

## 概要

本ドキュメントは、現在の単一リポジトリプロジェクト（dom-wb-handson）をTurborepoを使用したmonorepoに移行するための実装計画を記載します。

## 現在のプロジェクト構造分析

### 技術スタック

- **フレームワーク**: Vite + TypeScript
- **テスト**: Vitest（単体テスト）、Playwright（E2Eテスト）
- **状態管理**: Zustand
- **主要機能**: DOMベースのホワイトボードアプリケーション

### 現在のディレクトリ構造

```
dom-wb-handson/
├── src/
│   ├── components/      # UIコンポーネント
│   ├── tools/          # 描画ツール
│   ├── integration/    # 統合テスト
│   ├── test/          # テストユーティリティ
│   └── utils/         # ユーティリティ関数
├── e2e/               # E2Eテスト
├── docs/              # ドキュメント
└── index.html         # エントリーポイント
```

## Monorepo構成案

### パッケージ分割戦略

```
whiteboard-monorepo/
├── apps/
│   ├── whiteboard/          # メインアプリケーション
│   └── e2e/                # E2Eテストスイート
├── packages/
│   ├── canvas-core/         # Canvas基本機能
│   ├── drawing-tools/       # 描画ツール群
│   ├── ui-components/       # 共通UIコンポーネント
│   ├── shared-types/        # 共通型定義
│   ├── shared-utils/        # 共通ユーティリティ
│   ├── store/              # 状態管理
│   ├── tsconfig/           # 共通TypeScript設定
│   └── vite-config/        # 共通Vite設定
├── turbo.json              # Turborepo設定
├── package.json            # ルートpackage.json
└── pnpm-workspace.yaml     # pnpmワークスペース設定
```

### 各パッケージの責務

#### apps/whiteboard

- メインのホワイトボードアプリケーション
- 各パッケージを組み合わせた最終的なアプリケーション
- 現在の`index.html`、`main.ts`、`style.css`を含む

#### packages/canvas-core

- `canvas.ts`の基本機能
- Canvas要素の管理
- 基本的な描画操作

#### packages/drawing-tools

- 現在の`tools/`ディレクトリ内容
- `Tool.ts`、`ToolManager.ts`
- 各種ツール（`RectangleTool.ts`、`SelectTool.ts`など）

#### packages/ui-components

- `components/`ディレクトリの内容
- `SelectionLayer.ts`などのUI関連コンポーネント

#### packages/shared-types

- `types.ts`の共通型定義
- パッケージ間で共有される型

#### packages/shared-utils

- `utils/`ディレクトリの内容
- 座標変換などの共通ユーティリティ

#### packages/store

- Zustandを使用した状態管理
- `store.ts`の内容

#### apps/e2e

- Playwrightを使用したE2Eテストスイート
- 現在の`e2e/`ディレクトリの内容
- 全アプリケーションの統合テスト
- CI/CDパイプラインでの実行を考慮した構成

#### packages/tsconfig

- 共通TypeScript設定のパッケージ化
- ベース設定（`tsconfig.base.json`）の提供
- 用途別の設定プリセット:
  - `tsconfig.app.json`: アプリケーション用
  - `tsconfig.lib.json`: ライブラリ用
  - `tsconfig.test.json`: テスト用
- 各パッケージからの継承による設定の一元管理

#### packages/vite-config

- 共通Vite設定のパッケージ化
- ベース設定の提供
- プラグイン設定の共通化
- 用途別の設定ファクトリー関数:
  - `createAppConfig()`: アプリケーション用
  - `createLibConfig()`: ライブラリ用
  - `createTestConfig()`: Vitest用
- 共通のaliasやresolve設定

## 実装ステップ

### Phase 1: 基盤セットアップ（1-2日）

1. **Turborepo初期化**

   - ルートディレクトリの作成
   - Turborepoのインストールと初期設定
   - pnpmワークスペースの設定

2. **基本構造の作成**

   ```bash
   # ディレクトリ構造作成
   mkdir -p apps/{whiteboard,e2e}
   mkdir -p packages/{canvas-core,drawing-tools,ui-components,shared-types,shared-utils,store,tsconfig,vite-config}
   ```

3. **設定ファイルの準備**
   - `turbo.json`の作成
   - ルート`package.json`の設定
   - `pnpm-workspace.yaml`の作成

### Phase 2: パッケージ分離（3-4日）

1. **tsconfigパッケージの作成**

   - 共通TypeScript設定の作成
   - 各種プリセットの定義
   - package.jsonのexports設定

2. **vite-configパッケージの作成**

   - 共通Vite設定の作成
   - 設定ファクトリー関数の実装
   - 共通プラグインの設定

3. **shared-typesパッケージの作成**

   - 現在の`types.ts`を移行
   - tsconfigパッケージを使用した設定
   - パッケージ間の依存関係定義

4. **shared-utilsパッケージの作成**

   - `utils/`ディレクトリの移行
   - 単体テストの移行

5. **canvas-coreパッケージの作成**

   - `canvas.ts`の機能分離
   - 依存関係の整理
   - テストの移行

6. **drawing-toolsパッケージの作成**

   - `tools/`ディレクトリの移行
   - ツール管理システムの整理

7. **ui-componentsパッケージの作成**

   - `components/`の移行
   - コンポーネントの依存関係整理

8. **storeパッケージの作成**
   - Zustand状態管理の分離
   - ストアのテスト移行

### Phase 3: アプリケーション統合（2-3日）

1. **apps/whiteboardの構築**

   - 各パッケージの統合
   - `index.html`、`main.ts`の移行
   - スタイルシートの整理

2. **apps/e2eの構築**

   - 現在のE2Eテストの移行
   - Playwright設定の調整
   - whiteboardアプリケーションへの参照設定

3. **ビルドシステムの設定**

   - Vite設定の調整
   - Turborepoビルドパイプラインの設定
   - E2Eテストのパイプライン統合

4. **開発環境の最適化**
   - ホットリロードの設定
   - 開発サーバーの設定

### Phase 4: テスト環境の整備（2-3日）

1. **単体テストの移行**

   - 各パッケージへのテスト配置
   - Vitestの設定調整

2. **E2Eテストの調整**

   - apps/e2eでの独立した実行環境構築
   - 他のアプリケーションとの連携テスト
   - CI/CD対応

3. **統合テストの整理**
   - パッケージ間の統合テスト
   - テストカバレッジの確認

### Phase 5: 最終調整とドキュメント（1-2日）

1. **パフォーマンス最適化**

   - ビルドキャッシュの設定
   - 依存関係の最適化

2. **ドキュメントの更新**

   - README.mdの更新
   - 各パッケージのドキュメント作成
   - 開発ガイドの作成

3. **CI/CDパイプラインの設定**
   - GitHub Actionsの設定
   - 自動テストとビルドの設定

## 技術的な考慮事項

### パッケージマネージャー

- **pnpm**を推奨（ディスク容量効率とシンボリックリンクの扱いが優れている）
- npm workspacesやyarn workspacesも選択可能

### TypeScript設定

- プロジェクトリファレンスを使用した型チェックの最適化
- `@whiteboard/tsconfig`パッケージから設定を継承
- 各パッケージで最小限の設定のみ記述

### ビルド最適化

- Turborepoのキャッシュ機能を活用
- 並列ビルドによる高速化
- 変更検知による必要最小限のビルド

### 依存関係管理

- 各パッケージは明示的に依存関係を宣言
- 循環依存を避ける設計
- 共通の依存関係はルートで管理
- monorepo内のパッケージ間依存は`workspace:*`プロトコルを使用

## 予想される課題と対策

### 1. 循環依存の問題

- **対策**: 依存関係グラフの可視化ツールを使用
- レイヤードアーキテクチャの徹底

### 2. ビルド時間の増加

- **対策**: Turborepoのキャッシュ機能を最大限活用
- 開発時は変更されたパッケージのみビルド

### 3. 開発体験の低下

- **対策**: VSCodeのマルチルートワークスペース設定
- パッケージ間の移動を容易にするツール導入

### 4. テストの複雑化

- **対策**: パッケージごとのテスト戦略を明確化
- 統合テストの自動化

## 成功指標

1. **開発効率**

   - パッケージの独立したリリースが可能
   - 並列開発の実現

2. **ビルドパフォーマンス**

   - キャッシュヒット率80%以上
   - フルビルド時間の短縮

3. **コード品質**

   - パッケージ間の責務が明確
   - テストカバレッジの維持・向上

4. **保守性**
   - 新機能追加時の影響範囲の限定
   - ドキュメントの充実

## タイムライン

総期間: 約2-3週間

- Week 1: Phase 1-2（基盤セットアップとパッケージ分離）
- Week 2: Phase 3-4（アプリケーション統合とテスト環境）
- Week 3: Phase 5（最終調整とドキュメント）

## 次のステップ

1. チームでの計画レビュー
2. 技術選定の最終決定（パッケージマネージャーなど）
3. Phase 1の実装開始
4. 段階的な移行とフィードバックの収集

## 参考リソース

- [Turborepo公式ドキュメント](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

## 設定例

### packages/tsconfig/package.json

```json
{
  "name": "@whiteboard/tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": ["*.json"],
  "exports": {
    "./base": "./tsconfig.base.json",
    "./app": "./tsconfig.app.json",
    "./lib": "./tsconfig.lib.json",
    "./test": "./tsconfig.test.json"
  }
}
```

### packages/vite-config/package.json

```json
{
  "name": "@whiteboard/vite-config",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch"
  },
  "dependencies": {
    "vite": "^6.3.5"
  },
  "devDependencies": {
    "@whiteboard/tsconfig": "workspace:*",
    "tsup": "^8.0.0"
  }
}
```

### 使用例: apps/whiteboard/tsconfig.json

```json
{
  "extends": "@whiteboard/tsconfig/app",
  "include": ["src"]
}
```

### 使用例: apps/whiteboard/vite.config.ts

```typescript
import { createAppConfig } from "@whiteboard/vite-config";

export default createAppConfig({
  root: __dirname,
  // アプリケーション固有の設定
});
```

### 使用例: packages/canvas-core/package.json

```json
{
  "name": "@whiteboard/canvas-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "vitest"
  },
  "dependencies": {
    "@whiteboard/shared-types": "workspace:*",
    "@whiteboard/shared-utils": "workspace:*"
  },
  "devDependencies": {
    "@whiteboard/tsconfig": "workspace:*",
    "@whiteboard/vite-config": "workspace:*",
    "tsup": "^8.0.0",
    "vitest": "^3.2.4"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### ルートpackage.json

```json
{
  "name": "whiteboard-monorepo",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "latest"
  },
  "packageManager": "pnpm@8.0.0"
}
```


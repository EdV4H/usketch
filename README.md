# uSketch - モジュラーホワイトボードアプリケーション

**プラグイン可能な形状システムと状態マシン駆動のツールシステムを備えたモダンなホワイトボードアプリケーション**

XStateとZustandを活用した堅牢な状態管理、プラグインアーキテクチャによる拡張可能な形状システム、そしてReact 19の最新機能を活用したパフォーマンス最適化を実現しています。

## ✨ 特徴

- **🏗️ モジュラーアーキテクチャ**: 完全に分離されたパッケージ構成
- **🔌 プラグインシステム**: 拡張可能な形状・ツールシステム
- **🤖 状態マシン駆動**: XStateによる複雑な操作の制御
- **⚡️ React 19対応**: 最新のReact機能を活用
- **🎯 型安全**: TypeScript + Zodによる完全な型保証
- **🧩 再利用可能**: コンポーネント単位での活用が可能

## 🎨 現在の機能

### ✅ 実装済み機能

#### ビュー機能
- [x] DOMベースキャンバス表示
- [x] 背景グリッド表示
- [x] ズーム機能 (マウスホイール/タッチパッド)
- [x] パン機能 (スペースキー + ドラッグ)
- [x] ビューポート管理

#### 描画ツール
- [x] 選択ツール (Select)
- [x] パンツール (Hand) 
- [x] 矩形描画 (Rectangle)
- [x] 楕円描画 (Ellipse)
- [x] 直線描画 (Line)
- [x] フリーハンド描画 (Pencil)
- [x] テキスト追加 (Text)

#### 操作機能
- [x] シェイプの選択 (クリック/範囲選択)
- [x] 複数選択 (Shift + クリック)
- [x] 選択シェイプの移動 (ドラッグ)
- [x] シェイプのリサイズ (8方向ハンドル)
- [x] シェイプの削除 (Delete/Backspace)
- [x] Undo/Redo機能 (Cmd/Ctrl + Z/Shift+Z)

#### 状態管理
- [x] Zustandベースの状態管理
- [x] 履歴管理システム
- [x] 座標変換システム (ワールド ↔ スクリーン)

## 🚀 クイックスタート

### インストール

```bash
# pnpmを使用（推奨）
pnpm install

# または npm
npm install

# または yarn
yarn install
```

### 開発環境の起動

```bash
# 開発サーバーを起動
pnpm dev

# テストを実行
pnpm test

# E2Eテストを実行
pnpm test:e2e

# ビルド
pnpm build
```

### 基本的な使用方法

```tsx
import { Whiteboard } from '@usketch/react-canvas';
import { useWhiteboardStore } from '@usketch/store';
import { ShapePluginProvider } from '@usketch/shape-registry';
import { rectanglePlugin, ellipsePlugin, freedrawPlugin } from '@usketch/shape-plugins';

function App() {
  const plugins = [rectanglePlugin, ellipsePlugin, freedrawPlugin];

  return (
    <ShapePluginProvider plugins={plugins}>
      <div style={{ width: '100vw', height: '100vh' }}>
        <Whiteboard 
          backgroundType="grid"
          enableGridSnap={true}
        />
      </div>
    </ShapePluginProvider>
  );
}
```

### 描画ツールの使用例

```tsx
import { useWhiteboardStore } from '@usketch/store';
import { useToolMachine } from '@usketch/tools';

function ToolBar() {
  const { selectedTool, setSelectedTool } = useWhiteboardStore();
  const toolMachine = useToolMachine();

  const tools = [
    { id: 'select', label: '選択' },
    { id: 'rectangle', label: '矩形' },
    { id: 'ellipse', label: '楕円' },
    { id: 'freedraw', label: 'フリーハンド' },
  ];

  return (
    <div>
      {tools.map(tool => (
        <button
          key={tool.id}
          onClick={() => setSelectedTool(tool.id)}
          className={selectedTool === tool.id ? 'active' : ''}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}
```

### プラグインシステムの拡張例

```tsx
import { createShapePlugin } from '@usketch/shape-registry';
import { BaseShape } from '@usketch/shape-abstraction';

// カスタム形状プラグインの作成
const customShapePlugin = createShapePlugin({
  type: 'custom-shape',
  component: CustomShapeComponent,
  defaultProps: {
    width: 100,
    height: 100,
    style: { fill: '#ff0000' }
  },
  validator: (props) => {
    // Zodスキーマで検証
    return customShapeSchema.parse(props);
  }
});

// プラグインを登録して使用
<ShapePluginProvider plugins={[...defaultPlugins, customShapePlugin]}>
  <Whiteboard />
</ShapePluginProvider>
```

### 状態マシンの活用例

```tsx
import { useMachine } from '@xstate/react';
import { selectToolMachine } from '@usketch/tools/machines/select-tool';

function SelectTool() {
  const [state, send] = useMachine(selectToolMachine);

  // 現在の状態に応じた処理
  if (state.matches('selecting')) {
    // 選択中の処理
  } else if (state.matches('moving')) {
    // 移動中の処理
  } else if (state.matches('resizing')) {
    // リサイズ中の処理
  }

  return (
    <div>
      現在の状態: {state.value}
    </div>
  );
}
```

## 🏗️ アーキテクチャ

### 技術スタック

- **React 19**: 最新のReact機能を活用
- **TypeScript 5.8**: 完全な型安全性
- **XState 5**: 複雑な状態管理とツールシステム
- **Zustand 5**: グローバル状態管理
- **Zod 4**: スキーマ検証とバリデーション
- **Vite 7**: 高速開発サーバーとバンドル
- **Vitest**: ユニットテスト
- **Playwright**: E2Eテストフレームワーク
- **Biome**: 高速なリンター/フォーマッター
- **Turborepo**: モノレポ管理とビルド最適化

### パッケージ構成

```
┌──────────────────────────────────────────────────────┐
│                    アプリケーション層                     │
│              @usketch/app (メインアプリ)                 │
└──────────────────────────────────────────────────────┘
                           │
┌──────────────────────────────────────────────────────┐
│                    統合層                              │
│         @usketch/react-canvas (Canvas統合)             │
└──────────────────────────────────────────────────────┘
                    │              │
┌───────────────────────┐  ┌────────────────────────┐
│     ツールシステム       │  │    形状システム          │
│  @usketch/tools        │  │  @usketch/shape-*      │
│  (XState状態マシン)      │  │  (プラグインアーキテクチャ) │
└───────────────────────┘  └────────────────────────┘
                    │              │
┌──────────────────────────────────────────────────────┐
│                    基盤層                              │
│  @usketch/store (Zustand)                             │
│  @usketch/shared-types | @usketch/shared-utils        │
└──────────────────────────────────────────────────────┘
```

## 📚 開発ロードマップ

### ✅ フェーズ0: MVP完成
- ✅ プロジェクトセットアップ
- ✅ 基本キャンバス + ズーム/パン
- ✅ シェイプ選択・移動
- ✅ 座標変換システム

### ✅ フェーズ1: 基本描画機能 
- ✅ 長方形・楕円・直線の描画
- ✅ シェイプのリサイズ
- ✅ Undo/Redoシステム
- ✅ フリーハンド描画
- ✅ テキスト追加
- ✅ 複数選択

### 🔄 フェーズ2: 高度な機能 (開発中)
- 📋 テキスト編集機能の強化
- 📋 データ保存/読込 (JSON/画像エクスポート)
- 📋 レイヤー管理
- 📋 グループ化/グループ解除
- 📋 整列・配置ツール
- 📋 コピー&ペースト

### 📋 フェーズ3: コラボレーション機能
- 📋 リアルタイム同期
- 📋 カーソル共有
- 📋 コメント機能
- 📋 バージョン管理

## 🛠️ 開発に参加する

### 環境構築

```bash
# リポジトリをクローン
git clone [repository-url]
cd dom-base-whiteboard-handson

# 依存関係をインストール
pnpm install

# 開発サーバーを起動
pnpm dev
```

### プロジェクト構造

```
dom-base-whiteboard-handson/
├── apps/
│   ├── whiteboard/           # メインReactアプリケーション
│   └── e2e/                 # E2Eテスト (Playwright)
├── packages/
│   ├── react-canvas/        # Canvasコンポーネント統合
│   ├── tools/              # XState状態マシン駆動ツール
│   ├── store/              # Zustandグローバル状態管理
│   ├── shape-abstraction/  # 基底形状クラス
│   ├── react-shapes/       # React形状コンポーネント
│   ├── shape-registry/     # 形状プラグイン管理
│   ├── shape-plugins/      # 標準形状プラグイン
│   ├── background-presets/ # 背景コンポーネント
│   ├── ui-components/      # UI部品
│   ├── shared-types/       # 共通型定義
│   ├── shared-utils/       # ユーティリティ関数
│   ├── test-utils/         # テストヘルパー
│   ├── e2e-tests/          # E2E共通設定
│   ├── tsconfig/           # TypeScript設定
│   └── vite-config/        # Vite共通設定
└── docs/                   # ドキュメント
```

### コミット規約

```bash
# Gitmojiを使用したコミットメッセージ
✨ feat: 新機能追加
🐛 fix: バグ修正  
♻️ refactor: リファクタリング
🎨 style: フォーマット改善
⚡️ perf: パフォーマンス改善
✅ test: テスト追加・修正
📝 docs: ドキュメント更新
```

## 📖 詳細情報

- [📋 開発計画書](./PLAN.md): 詳細な設計思想と実装計画
- [🏗️ アーキテクチャ](./docs/architecture/): システム設計の詳細
- [🔧 API仕様](./docs/api/): ライブラリのAPI詳細
- [👨‍💻 開発ガイド](./docs/development/): 開発者向けガイドライン

## 📄 ライセンス

ISC License

---

**tldrawに敬意を表して** - このライブラリはtldrawの優れたアーキテクチャ設計から多くのインスピレーションを得ています。
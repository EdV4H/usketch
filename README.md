# uSketch - React Whiteboard Library

**React向けの軽量・ヘッドレス ホワイトボードライブラリ**

tldrawのアーキテクチャを参考に、DOMベースで高性能なホワイトボード機能を提供するReact向けヘッドレスライブラリです。UIコンポーネントを含まず、開発者が自由にインターフェースを構築できます。

## ✨ 特徴

- **⚛️ React専用**: React向けに最適化されたAPI
- **🎯 ヘッドレス設計**: UIを含まず、ロジックのみを提供
- **⚡️ 高性能**: CSS Transform + DOM最適化による高速描画
- **🔧 柔軟性**: 自由なスタイリングとカスタマイズが可能
- **📦 軽量**: 必要最小限の依存関係
- **🎨 豊富な機能**: 描画、選択、移動、拡大縮小をサポート

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
import { Canvas } from '@usketch/canvas-core';
import { whiteboardStore } from '@usketch/store';
import { ToolBar } from '@usketch/ui-components';
import { useEffect, useRef } from 'react';

function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // キャンバスを初期化
    canvasRef.current = new Canvas(containerRef.current);

    // クリーンアップ
    return () => {
      canvasRef.current?.destroy();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* ツールバー */}
      <ToolBar />
      
      {/* キャンバス */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
```

### 描画ツールの使用例

```tsx
import { whiteboardStore } from '@usketch/store';
import { ToolType } from '@usketch/shared-types';

// ツールを切り替える
function selectTool(toolType: ToolType) {
  whiteboardStore.getState().setSelectedTool(toolType);
}

// 矩形ツールを選択
selectTool('rectangle');

// 楕円ツールを選択  
selectTool('ellipse');

// フリーハンドツールを選択
selectTool('pencil');
```

### シェイプの操作例

```tsx
import { whiteboardStore } from '@usketch/store';

// 現在の状態を取得
const state = whiteboardStore.getState();

// シェイプを追加
state.addShape({
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  style: {
    fill: '#3b82f6',
    stroke: '#1e40af',
    strokeWidth: 2,
  }
});

// シェイプを選択
state.selectShapes(['shape-id-1', 'shape-id-2']);

// 選択中のシェイプを移動
state.moveSelectedShapes(50, 30);

// 選択中のシェイプを削除
state.deleteSelectedShapes();

// Undo/Redo
state.undo();
state.redo();
```

### ビューポート操作例

```tsx
import { whiteboardStore } from '@usketch/store';

const viewport = whiteboardStore.getState().viewport;

// ズームイン/アウト
viewport.zoomIn();
viewport.zoomOut();

// 特定の倍率にズーム
viewport.setZoom(1.5);

// パン（画面移動）
viewport.pan(100, 50);

// ビューをリセット
viewport.reset();
```

## 🏗️ アーキテクチャ

### 技術スタック

- **React 18**: モダンなReactアプリケーション
- **TypeScript**: 型安全性とコード品質
- **Vite**: 高速開発サーバーとバンドル
- **Zustand**: 軽量状態管理
- **Playwright**: E2Eテストフレームワーク
- **Biome**: 高速なリンター/フォーマッター

### 主要コンポーネント

```
┌─────────────────────────────────────────────────┐
│                ユーザーアプリ                      │
│              (UI + スタイリング)                   │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              ホワイトボードAPI                     │
│            (ヘッドレスライブラリ)                   │
├─────────────────────────────────────────────────┤
│  ツールシステム  │  状態管理   │   描画エンジン     │
│  (選択/移動/描画) │ (Zustand)  │ (DOM + CSS Transform)│
└─────────────────────────────────────────────────┘
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
│   ├── whiteboard/     # Reactアプリケーション
│   └── e2e/           # E2Eテスト (Playwright)
├── packages/
│   ├── canvas-core/    # キャンバスコア機能
│   ├── tools/         # 描画・操作ツール
│   ├── store/         # Zustand状態管理
│   ├── ui-components/ # React UIコンポーネント
│   ├── shared-types/  # 共通型定義
│   ├── shared-utils/  # 共通ユーティリティ
│   ├── test-utils/    # テストユーティリティ
│   ├── e2e-tests/     # E2Eテスト設定
│   ├── tsconfig/      # TypeScript設定
│   └── vite-config/   # Vite共通設定
└── docs/              # ドキュメント
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
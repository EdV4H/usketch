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

## 🎨 フェーズ0 機能 (MVP)

現在開発中のコア機能:

### ✅ ビュー機能
- [x] DOMベースキャンバス表示
- [x] 背景グリッド
- [x] ズーム機能 (マウスホイール)
- [x] パン機能 (ドラッグでの画面移動)

### ✅ 操作機能  
- [x] シェイプの選択 (クリック)
- [x] 選択シェイプの移動 (ドラッグ)

### ✅ 状態管理
- [x] 最小限の状態管理システム
- [x] 座標変換 (ワールド ↔ スクリーン)

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
import { useEffect, useRef } from 'react';

function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // キャンバスを初期化
    canvasRef.current = new Canvas(containerRef.current);

    // シェイプを追加
    whiteboardStore.getState().addShape({
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });

    // クリーンアップ
    return () => {
      canvasRef.current?.destroy();
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
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

### フェーズ0: MVP完成 (進行中)
- ✅ プロジェクトセットアップ
- ✅ 基本キャンバス + ズーム/パン
- ✅ シェイプ選択・移動
- 🔄 座標変換最適化

### フェーズ1: 基本描画機能
- 📋 長方形・楕円・直線の描画
- 📋 シェイプのリサイズ
- 📋 Undo/Redoシステム

### フェーズ2: 高度な機能  
- 📋 フリーハンド描画
- 📋 テキスト編集
- 📋 複数選択
- 📋 データ保存/読込

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
│   └── e2e/           # E2Eテスト
├── packages/
│   ├── canvas-core/    # キャンバスコア機能
│   ├── drawing-tools/  # 描画ツール
│   ├── store/         # 状態管理
│   ├── ui-components/ # UIコンポーネント
│   ├── shared-types/  # 共通型定義
│   └── shared-utils/  # 共通ユーティリティ
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
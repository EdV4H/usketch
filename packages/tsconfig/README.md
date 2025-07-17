# @whiteboard/tsconfig

共有TypeScript設定パッケージ

## 概要

このパッケージは、Whiteboardモノレポ内のすべてのパッケージで使用される共通のTypeScript設定を提供します。

## 設定ファイル

### tsconfig.base.json
すべての設定の基盤となる共通設定。厳格な型チェックとモダンなJavaScript機能を有効化。

### tsconfig.app.json
アプリケーション用の設定。Viteなどのバンドラーと連携し、開発体験を優先。

### tsconfig.lib.json
ライブラリパッケージ用の設定。型定義の生成とプロジェクトリファレンスを有効化。

### tsconfig.test.json
テスト環境用の設定。VitestとPlaywrightに最適化され、テスト固有の型を含む。

## 使用方法

### アプリケーションでの使用
```json
{
  "extends": "@whiteboard/tsconfig/app",
  "include": ["src"]
}
```

### ライブラリでの使用
```json
{
  "extends": "@whiteboard/tsconfig/lib",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### テストでの使用
```json
{
  "extends": "@whiteboard/tsconfig/test",
  "include": ["**/*.test.ts", "**/*.spec.ts"]
}
```

## 主要な設定の詳細

### Base設定の特徴
- **ターゲット**: ES2022（最新のJavaScript機能）
- **厳格モード**: すべての厳格な型チェックオプションを有効化
- **モジュール**: ESNext（最新のモジュール構文）
- **分離モジュール**: バンドラーとの互換性のため有効化

### App設定の特徴
- バンドラー向けのモジュール解決
- 型定義の生成を無効化（バンドラーが処理）
- パスエイリアスの設定
- 開発中の利便性のため一部の警告を緩和

### Lib設定の特徴
- 型定義ファイルの生成
- プロジェクトリファレンスのサポート
- インクリメンタルビルドの有効化
- より厳格な型チェック

### Test設定の特徴
- テストフレームワークの型を自動的に含む
- テストファイルのパターンを包括的にカバー
- テスト環境に合わせた緩和された設定

## カスタマイズ

各パッケージで必要に応じて設定をオーバーライドできます：

```json
{
  "extends": "@whiteboard/tsconfig/lib",
  "compilerOptions": {
    "target": "ES2019",  // 古いNode.jsバージョン対応
    "lib": ["ES2019"]    // 対応するライブラリ
  }
}
```
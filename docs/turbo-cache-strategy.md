# Turborepo キャッシュ戦略

## 概要

Turborepoのキャッシュシステムを最大限活用し、ビルド時間を短縮するための戦略を定義します。

## キャッシュの基本原理

Turborepoは以下の要素を組み合わせてキャッシュキーを生成します：
- タスク名
- 依存関係のハッシュ
- 入力ファイルのハッシュ
- 環境変数
- 出力ディレクトリ

## パイプライン別キャッシュ戦略

### 1. Build タスク
```json
{
  "build": {
    "cache": true,
    "inputs": [
      "src/**/*.ts",
      "src/**/*.tsx",
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      "!**/*.test.*",
      "!**/*.spec.*"
    ],
    "outputs": ["dist/**"],
    "env": ["NODE_ENV", "VITE_*"]
  }
}
```

**戦略**:
- ソースコードとビルド設定のみを入力として定義
- テストファイルは除外してキャッシュヒット率を向上
- 環境変数は必要最小限に限定

### 2. Test タスク
```json
{
  "test": {
    "cache": true,
    "inputs": ["src/**", "tests/**", "vitest.config.ts"],
    "outputs": ["coverage/**"]
  }
}
```

**戦略**:
- テスト実行はキャッシュ可能
- カバレッジレポートも出力として保存
- CI環境での再実行を防ぐ

### 3. E2E Test タスク
```json
{
  "test:e2e": {
    "cache": false,
    "dependsOn": ["build"]
  }
}
```

**戦略**:
- E2Eテストは環境依存が高いためキャッシュ無効
- ただし、依存するビルドタスクはキャッシュされる

### 4. Dev タスク
```json
{
  "dev": {
    "cache": false,
    "persistent": true
  }
}
```

**戦略**:
- 開発サーバーはキャッシュ不要
- `persistent: true`で長時間実行タスクとして設定

## グローバル設定

### 環境変数
```json
{
  "globalEnv": ["CI", "TZ", "NODE_ENV"],
  "globalDependencies": [".env", ".env.local", "tsconfig.json"]
}
```

**戦略**:
- グローバル環境変数は最小限に
- ローカル環境ファイルの変更も追跡

### キャッシュディレクトリ
```json
{
  "cacheDir": ".turbo",
  "daemon": true
}
```

**戦略**:
- ローカルキャッシュは`.turbo`ディレクトリに保存
- デーモンモードでファイル監視を効率化

## 最適化テクニック

### 1. 入力ファイルの精密な指定
```json
"inputs": [
  "src/**/*.ts",
  "!src/**/*.test.ts",
  "!src/**/*.stories.ts"
]
```
- 不要なファイルを除外してキャッシュヒット率を向上

### 2. 出力ディレクトリの明確な定義
```json
"outputs": ["dist/**", "build/**", ".next/**"]
```
- すべての生成物を指定してキャッシュから正確に復元

### 3. 依存関係の最適化
```json
"dependsOn": ["^build"]  // 依存パッケージのビルドのみ
```
- 必要な依存関係のみを指定

### 4. パッケージ別の設定オーバーライド
各パッケージの`package.json`で個別設定が可能：
```json
{
  "turbo": {
    "pipeline": {
      "build": {
        "outputs": ["lib/**", "es/**"]
      }
    }
  }
}
```

## リモートキャッシュ戦略

### Vercel Remote Cache（推奨）
```bash
npx turbo link
npx turbo run build --team=my-team --token=$TURBO_TOKEN
```

### 自前のキャッシュサーバー
```json
{
  "remoteCache": {
    "signature": true,
    "url": "https://cache.example.com"
  }
}
```

## CI/CD統合

### GitHub Actions設定例
```yaml
- name: Setup Turbo Cache
  uses: actions/cache@v3
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ github.sha }}
    restore-keys: |
      turbo-${{ runner.os }}-

- name: Build
  run: pnpm turbo build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

## キャッシュ無効化戦略

### 手動無効化
```bash
# 特定タスクのキャッシュをクリア
pnpm turbo run build --force

# すべてのキャッシュをクリア
rm -rf .turbo
```

### 自動無効化トリガー
- `package.json`の依存関係変更
- グローバル設定ファイルの変更
- 環境変数の変更

## モニタリングとデバッグ

### キャッシュヒット率の確認
```bash
pnpm turbo run build --dry-run
```

### 詳細ログの出力
```bash
pnpm turbo run build --verbosity=2
```

### キャッシュ分析
```bash
pnpm turbo run build --profile=profile.json
```

## ベストプラクティス

1. **入力の最小化**: 必要最小限のファイルのみを入力として指定
2. **出力の完全性**: すべての生成物を出力として指定
3. **環境変数の制限**: キャッシュに影響する環境変数は最小限に
4. **定期的な分析**: キャッシュヒット率を定期的に確認
5. **段階的な導入**: 最初は保守的な設定から始めて徐々に最適化

## 期待される効果

- **初回ビルド**: ベースライン（キャッシュなし）
- **2回目以降**: 80-95%のキャッシュヒット率
- **CI環境**: リモートキャッシュで50-70%の時間短縮
- **ローカル開発**: 変更箇所のみ再ビルドで90%以上の時間短縮
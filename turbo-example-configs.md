# Turborepo 設定例集

## 基本的なturbo.json（推奨構成）

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true,
      "outputs": ["coverage/**"]
    },
    "lint": {
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

## monorepo構成でのパッケージ別設定

### apps/whiteboard/package.json
```json
{
  "name": "@whiteboard/app",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "turbo": {
    "pipeline": {
      "build": {
        "outputs": ["dist/**"],
        "env": ["VITE_API_URL", "VITE_APP_TITLE"]
      }
    }
  }
}
```

### packages/canvas-core/package.json
```json
{
  "name": "@whiteboard/canvas-core",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "test": "vitest"
  },
  "turbo": {
    "pipeline": {
      "build": {
        "outputs": ["dist/**", "lib/**"]
      }
    }
  }
}
```

### apps/e2e/package.json
```json
{
  "name": "@whiteboard/e2e",
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  },
  "turbo": {
    "pipeline": {
      "test:e2e": {
        "dependsOn": ["@whiteboard/app#build"],
        "cache": false,
        "env": ["BASE_URL", "CI"]
      }
    }
  }
}
```

## 高度な設定パターン

### 1. 条件付きビルド
```json
{
  "pipeline": {
    "build:production": {
      "dependsOn": ["^build:production", "test", "lint"],
      "outputs": ["dist/**"],
      "env": ["NODE_ENV"]
    },
    "build:development": {
      "dependsOn": ["^build:development"],
      "outputs": ["dist/**"],
      "env": ["NODE_ENV", "DEBUG"]
    }
  }
}
```

### 2. 並列実行の最適化
```json
{
  "pipeline": {
    "check": {
      "dependsOn": ["lint", "typecheck", "test:unit"]
    },
    "lint": {
      "cache": true
    },
    "typecheck": {
      "cache": true
    },
    "test:unit": {
      "cache": true,
      "outputs": ["coverage/**"]
    }
  }
}
```

### 3. モノレポ内の特定パッケージ指定
```json
{
  "pipeline": {
    "deploy": {
      "dependsOn": [
        "@whiteboard/app#build",
        "@whiteboard/api#build"
      ],
      "cache": false
    }
  }
}
```

### 4. 環境別設定
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "env": {
        "production": ["NODE_ENV", "API_KEY"],
        "development": ["NODE_ENV", "DEBUG", "VERBOSE"]
      }
    }
  }
}
```

## ルートpackage.jsonのスクリプト例

```json
{
  "scripts": {
    // 基本コマンド
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    
    // フィルター付きコマンド
    "dev:app": "turbo run dev --filter=@whiteboard/app",
    "build:packages": "turbo run build --filter='./packages/*'",
    "test:changed": "turbo run test --filter='...[origin/main]'",
    
    // 並列実行
    "check:all": "turbo run lint typecheck test:unit --parallel",
    
    // キャッシュ制御
    "build:fresh": "turbo run build --force",
    "build:dry": "turbo run build --dry-run",
    
    // プロファイリング
    "build:profile": "turbo run build --profile=profile.json",
    
    // CI用コマンド
    "ci:build": "turbo run build --cache-dir=.turbo-ci",
    "ci:test": "turbo run test --cache-dir=.turbo-ci"
  }
}
```

## フィルターパターンの例

```bash
# 特定パッケージのみ
turbo run build --filter=@whiteboard/canvas-core

# ディレクトリベース
turbo run test --filter='./packages/*'

# 依存関係を含む
turbo run build --filter=@whiteboard/app...

# 依存元を含む
turbo run test --filter=...@whiteboard/shared-types

# 変更されたパッケージ
turbo run test --filter='...[origin/main]'

# 複数条件
turbo run build --filter='@whiteboard/app' --filter='@whiteboard/api'
```

## CI/CD設定例

### GitHub Actions
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm turbo build --cache-dir=.turbo-ci
      
      - name: Test
        run: pnpm turbo test --cache-dir=.turbo-ci
```

### Vercel設定
```json
{
  "buildCommand": "pnpm turbo build --filter=@whiteboard/app",
  "outputDirectory": "apps/whiteboard/dist",
  "installCommand": "pnpm install",
  "framework": null
}
```

## トラブルシューティング用設定

### デバッグモード
```json
{
  "daemon": false,
  "experimentalUI": false,
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true,
      "outputMode": "full"
    }
  }
}
```

### キャッシュ検証
```bash
# キャッシュ状態の確認
turbo run build --dry-run --graph

# キャッシュの詳細情報
turbo run build --verbosity=2

# キャッシュミスの調査
turbo run build --force --profile=cache-miss.json
```
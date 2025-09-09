# TypeScript/TSXファイル命名規則の強制

## 概要

このプロジェクトでは、TypeScript（`.ts`）およびTSX（`.tsx`）ファイルの命名規則として**kebab-case**を採用します。この規則を確実に守るため、Push前のフック処理とCI/CDパイプラインでの自動チェックを実装します。

## 命名規則

### 対象ファイル
- `.ts` ファイル
- `.tsx` ファイル

### 命名パターン
- **必須**: kebab-case（例: `user-profile.ts`, `header-component.tsx`, `api-v2.ts`, `utils-123.tsx`）
- **禁止**: 
  - camelCase（例: ~~`userProfile.ts`~~）
  - PascalCase（例: ~~`UserProfile.ts`~~）
  - snake_case（例: ~~`user_profile.ts`~~）
- **数字の扱い**: 数字は許可されるが、適切に区切る（例: `component-v2.tsx`, `test-123.ts`）

### 例外
- 設定ファイル（例: `next.config.ts`, `vite.config.ts`）
- 型定義ファイル（例: `*.d.ts`）
- テストファイル（例: `*.test.ts`, `*.spec.ts`）は対象だが、元ファイル名に従う

## 実装方法

### 1. ESLintルールによる検出

#### 必要なパッケージ
```json
{
  "devDependencies": {
    "eslint-plugin-filenames-simple": "^0.9.0"
  }
}
```

#### ESLint設定（`.eslintrc.json`）
```json
{
  "plugins": ["filenames-simple"],
  "rules": {
    "filenames-simple/naming-convention": [
      "error",
      {
        "rule": "kebab-case",
        "match": "\\.tsx?$"
      }
    ]
  }
}
```

### 2. Git Pre-commitフック

#### Huskyの設定
```bash
npm install --save-dev husky lint-staged
npx husky init
```

#### `.husky/pre-commit`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# ファイル名チェック
npm run check:filenames

# ESLintチェック
npx lint-staged
```

#### `package.json`のスクリプト
```json
{
  "scripts": {
    "check:filenames": "node scripts/check-filenames.js",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "npm run check:filenames",
      "eslint --fix"
    ]
  }
}
```

### 3. カスタムスクリプト

#### `scripts/check-filenames.js`
```javascript
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// kebab-case パターン（数字も許可）
const kebabCasePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 例外ファイルのパターン
const exceptions = [
  /^next\.config\.ts$/,
  /^vite\.config\.ts$/,
  /^jest\.config\.ts$/,
  /^postcss\.config\.ts$/,
  /\.d\.ts$/
];

function checkFilenames() {
  const errors = [];
  
  // TypeScript/TSXファイルを検索
  const files = glob.sync('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**']
  });

  files.forEach(filePath => {
    const filename = path.basename(filePath, path.extname(filePath));
    
    // 例外チェック
    const basename = path.basename(filePath);
    const isException = exceptions.some(pattern => pattern.test(basename));
    
    if (!isException && !kebabCasePattern.test(filename)) {
      errors.push(filePath);
    }
  });

  if (errors.length > 0) {
    console.error('❌ 以下のファイルがkebab-case命名規則に違反しています:');
    errors.forEach(file => {
      const filename = path.basename(file);
      const suggested = filename
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
        .replace(/_/g, '-');
      console.error(`  ${file}`);
      console.error(`    → 推奨: ${suggested}`);
    });
    process.exit(1);
  }

  console.log('✅ すべてのTypeScript/TSXファイルがkebab-case命名規則に準拠しています');
}

checkFilenames();
```

### 4. GitHub Actions CI設定

#### `.github/workflows/check-filenames.yml`
```yaml
name: Check Filename Convention

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches:
      - main
      - develop

jobs:
  check-filenames:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Check TypeScript/TSX filenames
        run: npm run check:filenames
        
      - name: Run ESLint filename rules
        run: npm run lint
```

### 5. VS Code設定（推奨）

#### `.vscode/settings.json`
```json
{
  "files.autoSave": "onFocusChange",
  "[typescript]": {
    "editor.formatOnSave": true
  },
  "[typescriptreact]": {
    "editor.formatOnSave": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "eslint.run": "onType"
}
```

## 既存ファイルの移行計画

### Phase 1: 検出とリスト作成
```bash
# 違反ファイルのリストを生成
npm run check:filenames > filename-violations.txt
```

### Phase 2: 自動リネームスクリプト
```javascript
// scripts/rename-files.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');

function toKebabCase(str) {
  return str
    // PascalCase/camelCaseの処理
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    // 数字の前後に区切りを追加
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .replace(/([0-9])([a-zA-Z])/g, '$1-$2')
    // すべて小文字に変換
    .toLowerCase()
    // アンダースコアをハイフンに変換
    .replace(/_/g, '-')
    // 重複するハイフンを単一に
    .replace(/-+/g, '-')
    // 先頭と末尾のハイフンを削除
    .replace(/^-|-$/g, '');
}

function renameFiles() {
  const files = glob.sync('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**', 'build/**']
  });

  const renames = [];
  
  files.forEach(filePath => {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const filename = path.basename(filePath, ext);
    const newFilename = toKebabCase(filename);
    
    if (filename !== newFilename) {
      const newPath = path.join(dir, newFilename + ext);
      renames.push({ from: filePath, to: newPath });
    }
  });

  // Git mvコマンドを生成
  renames.forEach(({ from, to }) => {
    console.log(`git mv "${from}" "${to}"`);
  });
}

renameFiles();
```

### Phase 3: インポート文の更新
リネーム後、プロジェクト全体のインポート文を更新する必要があります。

## トラブルシューティング

### よくある問題と解決方法

1. **既存のPascalCaseコンポーネントファイル**
   - 解決: 段階的な移行プランを作成し、チーム全体で合意を得る

2. **Next.jsの動的ルート**
   - 解決: `[id].tsx`のような動的ルートファイルは例外として扱う

3. **テストファイルの命名**
   - 解決: `component-name.test.tsx`のパターンを使用

## チームへの導入手順

1. **チーム全体への周知**
   - 命名規則の重要性を説明
   - 移行計画の共有

2. **段階的な導入**
   - 新規ファイルから適用開始
   - 既存ファイルは計画的に移行

3. **CI/CDの有効化**
   - まずは警告モードで開始
   - 2週間後にエラーモードに移行

## メンテナンス

### 定期的な確認項目
- [ ] ESLintルールの更新確認
- [ ] 例外リストの見直し
- [ ] CI実行時間の最適化
- [ ] チームフィードバックの収集

## 参考資料

- [ESLint Plugin Filenames Simple](https://github.com/epaew/eslint-plugin-filenames-simple)
- [Husky - Git Hooks](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
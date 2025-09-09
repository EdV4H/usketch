# TypeScript/TSXファイル命名規則の強制

## 概要

このプロジェクトでは、TypeScript（`.ts`）およびTSX（`.tsx`）ファイルの命名規則として**kebab-case**を採用します。この規則を確実に守るため、Push前のフック処理とCI/CDパイプラインでの自動チェックを実装します。

## 命名規則

### 対象ファイル
- `.ts` ファイル
- `.tsx` ファイル

### 命名パターン
- **必須**: kebab-case（例: `user-profile.ts`, `header-component.tsx`, `api-v2.ts`, `utils-123.tsx`）
- **許可される特殊ケース**:
  - 単一文字ファイル（例: `a.ts`, `x.tsx`, `1.ts`）
  - 数字を含むファイル（例: `component-v2.tsx`, `test-123.ts`）
- **禁止**: 
  - camelCase（例: ~~`userProfile.ts`~~）
  - PascalCase（例: ~~`UserProfile.ts`~~）
  - snake_case（例: ~~`user_profile.ts`~~）

### 例外
- 設定ファイル（例: `next.config.ts`, `vite.config.ts`）
- 型定義ファイル（例: `*.d.ts`）
- テストファイル（例: `*.test.ts`, `*.spec.ts`）は対象だが、元ファイル名に従う

## 実装方法

### 1. カスタムスクリプトによる検出

**注意**: このプロジェクトではBiomeを使用しているため、ESLintプラグインは使用しません。
Biomeには現在ファイル名規則を強制する機能がないため、カスタムスクリプトで実装します。

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

# Biomeチェック
npx lint-staged
```

#### `package.json`のスクリプト
```json
{
  "scripts": {
    "check:filenames": "node scripts/check-filenames.js",
    "biome:check": "biome check",
    "biome:fix": "biome check --write"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "biome check --write"
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

// kebab-case パターン（数字も許可、単一文字も許可）
// 例: 'a.ts', '1.ts', 'api-v2.ts', 'test-123.tsx'
const kebabCasePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 例外ファイルのパターン
const exceptions = [
  /^next\.config\.ts$/,
  /^vite\.config\.ts$/,
  /^jest\.config\.ts$/,
  /^postcss\.config\.ts$/,
  /\.d\.ts$/
];

function checkFilenames(specificFiles = []) {
  const errors = [];
  
  // ファイルリストを取得
  // 引数が指定されている場合はそれを使用、なければ全体をスキャン
  const files = specificFiles.length > 0 
    ? specificFiles.filter(f => /\.(ts|tsx)$/.test(f))
    : glob.sync('**/*.{ts,tsx}', {
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
      const ext = path.extname(file);
      const nameWithoutExt = path.basename(file, ext);
      // toKebabCase関数と同じロジックを使用
      const parts = nameWithoutExt
        .replace(/_/g, '-')
        .match(/([A-Z]+(?=[A-Z][a-z0-9])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+)/g);
      const suggested = parts
        ? parts.map(s => s.toLowerCase()).join('-') + ext
        : nameWithoutExt.toLowerCase() + ext;
      console.error(`  ${file}`);
      console.error(`    → 推奨: ${suggested}`);
    });
    process.exit(1);
  }

  const message = specificFiles.length > 0
    ? `✅ 指定されたTypeScript/TSXファイルがkebab-case命名規則に準拠しています`
    : `✅ すべてのTypeScript/TSXファイルがkebab-case命名規則に準拠しています`;
  console.log(message);
}

// コマンドライン引数を取得（node scripts/check-filenames.js file1.ts file2.tsx ...）
const args = process.argv.slice(2);
checkFilenames(args);
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
        
      - name: Run Biome check
        run: npm run biome:check
```

### 5. VS Code設定（推奨）

#### `.vscode/settings.json`
```json
{
  "files.autoSave": "onFocusChange",
  "[typescript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "biomejs.biome"
  },
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
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
  // アクロニム（複数の大文字）、小文字、数字のグループにマッチ
  // 例: 'API2Service' -> ['API', '2', 'Service']
  // 'XMLHttpRequest' -> ['XML', 'Http', 'Request']
  const parts = str
    .replace(/_/g, '-') // アンダースコアをハイフンとして扱う
    .match(/([A-Z]+(?=[A-Z][a-z0-9])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+)/g);
  
  if (!parts) return str.toLowerCase();
  
  return parts
    .map(s => s.toLowerCase())
    .join('-')
    .replace(/-+/g, '-') // 重複するハイフンを単一に
    .replace(/^-|-$/g, ''); // 先頭・末尾のハイフンを削除
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
- [ ] Biomeのファイル名ルール機能の追加確認
- [ ] 例外リストの見直し
- [ ] CI実行時間の最適化
- [ ] チームフィードバックの収集

## 参考資料

- [Biome - Fast Formatter and Linter](https://biomejs.dev/)
- [Husky - Git Hooks](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [Biome VS Code Extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
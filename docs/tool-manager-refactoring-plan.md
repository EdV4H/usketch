# ToolManager リファクタリング計画書

## 概要

現在のToolManagerクラスは、内部でツールを固定的に生成していますが、これをconstructorで外部からツール一覧を受け取る形にリファクタリングし、カスタマイズ性と拡張性を向上させます。

## 現状の問題点

### 1. 固定的なツール定義
```typescript
// 現在の実装 - ツールがハードコーディングされている
constructor() {
  const selectTool = createSelectTool();
  const rectangleTool = createRectangleTool();
  const drawingTool = createDrawingTool();
  
  const toolManagerMachine = createToolManager({
    select: selectTool,
    rectangle: rectangleTool,
    draw: drawingTool,
  });
}
```

### 2. 拡張性の制限
- 新しいツールを追加する際にToolManagerクラス自体を修正する必要がある
- アプリケーション側でツールをカスタマイズできない
- ツールの有効/無効を動的に制御できない

### 3. 依存関係の問題
- ToolManagerが具体的なツール実装に依存している
- テスト時にモックツールを注入できない

### 4. ツール固有ロジックの混在
- selectTool専用の選択処理がToolManager内にハードコーディング
- rectangle/drawツール専用の処理も存在
- ツールごとの振る舞いがToolManagerに漏れ出している

## リファクタリング設計

### 1. Zodスキーマによる型定義と検証

```typescript
import { z } from 'zod';
import type { AnyStateMachine } from 'xstate';

// Zodスキーマ定義
export const ToolConfigSchema = z.object({
  id: z.string().min(1, 'Tool ID is required'),
  machine: z.custom<AnyStateMachine>(
    (val) => val && typeof val === 'object',
    { message: 'Invalid XState machine' }
  ),
  displayName: z.string().optional(),
  icon: z.string().optional(),
  shortcut: z.string().max(1, 'Shortcut must be a single character').optional(),
  enabled: z.boolean().default(true),
  metadata: z.object({
    author: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
  
  // ツール固有の振る舞いを定義
  behaviors: z.object({
    // ツール切り替え時の処理
    onActivate: z.function()
      .args(z.object({ store: z.any(), previousToolId: z.string().optional() }))
      .returns(z.void())
      .optional(),
    onDeactivate: z.function()
      .args(z.object({ store: z.any(), nextToolId: z.string() }))
      .returns(z.void())
      .optional(),
    
    // イベント前処理（trueを返すとデフォルト処理をスキップ）
    beforePointerDown: z.function()
      .args(z.object({ event: z.any(), worldPos: z.any(), store: z.any() }))
      .returns(z.boolean())
      .optional(),
    beforePointerUp: z.function()
      .args(z.object({ event: z.any(), worldPos: z.any(), store: z.any() }))
      .returns(z.boolean())
      .optional(),
    
    // Shape作成後の処理
    onShapeCreated: z.function()
      .args(z.object({ shape: z.any(), store: z.any() }))
      .returns(z.void())
      .optional(),
  }).optional(),
});

export const ToolManagerOptionsSchema = z.object({
  tools: z.array(ToolConfigSchema).min(1, 'At least one tool is required'),
  defaultToolId: z.string().optional(),
  onToolChange: z.function()
    .args(z.string())
    .returns(z.void())
    .optional(),
  validateOnAdd: z.boolean().default(true),
  allowDuplicates: z.boolean().default(false),
});

// 型の自動生成
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type ToolManagerOptions = z.infer<typeof ToolManagerOptionsSchema>;
```

### 2. 新しいToolManagerクラス設計（Zod検証付き）

```typescript
export class ToolManager {
  private toolManagerActor: Actor<AnyStateMachine>;
  private currentToolId: string;
  private toolConfigs: Map<string, ToolConfig>;
  private options: ToolManagerOptions;

  constructor(options: unknown) {
    // Zodによる入力検証
    const validatedOptions = ToolManagerOptionsSchema.parse(options);
    this.options = validatedOptions;
    this.toolConfigs = new Map();
    
    // ツール設定を検証して保存
    validatedOptions.tools.forEach(config => {
      if (config.enabled !== false) {
        this.validateAndAddTool(config);
      }
    });
    
    // 少なくとも1つのツールが必要
    if (this.toolConfigs.size === 0) {
      throw new Error('At least one enabled tool is required');
    }
    
    // ツールマシンを作成
    const toolMachines = Object.fromEntries(
      Array.from(this.toolConfigs.entries()).map(([id, config]) => [id, config.machine])
    );
    
    // ToolManagerマシンを作成
    const toolManagerMachine = createToolManager(toolMachines);
    this.toolManagerActor = createActor(toolManagerMachine);
    this.toolManagerActor.start();
    
    // デフォルトツールを検証して設定
    const defaultToolId = this.validateDefaultToolId(
      validatedOptions.defaultToolId || validatedOptions.tools[0]?.id
    );
    this.setActiveTool(defaultToolId);
  }
  
  private validateAndAddTool(config: unknown): void {
    const validated = ToolConfigSchema.parse(config);
    
    // 重複チェック
    if (!this.options.allowDuplicates && this.toolConfigs.has(validated.id)) {
      throw new Error(`Tool with id "${validated.id}" already exists`);
    }
    
    this.toolConfigs.set(validated.id, validated);
  }
  
  private validateDefaultToolId(toolId: string | undefined): string {
    if (!toolId) {
      const firstTool = Array.from(this.toolConfigs.keys())[0];
      if (!firstTool) {
        throw new Error('No tools available to set as default');
      }
      return firstTool;
    }
    
    if (!this.toolConfigs.has(toolId)) {
      throw new Error(`Default tool "${toolId}" not found in available tools`);
    }
    
    return toolId;
  }
  
  // ツール切り替え処理（リファクタリング版）
  setActiveTool(toolId: string, updateStore = true): void {
    const previousToolId = this.currentToolId;
    const previousTool = this.toolConfigs.get(previousToolId);
    const nextTool = this.toolConfigs.get(toolId);
    
    if (!nextTool) {
      throw new Error(`Tool "${toolId}" not found`);
    }
    
    // 前のツールのdeactivate処理を実行
    if (previousTool?.behaviors?.onDeactivate) {
      previousTool.behaviors.onDeactivate({
        store: whiteboardStore.getState(),
        nextToolId: toolId
      });
    }
    
    // XStateマシンにツール切り替えを通知
    this.toolManagerActor.send({
      type: 'SWITCH_TOOL',
      tool: toolId
    });
    
    // 新しいツールのactivate処理を実行
    if (nextTool.behaviors?.onActivate) {
      nextTool.behaviors.onActivate({
        store: whiteboardStore.getState(),
        previousToolId
      });
    }
    
    // 状態を更新
    this.currentToolId = toolId;
    if (updateStore) {
      whiteboardStore.setState({ currentTool: toolId });
    }
  }
  
  // イベントハンドリング（リファクタリング版）
  handlePointerDown(event: PointerEvent, worldPos: Point): void {
    const currentTool = this.toolConfigs.get(this.currentToolId);
    
    // ツール固有の前処理を実行
    if (currentTool?.behaviors?.beforePointerDown) {
      const handled = currentTool.behaviors.beforePointerDown({
        event,
        worldPos,
        store: whiteboardStore.getState()
      });
      
      // ツールが処理済みの場合はここで終了
      if (handled) return;
    }
    
    // デフォルトの処理（XStateマシンへのイベント転送）
    this.toolManagerActor.send({
      type: 'POINTER_DOWN',
      point: worldPos,
      position: worldPos,
      event,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    });
  }
  
  // 動的にツールを追加（検証付き）
  addTool(config: unknown): void {
    if (this.options.validateOnAdd) {
      this.validateAndAddTool(config);
    } else {
      // 検証をスキップ（開発時のみ推奨）
      const tool = config as ToolConfig;
      this.toolConfigs.set(tool.id, tool);
    }
    
    const validated = this.toolConfigs.get((config as any).id)!;
    this.toolManagerActor.send({
      type: 'REGISTER_TOOL',
      id: validated.id,
      machine: validated.machine
    });
  }
  
  // ツールを削除
  removeTool(toolId: string): void {
    if (!this.toolConfigs.has(toolId)) {
      console.warn(`Tool "${toolId}" not found`);
      return;
    }
    
    if (this.currentToolId === toolId) {
      // 別のツールに切り替え
      const nextTool = Array.from(this.toolConfigs.keys()).find(id => id !== toolId);
      if (nextTool) {
        this.setActiveTool(nextTool);
      }
    }
    this.toolConfigs.delete(toolId);
  }
  
  // ツール一覧を取得（検証済みの型で返す）
  getAvailableTools(): ToolConfig[] {
    return Array.from(this.toolConfigs.values());
  }
  
  // ツール設定を取得
  getToolConfig(toolId: string): ToolConfig | undefined {
    return this.toolConfigs.get(toolId);
  }
  
  // ツール設定を更新
  updateToolConfig(toolId: string, updates: Partial<ToolConfig>): void {
    const existing = this.toolConfigs.get(toolId);
    if (!existing) {
      throw new Error(`Tool "${toolId}" not found`);
    }
    
    const updated = ToolConfigSchema.parse({ ...existing, ...updates });
    this.toolConfigs.set(toolId, updated);
  }
}
```

### 3. 使用例（Zod検証付き）

```typescript
// アプリケーション側でのツール定義
import { createSelectTool, createRectangleTool, createDrawingTool, createEllipseTool } from '@usketch/tools';
import { ToolConfigSchema, ToolManagerOptionsSchema } from '@usketch/tools/schemas';

// カスタムツールを定義
const customEraserTool = createEraserTool();

// ツール設定を作成（型安全・振る舞い定義付き）
const toolConfigs = [
  {
    id: 'select',
    machine: createSelectTool(),
    displayName: 'Select',
    icon: 'cursor',
    shortcut: 'v',
    enabled: true,
    metadata: {
      author: 'uSketch Team',
      version: '1.0.0',
      description: 'Select and move shapes'
    },
    behaviors: {
      // selectツール固有の振る舞いを定義
      onDeactivate: ({ store, nextToolId }) => {
        // selectツールから離れる時は選択を解除
        store.clearSelection();
        
        // DOM操作も必要に応じて実行
        const selectionBox = document.getElementById('selection-box-overlay');
        if (selectionBox) {
          selectionBox.style.display = 'none';
        }
      },
      
      beforePointerDown: ({ event, worldPos, store }) => {
        const shape = getShapeAtPoint(worldPos);
        
        if (shape) {
          // 修飾キーによる複数選択
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            if (store.selectedShapeIds.has(shape.id)) {
              store.deselectShape(shape.id);
            } else {
              store.selectShape(shape.id);
            }
          } else if (!store.selectedShapeIds.has(shape.id)) {
            // 新しいシェイプを選択
            store.clearSelection();
            store.selectShape(shape.id);
          }
        } else if (store.selectedShapeIds.size > 0) {
          // 空白クリックで選択解除
          store.clearSelection();
        }
        
        // デフォルト処理も実行
        return false;
      }
    }
  },
  {
    id: 'rectangle',
    machine: createRectangleTool(),
    displayName: 'Rectangle',
    icon: 'square',
    shortcut: 'r',
    behaviors: {
      onShapeCreated: ({ shape, store }) => {
        // 作成したシェイプをストアに追加
        store.addShape(shape);
      }
    }
  },
  {
    id: 'draw',
    machine: createDrawingTool(),
    displayName: 'Draw',
    icon: 'pencil',
    shortcut: 'd',
    behaviors: {
      onShapeCreated: ({ shape, store }) => {
        // 作成したシェイプをストアに追加
        store.addShape(shape);
      }
    }
  },
  {
    id: 'ellipse',
    machine: createEllipseTool(),
    displayName: 'Ellipse',
    icon: 'circle',
    shortcut: 'o'
  },
  {
    id: 'eraser',
    machine: customEraserTool,
    displayName: 'Eraser',
    icon: 'eraser',
    shortcut: 'e',
    metadata: {
      author: 'Custom Plugin',
      version: '0.1.0'
    }
  }
];

// ToolManagerを初期化（自動的に検証される）
try {
  const toolManager = new ToolManager({
    tools: toolConfigs,
    defaultToolId: 'select',
    validateOnAdd: true, // 動的追加時も検証
    allowDuplicates: false, // 重複を許可しない
    onToolChange: (toolId) => {
      console.log(`Tool changed to: ${toolId}`);
      updateUI(toolId);
    }
  });
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Invalid tool configuration:', error.errors);
    // ユーザーフレンドリーなエラーメッセージを表示
    showConfigurationError(error);
  }
}

// 動的にツールを追加する例
const dynamicTool = {
  id: 'highlighter',
  machine: createHighlighterTool(),
  displayName: 'Highlighter',
  icon: 'highlight',
  shortcut: 'h'
};

// 検証付きで追加
try {
  toolManager.addTool(dynamicTool);
} catch (error) {
  console.error('Failed to add tool:', error);
}

// プラグインから読み込む例
async function loadPluginTool(pluginUrl: string) {
  const response = await fetch(pluginUrl);
  const pluginData = await response.json();
  
  // Zodで検証してから追加
  const validatedTool = ToolConfigSchema.parse(pluginData);
  toolManager.addTool(validatedTool);
}
```

## 実装フェーズ

### フェーズ1: Zod導入と基本設計（1日）
1. Zodライブラリの追加
   ```bash
   pnpm add zod -w @usketch/tools
   ```
2. スキーマ定義ファイルの作成
   - `packages/tools/src/schemas/tool-config.ts`
   - `packages/tools/src/schemas/index.ts`
3. 型定義の自動生成設定
4. バリデーション関数の実装

### フェーズ2: ToolManagerリファクタリング（2日）
1. constructorでツール一覧を受け取るように変更
2. Zodによる入力検証の実装
3. エラーハンドリングの実装
4. 既存のAPIとの互換性を保持

### フェーズ3: 機能拡張（2-3日）
1. 動的なツール追加/削除機能（検証付き）
2. ツール有効/無効の切り替え機能
3. ツール設定の永続化機能
   ```typescript
   // LocalStorageへの保存時も検証
   const saveToolConfigs = (configs: unknown) => {
     const validated = z.array(ToolConfigSchema).parse(configs);
     localStorage.setItem('toolConfigs', JSON.stringify(validated));
   };
   
   // 読み込み時の検証
   const loadToolConfigs = (): ToolConfig[] => {
     const data = localStorage.getItem('toolConfigs');
     if (!data) return getDefaultTools();
     
     try {
       return z.array(ToolConfigSchema).parse(JSON.parse(data));
     } catch (error) {
       console.error('Invalid saved configs:', error);
       return getDefaultTools();
     }
   };
   ```
4. プラグインツールの安全な読み込み

### フェーズ4: UI統合（1-2日）
1. ツールバーコンポーネントとの統合
2. キーボードショートカットの自動登録
3. エラー表示コンポーネントの実装
4. ツール設定UIの実装

### フェーズ5: テストとドキュメント（2日）
1. Zodスキーマのユニットテスト
2. バリデーションエラーケースのテスト
3. E2Eテストの更新
4. APIドキュメントの更新（エラーケース含む）
5. 移行ガイドの作成

## 互換性の維持

### 後方互換性を保つラッパー関数

```typescript
// 既存のコードとの互換性を保つためのファクトリー関数
export function createDefaultToolManager(): ToolManager {
  return new ToolManager({
    tools: [
      { id: 'select', machine: createSelectTool() },
      { id: 'rectangle', machine: createRectangleTool() },
      { id: 'draw', machine: createDrawingTool() }
    ],
    defaultToolId: 'select'
  });
}
```

## メリット（Zod導入による追加メリット含む）

### 1. 拡張性の向上
- アプリケーション側で自由にツールを追加可能
- プラグイン形式でツールを配布可能
- 動的なツール管理が可能
- **✨ 外部ツールの安全な読み込み（Zod検証）**

### 2. テスタビリティの向上
- モックツールを簡単に注入可能
- ツール単体でのテストが容易
- 統合テストの柔軟性向上
- **✨ スキーマベースの自動テスト生成**

### 3. 保守性の向上
- ツールとToolManagerの責任分離
- 依存関係の逆転
- コードの再利用性向上
- **✨ 型定義とバリデーションの一元管理**

### 4. カスタマイズ性の向上
- ユーザー定義のツールを追加可能
- ツールセットを用途別に切り替え可能
- ツールの有効/無効を動的に制御
- **✨ メタデータによるツール管理**

### 5. 型安全性の向上（Zod導入）
- **✨ 実行時の型検証**
- **✨ TypeScript型の自動生成**
- **✨ 詳細なエラーメッセージ**
- **✨ デフォルト値の自動適用**

## リスクと対策

### リスク1: 破壊的変更
**対策**: 
- 後方互換性を保つラッパー関数を提供
- 段階的な移行パスを用意
- 非推奨警告を表示

### リスク2: パフォーマンスへの影響
**対策**:
- ツールの遅延読み込み機能
- 使用頻度の低いツールのアンロード
- ツールマシンのメモリ管理

### リスク3: 複雑性の増加
**対策**:
- シンプルなデフォルト設定を提供
- 詳細なドキュメントとサンプル
- TypeScriptの型サポートによる開発支援

## 移行ガイドライン

### 既存コードの移行手順

1. **最小限の変更で動作させる**
   ```typescript
   // Before
   const toolManager = new ToolManager();
   
   // After
   const toolManager = createDefaultToolManager();
   ```

2. **段階的にカスタマイズ**
   ```typescript
   // カスタムツールを追加
   const toolManager = new ToolManager({
     tools: [
       ...getDefaultTools(),
       { id: 'custom', machine: createCustomTool() }
     ]
   });
   ```

3. **完全なカスタマイズ**
   ```typescript
   // 完全に独自のツールセット
   const toolManager = new ToolManager({
     tools: getMyCustomTools(),
     defaultToolId: 'myDefaultTool',
     onToolChange: handleToolChange
   });
   ```

## Zodスキーマ検証の追加実装例

### エラーハンドリング

```typescript
// packages/tools/src/utils/error-handler.ts
import { z } from 'zod';

export class ToolValidationError extends Error {
  constructor(
    message: string,
    public zodError?: z.ZodError,
    public toolId?: string
  ) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join(', ');
}

// ユーザーフレンドリーなエラーメッセージ
export function getToolErrorMessage(error: unknown): string {
  if (error instanceof ToolValidationError) {
    if (error.zodError) {
      return `Invalid tool configuration: ${formatZodError(error.zodError)}`;
    }
    return error.message;
  }
  
  if (error instanceof z.ZodError) {
    return `Validation failed: ${formatZodError(error)}`;
  }
  
  return 'An unexpected error occurred';
}
```

### テスト例

```typescript
// packages/tools/src/__tests__/tool-manager.test.ts
import { describe, it, expect } from 'vitest';
import { ToolManager } from '../adapters/toolManagerAdapter';
import { ToolConfigSchema } from '../schemas';

describe('ToolManager with Zod validation', () => {
  it('should validate tool configuration on initialization', () => {
    const invalidConfig = {
      tools: [
        {
          id: '', // 空のIDは無効
          machine: null, // nullは無効
        }
      ]
    };
    
    expect(() => new ToolManager(invalidConfig)).toThrow();
  });
  
  it('should accept valid tool configuration', () => {
    const validConfig = {
      tools: [
        {
          id: 'test-tool',
          machine: createTestTool(),
          displayName: 'Test Tool',
          enabled: true
        }
      ]
    };
    
    const manager = new ToolManager(validConfig);
    expect(manager.getAvailableTools()).toHaveLength(1);
  });
  
  it('should provide helpful error messages', () => {
    const invalidConfig = {
      tools: [
        {
          id: 'test',
          machine: createTestTool(),
          shortcut: 'ab' // 2文字は無効
        }
      ]
    };
    
    try {
      new ToolManager(invalidConfig);
    } catch (error) {
      expect(error.message).toContain('Shortcut must be a single character');
    }
  });
});
```

## まとめ

このリファクタリングにより、ToolManagerは以下の改善を実現します：

1. **柔軟性**: 外部からツール設定を注入可能
2. **型安全性**: Zodによる実行時検証とTypeScript型の自動生成
3. **拡張性**: プラグインツールの安全な読み込み
4. **保守性**: スキーマベースの一元管理
5. **開発体験**: 詳細なエラーメッセージとデフォルト値

Zodの導入により、わずか8KBの追加で大幅な安全性向上を実現し、将来のファイル保存/読み込みやプラグインシステムにも対応できる堅牢なアーキテクチャとなります。

実装期間は約7-9日を想定し、段階的な移行により既存機能への影響を最小限に抑えながら着実に改善を進めることができます。
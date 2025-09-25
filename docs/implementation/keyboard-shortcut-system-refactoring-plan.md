# キーボードショートカットシステム改修計画書

## 概要

現在のキーボードショートカット実装を拡張し、初期化時の設定可能性、動的な変更機能、カメラ操作への対応を実現する包括的なリファクタリングを行う。

## 現状分析

### 現在の実装状況

1. **実装場所（2箇所に分散）**
   - `packages/react-canvas/src/hooks/use-keyboard-shortcuts.ts`
     - 基本的な描画ツール切り替え
     - 削除、選択、アライメント操作
     - Undo/Redo
     - グリッドスナップ切り替え
   - `apps/whiteboard/src/hooks/use-keyboard-shortcuts.ts`
     - スタイルのコピー＆ペースト
     - プロパティパネルのトグル
     - Undo/Redo（重複実装）

2. **現在対応しているショートカット**
   ```
   【基本操作】
   - Delete/Backspace: 選択図形削除
   - Escape: 選択解除・選択ツールに戻る
   - Cmd/Ctrl + A: すべて選択
   - Cmd/Ctrl + Z: Undo
   - Cmd/Ctrl + Shift + Z / Cmd/Ctrl + Y: Redo
   
   【ツール切り替え】
   - V/S: 選択ツール
   - R: 矩形ツール
   - O/E: 楕円ツール
   - D/P: フリーハンドツール
   - H: パンツール
   
   【アライメント】
   - Cmd/Ctrl + Shift + 矢印キー: 整列
   - Cmd/Ctrl + Shift + C: 水平中央揃え
   - Cmd/Ctrl + Shift + M: 垂直中央揃え
   
   【スタイル】
   - Cmd/Ctrl + Shift + C: スタイルコピー
   - Cmd/Ctrl + Shift + V: スタイルペースト
   
   【その他】
   - Shift + G: グリッドスナップ切り替え
   - Cmd/Ctrl + ,: プロパティパネル切り替え
   ```

### 問題点

1. **ハードコーディング**: キーバインディングがコード内に直接記述
2. **分散実装**: 2箇所に分かれており、一貫性が欠如
3. **拡張性の欠如**: 新しいショートカット追加が困難
4. **設定不可**: ユーザーによるカスタマイズが不可能
5. **カメラ操作未対応**: ズーム・パン操作のキーボードサポートなし

## 設計方針

### アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│              @usketch/keyboard-presets           │
│         （デフォルトキーバインディング定義）          │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│             @usketch/keyboard-manager            │
│  （キーボード管理・設定システム・コマンド実行）       │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│              @usketch/react-canvas               │
│         （React統合・Hooks・Context提供）          │
└─────────────────────────────────────────────────┘
```

### 主要コンポーネント

#### 1. `@usketch/keyboard-presets` パッケージ（新規）

**責務**: デフォルトキーバインディングの提供

```typescript
// src/presets/default.ts
export const defaultKeymap: KeyboardPreset = {
  id: 'default',
  name: 'Default',
  description: 'Standard keyboard shortcuts',
  bindings: {
    // ツール
    'select': ['v', 's'],
    'rectangle': ['r'],
    'ellipse': ['o', 'e'],
    'freedraw': ['d', 'p'],
    'pan': ['h'],
    
    // 基本操作
    'delete': ['Delete', 'Backspace'],
    'selectAll': ['mod+a'],
    'undo': ['mod+z'],
    'redo': ['mod+shift+z', 'mod+y'],
    'escape': ['Escape'],
    
    // アライメント
    'alignLeft': ['mod+shift+ArrowLeft'],
    'alignRight': ['mod+shift+ArrowRight'],
    'alignTop': ['mod+shift+ArrowUp'],
    'alignBottom': ['mod+shift+ArrowDown'],
    'alignCenterH': ['mod+shift+c'],
    'alignCenterV': ['mod+shift+m'],
    
    // カメラ操作（新規）
    'zoomIn': ['mod+=', 'mod+plus'],
    'zoomOut': ['mod+-', 'mod+minus'],
    'zoomReset': ['mod+0'],
    'zoomToFit': ['mod+1'],
    'zoomToSelection': ['mod+2'],
    'panUp': ['shift+ArrowUp'],
    'panDown': ['shift+ArrowDown'],
    'panLeft': ['shift+ArrowLeft'],
    'panRight': ['shift+ArrowRight'],
    
    // スナップ
    'toggleGridSnap': ['shift+g'],
    'toggleShapeSnap': ['shift+s'],
    
    // スタイル
    'copyStyle': ['mod+shift+c'],
    'pasteStyle': ['mod+shift+v'],
    
    // UI
    'togglePropertyPanel': ['mod+,'],
    'toggleDebugPanel': ['mod+shift+d']
  }
};

// src/presets/vim.ts
export const vimKeymap: KeyboardPreset = {
  id: 'vim',
  name: 'Vim-style',
  description: 'Vim-inspired keyboard shortcuts',
  bindings: {
    // 移動
    'panLeft': ['h'],
    'panDown': ['j'],
    'panUp': ['k'],
    'panRight': ['l'],
    // ... その他Vimスタイルのバインディング
  }
};
```

#### 2. `@usketch/keyboard-manager` パッケージ（新規）

**責務**: キーボードイベント管理、設定システム、コマンドマッピング

```typescript
// src/keyboard-manager.ts
export class KeyboardManager {
  private bindings: Map<string, KeyBinding>;
  private contexts: Map<string, KeyboardContext>;
  private activeContext: string = 'default';
  private commandHandlers: Map<string, CommandHandler>;
  
  constructor(config?: KeyboardConfig) {
    this.bindings = new Map();
    this.contexts = new Map();
    this.commandHandlers = new Map();
    
    if (config?.preset) {
      this.loadPreset(config.preset);
    }
  }
  
  // 初期化時設定
  initialize(config: KeyboardConfig): void {
    if (config.preset) {
      this.loadPreset(config.preset);
    }
    if (config.customBindings) {
      this.setBindings(config.customBindings);
    }
  }
  
  // 動的変更
  setBinding(command: string, keys: string[]): void {
    this.bindings.set(command, { command, keys });
  }
  
  removeBinding(command: string): void {
    this.bindings.delete(command);
  }
  
  // プリセット管理
  loadPreset(preset: KeyboardPreset): void {
    Object.entries(preset.bindings).forEach(([command, keys]) => {
      this.setBinding(command, keys);
    });
  }
  
  // コンテキスト管理
  pushContext(name: string, bindings?: KeyBindings): void {
    this.contexts.set(name, { name, bindings, priority: this.contexts.size });
    this.activeContext = name;
  }
  
  popContext(): void {
    // コンテキストスタックから削除
  }
  
  // コマンド実行
  registerCommand(name: string, handler: CommandHandler): void {
    this.commandHandlers.set(name, handler);
  }
  
  executeCommand(command: string, event: KeyboardEvent): boolean {
    const handler = this.commandHandlers.get(command);
    if (handler) {
      return handler(event);
    }
    return false;
  }
  
  // イベントハンドリング
  handleKeyDown(event: KeyboardEvent): boolean {
    const key = this.normalizeKey(event);
    const command = this.findCommand(key);
    
    if (command) {
      return this.executeCommand(command, event);
    }
    
    return false;
  }
  
  private normalizeKey(event: KeyboardEvent): string {
    const parts: string[] = [];
    
    if (event.ctrlKey || event.metaKey) parts.push('mod');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    
    parts.push(event.key.toLowerCase());
    
    return parts.join('+');
  }
}

// src/types.ts
export interface KeyboardConfig {
  preset?: KeyboardPreset;
  customBindings?: KeyBindings;
  enableInInput?: boolean;
  debug?: boolean;
}

export interface KeyBinding {
  command: string;
  keys: string[];
  context?: string;
  when?: string; // 条件式
}

export interface CommandHandler {
  (event: KeyboardEvent): boolean;
}

export interface CameraCommands {
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  zoomReset: () => void;
  zoomToFit: () => void;
  zoomToSelection: () => void;
  panBy: (deltaX: number, deltaY: number) => void;
}
```

#### 3. React統合層の改修

```typescript
// packages/react-canvas/src/providers/keyboard-provider.tsx
export const KeyboardProvider: React.FC<KeyboardProviderProps> = ({
  children,
  preset = defaultKeymap,
  customBindings,
  onBindingChange
}) => {
  const managerRef = useRef<KeyboardManager>();
  const store = useWhiteboardStore();
  
  useEffect(() => {
    const manager = new KeyboardManager({ preset, customBindings });
    
    // コマンドハンドラーの登録
    registerStandardCommands(manager, store);
    registerCameraCommands(manager, store);
    registerToolCommands(manager, store);
    
    managerRef.current = manager;
  }, []);
  
  return (
    <KeyboardContext.Provider value={{ manager: managerRef.current }}>
      {children}
    </KeyboardContext.Provider>
  );
};

// packages/react-canvas/src/hooks/use-keyboard.ts
export const useKeyboard = () => {
  const context = useContext(KeyboardContext);
  const [bindings, setBindings] = useState<KeyBindings>({});
  
  const updateBinding = useCallback((command: string, keys: string[]) => {
    context.manager?.setBinding(command, keys);
    setBindings(prev => ({ ...prev, [command]: keys }));
  }, [context.manager]);
  
  const resetToPreset = useCallback((preset: KeyboardPreset) => {
    context.manager?.loadPreset(preset);
    setBindings(preset.bindings);
  }, [context.manager]);
  
  return {
    bindings,
    updateBinding,
    resetToPreset,
    manager: context.manager
  };
};
```

### カメラ操作の実装

```typescript
// packages/store/src/store.ts に追加
interface CameraActions {
  // ズーム操作
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  zoomTo: (level: number) => void;
  zoomReset: () => void;
  zoomToFit: () => void;
  zoomToSelection: () => void;
  
  // パン操作
  panBy: (deltaX: number, deltaY: number) => void;
  panTo: (x: number, y: number) => void;
  centerView: () => void;
}

// packages/react-canvas/src/commands/camera-commands.ts
export function registerCameraCommands(
  manager: KeyboardManager,
  store: WhiteboardStore
) {
  // ズームイン
  manager.registerCommand('zoomIn', () => {
    const currentZoom = store.camera.zoom;
    store.setCamera({ zoom: Math.min(currentZoom * 1.2, 5) });
    return true;
  });
  
  // ズームアウト
  manager.registerCommand('zoomOut', () => {
    const currentZoom = store.camera.zoom;
    store.setCamera({ zoom: Math.max(currentZoom / 1.2, 0.1) });
    return true;
  });
  
  // ズームリセット
  manager.registerCommand('zoomReset', () => {
    store.setCamera({ zoom: 1 });
    return true;
  });
  
  // 全体表示
  manager.registerCommand('zoomToFit', () => {
    const bounds = calculateShapesBounds(store.shapes);
    const viewport = getViewportSize();
    const zoom = calculateFitZoom(bounds, viewport);
    store.setCamera({ zoom, x: bounds.center.x, y: bounds.center.y });
    return true;
  });
  
  // 選択範囲にズーム
  manager.registerCommand('zoomToSelection', () => {
    const selectedShapes = getSelectedShapes(store);
    if (selectedShapes.length === 0) return false;
    
    const bounds = calculateShapesBounds(selectedShapes);
    const viewport = getViewportSize();
    const zoom = calculateFitZoom(bounds, viewport, 0.8);
    store.setCamera({ zoom, x: bounds.center.x, y: bounds.center.y });
    return true;
  });
  
  // パン操作
  const PAN_DISTANCE = 50;
  
  manager.registerCommand('panUp', () => {
    store.setCamera({ 
      y: store.camera.y - PAN_DISTANCE / store.camera.zoom 
    });
    return true;
  });
  
  manager.registerCommand('panDown', () => {
    store.setCamera({ 
      y: store.camera.y + PAN_DISTANCE / store.camera.zoom 
    });
    return true;
  });
  
  manager.registerCommand('panLeft', () => {
    store.setCamera({ 
      x: store.camera.x - PAN_DISTANCE / store.camera.zoom 
    });
    return true;
  });
  
  manager.registerCommand('panRight', () => {
    store.setCamera({ 
      x: store.camera.x + PAN_DISTANCE / store.camera.zoom 
    });
    return true;
  });
}
```

## 実装計画

### フェーズ1: パッケージ構築（2-3日）

1. `@usketch/keyboard-presets` パッケージ作成
   - デフォルトプリセット定義
   - Vimプリセット定義
   - 型定義

2. `@usketch/keyboard-manager` パッケージ作成
   - KeyboardManagerクラス実装
   - コマンドシステム実装
   - コンテキスト管理実装

### フェーズ2: カメラ操作実装（1-2日）

1. Storeにカメラ操作アクション追加
2. カメラコマンドハンドラー実装
3. ビューポート計算ユーティリティ実装

### フェーズ3: React統合（2日）

1. KeyboardProvider実装
2. useKeyboardフック実装
3. 既存フックの移行
4. コマンド登録の統合

### フェーズ4: UI実装（2日）

1. キーボード設定パネルコンポーネント
2. ショートカット一覧表示
3. カスタマイズUI
4. プリセット選択UI

### フェーズ5: テスト・最適化（1-2日）

1. ユニットテスト作成
2. E2Eテスト追加
3. パフォーマンス最適化
4. ドキュメント作成

## 使用例

### 基本的な使用

```tsx
// 初期化時の設定
<WhiteboardCanvas
  keyboardPreset="default"
  customKeyBindings={{
    'customAction': ['ctrl+shift+x']
  }}
  onKeyBindingChange={(bindings) => {
    // 設定の永続化
    localStorage.setItem('keyBindings', JSON.stringify(bindings));
  }}
/>
```

### プログラマティックな変更

```tsx
function KeyboardSettings() {
  const { bindings, updateBinding, resetToPreset } = useKeyboard();
  
  const handleBindingChange = (command: string, newKeys: string[]) => {
    updateBinding(command, newKeys);
  };
  
  const handlePresetChange = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      resetToPreset(preset);
    }
  };
  
  return (
    <div>
      <select onChange={(e) => handlePresetChange(e.target.value)}>
        <option value="default">Default</option>
        <option value="vim">Vim-style</option>
        <option value="custom">Custom</option>
      </select>
      
      <KeyBindingList
        bindings={bindings}
        onChange={handleBindingChange}
      />
    </div>
  );
}
```

### カメラ操作の使用

```tsx
// キーボードショートカット
// Cmd/Ctrl + +: ズームイン
// Cmd/Ctrl + -: ズームアウト
// Cmd/Ctrl + 0: ズームリセット
// Cmd/Ctrl + 1: 全体表示
// Cmd/Ctrl + 2: 選択範囲にズーム
// Shift + 矢印キー: パン操作

// プログラマティックな使用
const store = useWhiteboardStore();
store.zoomIn(1.5);
store.zoomToSelection();
store.panBy(100, 50);
```

## 成功指標

1. **設定可能性**: すべてのキーバインディングが変更可能
2. **拡張性**: 新しいコマンドの追加が容易
3. **パフォーマンス**: キー入力の遅延 < 10ms
4. **互換性**: 既存機能の完全な維持
5. **テストカバレッジ**: 90%以上

## リスクと対策

### リスク1: 既存コードとの競合
**対策**: 移行期間中は両方のシステムを並行稼働させ、段階的に移行

### リスク2: パフォーマンス低下
**対策**: イベントハンドラーの最適化、デバウンス処理の実装

### リスク3: 複雑性の増加
**対策**: シンプルなAPI設計、十分なドキュメント作成

## 将来の拡張

1. **マクロ機能**: 複数コマンドの連続実行
2. **ジェスチャー対応**: マウスジェスチャーとの統合
3. **コンテキストメニュー**: 右クリックメニューとの連携
4. **アクセシビリティ**: スクリーンリーダー対応
5. **録画・再生**: 操作の記録と再現

## まとめ

この改修により、uSketchのキーボードショートカットシステムは以下を実現します：

- ✅ 初期化時の設定可能性
- ✅ 実行時の動的変更
- ✅ カメラ操作のフルサポート
- ✅ プリセットによる簡単な切り替え
- ✅ 拡張可能なアーキテクチャ

これにより、ユーザーの生産性向上と、開発者の保守性向上の両方を達成します。
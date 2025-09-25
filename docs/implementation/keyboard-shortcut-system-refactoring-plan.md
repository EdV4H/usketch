# キーボード・マウス操作システム改修計画書

## 概要

現在のキーボードショートカット・マウス操作実装を拡張し、初期化時の設定可能性、動的な変更機能、カメラ操作への対応を実現する包括的なリファクタリングを行う。キーボードとマウスの両方の入力デバイスに対して統一的な設定・管理システムを構築する。

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

3. **現在のマウス操作**
   - InteractionLayerでPointerEventを処理
   - 描画ツール（矩形、楕円、フリーハンド）
   - 選択・ドラッグ操作
   - ホイールによるズーム（実装箇所不明）
   - スペース+ドラッグによるパン

### 問題点

1. **ハードコーディング**: キー・マウスバインディングがコード内に直接記述
2. **分散実装**: 複数箇所に分かれており、一貫性が欠如
3. **拡張性の欠如**: 新しいショートカット・ジェスチャー追加が困難
4. **設定不可**: ユーザーによるカスタマイズが不可能
5. **カメラ操作未統合**: ズーム・パン操作が統一されていない
6. **マウス操作の設定不可**: マウスボタン割り当て、ジェスチャーのカスタマイズ不可

## 設計方針

### アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│              @usketch/input-presets              │
│    （デフォルトキー・マウスバインディング定義）        │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│              @usketch/input-manager              │
│  （入力デバイス統合管理・設定システム・コマンド実行）   │
│      - KeyboardManager: キーボード入力管理        │
│      - MouseManager: マウス入力管理               │
│      - GestureManager: ジェスチャー認識          │
└─────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│              @usketch/react-canvas               │
│         （React統合・Hooks・Context提供）          │
└─────────────────────────────────────────────────┘
```

### 主要コンポーネント

#### 1. `@usketch/input-presets` パッケージ（新規）

**責務**: デフォルトキー・マウスバインディングの提供

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

// src/presets/mouse-default.ts
export const defaultMouseMap: MousePreset = {
  id: 'default',
  name: 'Default Mouse',
  description: 'Standard mouse bindings',
  bindings: {
    // 基本操作
    'select': { button: 0 }, // 左クリック
    'contextMenu': { button: 2 }, // 右クリック
    'pan': { button: 1 }, // 中クリック
    
    // 修飾キー付き
    'multiSelect': { button: 0, modifiers: ['shift'] },
    'duplicateDrag': { button: 0, modifiers: ['alt'] },
    
    // ホイール操作
    'zoom': { wheel: true },
    'horizontalScroll': { wheel: true, modifiers: ['shift'] },
    
    // ジェスチャー
    'rotate': { gesture: 'rotate' },
    'pinchZoom': { gesture: 'pinch' }
  }
};

// src/presets/trackpad.ts
export const trackpadPreset: MousePreset = {
  id: 'trackpad',
  name: 'Trackpad Optimized',
  description: 'Optimized for trackpad/touchpad',
  bindings: {
    'pan': { gesture: 'twoFingerDrag' },
    'zoom': { gesture: 'pinch' },
    'rotate': { gesture: 'twoFingerRotate' },
    'smartZoom': { gesture: 'doubleTapTwoFinger' }
  }
};
```

#### 2. `@usketch/input-manager` パッケージ（新規）

**責務**: 統合入力管理、設定システム、コマンドマッピング

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

// src/mouse-manager.ts
export class MouseManager {
  private bindings: Map<string, MouseBinding>;
  private gestureRecognizer: GestureRecognizer;
  private commandHandlers: Map<string, CommandHandler>;
  
  constructor(config?: MouseConfig) {
    this.bindings = new Map();
    this.gestureRecognizer = new GestureRecognizer();
    this.commandHandlers = new Map();
    
    if (config?.preset) {
      this.loadPreset(config.preset);
    }
  }
  
  // マウスボタン設定
  setButtonBinding(command: string, button: number, modifiers?: string[]): void {
    this.bindings.set(command, { 
      command, 
      button, 
      modifiers,
      type: 'button'
    });
  }
  
  // ホイール設定
  setWheelBinding(command: string, direction: 'up' | 'down', modifiers?: string[]): void {
    this.bindings.set(command, {
      command,
      wheel: direction,
      modifiers,
      type: 'wheel'
    });
  }
  
  // ジェスチャー設定
  setGestureBinding(command: string, gesture: GestureType): void {
    this.bindings.set(command, {
      command,
      gesture,
      type: 'gesture'
    });
  }
  
  // イベントハンドリング
  handlePointerDown(event: PointerEvent): boolean {
    const binding = this.findBinding('button', event.button, event);
    if (binding) {
      return this.executeCommand(binding.command, event);
    }
    return false;
  }
  
  handleWheel(event: WheelEvent): boolean {
    const direction = event.deltaY > 0 ? 'down' : 'up';
    const binding = this.findBinding('wheel', direction, event);
    if (binding) {
      return this.executeCommand(binding.command, event);
    }
    return false;
  }
  
  handleGesture(gesture: GestureEvent): boolean {
    const binding = this.findBinding('gesture', gesture.type);
    if (binding) {
      return this.executeCommand(binding.command, gesture);
    }
    return false;
  }
}

// src/gesture-manager.ts
export class GestureManager {
  private activeGestures: Map<number, GestureState>;
  private recognizers: GestureRecognizer[];
  
  constructor() {
    this.activeGestures = new Map();
    this.recognizers = [
      new PinchRecognizer(),
      new RotateRecognizer(),
      new SwipeRecognizer(),
      new TwoFingerDragRecognizer()
    ];
  }
  
  // タッチ/ポインターイベントからジェスチャーを認識
  processPointerEvent(event: PointerEvent): GestureEvent | null {
    // ポインターの追跡
    if (event.type === 'pointerdown') {
      this.activeGestures.set(event.pointerId, {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        timestamp: event.timeStamp
      });
    } else if (event.type === 'pointermove') {
      const gesture = this.activeGestures.get(event.pointerId);
      if (gesture) {
        gesture.currentX = event.clientX;
        gesture.currentY = event.clientY;
      }
    } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
      this.activeGestures.delete(event.pointerId);
    }
    
    // ジェスチャー認識
    const pointers = Array.from(this.activeGestures.values());
    for (const recognizer of this.recognizers) {
      const gesture = recognizer.recognize(pointers);
      if (gesture) {
        return gesture;
      }
    }
    
    return null;
  }
}

// src/types.ts
export interface MouseBinding {
  command: string;
  button?: number;
  wheel?: 'up' | 'down' | boolean;
  gesture?: GestureType;
  modifiers?: string[];
  type: 'button' | 'wheel' | 'gesture';
}

export interface GestureEvent {
  type: GestureType;
  scale?: number;      // ピンチズーム用
  rotation?: number;   // 回転用
  deltaX?: number;     // パン用
  deltaY?: number;     // パン用
  velocity?: number;   // スワイプ用
  direction?: 'up' | 'down' | 'left' | 'right';
}

export type GestureType = 
  | 'pinch'
  | 'rotate' 
  | 'swipe'
  | 'twoFingerDrag'
  | 'doubleTap'
  | 'longPress'
  | 'drag';
```

#### 3. React統合層の改修

```typescript
// packages/react-canvas/src/providers/input-provider.tsx
export const InputProvider: React.FC<InputProviderProps> = ({
  children,
  keyboardPreset = defaultKeymap,
  mousePreset = defaultMouseMap,
  customKeyBindings,
  customMouseBindings,
  onBindingChange
}) => {
  const keyboardManagerRef = useRef<KeyboardManager>();
  const mouseManagerRef = useRef<MouseManager>();
  const gestureManagerRef = useRef<GestureManager>();
  const store = useWhiteboardStore();
  
  useEffect(() => {
    const keyboardManager = new KeyboardManager({ 
      preset: keyboardPreset, 
      customBindings: customKeyBindings 
    });
    
    const mouseManager = new MouseManager({
      preset: mousePreset,
      customBindings: customMouseBindings
    });
    
    const gestureManager = new GestureManager();
    
    // コマンドハンドラーの登録
    registerStandardCommands(keyboardManager, mouseManager, store);
    registerCameraCommands(keyboardManager, mouseManager, store);
    registerToolCommands(keyboardManager, mouseManager, store);
    
    keyboardManagerRef.current = keyboardManager;
    mouseManagerRef.current = mouseManager;
    gestureManagerRef.current = gestureManager;
  }, []);
  
  return (
    <InputContext.Provider value={{ 
      keyboard: keyboardManagerRef.current,
      mouse: mouseManagerRef.current,
      gesture: gestureManagerRef.current
    }}>
      {children}
    </InputContext.Provider>
  );
};

// packages/react-canvas/src/hooks/use-input.ts
export const useInput = () => {
  const context = useContext(InputContext);
  const [keyBindings, setKeyBindings] = useState<KeyBindings>({});
  const [mouseBindings, setMouseBindings] = useState<MouseBindings>({});
  
  const updateKeyBinding = useCallback((command: string, keys: string[]) => {
    context.keyboard?.setBinding(command, keys);
    setKeyBindings(prev => ({ ...prev, [command]: keys }));
  }, [context.keyboard]);
  
  const updateMouseBinding = useCallback((command: string, binding: MouseBinding) => {
    context.mouse?.setBinding(command, binding);
    setMouseBindings(prev => ({ ...prev, [command]: binding }));
  }, [context.mouse]);
  
  const resetToPreset = useCallback((type: 'keyboard' | 'mouse', preset: any) => {
    if (type === 'keyboard') {
      context.keyboard?.loadPreset(preset);
      setKeyBindings(preset.bindings);
    } else {
      context.mouse?.loadPreset(preset);
      setMouseBindings(preset.bindings);
    }
  }, [context]);
  
  return {
    keyBindings,
    mouseBindings,
    updateKeyBinding,
    updateMouseBinding,
    resetToPreset,
    keyboard: context.keyboard,
    mouse: context.mouse,
    gesture: context.gesture
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
  
  // マウスホイールによるズーム
  manager.registerCommand('wheelZoom', (event: WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY;
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    
    // マウス位置を中心にズーム
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const currentZoom = store.camera.zoom;
    const newZoom = Math.max(0.1, Math.min(5, currentZoom * zoomFactor));
    
    // ズーム中心点の調整
    const zoomDiff = newZoom - currentZoom;
    const offsetX = (x - store.camera.x) * (zoomDiff / currentZoom);
    const offsetY = (y - store.camera.y) * (zoomDiff / currentZoom);
    
    store.setCamera({ 
      zoom: newZoom,
      x: store.camera.x - offsetX,
      y: store.camera.y - offsetY
    });
    return true;
  });
  
  // トラックパッドジェスチャー
  manager.registerCommand('pinchZoom', (event: GestureEvent) => {
    if (event.scale) {
      const currentZoom = store.camera.zoom;
      const newZoom = Math.max(0.1, Math.min(5, currentZoom * event.scale));
      store.setCamera({ zoom: newZoom });
    }
    return true;
  });
  
  manager.registerCommand('twoFingerPan', (event: GestureEvent) => {
    if (event.deltaX !== undefined && event.deltaY !== undefined) {
      store.setCamera({
        x: store.camera.x + event.deltaX,
        y: store.camera.y + event.deltaY
      });
    }
    return true;
  });
}
```

## 実装計画

### フェーズ1: パッケージ構築（3-4日）

1. `@usketch/input-presets` パッケージ作成
   - キーボードプリセット定義（Default, Vim）
   - マウスプリセット定義（Default, Trackpad）
   - 型定義とインターフェース

2. `@usketch/input-manager` パッケージ作成
   - KeyboardManagerクラス実装
   - MouseManagerクラス実装
   - GestureManagerクラス実装
   - コマンドシステム実装
   - コンテキスト管理実装

### フェーズ2: カメラ操作実装（2日）

1. Storeにカメラ操作アクション追加
2. キーボード・マウスカメラコマンドハンドラー実装
3. ビューポート計算ユーティリティ実装
4. マウスホイールズーム実装
5. ジェスチャーによるズーム・パン実装

### フェーズ3: React統合（2-3日）

1. InputProvider実装
2. useInputフック実装
3. 既存フックの移行
4. コマンド登録の統合
5. イベントハンドラーの最適化

### フェーズ4: UI実装（2-3日）

1. 入力設定パネルコンポーネント
2. キーボード・マウスバインディング表示
3. カスタマイズUI（キー割り当て、マウスボタン設定）
4. プリセット選択UI
5. ジェスチャー設定UI

### フェーズ5: テスト・最適化（2日）

1. ユニットテスト作成
2. E2Eテスト追加（マウス操作含む）
3. パフォーマンス最適化
4. ドキュメント作成

## 使用例

### 基本的な使用

```tsx
// 初期化時の設定
<WhiteboardCanvas
  keyboardPreset="default"
  mousePreset="trackpad"
  customKeyBindings={{
    'customAction': ['ctrl+shift+x']
  }}
  customMouseBindings={{
    'specialTool': { button: 3, modifiers: ['ctrl'] }
  }}
  onInputBindingChange={(type, bindings) => {
    // 設定の永続化
    localStorage.setItem(`${type}Bindings`, JSON.stringify(bindings));
  }}
/>
```

### プログラマティックな変更

```tsx
function InputSettings() {
  const { 
    keyBindings, 
    mouseBindings, 
    updateKeyBinding, 
    updateMouseBinding,
    resetToPreset 
  } = useInput();
  
  const handleKeyBindingChange = (command: string, newKeys: string[]) => {
    updateKeyBinding(command, newKeys);
  };
  
  const handleMouseBindingChange = (command: string, binding: MouseBinding) => {
    updateMouseBinding(command, binding);
  };
  
  const handlePresetChange = (type: 'keyboard' | 'mouse', presetId: string) => {
    const preset = presets[type].find(p => p.id === presetId);
    if (preset) {
      resetToPreset(type, preset);
    }
  };
  
  return (
    <div>
      {/* キーボード設定 */}
      <section>
        <h3>キーボード設定</h3>
        <select onChange={(e) => handlePresetChange('keyboard', e.target.value)}>
          <option value="default">Default</option>
          <option value="vim">Vim-style</option>
          <option value="custom">Custom</option>
        </select>
        
        <KeyBindingList
          bindings={keyBindings}
          onChange={handleKeyBindingChange}
        />
      </section>
      
      {/* マウス設定 */}
      <section>
        <h3>マウス設定</h3>
        <select onChange={(e) => handlePresetChange('mouse', e.target.value)}>
          <option value="default">Standard Mouse</option>
          <option value="trackpad">Trackpad</option>
          <option value="gaming">Gaming Mouse</option>
        </select>
        
        <MouseBindingList
          bindings={mouseBindings}
          onChange={handleMouseBindingChange}
        />
      </section>
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

// マウス操作
// ホイール: ズーム（マウス位置中心）
// 中クリック + ドラッグ: パン
// Shift + ホイール: 水平スクロール

// トラックパッドジェスチャー
// ピンチ: ズーム
// 2本指ドラッグ: パン
// 2本指回転: キャンバス回転（将来実装）

// プログラマティックな使用
const store = useWhiteboardStore();
store.zoomIn(1.5);
store.zoomToSelection();
store.panBy(100, 50);
```

## 成功指標

1. **設定可能性**: すべてのキー・マウスバインディングが変更可能
2. **拡張性**: 新しいコマンド・ジェスチャーの追加が容易
3. **パフォーマンス**: 
   - キー入力の遅延 < 10ms
   - マウス操作の遅延 < 5ms
   - ジェスチャー認識 < 20ms
4. **互換性**: 既存機能の完全な維持
5. **テストカバレッジ**: 90%以上
6. **アクセシビリティ**: キーボードのみでの完全操作可能

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

この改修により、uSketchの入力システムは以下を実現します：

- ✅ キーボード・マウス両方の初期化時設定
- ✅ 実行時の動的バインディング変更
- ✅ カメラ操作のフルサポート（キーボード・マウス・ジェスチャー）
- ✅ プリセットによる簡単な切り替え
- ✅ ジェスチャー認識とカスタマイズ
- ✅ 拡張可能な統合アーキテクチャ
- ✅ デバイス別最適化（マウス/トラックパッド）

これにより、ユーザーの生産性向上と、開発者の保守性向上の両方を達成します。

## 実装優先順位

1. **高優先度**
   - キーボードショートカット基盤
   - マウスホイールズーム
   - 基本的なプリセット

2. **中優先度**
   - ジェスチャー認識
   - カスタマイズUI
   - トラックパッド最適化

3. **低優先度**
   - 高度なジェスチャー
   - マクロ機能
   - アニメーション付きカメラ操作
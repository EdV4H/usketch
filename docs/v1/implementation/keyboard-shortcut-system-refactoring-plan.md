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
   - カメラパン操作なし（今回追加）

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
    'alignCenterH': ['mod+shift+h'],  // 'h'を使用（HorizontalのH、直感的なキー割り当て）
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
    
    // カメラ操作
    'pan': { button: 1, action: 'drag' }, // 中ボタンドラッグ
    // 注: キーボード併用操作は別システムで管理
    // スペースキー押下中の動作は KeyboardManager と連携して実装
    
    // 修飾キー付き操作
    'multiSelect': { button: 0, modifiers: ['shift'] },
    'duplicateDrag': { button: 0, action: 'drag', modifiers: ['alt'] },
    'constrainedMove': { button: 0, action: 'drag', modifiers: ['shift'] }, // 水平/垂直移動
    
    // ホイール操作
    'zoom': { wheel: true },
    'zoomPrecise': { wheel: true, modifiers: ['mod'] }, // 精密ズーム（ctrlからmodに統一）
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

/**
 * コマンドハンドラーのインターフェース
 * @param event - イベントオブジェクト（KeyboardEvent, MouseEvent, PanEvent等）
 * @returns true: イベントを処理した（preventDefault済み）、false: イベントを処理しなかった
 */
export interface CommandHandler {
  (event: KeyboardEvent | MouseEvent | PanEvent | GestureEvent): boolean;
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
  private dragState: DragState | null = null;
  
  constructor(config?: MouseConfig) {
    this.bindings = new Map();
    this.gestureRecognizer = new GestureRecognizer();
    this.commandHandlers = new Map();
    
    if (config?.preset) {
      this.loadPreset(config.preset);
    }
  }
  
  // マウスボタン設定
  setButtonBinding(command: string, button: number, action?: 'click' | 'drag', modifiers?: string[]): void {
    this.bindings.set(command, { 
      command, 
      button,
      action: action || 'click',
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
    // ドラッグ操作の開始を記録
    this.dragState = {
      startX: event.clientX,
      startY: event.clientY,
      button: event.button,
      modifiers: this.getModifiers(event)
    };
    
    const binding = this.findBinding('button', event.button, event);
    if (binding) {
      if (binding.action === 'drag') {
        // ドラッグ開始コマンドを実行
        return this.executeCommand(`${binding.command}:start`, event);
      }
      return this.executeCommand(binding.command, event);
    }
    return false;
  }
  
  handlePointerMove(event: PointerEvent): boolean {
    if (!this.dragState) return false;
    
    const binding = this.findBinding('button', this.dragState.button, event);
    if (binding && binding.action === 'drag') {
      // PanEventタイプで一貫性を保つ
      const panEvent: PanEvent = {
        originalEvent: event,
        deltaX: event.clientX - this.dragState.startX,
        deltaY: event.clientY - this.dragState.startY,
        clientX: event.clientX,
        clientY: event.clientY
      };
      return this.executeCommand(`${binding.command}:move`, panEvent);
    }
    return false;
  }
  
  handlePointerUp(event: PointerEvent): boolean {
    if (this.dragState) {
      const binding = this.findBinding('button', this.dragState.button, event);
      if (binding && binding.action === 'drag') {
        this.executeCommand(`${binding.command}:end`, event);
      }
      this.dragState = null;
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
  
  /**
   * 修飾キーの状態を取得
   * 'mod'はプラットフォーム非依存の抽象化キー：
   * - macOS: Cmd (metaKey)
   * - Windows/Linux: Ctrl (ctrlKey)
   * これにより同じキーバインディングで全プラットフォームに対応
   */
  private getModifiers(event: MouseEvent | KeyboardEvent): string[] {
    const modifiers: string[] = [];
    if (event.ctrlKey || event.metaKey) modifiers.push('mod'); // プラットフォーム非依存
    if (event.shiftKey) modifiers.push('shift');
    if (event.altKey) modifiers.push('alt');
    // 注: スペースキーの状態は別途グローバル状態管理が必要
    return modifiers;
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
  action?: 'click' | 'drag'; // クリックかドラッグか
  wheel?: 'up' | 'down' | boolean;
  gesture?: GestureType;
  modifiers?: string[];
  type: 'button' | 'wheel' | 'gesture';
}

export interface DragState {
  startX: number;
  startY: number;
  button: number;
  modifiers: string[];
  lastX?: number;
  lastY?: number;
}

// パン操作用の統一イベントタイプ
export interface PanEvent {
  originalEvent: PointerEvent;
  deltaX: number;
  deltaY: number;
  clientX: number;
  clientY: number;
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
  
  // マウスによるパン操作（ドラッグ）
  let panStartCamera: { x: number; y: number } | null = null;
  
  manager.registerCommand('pan:start', (event: PointerEvent) => {
    // パン開始時のカメラ位置を記録
    panStartCamera = { ...store.camera };
    event.preventDefault();
    return true;
  });
  
  manager.registerCommand('pan:move', (event: PanEvent) => {
    if (!panStartCamera) return false;
    
    // ドラッグ量に応じてカメラを移動
    // マウスを右にドラッグ → ビューポートを左に移動（カメラを右に移動）
    // これによりコンテンツが左にスクロールする感覚を実現
    const sensitivity = 1.0; // 感度調整
    const invertDirection = true; // trueの場合、自然なドラッグ感覚（コンテンツをつかんで動かす）
    
    if (invertDirection) {
      // コンテンツをつかんで動かす感覚（推奨）
      store.setCamera({
        x: panStartCamera.x - event.deltaX * sensitivity,
        y: panStartCamera.y - event.deltaY * sensitivity
      });
    } else {
      // ビューポートを動かす感覚
      store.setCamera({
        x: panStartCamera.x + event.deltaX * sensitivity,
        y: panStartCamera.y + event.deltaY * sensitivity
      });
    }
    return true;
  });
  
  manager.registerCommand('pan:end', () => {
    panStartCamera = null;
    return true;
  });
  
  // キーボード併用パン操作（手のひらツール）
  // スペースキー押下状態はKeyboardManagerで管理
  let isSpacePressed = false;
  
  // KeyboardManagerからの状態通知を受信
  keyboardManager.on('space:down', () => {
    isSpacePressed = true;
    document.body.style.cursor = 'grab';
  });
  
  keyboardManager.on('space:up', () => {
    isSpacePressed = false;
    document.body.style.cursor = 'default';
  });
  
  // マウス操作時にスペースキー状態をチェック
  manager.registerCommand('drag:start', (event: PointerEvent) => {
    if (isSpacePressed && event.button === 0) { // スペース+左クリック
      panStartCamera = { ...store.camera };
      document.body.style.cursor = 'grabbing';
      event.preventDefault();
      return true;
    }
    return false;
  });
  
  manager.registerCommand('drag:move', (event: PanEvent) => {
    if (!panStartCamera || !isSpacePressed) return false;
    
    // 自然なドラッグ感覚（コンテンツをつかんで動かす）
    store.setCamera({
      x: panStartCamera.x - event.deltaX,  // 反転
      y: panStartCamera.y - event.deltaY   // 反転
    });
    return true;
  });
  
  manager.registerCommand('drag:end', () => {
    if (panStartCamera) {
      panStartCamera = null;
      if (isSpacePressed) {
        document.body.style.cursor = 'grab';
      } else {
        document.body.style.cursor = 'default';
      }
    }
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
  
  // Shift+ホイールで水平スクロール
  manager.registerCommand('horizontalScroll', (event: WheelEvent) => {
    event.preventDefault();
    const scrollAmount = event.deltaY * 0.5;
    
    store.setCamera({
      x: store.camera.x - scrollAmount
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

### フェーズ4: apps/whiteboardへの統合（2-3日）

#### 4.1 アプリケーション層への統合

##### 実装詳細

```tsx
// apps/whiteboard/src/app.tsx
import { InputProvider } from '@usketch/react-canvas';
import { defaultKeymap, vimKeymap } from '@usketch/input-presets';
import { defaultMouseMap, trackpadPreset } from '@usketch/input-presets';

export function App() {
  const [keyboardPreset, setKeyboardPreset] = useState(
    localStorage.getItem('keyboardPreset') || 'default'
  );
  const [mousePreset, setMousePreset] = useState(
    localStorage.getItem('mousePreset') || 'default'
  );

  const customKeyBindings = useMemo(() => {
    const saved = localStorage.getItem('customKeyBindings');
    return saved ? JSON.parse(saved) : {};
  }, []);

  const customMouseBindings = useMemo(() => {
    const saved = localStorage.getItem('customMouseBindings');
    return saved ? JSON.parse(saved) : {};
  }, []);

  const handleInputBindingChange = useCallback((type: string, bindings: any) => {
    localStorage.setItem(`custom${type}Bindings`, JSON.stringify(bindings));
  }, []);

  return (
    <InputProvider
      keyboardPreset={keyboardPreset === 'vim' ? vimKeymap : defaultKeymap}
      mousePreset={mousePreset === 'trackpad' ? trackpadPreset : defaultMouseMap}
      customKeyBindings={customKeyBindings}
      customMouseBindings={customMouseBindings}
      onBindingChange={handleInputBindingChange}
    >
      <WhiteboardCanvas />
      <SettingsPanel 
        onKeyboardPresetChange={setKeyboardPreset}
        onMousePresetChange={setMousePreset}
      />
    </InputProvider>
  );
}
```

##### グローバル入力設定の初期化

```tsx
// apps/whiteboard/src/providers/app-input-provider.tsx
import { useInput } from '@usketch/react-canvas';
import { useWhiteboardStore } from '@usketch/store';

export const AppInputProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { keyboard, mouse } = useInput();
  const store = useWhiteboardStore();
  
  useEffect(() => {
    if (!keyboard || !mouse) return;

    // アプリケーション固有のコマンドハンドラー登録
    
    // プロパティパネルのトグル
    keyboard.registerCommand('togglePropertyPanel', () => {
      store.togglePropertyPanel();
      return true;
    });

    // デバッグパネルのトグル
    keyboard.registerCommand('toggleDebugPanel', () => {
      store.toggleDebugPanel();
      return true;
    });

    // スタイルのコピー＆ペースト
    let copiedStyle: ShapeStyle | null = null;
    
    keyboard.registerCommand('copyStyle', () => {
      const selectedShapes = store.getSelectedShapes();
      if (selectedShapes.length > 0) {
        copiedStyle = selectedShapes[0].style;
        return true;
      }
      return false;
    });

    keyboard.registerCommand('pasteStyle', () => {
      if (copiedStyle) {
        const selectedShapes = store.getSelectedShapes();
        selectedShapes.forEach(shape => {
          store.updateShapeStyle(shape.id, copiedStyle);
        });
        return true;
      }
      return false;
    });

    // エクスポート機能
    keyboard.registerCommand('exportAsPNG', () => {
      exportCanvasAsPNG();
      return true;
    });

    keyboard.registerCommand('exportAsSVG', () => {
      exportCanvasAsSVG();
      return true;
    });
    
    // クリーンアップ
    return () => {
      keyboard.unregisterCommand('togglePropertyPanel');
      keyboard.unregisterCommand('toggleDebugPanel');
      keyboard.unregisterCommand('copyStyle');
      keyboard.unregisterCommand('pasteStyle');
      keyboard.unregisterCommand('exportAsPNG');
      keyboard.unregisterCommand('exportAsSVG');
    };
  }, [keyboard, mouse, store]);

  return <>{children}</>;
};
```

#### 4.2 既存機能の移行

##### 移行対象ファイル

1. `apps/whiteboard/src/hooks/use-keyboard-shortcuts.ts` → 削除
2. 重複実装の統合

```tsx
// 移行前 (apps/whiteboard/src/hooks/use-keyboard-shortcuts.ts)
const handleKeyDown = (e: KeyboardEvent) => {
  // 旧実装...
};

// 移行後 (InputProviderに統合済み)
// すべてのキーボードショートカットは@usketch/input-managerで管理
```

##### 重複解消の実装

```tsx
// packages/react-canvas/src/commands/register-all-commands.ts
export function registerAllCommands(
  keyboard: KeyboardManager,
  mouse: MouseManager,
  store: WhiteboardStore
) {
  // 基本コマンド（削除、選択、エスケープ等）
  registerBasicCommands(keyboard, store);
  
  // ツール切り替えコマンド
  registerToolCommands(keyboard, store);
  
  // アライメントコマンド
  registerAlignmentCommands(keyboard, store);
  
  // カメラ操作コマンド
  registerCameraCommands(keyboard, mouse, store);
  
  // Undo/Redoコマンド（重複を解消）
  registerHistoryCommands(keyboard, store);
  
  // スナップコマンド
  registerSnapCommands(keyboard, store);
}
```

#### 4.3 設定UIの実装

##### 入力設定パネル

```tsx
// apps/whiteboard/src/components/settings/input-settings.tsx
import { useInput } from '@usketch/react-canvas';
import { availablePresets } from '@usketch/input-presets';

export const InputSettings: React.FC = () => {
  const { 
    keyBindings, 
    mouseBindings, 
    updateKeyBinding, 
    updateMouseBinding,
    resetToPreset 
  } = useInput();
  
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState(false);
  
  const handleRecordKeys = (command: string) => {
    setEditingCommand(command);
    setRecordingKeys(true);
  };
  
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!recordingKeys || !editingCommand) return;
    
    e.preventDefault();
    const keys = normalizeKeyEvent(e);
    updateKeyBinding(editingCommand, [keys]);
    setRecordingKeys(false);
    setEditingCommand(null);
  }, [recordingKeys, editingCommand, updateKeyBinding]);
  
  useEffect(() => {
    if (recordingKeys) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [recordingKeys, handleKeyPress]);
  
  return (
    <div className="input-settings">
      <Tabs defaultValue="keyboard">
        <TabsList>
          <TabsTrigger value="keyboard">キーボード</TabsTrigger>
          <TabsTrigger value="mouse">マウス</TabsTrigger>
          <TabsTrigger value="gestures">ジェスチャー</TabsTrigger>
        </TabsList>
        
        <TabsContent value="keyboard">
          <div className="preset-selector">
            <Select onValueChange={(preset) => resetToPreset('keyboard', preset)}>
              <SelectTrigger>
                <SelectValue placeholder="プリセットを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="vim">Vim-style</SelectItem>
                <SelectItem value="custom">カスタム</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="keybindings-list">
            {Object.entries(keyBindings).map(([command, keys]) => (
              <div key={command} className="keybinding-item">
                <span className="command-name">{command}</span>
                <span className="keys">{keys.join(', ')}</span>
                <Button
                  size="sm"
                  onClick={() => handleRecordKeys(command)}
                  disabled={recordingKeys}
                >
                  {editingCommand === command && recordingKeys ? 'キー入力待機中...' : '変更'}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="mouse">
          <div className="preset-selector">
            <Select onValueChange={(preset) => resetToPreset('mouse', preset)}>
              <SelectTrigger>
                <SelectValue placeholder="プリセットを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Standard Mouse</SelectItem>
                <SelectItem value="trackpad">Trackpad</SelectItem>
                <SelectItem value="gaming">Gaming Mouse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="mouse-bindings-list">
            {Object.entries(mouseBindings).map(([command, binding]) => (
              <MouseBindingEditor
                key={command}
                command={command}
                binding={binding}
                onChange={(newBinding) => updateMouseBinding(command, newBinding)}
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="gestures">
          <GestureSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

##### ローカルストレージへの永続化

```tsx
// apps/whiteboard/src/hooks/use-persisted-input-settings.ts
export const usePersistedInputSettings = () => {
  const { keyBindings, mouseBindings } = useInput();
  
  // 設定変更時に自動保存
  useEffect(() => {
    localStorage.setItem('keyBindings', JSON.stringify(keyBindings));
  }, [keyBindings]);
  
  useEffect(() => {
    localStorage.setItem('mouseBindings', JSON.stringify(mouseBindings));
  }, [mouseBindings]);
  
  // 初回ロード時に復元
  useEffect(() => {
    const savedKeyBindings = localStorage.getItem('keyBindings');
    const savedMouseBindings = localStorage.getItem('mouseBindings');
    
    if (savedKeyBindings) {
      const bindings = JSON.parse(savedKeyBindings);
      Object.entries(bindings).forEach(([command, keys]) => {
        updateKeyBinding(command, keys as string[]);
      });
    }
    
    if (savedMouseBindings) {
      const bindings = JSON.parse(savedMouseBindings);
      Object.entries(bindings).forEach(([command, binding]) => {
        updateMouseBinding(command, binding as MouseBinding);
      });
    }
  }, []);
};
```

#### 4.4 パフォーマンス最適化

```tsx
// apps/whiteboard/src/hooks/use-optimized-input.ts
export const useOptimizedInput = () => {
  const { keyboard, mouse } = useInput();
  
  // イベントハンドラーのメモ化
  const handleKeyDown = useMemo(() => 
    throttle((e: KeyboardEvent) => keyboard?.handleKeyDown(e), 10),
    [keyboard]
  );
  
  const handlePointerMove = useMemo(() =>
    throttle((e: PointerEvent) => mouse?.handlePointerMove(e), 5),
    [mouse]
  );
  
  // デバウンス処理
  const handleWheel = useMemo(() =>
    debounce((e: WheelEvent) => mouse?.handleWheel(e), 50),
    [mouse]
  );
  
  // メモリリーク対策
  useEffect(() => {
    const controller = new AbortController();
    
    document.addEventListener('keydown', handleKeyDown, { 
      signal: controller.signal 
    });
    document.addEventListener('pointermove', handlePointerMove, { 
      signal: controller.signal,
      passive: true
    });
    document.addEventListener('wheel', handleWheel, { 
      signal: controller.signal,
      passive: false
    });
    
    return () => controller.abort();
  }, [handleKeyDown, handlePointerMove, handleWheel]);
};
```

#### 4.5 統合テスト

```tsx
// apps/e2e/tests/input-integration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Input System Integration', () => {
  test('keyboard shortcuts work with InputProvider', async ({ page }) => {
    await page.goto('/');
    
    // 矩形ツールへの切り替え
    await page.keyboard.press('r');
    const activeTool = await page.getAttribute('[data-testid="active-tool"]', 'data-tool');
    expect(activeTool).toBe('rectangle');
    
    // Undo/Redo
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    
    // カメラ操作
    await page.keyboard.press('Control+=');
    const zoom = await page.getAttribute('[data-testid="zoom-level"]', 'data-zoom');
    expect(parseFloat(zoom)).toBeGreaterThan(1);
  });
  
  test('mouse operations work with InputProvider', async ({ page }) => {
    await page.goto('/');
    
    // ホイールズーム
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
    
    // 中クリックパン
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(100, 100);
    await page.mouse.up({ button: 'middle' });
    
    // スペース+ドラッグパン
    await page.keyboard.down('Space');
    await page.mouse.down();
    await page.mouse.move(200, 200);
    await page.mouse.up();
    await page.keyboard.up('Space');
  });
  
  test('settings UI persists configuration', async ({ page }) => {
    await page.goto('/settings');
    
    // プリセット変更
    await page.selectOption('[data-testid="keyboard-preset"]', 'vim');
    await page.reload();
    
    const preset = await page.inputValue('[data-testid="keyboard-preset"]');
    expect(preset).toBe('vim');
    
    // カスタムバインディング
    await page.click('[data-testid="edit-binding-zoomIn"]');
    await page.keyboard.press('Alt+Plus');
    
    await page.reload();
    const binding = await page.textContent('[data-testid="binding-zoomIn"]');
    expect(binding).toContain('Alt+Plus');
  });
});
```

### フェーズ5: UI実装（2-3日）

1. 入力設定パネルコンポーネント
2. キーボード・マウスバインディング表示
3. カスタマイズUI（キー割り当て、マウスボタン設定）
4. プリセット選択UI
5. ジェスチャー設定UI

### フェーズ6: テスト・最適化（2日）

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
// 中クリック + ドラッグ: カメラパン（上下左右移動）
// スペース + 左ドラッグ: 手のひらツールパン
// スペース + 右ドラッグ: 代替パン
// Shift + ホイール: 水平スクロール
// Cmd/Ctrl + ホイール: 精密ズーム

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

## 更新されたタイムライン（apps/whiteboard統合版）

### 全体期間: 12-15日（当初10-12日から延長）

#### 詳細スケジュール

**週1（5日）**
- Day 1-2: `@usketch/input-presets` パッケージ作成
- Day 3-4: `@usketch/input-manager` パッケージ作成（KeyboardManager, MouseManager）
- Day 5: `@usketch/input-manager` パッケージ作成（GestureManager, コマンドシステム）

**週2（5日）**
- Day 6: カメラ操作実装（Store統合、基本コマンド）
- Day 7: カメラ操作実装（マウス/ジェスチャー対応）
- Day 8-9: React統合層（InputProvider, useInputフック）
- Day 10: apps/whiteboardへの統合（基本統合）

**週3（4-5日）**
- Day 11: apps/whiteboardへの統合（既存機能移行、重複解消）
- Day 12: apps/whiteboardへの統合（設定UI、永続化）
- Day 13: UI実装とパフォーマンス最適化
- Day 14: テスト作成（ユニット、E2E、統合テスト）
- Day 15: ドキュメント作成と最終調整

### フェーズ別所要時間の内訳

1. **パッケージ構築**: 4-5日（変更なし）
2. **カメラ操作実装**: 2日（変更なし）
3. **React統合**: 2日（1日短縮）
4. **apps/whiteboard統合**: 3日（新規追加）
5. **UI実装**: 1-2日（1日短縮）
6. **テスト・最適化**: 2日（変更なし）

### 追加作業による影響

**追加された作業**:
- アプリケーション層への深い統合
- 既存機能の完全移行
- 設定の永続化機能
- 統合テストの充実

**効率化による短縮**:
- React統合とUI実装の一部をapps/whiteboard統合に吸収
- 並行作業可能な部分の特定

## 実装優先順位

1. **高優先度**
   - キーボードショートカット基盤
   - apps/whiteboardへの基本統合
   - マウスホイールズーム
   - 基本的なプリセット

2. **中優先度**
   - 設定UI実装
   - ジェスチャー認識
   - カスタマイズUI
   - トラックパッド最適化

3. **低優先度**
   - 高度なジェスチャー
   - マクロ機能
   - アニメーション付きカメラ操作
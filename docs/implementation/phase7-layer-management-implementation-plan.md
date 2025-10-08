# Phase 7: レイヤー管理とグループ化機能 実装計画

## 📋 概要

Phase 7では、uSketchにレイヤー管理とグループ化機能を追加し、複雑な図形の整理と管理を可能にします。この実装により、プロフェッショナルなデザインツールとしての基盤が整います。

## 🎯 実装目標

### 主要機能
1. **レイヤーパネルUI**: レイヤーの一覧表示と管理
2. **レイヤー操作**: 表示/非表示、ロック、透明度調整
3. **グループ化**: 複数形状のグループ化とネスト対応
4. **Z-index管理**: 前面/背面への移動と順序制御
5. **ドラッグ&ドロップ**: 直感的なレイヤー並び替え

## 📊 現状分析

### 実装済みの基盤

#### 型定義
```typescript
// packages/shared-types/src/index.ts
interface BaseShape {
  id: string;
  type: "rectangle" | "ellipse" | "line" | "text" | "freedraw";
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  // ... スタイルプロパティ
}

type Shape = RectangleShape | EllipseShape | LineShape | TextShape | FreedrawShape;
```

#### ストア機能
- ✅ 形状の管理（shapes: Record<string, Shape>）
- ✅ 選択管理（selectedShapeIds: Set<string>）
- ✅ Undo/Redoシステム（CommandPattern）
- ❌ レイヤー順序管理（未実装）
- ❌ グループ構造（未実装）
- ❌ 可視性・ロック状態（未実装）

#### レンダリング
- ✅ 形状のレンダリング（React Shapes）
- ❌ Z-index順でのレンダリング（現在は追加順）
- ❌ 非表示形状のスキップ（未実装）

### 必要な新規機能
- レイヤー順序配列（zOrder）
- グループ構造の型定義
- レイヤーメタデータ（名前、可視性、ロック状態）
- レイヤーパネルUIコンポーネント

## 🏗️ 実装計画

### Phase 7.1: データ構造とストア拡張（3日）

#### 1. 型定義の拡張

```typescript
// packages/shared-types/src/layer.ts（新規）

/**
 * レイヤーメタデータ
 * 各形状に紐づくレイヤー情報
 */
export interface LayerMetadata {
  /** レイヤー名（未設定の場合は形状タイプから自動生成） */
  name?: string;
  /** 可視性 */
  visible: boolean;
  /** ロック状態（ロック時は選択・編集不可） */
  locked: boolean;
  /** 親グループID（グループ化されている場合） */
  parentId?: string;
  /** Z-index順での位置（小さいほど背面） */
  zIndex: number;
}

/**
 * グループ情報
 * 複数の形状をまとめて管理
 */
export interface ShapeGroup {
  /** グループID */
  id: string;
  /** グループ名 */
  name: string;
  /** グループに含まれる形状ID配列 */
  childIds: string[];
  /** 親グループID（ネストされたグループの場合） */
  parentId?: string;
  /** 可視性（グループ全体の表示/非表示） */
  visible: boolean;
  /** ロック状態（グループ全体のロック） */
  locked: boolean;
  /** 折りたたみ状態（UIでの表示用） */
  collapsed: boolean;
  /** Z-index順での位置 */
  zIndex: number;
}

/**
 * レイヤーツリーのノード
 * UIでの階層表示用
 */
export type LayerTreeNode =
  | { type: 'shape'; shape: Shape; metadata: LayerMetadata }
  | { type: 'group'; group: ShapeGroup };
```

#### 2. Shape型の拡張

```typescript
// packages/shared-types/src/index.ts
export interface BaseShape {
  id: string;
  type: "rectangle" | "ellipse" | "line" | "text" | "freedraw";
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  shadow?: ShadowProperties;

  // 新規追加: レイヤー情報
  layer?: LayerMetadata;
}
```

#### 3. レイヤー管理用のストア拡張

```typescript
// packages/store/src/slices/layer-slice.ts（新規）

export interface LayerState {
  /** グループ情報のマップ */
  groups: Record<string, ShapeGroup>;

  /** Z-index順の配列（形状IDまたはグループID） */
  zOrder: string[];

  /** レイヤーパネルの開閉状態 */
  layerPanelOpen: boolean;

  /** 現在選択中のレイヤー（プロパティ表示用） */
  selectedLayerId: string | null;
}

export interface LayerActions {
  // グループ操作
  /** 選択中の形状をグループ化 */
  groupShapes: (name?: string) => string | null;

  /** グループを解除 */
  ungroupShapes: (groupId: string) => void;

  /** グループに形状を追加 */
  addToGroup: (groupId: string, shapeIds: string[]) => void;

  /** グループから形状を削除 */
  removeFromGroup: (groupId: string, shapeIds: string[]) => void;

  /** グループ名を変更 */
  renameGroup: (groupId: string, name: string) => void;

  // レイヤー可視性
  /** 形状の可視性を切り替え */
  toggleShapeVisibility: (shapeId: string) => void;

  /** グループの可視性を切り替え */
  toggleGroupVisibility: (groupId: string) => void;

  // レイヤーロック
  /** 形状のロック状態を切り替え */
  toggleShapeLock: (shapeId: string) => void;

  /** グループのロック状態を切り替え */
  toggleGroupLock: (groupId: string) => void;

  // Z-index操作
  /** 形状を最前面に移動 */
  bringToFront: (id: string) => void;

  /** 形状を最背面に移動 */
  sendToBack: (id: string) => void;

  /** 形状を1つ前面に移動 */
  bringForward: (id: string) => void;

  /** 形状を1つ背面に移動 */
  sendBackward: (id: string) => void;

  /** Z-index順を直接設定（ドラッグ&ドロップ用） */
  reorderLayers: (newOrder: string[]) => void;

  // レイヤーパネル
  /** レイヤーパネルの開閉を切り替え */
  toggleLayerPanel: () => void;

  /** レイヤー選択 */
  selectLayer: (id: string) => void;

  // ユーティリティ
  /** レイヤーツリーを取得（UI表示用） */
  getLayerTree: () => LayerTreeNode[];

  /** 形状のレイヤー名を取得（自動生成含む） */
  getLayerName: (shapeId: string) => string;
}

export type LayerSlice = LayerState & LayerActions;
```

#### 4. デフォルト値の定義

```typescript
// packages/shared-types/src/defaults/layer-defaults.ts（新規）

export const DEFAULT_LAYER_METADATA: LayerMetadata = {
  visible: true,
  locked: false,
  zIndex: 0,
};

export const createDefaultGroup = (name: string): Omit<ShapeGroup, 'id'> => ({
  name,
  childIds: [],
  visible: true,
  locked: false,
  collapsed: false,
  zIndex: 0,
});
```

### Phase 7.2: レイヤー操作ロジック実装（4日）

#### 1. グループ化コマンド

```typescript
// packages/store/src/commands/layer/group-shapes-command.ts（新規）

export class GroupShapesCommand implements Command {
  constructor(
    private shapeIds: string[],
    private groupName: string,
    private groupId: string,
  ) {}

  execute(context: CommandContext): void {
    const state = context.getState();

    // グループを作成
    const newGroup: ShapeGroup = {
      id: this.groupId,
      name: this.groupName,
      childIds: [...this.shapeIds],
      visible: true,
      locked: false,
      collapsed: false,
      zIndex: Math.max(...this.shapeIds.map(id => {
        const shape = state.shapes[id];
        return shape?.layer?.zIndex ?? 0;
      })),
    };

    context.setState(state => {
      // グループを追加
      state.groups[this.groupId] = newGroup;

      // 各形状の親IDを設定
      this.shapeIds.forEach(id => {
        const shape = state.shapes[id];
        if (shape) {
          if (!shape.layer) {
            shape.layer = { ...DEFAULT_LAYER_METADATA };
          }
          shape.layer.parentId = this.groupId;
        }
      });

      // zOrderを更新
      this.updateZOrder(state);
    });
  }

  undo(context: CommandContext): void {
    context.setState(state => {
      // グループを削除
      delete state.groups[this.groupId];

      // 各形状の親IDをクリア
      this.shapeIds.forEach(id => {
        const shape = state.shapes[id];
        if (shape?.layer) {
          delete shape.layer.parentId;
        }
      });

      // zOrderを更新
      this.updateZOrder(state);
    });
  }

  private updateZOrder(state: WhiteboardState): void {
    // zOrderの再計算ロジック
    // グループ化された形状は連続して配置される
  }
}
```

#### 2. Z-index操作コマンド

```typescript
// packages/store/src/commands/layer/reorder-command.ts（新規）

export class ReorderCommand implements Command {
  constructor(
    private itemId: string,
    private oldIndex: number,
    private newIndex: number,
  ) {}

  execute(context: CommandContext): void {
    context.setState(state => {
      const zOrder = [...state.zOrder];

      // 配列から要素を削除して新しい位置に挿入
      zOrder.splice(this.oldIndex, 1);
      zOrder.splice(this.newIndex, 0, this.itemId);

      state.zOrder = zOrder;

      // 各要素のzIndexを更新
      this.updateZIndices(state, zOrder);
    });
  }

  undo(context: CommandContext): void {
    context.setState(state => {
      const zOrder = [...state.zOrder];

      // 元の位置に戻す
      zOrder.splice(this.newIndex, 1);
      zOrder.splice(this.oldIndex, 0, this.itemId);

      state.zOrder = zOrder;

      // 各要素のzIndexを更新
      this.updateZIndices(state, zOrder);
    });
  }

  private updateZIndices(state: WhiteboardState, zOrder: string[]): void {
    zOrder.forEach((id, index) => {
      if (state.shapes[id]) {
        if (!state.shapes[id].layer) {
          state.shapes[id].layer = { ...DEFAULT_LAYER_METADATA };
        }
        state.shapes[id].layer!.zIndex = index;
      } else if (state.groups[id]) {
        state.groups[id].zIndex = index;
      }
    });
  }
}
```

#### 3. レイヤーSliceの実装

```typescript
// packages/store/src/slices/layer-slice.ts

export const createLayerSlice: StateCreator<StoreState, [], [], LayerSlice> = (
  set,
  get,
) => ({
  // Initial state
  groups: {},
  zOrder: [],
  layerPanelOpen: false,
  selectedLayerId: null,

  // Actions
  groupShapes: (name?: string) => {
    const { selectedShapeIds, shapes, executeCommand } = get();
    if (selectedShapeIds.size < 2) return null;

    const shapeIds = Array.from(selectedShapeIds);
    const groupId = nanoid();
    const groupName = name || `グループ ${Object.keys(get().groups).length + 1}`;

    const command = new GroupShapesCommand(shapeIds, groupName, groupId);
    executeCommand(command);

    return groupId;
  },

  ungroupShapes: (groupId: string) => {
    const { groups, executeCommand } = get();
    const group = groups[groupId];
    if (!group) return;

    const command = new UngroupShapesCommand(groupId, group.childIds);
    executeCommand(command);
  },

  toggleShapeVisibility: (shapeId: string) => {
    set((state) => {
      const shape = state.shapes[shapeId];
      if (!shape) return;

      if (!shape.layer) {
        shape.layer = { ...DEFAULT_LAYER_METADATA };
      }
      shape.layer.visible = !shape.layer.visible;
    });
  },

  toggleGroupVisibility: (groupId: string) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group) return;

      group.visible = !group.visible;

      // グループ内の全形状の可視性も更新
      group.childIds.forEach(id => {
        const shape = state.shapes[id];
        if (shape) {
          if (!shape.layer) {
            shape.layer = { ...DEFAULT_LAYER_METADATA };
          }
          shape.layer.visible = group.visible;
        }
      });
    });
  },

  bringToFront: (id: string) => {
    const { zOrder, executeCommand } = get();
    const currentIndex = zOrder.indexOf(id);
    if (currentIndex === -1 || currentIndex === zOrder.length - 1) return;

    const command = new ReorderCommand(id, currentIndex, zOrder.length - 1);
    executeCommand(command);
  },

  sendToBack: (id: string) => {
    const { zOrder, executeCommand } = get();
    const currentIndex = zOrder.indexOf(id);
    if (currentIndex === -1 || currentIndex === 0) return;

    const command = new ReorderCommand(id, currentIndex, 0);
    executeCommand(command);
  },

  bringForward: (id: string) => {
    const { zOrder, executeCommand } = get();
    const currentIndex = zOrder.indexOf(id);
    if (currentIndex === -1 || currentIndex === zOrder.length - 1) return;

    const command = new ReorderCommand(id, currentIndex, currentIndex + 1);
    executeCommand(command);
  },

  sendBackward: (id: string) => {
    const { zOrder, executeCommand } = get();
    const currentIndex = zOrder.indexOf(id);
    if (currentIndex === -1 || currentIndex === 0) return;

    const command = new ReorderCommand(id, currentIndex, currentIndex - 1);
    executeCommand(command);
  },

  reorderLayers: (newOrder: string[]) => {
    set((state) => {
      state.zOrder = newOrder;
      // zIndexを更新
      newOrder.forEach((id, index) => {
        if (state.shapes[id]) {
          if (!state.shapes[id].layer) {
            state.shapes[id].layer = { ...DEFAULT_LAYER_METADATA };
          }
          state.shapes[id].layer!.zIndex = index;
        } else if (state.groups[id]) {
          state.groups[id].zIndex = index;
        }
      });
    });
  },

  toggleLayerPanel: () => {
    set((state) => {
      state.layerPanelOpen = !state.layerPanelOpen;
    });
  },

  selectLayer: (id: string) => {
    set({ selectedLayerId: id });
  },

  getLayerTree: () => {
    const { shapes, groups, zOrder } = get();
    const tree: LayerTreeNode[] = [];

    // zOrder順に処理（逆順で最前面から表示）
    [...zOrder].reverse().forEach(id => {
      if (groups[id]) {
        tree.push({ type: 'group', group: groups[id] });
      } else if (shapes[id]) {
        const shape = shapes[id];
        const metadata = shape.layer || DEFAULT_LAYER_METADATA;

        // 親グループがない場合のみトップレベルに追加
        if (!metadata.parentId) {
          tree.push({ type: 'shape', shape, metadata });
        }
      }
    });

    return tree;
  },

  getLayerName: (shapeId: string) => {
    const { shapes } = get();
    const shape = shapes[shapeId];
    if (!shape) return '';

    // カスタム名が設定されている場合はそれを使用
    if (shape.layer?.name) {
      return shape.layer.name;
    }

    // 形状タイプから自動生成
    const typeNames: Record<string, string> = {
      rectangle: '長方形',
      ellipse: '楕円',
      line: '線',
      text: 'テキスト',
      freedraw: 'フリーハンド',
    };

    return typeNames[shape.type] || shape.type;
  },
});
```

### Phase 7.3: レイヤーパネルUI実装（5日）

#### 1. コンポーネント構造

```
apps/whiteboard/src/components/layer-panel/
├── index.ts
├── layer-panel.tsx              # メインコンテナ
├── layer-panel.css
├── layer-tree.tsx               # レイヤーツリー表示
├── layer-tree.css
├── layer-item/
│   ├── layer-item.tsx           # レイヤー項目（形状またはグループ）
│   ├── layer-item.css
│   ├── shape-layer-item.tsx     # 形状レイヤー項目
│   ├── group-layer-item.tsx     # グループレイヤー項目
│   └── layer-controls.tsx       # 可視性・ロックボタン
├── layer-thumbnail.tsx          # レイヤーサムネイル
├── layer-thumbnail.css
└── drag-drop-context.tsx        # ドラッグ&ドロップ機能
```

#### 2. レイヤーパネルのメインコンポーネント

```typescript
// apps/whiteboard/src/components/layer-panel/layer-panel.tsx

export const LayerPanel: React.FC = () => {
  const layerPanelOpen = useWhiteboardStore(state => state.layerPanelOpen);
  const toggleLayerPanel = useWhiteboardStore(state => state.toggleLayerPanel);
  const layerTree = useWhiteboardStore(state => state.getLayerTree());

  if (!layerPanelOpen) {
    return (
      <div className="layer-panel layer-panel--collapsed">
        <button
          type="button"
          className="layer-panel__toggle"
          onClick={toggleLayerPanel}
          aria-label="レイヤーパネルを開く"
        >
          <LayersIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel__header">
        <h3>レイヤー</h3>
        <div className="layer-panel__header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={toggleLayerPanel}
            aria-label="レイヤーパネルを閉じる"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="layer-panel__toolbar">
        <LayerToolbar />
      </div>

      <div className="layer-panel__content">
        <LayerTree nodes={layerTree} />
      </div>
    </div>
  );
};
```

#### 3. レイヤーツリーコンポーネント

```typescript
// apps/whiteboard/src/components/layer-panel/layer-tree.tsx

interface LayerTreeProps {
  nodes: LayerTreeNode[];
  level?: number;
}

export const LayerTree: React.FC<LayerTreeProps> = ({ nodes, level = 0 }) => {
  return (
    <div className="layer-tree" style={{ paddingLeft: `${level * 20}px` }}>
      {nodes.map(node => {
        if (node.type === 'group') {
          return (
            <GroupLayerItem
              key={node.group.id}
              group={node.group}
              level={level}
            />
          );
        } else {
          return (
            <ShapeLayerItem
              key={node.shape.id}
              shape={node.shape}
              metadata={node.metadata}
              level={level}
            />
          );
        }
      })}
    </div>
  );
};
```

#### 4. 形状レイヤー項目コンポーネント

```typescript
// apps/whiteboard/src/components/layer-panel/layer-item/shape-layer-item.tsx

interface ShapeLayerItemProps {
  shape: Shape;
  metadata: LayerMetadata;
  level: number;
}

export const ShapeLayerItem: React.FC<ShapeLayerItemProps> = ({
  shape,
  metadata,
  level,
}) => {
  const selectedShapeIds = useWhiteboardStore(state => state.selectedShapeIds);
  const selectShape = useWhiteboardStore(state => state.selectShape);
  const clearSelection = useWhiteboardStore(state => state.clearSelection);
  const toggleShapeVisibility = useWhiteboardStore(state => state.toggleShapeVisibility);
  const toggleShapeLock = useWhiteboardStore(state => state.toggleShapeLock);
  const getLayerName = useWhiteboardStore(state => state.getLayerName);

  const isSelected = selectedShapeIds.has(shape.id);
  const layerName = getLayerName(shape.id);

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // 複数選択
      selectShape(shape.id);
    } else {
      clearSelection();
      selectShape(shape.id);
    }
  };

  return (
    <div
      className={`layer-item ${isSelected ? 'layer-item--selected' : ''} ${
        metadata.locked ? 'layer-item--locked' : ''
      }`}
      onClick={handleClick}
      style={{ paddingLeft: `${level * 20}px` }}
    >
      <LayerThumbnail shape={shape} />

      <span className="layer-item__name">{layerName}</span>

      <div className="layer-item__controls">
        <button
          type="button"
          className="icon-button"
          onClick={(e) => {
            e.stopPropagation();
            toggleShapeVisibility(shape.id);
          }}
          aria-label={metadata.visible ? '非表示' : '表示'}
        >
          {metadata.visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={(e) => {
            e.stopPropagation();
            toggleShapeLock(shape.id);
          }}
          aria-label={metadata.locked ? 'ロック解除' : 'ロック'}
        >
          {metadata.locked ? <LockIcon /> : <UnlockIcon />}
        </button>
      </div>
    </div>
  );
};
```

#### 5. グループレイヤー項目コンポーネント

```typescript
// apps/whiteboard/src/components/layer-panel/layer-item/group-layer-item.tsx

interface GroupLayerItemProps {
  group: ShapeGroup;
  level: number;
}

export const GroupLayerItem: React.FC<GroupLayerItemProps> = ({
  group,
  level,
}) => {
  const [isExpanded, setIsExpanded] = useState(!group.collapsed);
  const shapes = useWhiteboardStore(state => state.shapes);
  const toggleGroupVisibility = useWhiteboardStore(state => state.toggleGroupVisibility);
  const toggleGroupLock = useWhiteboardStore(state => state.toggleGroupLock);

  const childShapes = group.childIds
    .map(id => shapes[id])
    .filter(Boolean);

  return (
    <div className="layer-item layer-item--group">
      <div
        className="layer-item__header"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        <button
          type="button"
          className="layer-item__expand"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? '折りたたむ' : '展開'}
        >
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>

        <FolderIcon />

        <span className="layer-item__name">{group.name}</span>

        <span className="layer-item__count">({group.childIds.length})</span>

        <div className="layer-item__controls">
          <button
            type="button"
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation();
              toggleGroupVisibility(group.id);
            }}
            aria-label={group.visible ? '非表示' : '表示'}
          >
            {group.visible ? <EyeIcon /> : <EyeOffIcon />}
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation();
              toggleGroupLock(group.id);
            }}
            aria-label={group.locked ? 'ロック解除' : 'ロック'}
          >
            {group.locked ? <LockIcon /> : <UnlockIcon />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="layer-item__children">
          {childShapes.map(shape => (
            <ShapeLayerItem
              key={shape.id}
              shape={shape}
              metadata={shape.layer || DEFAULT_LAYER_METADATA}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

#### 6. レイヤーツールバー

```typescript
// apps/whiteboard/src/components/layer-panel/layer-toolbar.tsx

export const LayerToolbar: React.FC = () => {
  const selectedShapeIds = useWhiteboardStore(state => state.selectedShapeIds);
  const groupShapes = useWhiteboardStore(state => state.groupShapes);
  const ungroupShapes = useWhiteboardStore(state => state.ungroupShapes);
  const bringToFront = useWhiteboardStore(state => state.bringToFront);
  const sendToBack = useWhiteboardStore(state => state.sendToBack);

  const canGroup = selectedShapeIds.size >= 2;

  return (
    <div className="layer-toolbar">
      <button
        type="button"
        className="icon-button"
        disabled={!canGroup}
        onClick={() => groupShapes()}
        title="グループ化"
      >
        <GroupIcon />
      </button>

      <button
        type="button"
        className="icon-button"
        disabled={selectedShapeIds.size === 0}
        title="グループ解除"
      >
        <UngroupIcon />
      </button>

      <div className="toolbar-divider" />

      <button
        type="button"
        className="icon-button"
        disabled={selectedShapeIds.size === 0}
        onClick={() => {
          selectedShapeIds.forEach(id => bringToFront(id));
        }}
        title="最前面へ"
      >
        <BringToFrontIcon />
      </button>

      <button
        type="button"
        className="icon-button"
        disabled={selectedShapeIds.size === 0}
        onClick={() => {
          selectedShapeIds.forEach(id => sendToBack(id));
        }}
        title="最背面へ"
      >
        <SendToBackIcon />
      </button>
    </div>
  );
};
```

### Phase 7.4: ドラッグ&ドロップ機能実装（3日）

#### 1. ドラッグ&ドロップライブラリの選定

**推奨ライブラリ**: `@dnd-kit/core` + `@dnd-kit/sortable`
- React 19対応
- 軽量かつ高性能
- アクセシビリティ対応
- TypeScript完全サポート

```json
// package.json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^9.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  }
}
```

#### 2. ドラッグ対応のレイヤーツリー

```typescript
// apps/whiteboard/src/components/layer-panel/layer-tree-draggable.tsx

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export const LayerTreeDraggable: React.FC<LayerTreeProps> = ({ nodes }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const reorderLayers = useWhiteboardStore(state => state.reorderLayers);
  const zOrder = useWhiteboardStore(state => state.zOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px移動したらドラッグ開始
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = zOrder.indexOf(active.id as string);
      const newIndex = zOrder.indexOf(over.id as string);

      const newOrder = arrayMove(zOrder, oldIndex, newIndex);
      reorderLayers(newOrder);
    }

    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={zOrder}
        strategy={verticalListSortingStrategy}
      >
        <div className="layer-tree">
          {nodes.map(node => (
            <SortableLayerItem
              key={node.type === 'group' ? node.group.id : node.shape.id}
              node={node}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId && (
          <div className="layer-item layer-item--dragging">
            ドラッグ中...
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

// ヘルパー関数
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = [...array];
  const [removed] = newArray.splice(from, 1);
  newArray.splice(to, 0, removed);
  return newArray;
}
```

#### 3. ソート可能なレイヤー項目

```typescript
// apps/whiteboard/src/components/layer-panel/sortable-layer-item.tsx

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableLayerItemProps {
  node: LayerTreeNode;
}

export const SortableLayerItem: React.FC<SortableLayerItemProps> = ({ node }) => {
  const id = node.type === 'group' ? node.group.id : node.shape.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {node.type === 'group' ? (
        <GroupLayerItem group={node.group} level={0} />
      ) : (
        <ShapeLayerItem
          shape={node.shape}
          metadata={node.metadata}
          level={0}
        />
      )}
    </div>
  );
};
```

### Phase 7.5: レンダリング最適化（2日）

#### 1. Z-index順でのレンダリング

```typescript
// packages/react-canvas/src/components/canvas-renderer.tsx

export const CanvasRenderer: React.FC = () => {
  const shapes = useWhiteboardStore(state => state.shapes);
  const zOrder = useWhiteboardStore(state => state.zOrder);

  // zOrder順（背面から前面）にソート
  const sortedShapeIds = useMemo(() => {
    return [...zOrder].filter(id => shapes[id]);
  }, [shapes, zOrder]);

  return (
    <div className="canvas-renderer">
      {sortedShapeIds.map(id => {
        const shape = shapes[id];

        // 非表示またはロックされた形状をスキップ
        if (!shape.layer?.visible) {
          return null;
        }

        return (
          <ShapeComponent
            key={id}
            shape={shape}
            isLocked={shape.layer?.locked}
          />
        );
      })}
    </div>
  );
};
```

#### 2. パフォーマンス最適化

```typescript
// レイヤー数が多い場合の仮想スクロール対応
// apps/whiteboard/src/components/layer-panel/layer-tree-virtualized.tsx

import { useVirtualizer } from '@tanstack/react-virtual';

export const LayerTreeVirtualized: React.FC<LayerTreeProps> = ({ nodes }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // レイヤー項目の高さ
    overscan: 5, // 表示外の項目も5個レンダリング
  });

  return (
    <div
      ref={parentRef}
      className="layer-tree-virtualized"
      style={{ height: '400px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => {
          const node = nodes[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {node.type === 'group' ? (
                <GroupLayerItem group={node.group} level={0} />
              ) : (
                <ShapeLayerItem
                  shape={node.shape}
                  metadata={node.metadata}
                  level={0}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

### Phase 7.6: ホワイトボードアプリへの統合（2日）

#### 1. レイアウト更新

```typescript
// apps/whiteboard/src/components/layout.tsx

export const WhiteboardLayout: React.FC = () => {
  const propertyPanelOpen = useWhiteboardStore(state => state.selectedShapeIds.size > 0);
  const layerPanelOpen = useWhiteboardStore(state => state.layerPanelOpen);

  return (
    <div className="whiteboard-layout">
      <Toolbar />

      <div className="main-area">
        {/* 左サイドバー: レイヤーパネル */}
        {layerPanelOpen && (
          <aside className="left-sidebar">
            <LayerPanel />
          </aside>
        )}

        {/* メインキャンバス */}
        <div className="canvas-container">
          <Canvas />
        </div>

        {/* 右サイドバー: プロパティパネル */}
        {propertyPanelOpen && (
          <aside className="right-sidebar">
            <PropertyPanel />
          </aside>
        )}
      </div>
    </div>
  );
};
```

#### 2. ショートカットキー追加

```typescript
// apps/whiteboard/src/hooks/use-keyboard-shortcuts.ts

const shortcuts = {
  // 既存のショートカット
  'cmd+z': undo,
  'cmd+shift+z': redo,
  'cmd+c': copy,
  'cmd+v': paste,

  // 新規: グループ化
  'cmd+g': groupShapes,
  'cmd+shift+g': ungroupShapes,

  // 新規: レイヤー順序
  'cmd+]': bringForward,
  'cmd+[': sendBackward,
  'cmd+shift+]': bringToFront,
  'cmd+shift+[': sendToBack,

  // 新規: レイヤーパネル表示切替
  'cmd+shift+l': toggleLayerPanel,
};
```

#### 3. コンテキストメニュー拡張

```typescript
// apps/whiteboard/src/components/context-menu/context-menu.tsx

export const ContextMenu: React.FC<ContextMenuProps> = ({ position, targetId }) => {
  const groupShapes = useWhiteboardStore(state => state.groupShapes);
  const bringToFront = useWhiteboardStore(state => state.bringToFront);
  const sendToBack = useWhiteboardStore(state => state.sendToBack);
  const selectedShapeIds = useWhiteboardStore(state => state.selectedShapeIds);

  return (
    <div className="context-menu" style={{ top: position.y, left: position.x }}>
      {selectedShapeIds.size >= 2 && (
        <>
          <button onClick={() => groupShapes()}>
            グループ化 (Cmd+G)
          </button>
          <div className="divider" />
        </>
      )}

      <button onClick={() => bringToFront(targetId)}>
        最前面へ (Cmd+Shift+])
      </button>
      <button onClick={() => sendToBack(targetId)}>
        最背面へ (Cmd+Shift+[)
      </button>

      {/* その他のメニュー項目 */}
    </div>
  );
};
```

## 📅 実装スケジュール

### Week 1（10月7日〜10月13日）
- **Day 1-2**: データ構造設計と型定義
  - LayerMetadata, ShapeGroup型の定義
  - デフォルト値の作成
  - 既存Shape型の拡張

- **Day 3**: ストア拡張（LayerSlice基盤）
  - LayerState, LayerActionsの定義
  - 基本的なアクション実装

### Week 2（10月14日〜10月20日）
- **Day 4-6**: レイヤー操作ロジック実装
  - グループ化コマンド
  - Z-index操作コマンド
  - 可視性・ロック機能

- **Day 7-8**: LayerSliceの完成
  - 全アクションの実装
  - ユニットテスト作成

### Week 3（10月21日〜10月27日）
- **Day 9-11**: レイヤーパネルUI実装
  - 基本レイアウト
  - ShapeLayerItem, GroupLayerItem
  - レイヤーツールバー

- **Day 12-13**: ドラッグ&ドロップ実装
  - @dnd-kit統合
  - ソート可能なレイヤーツリー

### Week 4（10月28日〜11月1日）
- **Day 14**: レンダリング最適化
  - Z-index順レンダリング
  - 仮想スクロール対応（必要に応じて）

- **Day 15**: アプリケーション統合
  - レイアウト調整
  - ショートカットキー
  - コンテキストメニュー拡張

- **Day 16-17**: テストと品質保証
  - E2Eテスト作成
  - 各機能の動作確認
  - バグ修正

## 🧪 テスト計画

### ユニットテスト

```typescript
// packages/store/src/slices/__tests__/layer-slice.test.ts

describe('LayerSlice', () => {
  describe('グループ化', () => {
    test('複数形状をグループ化できる', () => {
      const store = createTestStore();
      // テストロジック
    });

    test('グループを解除できる', () => {
      // テストロジック
    });

    test('ネストされたグループを作成できる', () => {
      // テストロジック
    });
  });

  describe('Z-index操作', () => {
    test('形状を最前面に移動できる', () => {
      // テストロジック
    });

    test('形状を最背面に移動できる', () => {
      // テストロジック
    });

    test('ドラッグ&ドロップで順序を変更できる', () => {
      // テストロジック
    });
  });

  describe('可視性とロック', () => {
    test('形状の可視性を切り替えられる', () => {
      // テストロジック
    });

    test('ロックされた形状は選択できない', () => {
      // テストロジック
    });

    test('グループの可視性が子要素に反映される', () => {
      // テストロジック
    });
  });

  describe('Undo/Redo', () => {
    test('グループ化をUndoできる', () => {
      // テストロジック
    });

    test('Z-index変更をUndoできる', () => {
      // テストロジック
    });
  });
});
```

### E2Eテスト

```typescript
// apps/e2e/tests/layer-management.spec.ts

test('レイヤーパネルの基本操作', async ({ page }) => {
  // レイヤーパネルを開く
  await page.click('[data-testid="toggle-layer-panel"]');
  await expect(page.locator('.layer-panel')).toBeVisible();

  // 形状を作成
  await page.click('[data-testid="tool-rectangle"]');
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();

  // レイヤーが追加されたことを確認
  await expect(page.locator('.layer-item')).toHaveCount(1);
});

test('グループ化とグループ解除', async ({ page }) => {
  // 複数の形状を作成
  // ... (形状作成ロジック)

  // 全選択
  await page.keyboard.press('Meta+A');

  // グループ化
  await page.keyboard.press('Meta+G');

  // グループが作成されたことを確認
  await expect(page.locator('.layer-item--group')).toBeVisible();

  // グループ解除
  await page.keyboard.press('Meta+Shift+G');

  // グループが解除されたことを確認
  await expect(page.locator('.layer-item--group')).not.toBeVisible();
});

test('ドラッグ&ドロップでレイヤー順序を変更', async ({ page }) => {
  // 複数の形状を作成
  // ... (形状作成ロジック)

  // レイヤーパネルを開く
  await page.click('[data-testid="toggle-layer-panel"]');

  // 最初のレイヤーを取得
  const firstLayer = page.locator('.layer-item').first();
  const lastLayer = page.locator('.layer-item').last();

  // ドラッグ&ドロップ
  await firstLayer.dragTo(lastLayer);

  // 順序が変更されたことを確認
  // ... (検証ロジック)
});

test('可視性の切り替え', async ({ page }) => {
  // 形状を作成
  // ... (形状作成ロジック)

  // レイヤーパネルを開く
  await page.click('[data-testid="toggle-layer-panel"]');

  // 可視性ボタンをクリック
  await page.click('.layer-item [data-testid="toggle-visibility"]');

  // 形状が非表示になったことを確認
  await expect(page.locator('.shape-component')).not.toBeVisible();

  // もう一度クリックして表示
  await page.click('.layer-item [data-testid="toggle-visibility"]');

  // 形状が表示されたことを確認
  await expect(page.locator('.shape-component')).toBeVisible();
});

test('ショートカットキーでZ-index操作', async ({ page }) => {
  // 複数の形状を作成
  // ... (形状作成ロジック)

  // 最初の形状を選択
  await page.click('.shape-component:first-child');

  // 最前面へ移動
  await page.keyboard.press('Meta+Shift+]');

  // Z-indexが変更されたことを確認
  // ... (検証ロジック)
});
```

## 🎨 デザイン考慮事項

### UIデザイン原則
1. **階層の視覚化**: インデントと折りたたみで階層構造を明確に
2. **直感的な操作**: ドラッグ&ドロップでの並び替え
3. **状態の明示**: アイコンで可視性・ロック状態を表示
4. **一貫性**: PropertyPanelと統一されたデザイン
5. **アクセシビリティ**: キーボード操作、スクリーンリーダー対応

### レスポンシブデザイン
- パネルの折りたたみ・展開
- モバイル表示時の最適化
- 小画面でのレイヤーツリー表示

## 📦 依存関係

### 新規導入予定のライブラリ

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^9.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@tanstack/react-virtual": "^3.10.8"
}
```

### 既存ライブラリの活用
- `zustand`: レイヤー状態管理
- `nanoid`: グループIDの生成
- `@usketch/shared-types`: 型定義の拡張

## ⚡ パフォーマンス最適化

### 最適化戦略
1. **メモ化**: React.memo、useMemo、useCallbackの適切な使用
2. **仮想スクロール**: レイヤー数が多い場合の最適化
3. **遅延レンダリング**: 非表示レイヤーのレンダリングスキップ
4. **バッチ更新**: 複数レイヤーの一括更新

### レンダリング最適化
```typescript
// 非表示形状のレンダリングをスキップ
const visibleShapes = useMemo(() => {
  return sortedShapeIds.filter(id => {
    const shape = shapes[id];
    return shape?.layer?.visible !== false;
  });
}, [shapes, sortedShapeIds]);
```

## 🚀 成功指標

### 機能的指標
- ✅ グループ化・グループ解除が動作
- ✅ ドラッグ&ドロップでレイヤー並び替え可能
- ✅ 可視性・ロック状態の切り替え
- ✅ Z-index操作（最前面・最背面・前面へ・背面へ）
- ✅ ネストされたグループのサポート
- ✅ Undo/Redo対応

### パフォーマンス指標
- レイヤー操作の反応時間 < 50ms
- 100レイヤーでもスムーズな操作
- メモリ使用量の増加 < 20MB

### ユーザビリティ指標
- 直感的なドラッグ&ドロップ操作
- ショートカットキー対応
- アクセシビリティスコア > 90
- モバイルでも使いやすいUI

## 📝 リスクと対策

### 技術的リスク

1. **複雑なレイヤー構造の管理**
   - 対策: 明確なデータ構造設計、ユニットテストの充実

2. **ドラッグ&ドロップのパフォーマンス**
   - 対策: 最適化されたライブラリ（@dnd-kit）の使用、仮想スクロール

3. **グループのネスト処理**
   - 対策: 再帰的な処理の最適化、最大ネスト深度の制限

4. **レンダリング順序の複雑化**
   - 対策: zOrder配列での明示的な管理、レンダリングロジックの単純化

### UX的リスク

1. **操作の複雑化**
   - 対策: 段階的な機能公開、チュートリアルの提供

2. **UI の煩雑化**
   - 対策: 折りたたみ可能なパネル、シンプルなデザイン

## 🎯 次のステップ

Phase 7完了後は、以下の機能拡張を検討：

### Phase 8: エクスポート/インポート機能
- PNG/SVG/PDF形式でのエクスポート
- レイヤー構造の保持
- プロジェクトファイルの保存・読み込み

### レイヤー機能の拡張（将来）
- **レイヤー効果**: グループ全体へのエフェクト適用
- **スマートオブジェクト**: 再利用可能なコンポーネント
- **レイヤースタイル**: 複数レイヤーへのスタイル一括適用
- **レイヤー検索**: 名前や属性での検索機能

## 📚 参考資料

- [Figma Layers](https://www.figma.com/best-practices/layer-organization/)
- [Sketch Layer Management](https://www.sketch.com/docs/layer-basics/)
- [@dnd-kit Documentation](https://docs.dndkit.com/)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [既存アーキテクチャ設計書](../architecture/README.md)
- [Phase 6実装計画書](./phase6-property-panel-implementation-plan.md)

## 📖 用語集

- **レイヤー**: 1つの形状またはグループを表す管理単位
- **グループ**: 複数の形状をまとめた単位
- **Z-index**: 重なり順序を表す数値（小さいほど背面）
- **zOrder**: レイヤーのZ-index順を管理する配列
- **レイヤーツリー**: レイヤーの階層構造を表すツリー
- **ネスト**: グループ内にグループを含む階層構造

---

**実装開始予定日**: 2025-10-07
**実装完了予定日**: 2025-11-01
**推定工数**: 17日間

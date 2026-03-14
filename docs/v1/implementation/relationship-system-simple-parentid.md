# Shape Relationship System - Simple parentId Implementation

**作成日**: 2025-01-23
**ステータス**: 🔵 **計画中**
**目的**: 形状間の親子関係とその振る舞いを、既存の`parentId`を活用してシンプルに実装する

---

## 📋 目次

- [概要と設計思想](#概要と設計思想)
- [型定義とデータ構造](#型定義とデータ構造)
- [ルールエンジンの設計](#ルールエンジンの設計)
- [重なり検出と自動親子関係形成](#重なり検出と自動親子関係形成)
- [エフェクト適用システム](#エフェクト適用システム)
- [実装フェーズ](#実装フェーズ)
- [メリット・デメリット](#メリットデメリット)
- [パフォーマンス考察](#パフォーマンス考察)
- [移行計画](#移行計画)

---

## 概要と設計思想

### 基本コンセプト

既存の`LayerMetadata.parentId`を活用し、最小限の変更で親子関係システムを構築します。
親子関係の**振る舞い（エフェクト）**は、形状タイプの組み合わせに応じて**ルールエンジン**が決定します。

### 設計原則

1. **シンプルさ優先**: 既存の`parentId`構造を維持
2. **段階的拡張**: 必要に応じて機能を追加
3. **後方互換性**: 既存コードへの影響を最小化
4. **宣言的ルール定義**: 振る舞いはルールとして外部定義

### アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    WhiteboardStore                      │
│  shapes: Record<string, Shape>                          │
│  ┌──────────────────────────────────────┐              │
│  │ Shape                                 │              │
│  │   layer: {                            │              │
│  │     parentId?: string                 │  ← 親への参照 │
│  │     parentRelationType?: RelationType │  ← 関係タイプ │
│  │   }                                   │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            RelationshipRuleEngine                       │
│  - checkOverlap(): ルール適用判定                        │
│  - applyEffects(): エフェクト適用                        │
│  - onParentChanged(): 親変更時の子への伝播               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              RelationshipRule[]                         │
│  - type: 'containment' | 'attachment' | ...             │
│  - parentType / childType: 形状タイプ                    │
│  - effects: エフェクト定義                               │
│  - constraints: 制約定義                                │
└─────────────────────────────────────────────────────────┘
```

---

## 型定義とデータ構造

### 1. LayerMetadata の拡張

```typescript
/**
 * レイヤーメタデータ（既存の拡張）
 */
export interface LayerMetadata {
  /** レイヤー名 */
  name?: string;
  /** 可視性 */
  visible: boolean;
  /** ロック状態 */
  locked: boolean;
  /** 親形状のID（既存） */
  parentId?: string;
  /** 親子関係のタイプ（新規追加） */
  parentRelationType?: RelationType;
  /** Z-index順での位置 */
  zIndex: number;
}

/**
 * 親子関係のタイプ
 */
export type RelationType =
  | 'containment'  // グループによる包含
  | 'attachment'   // ラベルなどの付随
  | 'connection'   // コネクタによる接続
  | 'clip'         // フレームによるクリッピング
  | 'mask';        // マスキング

/**
 * 形状タイプ（既存 + 将来の拡張用）
 */
export type ShapeType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'freedraw'
  | 'group'
  | 'frame'      // 新規: クリッピング機能付きコンテナ
  | 'connector'  // 新規: 形状間を接続する線
  | 'component'; // 新規: 再利用可能なコンポーネント
```

### 2. ルール定義

```typescript
/**
 * 親子関係のルール定義
 */
export interface RelationshipRule {
  /** ルールID（デバッグ用） */
  id: string;

  /** 関係性のタイプ */
  type: RelationType;

  /** 親として許可される形状タイプ */
  parentType: ShapeType | ShapeType[] | '*';

  /** 子として許可される形状タイプ */
  childType: ShapeType | ShapeType[] | '*';

  /** 重なり時に自動で親子関係を形成するか */
  canFormOnOverlap: boolean;

  /** 重なり判定の条件 */
  overlapCondition: OverlapCondition;

  /** 適用されるエフェクト */
  effects: RelationshipEffect[];

  /** 適用される制約（オプション） */
  constraints?: RelationshipConstraint[];

  /** 優先度（複数ルールがマッチした時の判定用） */
  priority?: number;
}

/**
 * 重なり判定の条件
 */
export type OverlapCondition =
  | 'contains'       // 完全に内包している
  | 'intersects'     // 部分的に重なっている
  | 'center-inside'; // 中心点が内側にある

/**
 * 親子関係が形成された時の作用
 */
export interface RelationshipEffect {
  /** エフェクトのタイプ */
  type: EffectType;

  /** エフェクト固有の設定 */
  config?: Record<string, unknown>;
}

export type EffectType =
  | 'move-with-parent'    // 親と一緒に移動
  | 'resize-with-parent'  // 親のリサイズに追従
  | 'rotate-with-parent'  // 親の回転に追従
  | 'clip-by-parent'      // 親の境界でクリップ
  | 'inherit-style'       // スタイルを継承
  | 'auto-layout'         // 自動レイアウト
  | 'maintain-distance';  // 親との距離を維持

/**
 * 親子関係の制約
 */
export interface RelationshipConstraint {
  /** 制約のタイプ */
  type: ConstraintType;

  /** 制約の適用モード */
  mode: 'inherit' | 'constrain' | 'sync';

  /** 制約固有の設定 */
  config?: Record<string, unknown>;
}

export type ConstraintType =
  | 'position'   // 位置の制約
  | 'size'       // サイズの制約
  | 'style'      // スタイルの制約
  | 'visibility' // 可視性の制約
  | 'lock';      // ロック状態の制約
```

---

## ルールエンジンの設計

### 1. RelationshipRuleEngine クラス

```typescript
/**
 * 親子関係のルールエンジン
 * 形状タイプの組み合わせに応じた振る舞いを管理
 */
export class RelationshipRuleEngine {
  private rules: RelationshipRule[] = [];

  /**
   * ルールを登録
   */
  registerRule(rule: RelationshipRule): void {
    this.rules.push(rule);
    // 優先度でソート
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * 複数のルールを一括登録
   */
  registerRules(rules: RelationshipRule[]): void {
    rules.forEach(rule => this.registerRule(rule));
  }

  /**
   * 2つの形状が重なった時、どのルールが適用されるか判定
   */
  checkOverlap(
    parent: Shape,
    child: Shape,
    overlapType: 'contains' | 'intersects' | 'center-inside'
  ): RelationshipRule | null {
    for (const rule of this.rules) {
      // 自動形成が無効なルールはスキップ
      if (!rule.canFormOnOverlap) continue;

      // 親子タイプのマッチング
      if (!this.matchesType(parent.type, rule.parentType)) continue;
      if (!this.matchesType(child.type, rule.childType)) continue;

      // 重なり条件のチェック
      if (rule.overlapCondition !== overlapType) continue;

      // マッチしたルールを返す（優先度順にソート済み）
      return rule;
    }
    return null;
  }

  /**
   * 親が変更された時に子にエフェクトを適用
   */
  applyEffectsToChildren(
    parentId: string,
    changeType: 'position' | 'size' | 'rotation' | 'style',
    shapes: Record<string, Shape>
  ): Shape[] {
    const parent = shapes[parentId];
    if (!parent) return [];

    const children = this.getChildren(parentId, shapes);
    const updatedShapes: Shape[] = [];

    for (const child of children) {
      const rule = this.getRuleForRelation(parent, child);
      if (!rule) continue;

      // 変更タイプに応じたエフェクトを適用
      for (const effect of rule.effects) {
        if (this.shouldApplyEffect(effect, changeType)) {
          const updated = this.applyEffect(effect, parent, child, shapes);
          if (updated) {
            updatedShapes.push(updated);
          }
        }
      }
    }

    return updatedShapes;
  }

  /**
   * 既存の親子関係に対応するルールを取得
   */
  getRuleForRelation(parent: Shape, child: Shape): RelationshipRule | null {
    const relationType = child.layer?.parentRelationType;
    if (!relationType) return null;

    for (const rule of this.rules) {
      if (rule.type !== relationType) continue;
      if (!this.matchesType(parent.type, rule.parentType)) continue;
      if (!this.matchesType(child.type, rule.childType)) continue;
      return rule;
    }
    return null;
  }

  /**
   * 親の子形状を取得（parentIdベース）
   */
  private getChildren(parentId: string, shapes: Record<string, Shape>): Shape[] {
    return Object.values(shapes).filter(
      shape => shape.layer?.parentId === parentId
    );
  }

  /**
   * 形状タイプのマッチング判定
   */
  private matchesType(
    shapeType: string,
    ruleType: ShapeType | ShapeType[] | '*'
  ): boolean {
    if (ruleType === '*') return true;
    if (Array.isArray(ruleType)) {
      return ruleType.includes(shapeType as ShapeType);
    }
    return shapeType === ruleType;
  }

  /**
   * エフェクトを適用すべきか判定
   */
  private shouldApplyEffect(
    effect: RelationshipEffect,
    changeType: 'position' | 'size' | 'rotation' | 'style'
  ): boolean {
    const effectChangeMap: Record<EffectType, string[]> = {
      'move-with-parent': ['position'],
      'resize-with-parent': ['size'],
      'rotate-with-parent': ['rotation'],
      'clip-by-parent': ['position', 'size'],
      'inherit-style': ['style'],
      'auto-layout': ['position', 'size'],
      'maintain-distance': ['position'],
    };

    const applicableChanges = effectChangeMap[effect.type];
    return applicableChanges?.includes(changeType) ?? false;
  }

  /**
   * エフェクトを適用（実装は個別のエフェクトハンドラに委譲）
   */
  private applyEffect(
    effect: RelationshipEffect,
    parent: Shape,
    child: Shape,
    shapes: Record<string, Shape>
  ): Shape | null {
    // 各エフェクトの実装は別クラスに委譲
    const handler = effectHandlers[effect.type];
    if (!handler) return null;

    return handler(parent, child, effect.config, shapes);
  }
}

/**
 * エフェクトハンドラの型定義
 */
type EffectHandler = (
  parent: Shape,
  child: Shape,
  config: Record<string, unknown> | undefined,
  shapes: Record<string, Shape>
) => Shape | null;

/**
 * エフェクトハンドラのレジストリ
 */
const effectHandlers: Record<EffectType, EffectHandler> = {
  'move-with-parent': applyMoveWithParent,
  'resize-with-parent': applyResizeWithParent,
  'rotate-with-parent': applyRotateWithParent,
  'clip-by-parent': applyClipByParent,
  'inherit-style': applyInheritStyle,
  'auto-layout': applyAutoLayout,
  'maintain-distance': applyMaintainDistance,
};
```

### 2. 標準ルールセット

```typescript
/**
 * 標準的な親子関係ルールのセット
 */
export const standardRelationshipRules: RelationshipRule[] = [
  // グループ: 任意の形状を包含
  {
    id: 'group-containment',
    type: 'containment',
    parentType: 'group',
    childType: '*',
    canFormOnOverlap: false, // 明示的なグループ化操作のみ
    overlapCondition: 'contains',
    effects: [
      { type: 'move-with-parent' },
      { type: 'rotate-with-parent' },
    ],
    constraints: [
      { type: 'visibility', mode: 'inherit' },
      { type: 'lock', mode: 'inherit' },
    ],
    priority: 10,
  },

  // フレーム: 内部の形状をクリッピング
  {
    id: 'frame-clip',
    type: 'clip',
    parentType: 'frame',
    childType: ['rectangle', 'ellipse', 'text', 'freedraw', 'group'],
    canFormOnOverlap: true, // 重なったら自動で親子に
    overlapCondition: 'center-inside',
    effects: [
      { type: 'move-with-parent' },
      { type: 'clip-by-parent' },
    ],
    priority: 20,
  },

  // テキストラベル: 図形に付随
  {
    id: 'shape-label',
    type: 'attachment',
    parentType: ['rectangle', 'ellipse', 'group'],
    childType: 'text',
    canFormOnOverlap: true,
    overlapCondition: 'center-inside',
    effects: [
      { type: 'move-with-parent' },
      { type: 'rotate-with-parent' },
      {
        type: 'inherit-style',
        config: { properties: ['fillColor', 'strokeColor'] }
      },
    ],
    priority: 15,
  },

  // コネクタ: 図形間を接続
  {
    id: 'connector-attachment',
    type: 'connection',
    parentType: ['rectangle', 'ellipse', 'group'],
    childType: 'connector',
    canFormOnOverlap: true,
    overlapCondition: 'intersects',
    effects: [
      {
        type: 'maintain-distance',
        config: { snapToEdge: true }
      },
    ],
    priority: 25,
  },

  // マスク: 画像やグループをマスキング
  {
    id: 'shape-mask',
    type: 'mask',
    parentType: ['rectangle', 'ellipse', 'freedraw'],
    childType: ['group'],
    canFormOnOverlap: true,
    overlapCondition: 'intersects',
    effects: [
      { type: 'clip-by-parent' },
    ],
    priority: 30,
  },
];
```

---

## 重なり検出と自動親子関係形成

### 1. 重なり判定ユーティリティ

```typescript
/**
 * 重なり判定ユーティリティ
 */
export class OverlapDetector {
  /**
   * 親が子を完全に内包しているか
   */
  static contains(parent: Shape, child: Shape): boolean {
    const parentBounds = getBounds(parent);
    const childBounds = getBounds(child);

    return (
      childBounds.x >= parentBounds.x &&
      childBounds.y >= parentBounds.y &&
      childBounds.x + childBounds.width <= parentBounds.x + parentBounds.width &&
      childBounds.y + childBounds.height <= parentBounds.y + parentBounds.height
    );
  }

  /**
   * 2つの形状が部分的に重なっているか
   */
  static intersects(parent: Shape, child: Shape): boolean {
    const parentBounds = getBounds(parent);
    const childBounds = getBounds(child);

    return !(
      childBounds.x + childBounds.width < parentBounds.x ||
      childBounds.x > parentBounds.x + parentBounds.width ||
      childBounds.y + childBounds.height < parentBounds.y ||
      childBounds.y > parentBounds.y + parentBounds.height
    );
  }

  /**
   * 子の中心点が親の内側にあるか
   */
  static centerInside(parent: Shape, child: Shape): boolean {
    const parentBounds = getBounds(parent);
    const childBounds = getBounds(child);

    const centerX = childBounds.x + childBounds.width / 2;
    const centerY = childBounds.y + childBounds.height / 2;

    return (
      centerX >= parentBounds.x &&
      centerX <= parentBounds.x + parentBounds.width &&
      centerY >= parentBounds.y &&
      centerY <= parentBounds.y + parentBounds.height
    );
  }

  /**
   * 重なりタイプを判定
   */
  static getOverlapType(
    parent: Shape,
    child: Shape
  ): 'contains' | 'intersects' | 'center-inside' | null {
    if (this.contains(parent, child)) return 'contains';
    if (this.centerInside(parent, child)) return 'center-inside';
    if (this.intersects(parent, child)) return 'intersects';
    return null;
  }
}
```

### 2. ドラッグ&ドロップでの自動親子関係形成

```typescript
/**
 * 形状のドロップ時に親子関係を自動形成
 */
export function handleShapeDropForRelationship(
  droppedShapeId: string,
  potentialParents: Shape[],
  ruleEngine: RelationshipRuleEngine,
  shapes: Record<string, Shape>
): { parentId: string; relationType: RelationType } | null {
  const droppedShape = shapes[droppedShapeId];
  if (!droppedShape) return null;

  // 優先度順（Z-indexが高い順）に親候補をチェック
  const sortedParents = [...potentialParents].sort(
    (a, b) => (b.layer?.zIndex ?? 0) - (a.layer?.zIndex ?? 0)
  );

  for (const parent of sortedParents) {
    // 自分自身や既存の子は親にできない
    if (parent.id === droppedShapeId) continue;
    if (parent.layer?.parentId === droppedShapeId) continue;

    // 重なりタイプを判定
    const overlapType = OverlapDetector.getOverlapType(parent, droppedShape);
    if (!overlapType) continue;

    // ルールエンジンに問い合わせ
    const rule = ruleEngine.checkOverlap(parent, droppedShape, overlapType);
    if (rule) {
      return {
        parentId: parent.id,
        relationType: rule.type,
      };
    }
  }

  return null;
}
```

---

## エフェクト適用システム

### 1. エフェクトハンドラの実装例

```typescript
/**
 * move-with-parent エフェクト
 * 親の移動に追従
 */
function applyMoveWithParent(
  parent: Shape,
  child: Shape,
  config: Record<string, unknown> | undefined,
  shapes: Record<string, Shape>
): Shape | null {
  // 親の移動量を計算（前回の位置との差分）
  // 実際には前回の位置を保存しておく必要がある
  const deltaX = 0; // 実装時に計算
  const deltaY = 0; // 実装時に計算

  return {
    ...child,
    x: child.x + deltaX,
    y: child.y + deltaY,
  };
}

/**
 * clip-by-parent エフェクト
 * 親の境界でクリッピング
 */
function applyClipByParent(
  parent: Shape,
  child: Shape,
  config: Record<string, unknown> | undefined,
  shapes: Record<string, Shape>
): Shape | null {
  // SVGのclipPathを使用するため、Shapeオブジェクト自体は変更不要
  // レンダリング時にclipPath属性を適用
  return null;
}

/**
 * inherit-style エフェクト
 * 親のスタイルを継承
 */
function applyInheritStyle(
  parent: Shape,
  child: Shape,
  config: Record<string, unknown> | undefined,
  shapes: Record<string, Shape>
): Shape | null {
  const properties = (config?.properties as string[]) ?? [];

  const updates: Partial<Shape> = {};
  for (const prop of properties) {
    if (prop in parent) {
      (updates as any)[prop] = (parent as any)[prop];
    }
  }

  return { ...child, ...updates };
}

/**
 * maintain-distance エフェクト
 * コネクタなどが親との距離を維持
 */
function applyMaintainDistance(
  parent: Shape,
  child: Shape,
  config: Record<string, unknown> | undefined,
  shapes: Record<string, Shape>
): Shape | null {
  const snapToEdge = config?.snapToEdge ?? false;

  if (snapToEdge && child.type === 'line') {
    // 線の端点を親の最寄りのエッジにスナップ
    const parentBounds = getBounds(parent);
    const line = child as LineShape;

    // 最寄りのエッジポイントを計算
    const snappedPoint = findNearestEdgePoint(parentBounds, {
      x: line.x,
      y: line.y,
    });

    return {
      ...line,
      x: snappedPoint.x,
      y: snappedPoint.y,
    };
  }

  return null;
}

// 他のエフェクトハンドラも同様に実装...
```

### 2. ストアとの統合

```typescript
/**
 * Zustand storeでの親子関係エフェクト適用
 */
export const useWhiteboardStore = create<WhiteboardStore>((set, get) => ({
  shapes: {},
  relationshipRuleEngine: new RelationshipRuleEngine(),

  // 初期化時にルールを登録
  initializeRelationshipRules: () => {
    const engine = get().relationshipRuleEngine;
    engine.registerRules(standardRelationshipRules);
  },

  // 形状を更新（親子関係のエフェクトも適用）
  updateShape: (id: string, updates: Partial<Shape>) => {
    set((state) => {
      const shape = state.shapes[id];
      if (!shape) return state;

      const updatedShape = { ...shape, ...updates };
      const newShapes = { ...state.shapes, [id]: updatedShape };

      // 変更タイプを判定
      let changeType: 'position' | 'size' | 'rotation' | 'style' | null = null;
      if ('x' in updates || 'y' in updates) changeType = 'position';
      else if ('width' in updates || 'height' in updates) changeType = 'size';
      else if ('rotation' in updates) changeType = 'rotation';
      else if ('fillColor' in updates || 'strokeColor' in updates) changeType = 'style';

      // 子形状にエフェクトを適用
      if (changeType) {
        const updatedChildren = state.relationshipRuleEngine.applyEffectsToChildren(
          id,
          changeType,
          newShapes
        );

        for (const child of updatedChildren) {
          newShapes[child.id] = child;
        }
      }

      return { shapes: newShapes };
    });
  },

  // 親子関係を設定
  setParent: (childId: string, parentId: string | null, relationType?: RelationType) => {
    set((state) => {
      const child = state.shapes[childId];
      if (!child) return state;

      const updatedChild: Shape = {
        ...child,
        layer: {
          ...child.layer,
          visible: child.layer?.visible ?? true,
          locked: child.layer?.locked ?? false,
          zIndex: child.layer?.zIndex ?? 0,
          parentId: parentId ?? undefined,
          parentRelationType: relationType,
        },
      };

      return {
        shapes: {
          ...state.shapes,
          [childId]: updatedChild,
        },
      };
    });
  },
}));
```

---

## 実装フェーズ

### Phase 1: 基盤整備（2週間）

#### 1.1 型定義の追加

- [ ] `RelationType` の定義
- [ ] `LayerMetadata.parentRelationType` の追加
- [ ] `RelationshipRule` インターフェースの定義
- [ ] `RelationshipEffect` と `RelationshipConstraint` の定義

**成果物:**
- `packages/shared-types/src/relationship.ts`
- `packages/shared-types/src/layer.ts` の更新

#### 1.2 ルールエンジンの実装

- [ ] `RelationshipRuleEngine` クラス
- [ ] `OverlapDetector` ユーティリティ
- [ ] 標準ルールセットの定義

**成果物:**
- `packages/relationship-system/src/rule-engine.ts`
- `packages/relationship-system/src/overlap-detector.ts`
- `packages/relationship-system/src/standard-rules.ts`

#### 1.3 テストの作成

- [ ] `RelationshipRuleEngine` のユニットテスト
- [ ] `OverlapDetector` のユニットテスト
- [ ] ルールマッチングのテスト

**成果物:**
- `packages/relationship-system/src/rule-engine.test.ts`
- テストカバレッジ 90%以上

---

### Phase 2: エフェクトシステム（2週間）

#### 2.1 基本エフェクトの実装

- [ ] `move-with-parent` ハンドラ
- [ ] `rotate-with-parent` ハンドラ
- [ ] `resize-with-parent` ハンドラ
- [ ] `clip-by-parent` ハンドラ

**成果物:**
- `packages/relationship-system/src/effects/`

#### 2.2 高度なエフェクトの実装

- [ ] `inherit-style` ハンドラ
- [ ] `maintain-distance` ハンドラ
- [ ] `auto-layout` ハンドラ

**成果物:**
- `packages/relationship-system/src/effects/advanced.ts`

#### 2.3 ストア統合

- [ ] `useWhiteboardStore` での親子関係管理
- [ ] 形状更新時のエフェクト適用
- [ ] 親子関係の設定/解除API

**成果物:**
- `packages/store/src/slices/relationship-slice.ts`

---

### Phase 3: UI統合（2週間）

#### 3.1 ドラッグ&ドロップでの自動親子関係

- [ ] `handleShapeDropForRelationship` の実装
- [ ] select-tool での統合
- [ ] ビジュアルフィードバック（ドロップ可能な親をハイライト）

**成果物:**
- `packages/tools/src/tools/select-tool.ts` の更新

#### 3.2 レイヤーパネルでの親子関係表示

- [ ] 親子関係タイプのアイコン表示
- [ ] ドラッグ&ドロップでの親子関係変更
- [ ] コンテキストメニューでの解除

**成果物:**
- `apps/whiteboard/src/components/layer-panel/` の更新

#### 3.3 E2Eテスト

- [ ] グループ化のテスト
- [ ] フレームクリッピングのテスト
- [ ] ラベル付随のテスト
- [ ] コネクタ接続のテスト

**成果物:**
- `apps/e2e/tests/relationship-system.spec.ts`

---

### Phase 4: 最適化と拡張（1週間）

#### 4.1 パフォーマンス最適化

- [ ] 子形状検索のキャッシング
- [ ] エフェクト適用のバッチ処理
- [ ] 不要な再レンダリングの削減

#### 4.2 ドキュメント作成

- [ ] API仕様書
- [ ] 使用例とベストプラクティス
- [ ] カスタムルールの作成ガイド

**成果物:**
- `docs/api/relationship-system.md`
- `docs/examples/relationship-system-usage.md`

---

## メリット・デメリット

### ✅ メリット

1. **シンプル**: 既存の`parentId`を活用、データ構造の変更最小
2. **後方互換性**: 既存コードへの影響が少ない
3. **段階的導入**: 機能を少しずつ追加可能
4. **パフォーマンス**: シンプルな構造で高速
5. **理解しやすい**: 親子関係が直感的
6. **テストしやすい**: ルールエンジンを独立してテスト可能

### ❌ デメリット

1. **多対多不可**: 1つの形状は1つの親のみ
2. **関係メタデータ制限**: 関係固有のデータを保存しにくい
3. **クエリ効率**: 全形状を走査して子を検索
4. **スケーラビリティ**: 形状数が増えると検索が遅くなる可能性
5. **循環参照チェック**: 親子関係の整合性チェックが必要

### 🎯 適用範囲

以下の要件を満たす場合に適している:

- 形状数が1万以下
- 1つの形状は1つの親のみ
- 親子関係の種類が限定的（5-10種類程度）
- シンプルさと保守性を重視

---

## パフォーマンス考察

### 子形状検索のコスト

```typescript
// O(n) の線形検索
function getChildren(parentId: string, shapes: Record<string, Shape>): Shape[] {
  return Object.values(shapes).filter(
    shape => shape.layer?.parentId === parentId
  );
}
```

**最適化案:**

1. **インデックスキャッシュ**

```typescript
class RelationshipIndex {
  private parentToChildren: Map<string, Set<string>> = new Map();

  addRelation(parentId: string, childId: string): void {
    if (!this.parentToChildren.has(parentId)) {
      this.parentToChildren.set(parentId, new Set());
    }
    this.parentToChildren.get(parentId)!.add(childId);
  }

  getChildren(parentId: string): string[] {
    return Array.from(this.parentToChildren.get(parentId) ?? []);
  }
}
```

2. **メモ化**

```typescript
const getChildrenMemoized = memoize(
  (parentId: string, shapes: Record<string, Shape>) => {
    return Object.values(shapes).filter(
      shape => shape.layer?.parentId === parentId
    );
  },
  // キャッシュキー生成
  (parentId, shapes) => `${parentId}-${Object.keys(shapes).length}`
);
```

### ベンチマーク想定

| 形状数 | 子検索（線形） | 子検索（インデックス） | エフェクト適用 |
|--------|----------------|------------------------|----------------|
| 100    | < 1ms          | < 0.1ms                | < 1ms          |
| 1,000  | < 5ms          | < 0.1ms                | < 5ms          |
| 10,000 | < 50ms         | < 0.1ms                | < 50ms         |

---

## 移行計画

### ステップ1: 既存の`parentId`との共存

現在のグループ機能（`GroupShape.childIds`）と並行して動作させる:

```typescript
// 後方互換性のため両方をサポート
interface LayerMetadata {
  parentId?: string;              // 新システム
  parentRelationType?: RelationType; // 新システム
  zIndex: number;
}

interface GroupShape extends BaseShape {
  type: "group";
  childIds: string[];  // 旧システム（deprecated）
  // ...
}
```

### ステップ2: 段階的な移行

1. **Week 1-2**: 新しいルールエンジンを導入、既存機能に影響なし
2. **Week 3-4**: グループ機能を新システムに移行
3. **Week 5-6**: `childIds`をdeprecatedに、警告を表示
4. **Week 7-8**: `childIds`を完全に削除

### ステップ3: マイグレーション

```typescript
/**
 * 既存データを新形式に移行
 */
function migrateGroupShapeToParentId(shapes: Record<string, Shape>): void {
  for (const shape of Object.values(shapes)) {
    if (shape.type === 'group') {
      const group = shape as GroupShape;

      // childIds → parentId への変換
      for (const childId of group.childIds) {
        const child = shapes[childId];
        if (child) {
          child.layer = {
            ...child.layer,
            visible: child.layer?.visible ?? true,
            locked: child.layer?.locked ?? false,
            zIndex: child.layer?.zIndex ?? 0,
            parentId: group.id,
            parentRelationType: 'containment',
          };
        }
      }

      // childIds を削除（deprecated）
      delete (group as any).childIds;
    }
  }
}
```

---

## リスクと対策

### リスク1: パフォーマンス劣化

**対策:**
- インデックスキャッシュの導入
- エフェクト適用のバッチ処理
- React.memoによる再レンダリング抑制

### リスク2: 循環参照

**対策:**

```typescript
function setParentWithCycleCheck(
  childId: string,
  parentId: string,
  shapes: Record<string, Shape>
): boolean {
  // 先祖をたどって循環参照チェック
  let current = parentId;
  const visited = new Set<string>();

  while (current) {
    if (current === childId) return false; // 循環検出
    if (visited.has(current)) return false;
    visited.add(current);
    current = shapes[current]?.layer?.parentId ?? '';
  }

  return true; // 安全
}
```

### リスク3: データ整合性

**対策:**
- 形状削除時に子の`parentId`を自動クリア
- バリデーション関数の定期実行
- 開発時のデバッグツール提供

---

## 今後の拡張可能性

### カスタムルールの登録

```typescript
// ユーザーが独自ルールを追加可能
const customRule: RelationshipRule = {
  id: 'my-custom-rule',
  type: 'attachment',
  parentType: 'custom-shape',
  childType: 'text',
  canFormOnOverlap: true,
  overlapCondition: 'center-inside',
  effects: [
    { type: 'move-with-parent' },
  ],
  priority: 50,
};

whiteboardStore.relationshipRuleEngine.registerRule(customRule);
```

### プラグインシステムとの統合

```typescript
// Shapeプラグインがルールを提供
export const customShapePlugin: ShapePlugin = {
  type: 'custom-shape',
  // ...
  relationshipRules: [
    // このShapeタイプ固有のルール
  ],
};
```

---

## まとめ

この実装方式は、**シンプルさ**と**段階的拡張性**を重視した設計です。

**推奨ケース:**
- 既存コードへの影響を最小化したい
- 迅速にプロトタイプを作りたい
- 形状数が中規模（1万以下）
- 1対多の親子関係で十分

**次の検討が必要なケース:**
- 形状数が1万を超える
- 多対多の関係が必要
- 関係固有のメタデータが多い
- 複雑なクエリが頻繁に必要

その場合は、`relationships`配列による柔軟な実装（別ドキュメント）を検討してください。

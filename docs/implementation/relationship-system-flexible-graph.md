# Shape Relationship System - Flexible Graph Implementation

**作成日**: 2025-01-23
**ステータス**: 🔵 **計画中**
**目的**: 形状間の複雑な親子関係をグラフ構造として柔軟に管理し、将来の拡張性を最大化する

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

形状データと親子関係を**完全に分離**し、関係性を専用の`relationships`配列で管理します。
これにより、多対多の関係、複雑なクエリ、関係固有のメタデータなど、高度な要件に対応できます。

### 設計原則

1. **関心の分離**: 形状データと関係性を独立管理
2. **柔軟性優先**: 複雑な関係性にも対応可能
3. **クエリ最適化**: インデックス構築による高速検索
4. **拡張性**: 新しい関係タイプを簡単に追加
5. **トレーサビリティ**: 関係の履歴やメタデータを保存

### アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    WhiteboardStore                      │
│                                                         │
│  shapes: Record<string, Shape>  ← 純粋な形状データ       │
│  ┌──────────────────────────┐                          │
│  │ Shape (シンプル)           │                          │
│  │   id, type, x, y, ...     │  ← 関係性の情報なし      │
│  └──────────────────────────┘                          │
│                                                         │
│  relationships: ShapeRelationship[]  ← 関係性の配列     │
│  ┌────────────────────────────────────┐                │
│  │ ShapeRelationship                   │                │
│  │   type: 'containment' | ...         │                │
│  │   parentId: string                  │                │
│  │   childId: string                   │                │
│  │   metadata: { ... }                 │                │
│  │   createdAt: number                 │                │
│  └────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            RelationshipGraph (高速クエリ)                │
│  - parentIndex: Map<parentId, childIds[]>               │
│  - childIndex: Map<childId, parentIds[]>                │
│  - typeIndex: Map<relationType, relations[]>            │
│  - getChildren(): O(1) 検索                             │
│  - getParents(): O(1) 検索                              │
│  - findPath(): グラフ探索                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            RelationshipRuleEngine                       │
│  - checkOverlap(): ルール適用判定                        │
│  - applyEffects(): エフェクト適用                        │
│  - onRelationChanged(): 関係変更時の処理                │
└─────────────────────────────────────────────────────────┘
```

---

## 型定義とデータ構造

### 1. Shape定義（シンプル化）

```typescript
/**
 * Shape定義（関係性の情報を含まない）
 */
export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  shadow?: ShadowProperties;
  // layer.parentId は削除（relationships配列で管理）
  layer?: {
    name?: string;
    visible: boolean;
    locked: boolean;
    zIndex: number;
  };
}

export type Shape =
  | RectangleShape
  | EllipseShape
  | LineShape
  | TextShape
  | FreedrawShape
  | FrameShape
  | ConnectorShape;
```

### 2. 関係性の定義

```typescript
/**
 * 形状間の関係性
 */
export interface ShapeRelationship {
  /** 関係ID（一意） */
  id: string;

  /** 関係のタイプ */
  type: RelationType;

  /** 親形状のID */
  parentId: string;

  /** 子形状のID */
  childId: string;

  /** 関係固有のメタデータ */
  metadata?: RelationshipMetadata;

  /** 作成日時 */
  createdAt: number;

  /** 最終更新日時 */
  updatedAt?: number;

  /** この関係が適用するエフェクト（オプション、ルールから継承も可） */
  effects?: RelationshipEffect[];

  /** この関係の制約（オプション） */
  constraints?: RelationshipConstraint[];
}

/**
 * 関係性のタイプ
 */
export type RelationType =
  | 'containment'  // グループによる包含
  | 'attachment'   // ラベルなどの付随
  | 'connection'   // コネクタによる接続
  | 'clip'         // フレームによるクリッピング
  | 'mask'         // マスキング
  | 'instance'     // コンポーネントのインスタンス
  | 'layout';      // レイアウトコンテナの子

/**
 * 関係固有のメタデータ
 */
export interface RelationshipMetadata {
  /** コネクタの接続点情報 */
  connectionPoint?: {
    edge: 'top' | 'right' | 'bottom' | 'left';
    offset: number; // 0-1の範囲
  };

  /** レイアウト情報 */
  layoutConfig?: {
    flex?: number;
    order?: number;
    margin?: { top: number; right: number; bottom: number; left: number };
  };

  /** インスタンス情報 */
  instanceOverrides?: Record<string, unknown>;

  /** カスタムメタデータ */
  custom?: Record<string, unknown>;
}

/**
 * エフェクトと制約の定義（シンプル実装と同じ）
 */
export interface RelationshipEffect {
  type: EffectType;
  config?: Record<string, unknown>;
}

export type EffectType =
  | 'move-with-parent'
  | 'resize-with-parent'
  | 'rotate-with-parent'
  | 'clip-by-parent'
  | 'inherit-style'
  | 'auto-layout'
  | 'maintain-distance';

export interface RelationshipConstraint {
  type: ConstraintType;
  mode: 'inherit' | 'constrain' | 'sync';
  config?: Record<string, unknown>;
}

export type ConstraintType =
  | 'position'
  | 'size'
  | 'style'
  | 'visibility'
  | 'lock';
```

### 3. ルール定義

```typescript
/**
 * 親子関係のルール定義（シンプル実装とほぼ同じ）
 */
export interface RelationshipRule {
  id: string;
  type: RelationType;
  parentType: ShapeType | ShapeType[] | '*';
  childType: ShapeType | ShapeType[] | '*';
  canFormOnOverlap: boolean;
  overlapCondition: OverlapCondition;
  effects: RelationshipEffect[];
  constraints?: RelationshipConstraint[];
  priority?: number;

  /** 多対多を許可するか（新規） */
  allowMultipleParents?: boolean;
  allowMultipleChildren?: boolean;

  /** カスタムバリデーション（新規） */
  validate?: (parent: Shape, child: Shape, existing: ShapeRelationship[]) => boolean;
}

export type OverlapCondition =
  | 'contains'
  | 'intersects'
  | 'center-inside';
```

---

## ルールエンジンの設計

### 1. RelationshipGraph クラス

```typescript
/**
 * 関係性のグラフ構造を管理
 * 高速なクエリとトラバーサルをサポート
 */
export class RelationshipGraph {
  private relationships: Map<string, ShapeRelationship> = new Map();

  // インデックス（高速検索用）
  private parentIndex: Map<string, Set<string>> = new Map(); // parentId -> relationIds
  private childIndex: Map<string, Set<string>> = new Map();  // childId -> relationIds
  private typeIndex: Map<RelationType, Set<string>> = new Map(); // type -> relationIds

  /**
   * 関係を追加
   */
  addRelationship(relation: ShapeRelationship): void {
    this.relationships.set(relation.id, relation);

    // インデックスを更新
    this.addToIndex(this.parentIndex, relation.parentId, relation.id);
    this.addToIndex(this.childIndex, relation.childId, relation.id);
    this.addToIndex(this.typeIndex, relation.type, relation.id);
  }

  /**
   * 関係を削除
   */
  removeRelationship(relationId: string): boolean {
    const relation = this.relationships.get(relationId);
    if (!relation) return false;

    this.relationships.delete(relationId);

    // インデックスから削除
    this.removeFromIndex(this.parentIndex, relation.parentId, relationId);
    this.removeFromIndex(this.childIndex, relation.childId, relationId);
    this.removeFromIndex(this.typeIndex, relation.type, relationId);

    return true;
  }

  /**
   * 親の全子関係を取得（O(1)）
   */
  getChildRelationships(parentId: string): ShapeRelationship[] {
    const relationIds = this.parentIndex.get(parentId) ?? new Set();
    return Array.from(relationIds)
      .map(id => this.relationships.get(id))
      .filter((r): r is ShapeRelationship => r !== undefined);
  }

  /**
   * 子の全親関係を取得（O(1)）
   */
  getParentRelationships(childId: string): ShapeRelationship[] {
    const relationIds = this.childIndex.get(childId) ?? new Set();
    return Array.from(relationIds)
      .map(id => this.relationships.get(id))
      .filter((r): r is ShapeRelationship => r !== undefined);
  }

  /**
   * 特定タイプの関係を取得（O(1)）
   */
  getRelationshipsByType(type: RelationType): ShapeRelationship[] {
    const relationIds = this.typeIndex.get(type) ?? new Set();
    return Array.from(relationIds)
      .map(id => this.relationships.get(id))
      .filter((r): r is ShapeRelationship => r !== undefined);
  }

  /**
   * 2つの形状間に関係が存在するかチェック
   */
  hasRelationship(parentId: string, childId: string, type?: RelationType): boolean {
    const relations = this.getChildRelationships(parentId);
    return relations.some(r =>
      r.childId === childId &&
      (type === undefined || r.type === type)
    );
  }

  /**
   * 循環参照チェック（グラフ探索）
   */
  wouldCreateCycle(parentId: string, childId: string): boolean {
    // childIdからparentIdへのパスが存在するかDFSでチェック
    const visited = new Set<string>();
    const stack = [childId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === parentId) return true; // 循環検出
      if (visited.has(current)) continue;
      visited.add(current);

      // currentの全子を探索
      const children = this.getChildRelationships(current);
      for (const relation of children) {
        stack.push(relation.childId);
      }
    }

    return false;
  }

  /**
   * 全祖先を取得（ルートまで）
   */
  getAncestors(shapeId: string, type?: RelationType): string[] {
    const ancestors: string[] = [];
    const visited = new Set<string>();
    let current = shapeId;

    while (true) {
      const parents = this.getParentRelationships(current);
      const filtered = type
        ? parents.filter(r => r.type === type)
        : parents;

      if (filtered.length === 0) break;

      // 複数の親がいる場合は最初の親を選択（BFS的に全祖先を取得も可能）
      const parent = filtered[0];
      if (visited.has(parent.parentId)) break; // 循環防止
      visited.add(parent.parentId);

      ancestors.push(parent.parentId);
      current = parent.parentId;
    }

    return ancestors;
  }

  /**
   * 全子孫を取得（深さ優先）
   */
  getDescendants(shapeId: string, type?: RelationType): string[] {
    const descendants: string[] = [];
    const visited = new Set<string>();
    const stack = [shapeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const children = this.getChildRelationships(current);
      const filtered = type
        ? children.filter(r => r.type === type)
        : children;

      for (const relation of filtered) {
        descendants.push(relation.childId);
        stack.push(relation.childId);
      }
    }

    return descendants;
  }

  /**
   * 統計情報を取得（デバッグ用）
   */
  getStats(): {
    totalRelationships: number;
    byType: Record<RelationType, number>;
    avgChildrenPerParent: number;
  } {
    const byType: Record<string, number> = {};
    for (const relation of this.relationships.values()) {
      byType[relation.type] = (byType[relation.type] ?? 0) + 1;
    }

    const avgChildren = this.parentIndex.size > 0
      ? this.relationships.size / this.parentIndex.size
      : 0;

    return {
      totalRelationships: this.relationships.size,
      byType: byType as Record<RelationType, number>,
      avgChildrenPerParent: avgChildren,
    };
  }

  /**
   * インデックスに追加
   */
  private addToIndex<K>(index: Map<K, Set<string>>, key: K, value: string): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  /**
   * インデックスから削除
   */
  private removeFromIndex<K>(index: Map<K, Set<string>>, key: K, value: string): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * 全関係をクリア
   */
  clear(): void {
    this.relationships.clear();
    this.parentIndex.clear();
    this.childIndex.clear();
    this.typeIndex.clear();
  }

  /**
   * 全関係を配列として取得
   */
  toArray(): ShapeRelationship[] {
    return Array.from(this.relationships.values());
  }
}
```

### 2. RelationshipRuleEngine クラス（拡張版）

```typescript
/**
 * 親子関係のルールエンジン（拡張版）
 */
export class RelationshipRuleEngine {
  private rules: RelationshipRule[] = [];
  private graph: RelationshipGraph;

  constructor(graph: RelationshipGraph) {
    this.graph = graph;
  }

  /**
   * ルールを登録
   */
  registerRule(rule: RelationshipRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * 重なり時のルール判定
   */
  checkOverlap(
    parent: Shape,
    child: Shape,
    overlapType: 'contains' | 'intersects' | 'center-inside',
    existingRelations: ShapeRelationship[]
  ): RelationshipRule | null {
    for (const rule of this.rules) {
      if (!rule.canFormOnOverlap) continue;
      if (!this.matchesType(parent.type, rule.parentType)) continue;
      if (!this.matchesType(child.type, rule.childType)) continue;
      if (rule.overlapCondition !== overlapType) continue;

      // 多対多チェック
      if (!rule.allowMultipleParents) {
        const hasParent = existingRelations.some(r => r.childId === child.id);
        if (hasParent) continue;
      }

      // カスタムバリデーション
      if (rule.validate && !rule.validate(parent, child, existingRelations)) {
        continue;
      }

      return rule;
    }
    return null;
  }

  /**
   * 関係を作成
   */
  createRelationship(
    parentId: string,
    childId: string,
    rule: RelationshipRule,
    metadata?: RelationshipMetadata
  ): ShapeRelationship {
    return {
      id: generateId(),
      type: rule.type,
      parentId,
      childId,
      metadata,
      createdAt: Date.now(),
      effects: rule.effects,
      constraints: rule.constraints,
    };
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

    const relations = this.graph.getChildRelationships(parentId);
    const updatedShapes: Shape[] = [];

    for (const relation of relations) {
      const child = shapes[relation.childId];
      if (!child) continue;

      const effects = relation.effects ?? [];
      for (const effect of effects) {
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
   * 関係が変更された時の処理（新規追加・削除）
   */
  onRelationshipChanged(
    relation: ShapeRelationship,
    action: 'added' | 'removed',
    shapes: Record<string, Shape>
  ): void {
    if (action === 'added') {
      // 関係追加時の初期エフェクト適用
      const parent = shapes[relation.parentId];
      const child = shapes[relation.childId];
      if (!parent || !child) return;

      const effects = relation.effects ?? [];
      for (const effect of effects) {
        this.applyEffect(effect, parent, child, shapes);
      }
    }
    // removed時は特に処理不要（子は独立した状態に戻る）
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
   * エフェクトを適用
   */
  private applyEffect(
    effect: RelationshipEffect,
    parent: Shape,
    child: Shape,
    shapes: Record<string, Shape>
  ): Shape | null {
    const handler = effectHandlers[effect.type];
    if (!handler) return null;
    return handler(parent, child, effect.config, shapes);
  }
}
```

---

## 重なり検出と自動親子関係形成

### ドラッグ&ドロップでの自動親子関係形成

```typescript
/**
 * 形状のドロップ時に親子関係を自動形成（Graph版）
 */
export function handleShapeDropForRelationship(
  droppedShapeId: string,
  potentialParents: Shape[],
  ruleEngine: RelationshipRuleEngine,
  graph: RelationshipGraph,
  shapes: Record<string, Shape>
): ShapeRelationship | null {
  const droppedShape = shapes[droppedShapeId];
  if (!droppedShape) return null;

  // 既存の関係を取得
  const existingRelations = graph.toArray();

  // 優先度順（Z-indexが高い順）に親候補をチェック
  const sortedParents = [...potentialParents].sort(
    (a, b) => (b.layer?.zIndex ?? 0) - (a.layer?.zIndex ?? 0)
  );

  for (const parent of sortedParents) {
    // 自分自身は親にできない
    if (parent.id === droppedShapeId) continue;

    // 循環参照チェック
    if (graph.wouldCreateCycle(parent.id, droppedShapeId)) continue;

    // 重なりタイプを判定
    const overlapType = OverlapDetector.getOverlapType(parent, droppedShape);
    if (!overlapType) continue;

    // ルールエンジンに問い合わせ
    const rule = ruleEngine.checkOverlap(
      parent,
      droppedShape,
      overlapType,
      existingRelations
    );

    if (rule) {
      // 関係を作成
      const relation = ruleEngine.createRelationship(
        parent.id,
        droppedShapeId,
        rule
      );

      // グラフに追加
      graph.addRelationship(relation);

      // 初期エフェクト適用
      ruleEngine.onRelationshipChanged(relation, 'added', shapes);

      return relation;
    }
  }

  return null;
}
```

---

## エフェクト適用システム

エフェクトハンドラの実装はシンプル版とほぼ同じですが、`RelationshipGraph`を活用してより高度な処理が可能です。

```typescript
/**
 * auto-layout エフェクト（拡張版）
 * 親のレイアウト設定に基づいて子を自動配置
 */
function applyAutoLayout(
  parent: Shape,
  child: Shape,
  config: Record<string, unknown> | undefined,
  shapes: Record<string, Shape>
): Shape | null {
  // グラフから全子を取得
  const graph = globalRelationshipGraph; // 実際はDI
  const childRelations = graph.getChildRelationships(parent.id);

  // レイアウトタイプに応じた配置
  const layoutType = config?.layoutType ?? 'flex';

  if (layoutType === 'flex') {
    // Flexboxライクな自動配置
    const direction = (config?.direction as 'row' | 'column') ?? 'row';
    const gap = (config?.gap as number) ?? 10;

    let offset = 0;
    for (const relation of childRelations) {
      const childShape = shapes[relation.childId];
      if (!childShape || childShape.id !== child.id) continue;

      const layoutConfig = relation.metadata?.layoutConfig;
      const margin = layoutConfig?.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };

      if (direction === 'row') {
        return {
          ...child,
          x: parent.x + offset + margin.left,
          y: parent.y + margin.top,
        };
      } else {
        return {
          ...child,
          x: parent.x + margin.left,
          y: parent.y + offset + margin.top,
        };
      }
    }
  }

  return null;
}
```

---

## 実装フェーズ

### Phase 1: 基盤整備（3週間）

#### 1.1 型定義の追加

- [ ] `ShapeRelationship` インターフェースの定義
- [ ] `RelationshipMetadata` の定義
- [ ] `RelationshipRule` の拡張（多対多サポート）
- [ ] `Shape`から`layer.parentId`の削除計画

**成果物:**
- `packages/shared-types/src/relationship.ts`
- `packages/shared-types/src/index.ts` の更新

#### 1.2 RelationshipGraph の実装

- [ ] `RelationshipGraph` クラス
- [ ] インデックス構築ロジック
- [ ] グラフトラバーサル機能
- [ ] 循環参照チェック

**成果物:**
- `packages/relationship-system/src/relationship-graph.ts`
- 30個以上のユニットテスト（100%カバレッジ）

#### 1.3 ルールエンジンの実装

- [ ] `RelationshipRuleEngine` クラス（Graph対応）
- [ ] `OverlapDetector` ユーティリティ
- [ ] 標準ルールセットの定義

**成果物:**
- `packages/relationship-system/src/rule-engine.ts`
- `packages/relationship-system/src/standard-rules.ts`

#### 1.4 テストの作成

- [ ] `RelationshipGraph` のユニットテスト
- [ ] `RelationshipRuleEngine` のユニットテスト
- [ ] グラフ操作のエッジケーステスト

**成果物:**
- テストカバレッジ 95%以上

---

### Phase 2: エフェクトシステム（2週間）

#### 2.1 基本エフェクトの実装

- [ ] `move-with-parent` ハンドラ
- [ ] `rotate-with-parent` ハンドラ
- [ ] `clip-by-parent` ハンドラ

#### 2.2 高度なエフェクトの実装

- [ ] `auto-layout` ハンドラ（Flexbox風）
- [ ] `maintain-distance` ハンドラ
- [ ] `inherit-style` ハンドラ

#### 2.3 ストア統合

- [ ] `relationships`配列の追加
- [ ] `RelationshipGraph`の初期化
- [ ] 関係追加/削除のAPI
- [ ] エフェクト適用のフック

**成果物:**
- `packages/store/src/slices/relationship-slice.ts`
- `packages/store/src/relationship-graph-instance.ts`

---

### Phase 3: データ移行（2週間）

#### 3.1 移行スクリプトの作成

- [ ] `parentId` → `relationships` 変換
- [ ] `GroupShape.childIds` → `relationships` 変換
- [ ] バリデーションとエラーハンドリング

**成果物:**
- `packages/store/src/migrations/migrate-to-relationships.ts`

#### 3.2 後方互換性レイヤー

- [ ] `layer.parentId`の読み取り専用プロパティ化（Getter）
- [ ] 既存コードの段階的移行サポート
- [ ] Deprecated警告の追加

**成果物:**
- `packages/shared-types/src/legacy-compatibility.ts`

#### 3.3 移行テスト

- [ ] 移行スクリプトのユニットテスト
- [ ] 既存データの移行検証
- [ ] 後方互換性のテスト

---

### Phase 4: UI統合（3週間）

#### 4.1 ドラッグ&ドロップでの自動親子関係

- [ ] `handleShapeDropForRelationship` の実装
- [ ] select-tool での統合
- [ ] ビジュアルフィードバック

**成果物:**
- `packages/tools/src/tools/select-tool.ts` の更新

#### 4.2 レイヤーパネルでの関係表示

- [ ] 複数親のサポート（ツリー → グラフ表示）
- [ ] 関係タイプのアイコン表示
- [ ] 関係の追加/削除UI

**成果物:**
- `apps/whiteboard/src/components/layer-panel/` の大幅更新

#### 4.3 関係インスペクター

- [ ] 選択形状の全関係を表示
- [ ] 関係メタデータの編集
- [ ] 関係の削除

**成果物:**
- `apps/whiteboard/src/components/relationship-inspector.tsx`

#### 4.4 E2Eテスト

- [ ] グラフ構造のテスト
- [ ] 多対多関係のテスト
- [ ] 複雑なレイアウトのテスト

**成果物:**
- `apps/e2e/tests/relationship-graph.spec.ts`

---

### Phase 5: パフォーマンス最適化（2週間）

#### 5.1 インデックス最適化

- [ ] 大規模データセットでのベンチマーク
- [ ] インデックス構築の最適化
- [ ] メモリ使用量の削減

#### 5.2 レンダリング最適化

- [ ] React.memoの適用
- [ ] 仮想スクロールの導入（レイヤーパネル）
- [ ] エフェクト適用のバッチ処理

#### 5.3 ドキュメント作成

- [ ] API仕様書
- [ ] 使用例とベストプラクティス
- [ ] カスタムルールの作成ガイド
- [ ] パフォーマンスチューニングガイド

**成果物:**
- `docs/api/relationship-graph-system.md`
- `docs/examples/relationship-graph-usage.md`

---

## メリット・デメリット

### ✅ メリット

1. **柔軟性**: 多対多、複雑な関係性に対応
2. **拡張性**: 新しい関係タイプを簡単に追加
3. **関心の分離**: 形状データと関係性が独立
4. **メタデータ**: 関係固有の情報を保存可能
5. **トレーサビリティ**: 関係の作成日時や履歴を記録
6. **高速クエリ**: インデックスによるO(1)検索
7. **グラフ操作**: 祖先・子孫の取得、循環参照チェックが容易
8. **将来性**: 複雑な機能（レイアウトシステム、コンポーネント）に対応可能

### ❌ デメリット

1. **複雑性**: データ構造とコードが複雑
2. **実装コスト**: 開発期間が長い（10-12週間）
3. **学習コスト**: 開発者が理解するのに時間がかかる
4. **メモリ使用量**: インデックスによる追加メモリ
5. **移行コスト**: 既存データの移行が必要
6. **整合性管理**: グラフとインデックスの同期が必要
7. **デバッグ難易度**: 問題の特定が難しくなる可能性

### 🎯 適用範囲

以下の要件を満たす場合に適している:

- 形状数が1万を超える可能性がある
- 多対多の関係が必要
- 複雑なレイアウトシステムを実装予定
- 関係固有のメタデータが多い
- 長期的な拡張性を重視
- パフォーマンスが重要

---

## パフォーマンス考察

### クエリパフォーマンス

| 操作 | シンプル実装 | Graph実装 | 改善率 |
|------|-------------|-----------|--------|
| 子検索 | O(n) | O(1) | 最大100倍 |
| 親検索 | O(1) | O(1) | 同等 |
| 祖先検索 | O(n×d) | O(d) | n倍 |
| 子孫検索 | O(n×d) | O(c×d) | n/c倍 |
| 循環チェック | O(n) | O(d) | n/d倍 |

- n: 全形状数
- d: 深さ（階層レベル）
- c: 平均子数

### メモリ使用量

```typescript
// 1つの関係あたりのメモリ使用量（推定）

// シンプル実装
// Shape.layer.parentId: 8 bytes (文字列参照)
// Shape.layer.parentRelationType: 8 bytes

// Graph実装
// ShapeRelationship: 約200 bytes
//   - id: 40 bytes
//   - type: 8 bytes
//   - parentId: 40 bytes
//   - childId: 40 bytes
//   - metadata: ~50 bytes
//   - timestamps: 16 bytes
// インデックス: 約50 bytes (3つのMapエントリ)

// 合計: 約250 bytes vs 16 bytes
// 約15倍のメモリ使用量
```

**1万形状、平均3つの関係を持つ場合:**

- シンプル実装: 約480 KB
- Graph実装: 約7.5 MB

### ベンチマーク想定

| 形状数 | 関係数 | Graph構築 | 子検索 | 全子孫検索 | メモリ |
|--------|--------|----------|--------|-----------|--------|
| 100    | 150    | 1ms      | 0.01ms | 0.1ms     | 37 KB  |
| 1,000  | 1,500  | 10ms     | 0.01ms | 1ms       | 375 KB |
| 10,000 | 15,000 | 100ms    | 0.01ms | 10ms      | 3.7 MB |
| 100,000| 150,000| 1,000ms  | 0.01ms | 100ms     | 37 MB  |

---

## 移行計画

### ステップ1: 並行稼働（2週間）

既存の`parentId`と新しい`relationships`配列を両方サポート:

```typescript
// 後方互換性レイヤー
export function getParentId(shape: Shape, graph: RelationshipGraph): string | undefined {
  // 1. layer.parentId を優先（既存データ）
  if (shape.layer?.parentId) {
    return shape.layer.parentId;
  }

  // 2. relationships から取得（新データ）
  const relations = graph.getParentRelationships(shape.id);
  return relations[0]?.parentId;
}

export function setParentId(
  shapeId: string,
  parentId: string | null,
  relationType: RelationType,
  graph: RelationshipGraph,
  store: WhiteboardStore
): void {
  // 両方に書き込み（移行期間中）
  // 1. layer.parentId を更新
  store.updateShape(shapeId, {
    layer: {
      ...store.shapes[shapeId].layer,
      parentId: parentId ?? undefined,
      parentRelationType: relationType,
    },
  });

  // 2. relationships を更新
  // 既存関係を削除
  const existing = graph.getParentRelationships(shapeId);
  for (const rel of existing) {
    graph.removeRelationship(rel.id);
  }

  // 新しい関係を追加
  if (parentId) {
    const relation = store.relationshipRuleEngine.createRelationship(
      parentId,
      shapeId,
      // ルールを検索または作成
      findRuleForRelationType(relationType)
    );
    graph.addRelationship(relation);
  }
}
```

### ステップ2: データ移行（1週間）

```typescript
/**
 * 既存データをrelationships配列に移行
 */
export function migrateToRelationshipGraph(
  shapes: Record<string, Shape>,
  graph: RelationshipGraph,
  ruleEngine: RelationshipRuleEngine
): void {
  for (const shape of Object.values(shapes)) {
    // 1. layer.parentId から移行
    if (shape.layer?.parentId) {
      const relationType = shape.layer.parentRelationType ?? 'containment';
      const rule = findRuleForRelationType(relationType);

      const relation = ruleEngine.createRelationship(
        shape.layer.parentId,
        shape.id,
        rule
      );
      graph.addRelationship(relation);
    }

    // 2. GroupShape.childIds から移行
    if (shape.type === 'group') {
      const group = shape as GroupShape;
      if (group.childIds) {
        for (const childId of group.childIds) {
          const rule = findRuleForRelationType('containment');
          const relation = ruleEngine.createRelationship(
            group.id,
            childId,
            rule
          );
          graph.addRelationship(relation);
        }

        // childIds を削除（deprecated）
        delete (group as any).childIds;
      }
    }
  }

  // 移行後の検証
  validateRelationshipGraph(shapes, graph);
}

/**
 * グラフの整合性を検証
 */
function validateRelationshipGraph(
  shapes: Record<string, Shape>,
  graph: RelationshipGraph
): void {
  for (const relation of graph.toArray()) {
    // 親が存在するか
    if (!shapes[relation.parentId]) {
      console.error(`Invalid relation: parent ${relation.parentId} not found`);
      graph.removeRelationship(relation.id);
    }

    // 子が存在するか
    if (!shapes[relation.childId]) {
      console.error(`Invalid relation: child ${relation.childId} not found`);
      graph.removeRelationship(relation.id);
    }

    // 循環参照チェック
    if (graph.wouldCreateCycle(relation.parentId, relation.childId)) {
      console.error(`Circular reference detected: ${relation.id}`);
      graph.removeRelationship(relation.id);
    }
  }
}
```

### ステップ3: 完全移行（1週間）

```typescript
// layer.parentId を完全に削除
export interface LayerMetadata {
  name?: string;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  // parentId: 削除
  // parentRelationType: 削除
}

// GroupShape.childIds を削除
export interface GroupShape extends BaseShape {
  type: "group";
  width: number;
  height: number;
  name: string;
  collapsed: boolean;
  // childIds: 削除
}
```

---

## リスクと対策

### リスク1: パフォーマンス劣化

**対策:**
- インデックス構築の最適化
- 不要な再計算の削減（メモ化）
- Web Workerでのグラフ操作（将来）

### リスク2: データ移行の失敗

**対策:**
- 移行前のバックアップ
- ロールバック機能の実装
- 段階的な移行（並行稼働期間）

### リスク3: 複雑性による開発効率低下

**対策:**
- 充実したドキュメント
- デバッグツールの提供
- ユニットテストの充実（95%以上）

### リスク4: メモリ使用量の増加

**対策:**
- インデックスの遅延構築
- 不要な関係の定期クリーンアップ
- メモリプロファイリングの実施

---

## 今後の拡張可能性

### 1. レイアウトシステム

```typescript
const flexLayoutRule: RelationshipRule = {
  id: 'flex-layout',
  type: 'layout',
  parentType: 'frame',
  childType: '*',
  canFormOnOverlap: true,
  overlapCondition: 'center-inside',
  effects: [
    {
      type: 'auto-layout',
      config: {
        layoutType: 'flex',
        direction: 'row',
        gap: 10,
      },
    },
  ],
  allowMultipleChildren: true,
};
```

### 2. コンポーネントシステム

```typescript
// マスターコンポーネントとインスタンスの関係
const instanceRelation: ShapeRelationship = {
  id: 'instance-1',
  type: 'instance',
  parentId: 'master-component-id',
  childId: 'instance-shape-id',
  metadata: {
    instanceOverrides: {
      text: 'Custom text',
      fillColor: '#ff0000',
    },
  },
  createdAt: Date.now(),
};
```

### 3. 高度なクエリ

```typescript
// 複数条件でのフィルタリング
graph.findRelationships({
  type: 'containment',
  parentType: 'group',
  createdAfter: Date.now() - 3600000, // 1時間以内
  hasMetadata: { layoutConfig: true },
});

// パス検索
graph.findPath('shape-a', 'shape-z', { maxDepth: 5 });
```

### 4. リレーションのバージョン管理

```typescript
export interface ShapeRelationship {
  // ...
  version: number;
  history?: Array<{
    version: number;
    updatedAt: number;
    changes: Partial<ShapeRelationship>;
  }>;
}
```

---

## まとめ

この実装方式は、**柔軟性**と**将来の拡張性**を最大化した設計です。

**推奨ケース:**
- 長期的なプロジェクト（2年以上）
- 複雑な機能を段階的に追加予定
- 形状数が1万を超える可能性
- 多対多の関係が必要
- チームに十分なリソースがある

**避けるべきケース:**
- 短期的なプロトタイプ
- 小規模プロジェクト（形状数1000未満）
- シンプルさを重視
- 開発リソースが限られている

**シンプル実装との比較:**

| 項目 | シンプル実装 | Graph実装 |
|------|-------------|-----------|
| 開発期間 | 7週間 | 12週間 |
| 複雑性 | 低 | 高 |
| 柔軟性 | 中 | 極めて高 |
| パフォーマンス（小規模） | 高 | 中 |
| パフォーマンス（大規模） | 低 | 高 |
| メモリ使用量 | 少 | 多 |
| 学習コスト | 低 | 高 |
| 将来性 | 中 | 極めて高 |

**最終判断:**
- まずは**シンプル実装**で開始
- 必要性が明確になったら**Graph実装**に移行
- 段階的な移行パスを確保

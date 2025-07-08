# データ属性標準仕様書

## 🎯 目的

このドキュメントは、DOMホワイトボードプロジェクトにおけるdata-*属性の標準仕様を定義し、テスト可能性を高めるための統一的なガイドラインを提供します。

## ⚠️ 重要: 現在の実装状況

**現在、E2Eテストで期待されている`data-shape`属性が実装に存在しません。**
代わりに`data-shape-id`が使用されています。この差異を解消するため、以下の標準を定めます。

## 📋 データ属性の標準定義

### 1. Shape関連の属性

```html
<!-- Shape要素の基本構造 -->
<div class="shape"
     data-shape-id="shape-123"
     data-shape-type="rectangle"
     data-shape-selected="true"
     data-shape-locked="false"
     data-shape-visible="true"
     style="transform: translate(100px, 100px)">
  <!-- Shape content -->
</div>
```

#### 必須属性

| 属性名 | 説明 | 値の例 | 用途 |
|--------|------|--------|------|
| `data-shape-id` | 一意のShape識別子 | `"shape-123"`, `"rect-abc"` | 個別のShapeを特定 |
| `data-shape-type` | Shapeの種類 | `"rectangle"`, `"ellipse"`, `"line"` | Shape種別でのフィルタリング |

#### オプション属性

| 属性名 | 説明 | 値 | デフォルト |
|--------|------|-----|------------|
| `data-shape-selected` | 選択状態 | `"true"` \| `"false"` | `"false"` |
| `data-shape-locked` | ロック状態 | `"true"` \| `"false"` | `"false"` |
| `data-shape-visible` | 表示状態 | `"true"` \| `"false"` | `"true"` |
| `data-shape-layer` | レイヤー番号 | `"0"`, `"1"`, `"2"`... | `"0"` |

### 2. ツール関連の属性

```html
<!-- ツールボタンの例 -->
<button class="tool-button"
        data-tool="rectangle"
        data-tool-active="true"
        data-tool-group="shapes">
  <span data-tool-icon="rectangle">□</span>
  <span data-tool-label>Rectangle</span>
</button>
```

| 属性名 | 説明 | 値の例 |
|--------|------|--------|
| `data-tool` | ツール識別子 | `"select"`, `"rectangle"`, `"ellipse"` |
| `data-tool-active` | アクティブ状態 | `"true"` \| `"false"` |
| `data-tool-group` | ツールグループ | `"shapes"`, `"selection"`, `"text"` |

### 3. UI要素の属性

```html
<!-- 選択ボックス -->
<div class="selection-box"
     data-selection-type="single"
     data-selection-count="1">
  <div class="resize-handle" data-resize-handle="nw"></div>
  <div class="resize-handle" data-resize-handle="ne"></div>
  <!-- ... other handles ... -->
</div>

<!-- キャンバス -->
<div id="canvas"
     data-canvas-ready="true"
     data-canvas-tool="rectangle"
     data-canvas-zoom="100">
  <!-- Canvas content -->
</div>
```

### 4. 状態管理の属性

```html
<!-- アプリケーション全体の状態 -->
<div id="app"
     data-app-ready="true"
     data-app-mode="edit"
     data-app-debug="false">
  <!-- Application content -->
</div>
```

## 🔧 実装ガイド

### TypeScriptでの型定義

```typescript
// types/data-attributes.ts
export interface ShapeDataAttributes {
  'data-shape-id': string;
  'data-shape-type': ShapeType;
  'data-shape-selected'?: 'true' | 'false';
  'data-shape-locked'?: 'true' | 'false';
  'data-shape-visible'?: 'true' | 'false';
  'data-shape-layer'?: string;
}

export interface ToolDataAttributes {
  'data-tool': ToolType;
  'data-tool-active'?: 'true' | 'false';
  'data-tool-group'?: ToolGroup;
}

// ヘルパー関数
export function setShapeDataAttributes(
  element: HTMLElement,
  attributes: Partial<ShapeDataAttributes>
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined) {
      element.setAttribute(key, String(value));
    }
  });
}

export function getShapeDataAttributes(
  element: HTMLElement
): Partial<ShapeDataAttributes> {
  const attributes: Partial<ShapeDataAttributes> = {};
  
  const id = element.getAttribute('data-shape-id');
  if (id) attributes['data-shape-id'] = id;
  
  const type = element.getAttribute('data-shape-type');
  if (type) attributes['data-shape-type'] = type as ShapeType;
  
  // ... other attributes
  
  return attributes;
}
```

### 実装例

```typescript
// components/Shape.ts
class Shape {
  private element: HTMLElement;
  
  constructor(private data: ShapeData) {
    this.element = this.createElement();
    this.updateDataAttributes();
  }
  
  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'shape';
    return element;
  }
  
  private updateDataAttributes(): void {
    // 必須属性
    this.element.setAttribute('data-shape-id', this.data.id);
    this.element.setAttribute('data-shape-type', this.data.type);
    
    // オプション属性
    if (this.data.selected) {
      this.element.setAttribute('data-shape-selected', 'true');
    } else {
      this.element.removeAttribute('data-shape-selected');
    }
    
    // テスト用の追加属性
    if (process.env.NODE_ENV === 'test') {
      this.element.setAttribute('data-testid', `shape-${this.data.id}`);
    }
  }
  
  select(): void {
    this.data.selected = true;
    this.element.setAttribute('data-shape-selected', 'true');
    this.element.classList.add('selected');
  }
  
  deselect(): void {
    this.data.selected = false;
    this.element.removeAttribute('data-shape-selected');
    this.element.classList.remove('selected');
  }
}
```

## 🧪 テストでの使用方法

### セレクタヘルパー

```typescript
// test-utils/selectors.ts
export const SHAPE_SELECTORS = {
  // 基本セレクタ
  anyShape: '[data-shape-id]',
  shapeById: (id: string) => `[data-shape-id="${id}"]`,
  shapeByType: (type: string) => `[data-shape-type="${type}"]`,
  
  // 状態セレクタ
  selectedShapes: '[data-shape-selected="true"]',
  lockedShapes: '[data-shape-locked="true"]',
  visibleShapes: '[data-shape-visible="true"]',
  
  // 複合セレクタ
  selectedRectangles: '[data-shape-type="rectangle"][data-shape-selected="true"]',
  unlockedShapes: '[data-shape-id]:not([data-shape-locked="true"])',
} as const;

export const TOOL_SELECTORS = {
  anyTool: '[data-tool]',
  toolByName: (name: string) => `[data-tool="${name}"]`,
  activeTool: '[data-tool-active="true"]',
  toolInGroup: (group: string) => `[data-tool-group="${group}"]`,
} as const;
```

### E2Eテストでの使用

```typescript
// e2e/shape-selection.spec.ts
import { test, expect } from '@playwright/test';
import { SHAPE_SELECTORS, TOOL_SELECTORS } from '../test-utils/selectors';

test.describe('Shape Selection', () => {
  test('should select shape on click', async ({ page }) => {
    await page.goto('/');
    
    // Shapeをクリック
    const shape = page.locator(SHAPE_SELECTORS.shapeByType('rectangle')).first();
    await shape.click();
    
    // 選択状態を確認
    await expect(shape).toHaveAttribute('data-shape-selected', 'true');
    await expect(page.locator(SHAPE_SELECTORS.selectedShapes)).toHaveCount(1);
  });
  
  test('should select multiple shapes', async ({ page }) => {
    await page.goto('/');
    
    // 複数のShapeを選択（Ctrlキー押下）
    const shapes = page.locator(SHAPE_SELECTORS.anyShape);
    await shapes.nth(0).click();
    await shapes.nth(1).click({ modifiers: ['Control'] });
    
    // 選択数を確認
    await expect(page.locator(SHAPE_SELECTORS.selectedShapes)).toHaveCount(2);
  });
});
```

### ユニットテストでの使用

```typescript
// tests/shape.test.ts
import { Shape } from '../src/components/Shape';
import { SHAPE_SELECTORS } from '../test-utils/selectors';

describe('Shape Component', () => {
  it('should set correct data attributes', () => {
    const shape = new Shape({
      id: 'test-123',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });
    
    const element = shape.getElement();
    
    expect(element.getAttribute('data-shape-id')).toBe('test-123');
    expect(element.getAttribute('data-shape-type')).toBe('rectangle');
    expect(element.matches(SHAPE_SELECTORS.shapeByType('rectangle'))).toBe(true);
  });
  
  it('should update selection state', () => {
    const shape = new Shape({ id: 'test-456', type: 'ellipse' });
    const element = shape.getElement();
    
    // 選択前
    expect(element.getAttribute('data-shape-selected')).toBeNull();
    
    // 選択
    shape.select();
    expect(element.getAttribute('data-shape-selected')).toBe('true');
    expect(element.matches(SHAPE_SELECTORS.selectedShapes)).toBe(true);
    
    // 選択解除
    shape.deselect();
    expect(element.getAttribute('data-shape-selected')).toBeNull();
  });
});
```

## 📊 移行計画

### 現在の実装から標準への移行

```typescript
// migration/update-data-attributes.ts
export function migrateDataAttributes(): void {
  // 既存の要素を更新
  document.querySelectorAll('[data-shape]').forEach(element => {
    const shapeId = element.getAttribute('data-shape');
    if (shapeId) {
      element.setAttribute('data-shape-id', shapeId);
      element.removeAttribute('data-shape');
    }
  });
  
  // data-selectedをdata-shape-selectedに変更
  document.querySelectorAll('[data-selected]').forEach(element => {
    const selected = element.getAttribute('data-selected');
    if (selected && element.hasAttribute('data-shape-id')) {
      element.setAttribute('data-shape-selected', selected);
      element.removeAttribute('data-selected');
    }
  });
}
```

### 段階的な移行手順

1. **Phase 1: 新属性の追加（互換性維持）**
   ```typescript
   element.setAttribute('data-shape', id); // 既存
   element.setAttribute('data-shape-id', id); // 新規追加
   ```

2. **Phase 2: テストの更新**
   - 新しいセレクタヘルパーを使用
   - 古いセレクタから段階的に移行

3. **Phase 3: 古い属性の削除**
   - 全てのテストが新属性を使用することを確認
   - 古い属性を削除

## 🔍 デバッグ支援

### データ属性の可視化

```typescript
// debug/data-attributes-inspector.ts
export class DataAttributesInspector {
  private enabled = false;
  
  enable(): void {
    this.enabled = true;
    this.addStyles();
    this.showAttributes();
  }
  
  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      [data-shape-id]::before {
        content: attr(data-shape-id) " (" attr(data-shape-type) ")";
        position: absolute;
        top: -20px;
        left: 0;
        font-size: 10px;
        background: #333;
        color: white;
        padding: 2px 4px;
        border-radius: 2px;
        pointer-events: none;
        z-index: 9999;
      }
      
      [data-shape-selected="true"] {
        outline: 2px solid #0066ff !important;
      }
      
      [data-tool-active="true"] {
        background-color: #e0e0e0 !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  showAttributes(): void {
    console.log('=== Data Attributes Debug Info ===');
    
    // Shape属性
    const shapes = document.querySelectorAll('[data-shape-id]');
    console.log(`Shapes found: ${shapes.length}`);
    shapes.forEach((shape, index) => {
      console.log(`Shape ${index}:`, {
        id: shape.getAttribute('data-shape-id'),
        type: shape.getAttribute('data-shape-type'),
        selected: shape.getAttribute('data-shape-selected'),
      });
    });
    
    // Tool属性
    const tools = document.querySelectorAll('[data-tool]');
    console.log(`Tools found: ${tools.length}`);
    tools.forEach((tool, index) => {
      console.log(`Tool ${index}:`, {
        name: tool.getAttribute('data-tool'),
        active: tool.getAttribute('data-tool-active'),
      });
    });
  }
}

// 使用例
if (process.env.NODE_ENV === 'development') {
  const inspector = new DataAttributesInspector();
  (window as any).inspectDataAttributes = () => inspector.enable();
}
```

## ✅ チェックリスト

### 実装時のチェックリスト

- [ ] 必須のdata属性が設定されている
  - [ ] `data-shape-id`（Shape要素）
  - [ ] `data-shape-type`（Shape要素）
  - [ ] `data-tool`（ツール要素）
- [ ] 属性値が仕様に準拠している
- [ ] 状態変更時に属性が更新される
- [ ] 不要な属性が削除される
- [ ] テスト環境でのみ`data-testid`が追加される

### レビュー時のチェックリスト

- [ ] データ属性の命名規則に従っている
- [ ] セレクタヘルパーを使用している
- [ ] 属性の更新が適切に行われている
- [ ] パフォーマンスへの影響が考慮されている

## 📝 今後の拡張

### 検討中の属性

- `data-shape-group`: グループ化されたShapeの識別
- `data-shape-parent`: 親Shape ID
- `data-shape-order`: Z-index順序
- `data-shape-transform`: 変形情報

### カスタムイベント属性

- `data-event-clickable`: クリック可能
- `data-event-draggable`: ドラッグ可能
- `data-event-resizable`: リサイズ可能

これらの標準に従うことで、テストの信頼性と保守性が大幅に向上します。
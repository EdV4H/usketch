# 描画ツール テストケース設計書

## 1. テスト対象の概要

### 対象機能
- 矩形（Rectangle）描画ツール
- 楕円（Ellipse）描画ツール
- 直線（Line）描画ツール
- 自由描画（Freehand）ツール
- テキスト（Text）ツール
- 選択（Selection）ツール

### テスト範囲
- ツールの切り替え
- 描画操作（マウス/タッチ）
- 図形のプロパティ設定
- 描画のキャンセル
- Undo/Redo機能

## 2. ユニットテストケース

### 2.1 ツール管理（ToolManager）

#### TC-TM-001: ツール切り替え
```typescript
describe('ToolManager', () => {
  it('should switch between tools correctly', () => {
    const toolManager = new ToolManager()
    
    toolManager.setActiveTool('rectangle')
    expect(toolManager.getActiveTool()).toBe('rectangle')
    
    toolManager.setActiveTool('ellipse')
    expect(toolManager.getActiveTool()).toBe('ellipse')
  })
  
  it('should deactivate previous tool when switching', () => {
    const toolManager = new ToolManager()
    const mockDeactivate = vi.fn()
    
    toolManager.setActiveTool('rectangle')
    toolManager.tools.rectangle.deactivate = mockDeactivate
    
    toolManager.setActiveTool('ellipse')
    expect(mockDeactivate).toHaveBeenCalled()
  })
})
```

### 2.2 矩形ツール（RectangleTool）

#### TC-RT-001: 矩形の描画開始
```typescript
describe('RectangleTool', () => {
  it('should start drawing on mousedown', () => {
    const tool = new RectangleTool()
    const mockEvent = createMockMouseEvent('mousedown', { x: 100, y: 100 })
    
    tool.onMouseDown(mockEvent)
    
    expect(tool.isDrawing).toBe(true)
    expect(tool.startPoint).toEqual({ x: 100, y: 100 })
  })
})
```

#### TC-RT-002: 矩形のドラッグ中更新
```typescript
it('should update rectangle dimensions on drag', () => {
  const tool = new RectangleTool()
  const store = useWhiteboardStore.getState()
  
  tool.onMouseDown(createMockMouseEvent('mousedown', { x: 100, y: 100 }))
  tool.onMouseMove(createMockMouseEvent('mousemove', { x: 200, y: 150 }))
  
  const shape = store.getShape(tool.currentShapeId)
  expect(shape.width).toBe(100)
  expect(shape.height).toBe(50)
})
```

#### TC-RT-003: 矩形の描画完了
```typescript
it('should complete rectangle on mouseup', () => {
  const tool = new RectangleTool()
  const store = useWhiteboardStore.getState()
  
  tool.onMouseDown(createMockMouseEvent('mousedown', { x: 100, y: 100 }))
  tool.onMouseMove(createMockMouseEvent('mousemove', { x: 200, y: 150 }))
  tool.onMouseUp(createMockMouseEvent('mouseup'))
  
  expect(tool.isDrawing).toBe(false)
  expect(store.shapes.length).toBe(1)
})
```

#### TC-RT-004: 最小サイズ制約
```typescript
it('should enforce minimum size constraints', () => {
  const tool = new RectangleTool()
  
  tool.onMouseDown(createMockMouseEvent('mousedown', { x: 100, y: 100 }))
  tool.onMouseMove(createMockMouseEvent('mousemove', { x: 102, y: 101 }))
  tool.onMouseUp(createMockMouseEvent('mouseup'))
  
  const shape = store.getShape(tool.currentShapeId)
  expect(shape).toBeUndefined() // 小さすぎる図形は作成されない
})
```

### 2.3 楕円ツール（EllipseTool）

#### TC-ET-001: 楕円の描画
```typescript
describe('EllipseTool', () => {
  it('should create ellipse with correct dimensions', () => {
    const tool = new EllipseTool()
    const store = useWhiteboardStore.getState()
    
    tool.onMouseDown(createMockMouseEvent('mousedown', { x: 50, y: 50 }))
    tool.onMouseMove(createMockMouseEvent('mousemove', { x: 150, y: 100 }))
    tool.onMouseUp(createMockMouseEvent('mouseup'))
    
    const shape = store.shapes[0]
    expect(shape.type).toBe('ellipse')
    expect(shape.width).toBe(100)
    expect(shape.height).toBe(50)
  })
})
```

### 2.4 直線ツール（LineTool）

#### TC-LT-001: 直線の描画
```typescript
describe('LineTool', () => {
  it('should create line between two points', () => {
    const tool = new LineTool()
    
    tool.onMouseDown(createMockMouseEvent('mousedown', { x: 0, y: 0 }))
    tool.onMouseMove(createMockMouseEvent('mousemove', { x: 100, y: 100 }))
    tool.onMouseUp(createMockMouseEvent('mouseup'))
    
    const shape = store.shapes[0]
    expect(shape.type).toBe('line')
    expect(shape.startX).toBe(0)
    expect(shape.startY).toBe(0)
    expect(shape.endX).toBe(100)
    expect(shape.endY).toBe(100)
  })
})
```

### 2.5 選択ツール（SelectionTool）

#### TC-ST-001: 単一選択
```typescript
describe('SelectionTool', () => {
  it('should select shape on click', () => {
    const tool = new SelectionTool()
    const store = useWhiteboardStore.getState()
    
    // 事前に図形を追加
    store.addShape(createMockRectangle(100, 100, 50, 50))
    
    tool.onClick(createMockMouseEvent('click', { x: 125, y: 125 }))
    
    expect(store.selectedShapeIds).toContain(store.shapes[0].id)
  })
})
```

## 3. 統合テストケース

### 3.1 ツール切り替えと描画

#### TC-INT-001: 複数ツールでの連続描画
```typescript
it('should draw multiple shapes with different tools', async () => {
  const canvas = new WhiteboardCanvas(element)
  
  // 矩形を描画
  canvas.setTool('rectangle')
  await drawRectangle(canvas, { x: 10, y: 10 }, { x: 60, y: 60 })
  
  // 楕円を描画
  canvas.setTool('ellipse')
  await drawEllipse(canvas, { x: 100, y: 10 }, { x: 150, y: 60 })
  
  const shapes = canvas.getShapes()
  expect(shapes).toHaveLength(2)
  expect(shapes[0].type).toBe('rectangle')
  expect(shapes[1].type).toBe('ellipse')
})
```

### 3.2 描画とUndo/Redo

#### TC-INT-002: Undo/Redo動作
```typescript
it('should undo and redo drawing operations', async () => {
  const canvas = new WhiteboardCanvas(element)
  
  // 3つの図形を描画
  await drawRectangle(canvas, { x: 0, y: 0 }, { x: 50, y: 50 })
  await drawEllipse(canvas, { x: 60, y: 0 }, { x: 110, y: 50 })
  await drawLine(canvas, { x: 0, y: 60 }, { x: 100, y: 60 })
  
  expect(canvas.getShapes()).toHaveLength(3)
  
  // Undo
  canvas.undo()
  expect(canvas.getShapes()).toHaveLength(2)
  
  // Redo
  canvas.redo()
  expect(canvas.getShapes()).toHaveLength(3)
})
```

## 4. E2Eテストケース

### 4.1 基本的な描画フロー

#### TC-E2E-001: 矩形描画の完全フロー
```typescript
test('should draw rectangle with mouse', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  // ツールバーから矩形ツールを選択
  await page.click('[data-tool="rectangle"]')
  
  // キャンバス上で矩形を描画
  const canvas = page.locator('#canvas')
  await canvas.dragTo(canvas, {
    sourcePosition: { x: 100, y: 100 },
    targetPosition: { x: 200, y: 150 }
  })
  
  // 矩形が作成されたことを確認
  const rectangle = page.locator('[data-shape-type="rectangle"]')
  await expect(rectangle).toBeVisible()
  await expect(rectangle).toHaveCSS('width', '100px')
  await expect(rectangle).toHaveCSS('height', '50px')
})
```

### 4.2 図形の編集

#### TC-E2E-002: 図形の移動とリサイズ
```typescript
test('should move and resize shape', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  // 矩形を描画
  await drawRectangleOnCanvas(page, { x: 100, y: 100 }, { x: 200, y: 200 })
  
  // 図形を選択
  await page.click('[data-shape-type="rectangle"]')
  
  // 図形を移動
  await page.dragTo('[data-shape-type="rectangle"]', {
    targetPosition: { x: 150, y: 150 }
  })
  
  // リサイズハンドルをドラッグ
  await page.dragTo('[data-resize-handle="se"]', {
    targetPosition: { x: 250, y: 250 }
  })
  
  // 位置とサイズを確認
  const shape = page.locator('[data-shape-type="rectangle"]')
  await expect(shape).toHaveAttribute('data-x', '150')
  await expect(shape).toHaveAttribute('data-width', '150')
})
```

### 4.3 キーボードショートカット

#### TC-E2E-003: キーボードショートカット操作
```typescript
test('should respond to keyboard shortcuts', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  // 図形を描画
  await drawRectangleOnCanvas(page, { x: 50, y: 50 }, { x: 150, y: 150 })
  
  // Ctrl+Z でUndo
  await page.keyboard.press('Control+Z')
  await expect(page.locator('[data-shape-type="rectangle"]')).not.toBeVisible()
  
  // Ctrl+Y でRedo
  await page.keyboard.press('Control+Y')
  await expect(page.locator('[data-shape-type="rectangle"]')).toBeVisible()
  
  // Delete で削除
  await page.click('[data-shape-type="rectangle"]')
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-shape-type="rectangle"]')).not.toBeVisible()
})
```

## 5. パフォーマンステスト

### 5.1 大量図形の描画

#### TC-PERF-001: 100個の図形描画
```typescript
test('should handle 100 shapes efficiently', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  const startTime = Date.now()
  
  // 100個の図形を描画
  for (let i = 0; i < 100; i++) {
    const x = (i % 10) * 60
    const y = Math.floor(i / 10) * 60
    await drawRectangleOnCanvas(page, { x, y }, { x: x + 50, y: y + 50 })
  }
  
  const endTime = Date.now()
  const totalTime = endTime - startTime
  
  // 描画時間が妥当な範囲内
  expect(totalTime).toBeLessThan(30000) // 30秒以内
  
  // すべての図形が表示されている
  const shapes = page.locator('[data-shape-type="rectangle"]')
  await expect(shapes).toHaveCount(100)
})
```

## 6. アクセシビリティテスト

### 6.1 キーボード操作

#### TC-A11Y-001: キーボードのみでの操作
```typescript
test('should be fully keyboard accessible', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  // Tabでツールバーにフォーカス
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-tool="selection"]')).toBeFocused()
  
  // 矢印キーでツール選択
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-tool="rectangle"]')).toBeFocused()
  
  // Enterで選択
  await page.keyboard.press('Enter')
  
  // キャンバスにフォーカスを移動してSpaceで描画モード
  await page.keyboard.press('Tab')
  await page.keyboard.press('Space')
  
  // 矢印キーで描画位置を調整
  await page.keyboard.press('ArrowRight+Shift')
  await page.keyboard.press('ArrowDown+Shift')
})
```

## 7. エラーケース

### 7.1 異常系テスト

#### TC-ERR-001: 無効な座標での描画
```typescript
it('should handle invalid coordinates gracefully', () => {
  const tool = new RectangleTool()
  
  // 負の座標
  tool.onMouseDown(createMockMouseEvent('mousedown', { x: -100, y: -100 }))
  tool.onMouseMove(createMockMouseEvent('mousemove', { x: -200, y: -200 }))
  tool.onMouseUp(createMockMouseEvent('mouseup'))
  
  // エラーが発生しないこと
  expect(() => tool.getCurrentShape()).not.toThrow()
})
```

## 8. テスト実行計画

### フェーズ1: ユニットテスト
- 各ツールクラスの基本機能
- エッジケースとエラーハンドリング
- 実行時間目標: < 5秒

### フェーズ2: 統合テスト
- ツール間の連携
- 状態管理との統合
- 実行時間目標: < 10秒

### フェーズ3: E2Eテスト
- ユーザーシナリオ
- ブラウザ互換性
- 実行時間目標: < 30秒

### フェーズ4: 非機能テスト
- パフォーマンステスト
- アクセシビリティテスト
- 実行時間目標: < 60秒
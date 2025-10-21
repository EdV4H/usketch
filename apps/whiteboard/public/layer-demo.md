# レイヤー管理機能デモ

Phase 7.1 & 7.2で実装したレイヤー管理機能をブラウザコンソールで試す方法

## 準備

1. アプリを起動: `pnpm --filter @usketch/app run dev`
2. ブラウザを開く: http://localhost:5173
3. 開発者ツールのコンソールを開く (F12 または Cmd+Option+I)

## ストアへのアクセス

```javascript
// ストアにアクセス
const store = window.__WHITEBOARD_STORE__;
```

## 1. 複数の図形を作成

```javascript
// 3つの矩形を作成
const rect1 = {
  id: 'rect-1',
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  strokeColor: '#ff0000',
  fillColor: '#ffcccc',
  strokeWidth: 2
};

const rect2 = {
  id: 'rect-2',
  type: 'rectangle',
  x: 250,
  y: 100,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  strokeColor: '#00ff00',
  fillColor: '#ccffcc',
  strokeWidth: 2
};

const rect3 = {
  id: 'rect-3',
  type: 'rectangle',
  x: 400,
  y: 100,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 1,
  strokeColor: '#0000ff',
  fillColor: '#ccccff',
  strokeWidth: 2
};

store.getState().addShape(rect1);
store.getState().addShape(rect2);
store.getState().addShape(rect3);
```

## 2. グループ化機能を試す

```javascript
// rect1とrect2を選択
store.getState().setSelection(['rect-1', 'rect-2']);

// グループ化（"My Group"という名前で）
const groupId = store.getState().groupShapes('My Group');
console.log('グループID:', groupId);

// グループ情報を確認
console.log('グループ一覧:', store.getState().groups);
console.log('Z-order:', store.getState().zOrder);
```

## 3. グループ解除を試す

```javascript
// グループを解除
store.getState().ungroupShapes(groupId);

// 解除されたことを確認
console.log('グループ一覧:', store.getState().groups);
console.log('Z-order:', store.getState().zOrder);
```

## 4. 可視性の切り替え

```javascript
// rect1を非表示にする
store.getState().toggleShapeVisibility('rect-1');

// 確認
console.log('rect-1の可視性:', store.getState().shapes['rect-1']?.layer?.visible);

// 再度表示
store.getState().toggleShapeVisibility('rect-1');
```

## 5. ロック機能

```javascript
// rect2をロック
store.getState().toggleShapeLock('rect-2');

// 確認
console.log('rect-2のロック状態:', store.getState().shapes['rect-2']?.layer?.locked);

// ロック解除
store.getState().toggleShapeLock('rect-2');
```

## 6. Z-index操作

```javascript
// Z-orderの初期状態を確認
console.log('初期Z-order:', store.getState().zOrder);

// rect1を最前面に
store.getState().bringToFront('rect-1');
console.log('最前面移動後:', store.getState().zOrder);

// rect3を最背面に
store.getState().sendToBack('rect-3');
console.log('最背面移動後:', store.getState().zOrder);

// rect2を1つ前に
store.getState().bringForward('rect-2');
console.log('1つ前移動後:', store.getState().zOrder);

// rect1を1つ後ろに
store.getState().sendBackward('rect-1');
console.log('1つ後ろ移動後:', store.getState().zOrder);
```

## 7. Undo/Redo機能

```javascript
// グループ化してからUndo
store.getState().setSelection(['rect-1', 'rect-2']);
const gid = store.getState().groupShapes('Test Group');

console.log('グループ化後:', store.getState().groups);

// Undo
store.getState().undo();
console.log('Undo後:', store.getState().groups);

// Redo
store.getState().redo();
console.log('Redo後:', store.getState().groups);
```

## 8. レイヤーツリーの取得

```javascript
// レイヤーツリーを取得（UI表示用）
const tree = store.getState().getLayerTree();
console.log('レイヤーツリー:', tree);

// レイヤー名を取得
console.log('rect-1の名前:', store.getState().getLayerName('rect-1'));
```

## 9. 複雑なシナリオ

```javascript
// 全体のワークフロー
// 1. 図形を作成
const shapes = [
  { id: 's1', type: 'rectangle', x: 50, y: 50, width: 80, height: 80, rotation: 0, opacity: 1, strokeColor: '#ff0000', fillColor: '#ffcccc', strokeWidth: 2 },
  { id: 's2', type: 'rectangle', x: 150, y: 50, width: 80, height: 80, rotation: 0, opacity: 1, strokeColor: '#00ff00', fillColor: '#ccffcc', strokeWidth: 2 },
  { id: 's3', type: 'rectangle', x: 250, y: 50, width: 80, height: 80, rotation: 0, opacity: 1, strokeColor: '#0000ff', fillColor: '#ccccff', strokeWidth: 2 },
  { id: 's4', type: 'rectangle', x: 350, y: 50, width: 80, height: 80, rotation: 0, opacity: 1, strokeColor: '#ffff00', fillColor: '#ffffcc', strokeWidth: 2 }
];

shapes.forEach(s => store.getState().addShape(s));

// 2. グループ化（s1, s2）
store.getState().setSelection(['s1', 's2']);
const g1 = store.getState().groupShapes('Group A');

// 3. グループ化（s3, s4）
store.getState().setSelection(['s3', 's4']);
const g2 = store.getState().groupShapes('Group B');

// 4. グループ全体の可視性を切り替え
store.getState().toggleGroupVisibility(g1);

// 5. レイヤーツリーを確認
console.log('最終レイヤーツリー:', store.getState().getLayerTree());

// 6. Undo/Redoで履歴を確認
console.log('Undo可能:', store.getState().canUndo);
console.log('Redo可能:', store.getState().canRedo);
```

## ストアの状態確認

```javascript
// 現在のストア状態を全て表示
const state = store.getState();
console.log({
  shapes: state.shapes,
  groups: state.groups,
  zOrder: state.zOrder,
  selectedShapeIds: Array.from(state.selectedShapeIds),
  layerPanelOpen: state.layerPanelOpen,
  canUndo: state.canUndo,
  canRedo: state.canRedo
});
```

## 注意事項

- Phase 7.3（レイヤーパネルUI）はまだ未実装なので、ブラウザコンソールからのみ操作可能
- グループ化した図形は視覚的には変化しませんが、内部状態は正しく管理されています
- Undo/Redoは完全に動作します

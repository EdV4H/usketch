# Phase 6 スタイル機能のテスト方法

## 開発サーバー
http://localhost:5175/ でアクセス可能

## ブラウザコンソールでテストできる機能

### 1. ストアへのアクセス
```javascript
// ストアを取得
const store = window.whiteboardStore || document.querySelector('[data-testid="canvas"]').__reactFiber$?.return?.return?.memoizedProps?.value?.store;

// または開発者ツールでReact DevToolsを使用
// Components → Canvas → Props → store
```

### 2. 現在のスタイル状態を確認
```javascript
// 選択中形状のスタイル
store.getState().selectedShapeStyles

// スタイルプリセット一覧
store.getState().stylePresets

// 最近使った色
store.getState().recentColors

// コピー中のスタイル
store.getState().copiedStyle
```

### 3. 形状を作成して選択
```javascript
// 矩形を作成
store.getState().addShape({
  id: 'test-rect-1',
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  rotation: 0,
  opacity: 1,
  strokeColor: '#333333',
  fillColor: '#e0e0ff',
  strokeWidth: 2
});

// 形状を選択
store.getState().selectShape('test-rect-1');

// 選択中のスタイルを確認
store.getState().selectedShapeStyles
```

### 4. スタイル更新のテスト
```javascript
// 選択中の形状のスタイルを更新
store.getState().updateSelectedShapesStyle({
  fillColor: '#ff0000',
  strokeColor: '#00ff00',
  strokeWidth: 4,
  opacity: 0.8
});

// 変更を確認
store.getState().shapes['test-rect-1']
```

### 5. スタイルコピー/ペースト
```javascript
// 現在選択中の形状のスタイルをコピー
store.getState().copyStyleFromSelection();

// コピー中のスタイルを確認
store.getState().copiedStyle

// 別の形状を作成して選択
store.getState().addShape({
  id: 'test-rect-2',
  type: 'rectangle',
  x: 350,
  y: 100,
  width: 150,
  height: 150,
  rotation: 0,
  opacity: 1,
  strokeColor: '#000000',
  fillColor: '#ffffff',
  strokeWidth: 1
});

store.getState().selectShape('test-rect-2');

// スタイルをペースト
store.getState().pasteStyleToSelection();

// 結果を確認
store.getState().shapes['test-rect-2']
```

### 6. スタイルプリセット
```javascript
// 現在のプリセット一覧
store.getState().stylePresets

// 選択中形状のスタイルをプリセットとして保存
store.getState().saveStylePreset('My Custom Style');

// プリセットを確認
store.getState().stylePresets

// プリセットを適用（プリセットIDを使用）
const presetId = store.getState().stylePresets[0].id;
store.getState().applyStylePreset(presetId);

// プリセットを削除
store.getState().deleteStylePreset(presetId);
```

### 7. 最近使った色
```javascript
// 色を追加
store.getState().addRecentColor('#ff00ff');
store.getState().addRecentColor('#00ffff');
store.getState().addRecentColor('#ffff00');

// 最近使った色を確認（最大10色）
store.getState().recentColors
```

### 8. Undo/Redo
```javascript
// スタイル変更を元に戻す
store.getState().undo();

// やり直し
store.getState().redo();

// Undo/Redo可能か確認
store.getState().canUndo
store.getState().canRedo
```

### 9. 複数選択でのスタイル更新
```javascript
// 複数の形状を選択
store.getState().selectShape('test-rect-1');
store.getState().toggleSelection('test-rect-2');

// 選択中の形状を確認
Array.from(store.getState().selectedShapeIds)

// 複数の形状に同じスタイルを適用
store.getState().updateSelectedShapesStyle({
  fillColor: '#9333ea',
  strokeWidth: 3
});

// 共通スタイルを確認
store.getState().selectedShapeStyles
```

### 10. デバッグ用
```javascript
// 全状態を確認
console.log(store.getState());

// スタイル関連の状態のみ
const { selectedShapeStyles, stylePresets, copiedStyle, recentColors } = store.getState();
console.table({ selectedShapeStyles, copiedStyle, recentColors });

// プリセット一覧を見やすく表示
console.table(store.getState().stylePresets);
```

## 注意事項
- ストアへのアクセス方法はアプリケーションの実装によって異なる場合があります
- React DevToolsを使用すると、より簡単にストアにアクセスできます
- 形状のIDは実際のアプリケーションで生成されるものを使用してください
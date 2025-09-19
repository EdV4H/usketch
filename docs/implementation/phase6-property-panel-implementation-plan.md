# Phase 6: プロパティパネルとスタイリング機能 実装計画

## 📋 概要

Phase 6では、uSketchにプロパティパネルとスタイリング機能を追加し、ユーザーが形状の外観を詳細にカスタマイズできるようにします。この実装により、基本的な描画ツールから本格的なデザインツールへと進化させます。

## 🎯 実装目標

### 主要機能
1. **プロパティパネルUI**: 選択した形状のプロパティを表示・編集
2. **カラーピッカー**: 直感的な色選択インターフェース
3. **スタイル設定**: 線幅、線スタイル、透明度の調整
4. **スタイル管理**: コピー/ペースト、プリセット機能
5. **リアルタイムプレビュー**: 変更内容の即時反映

## 📊 現状分析

### 実装済みの基盤

#### 型定義とデフォルト値
```typescript
// packages/shared-types/src/shapes/base.ts
interface BaseShape {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
}

// デフォルトスタイル定義済み
DEFAULT_SHAPE_STYLES = {
  strokeColor: "#333333",
  fillColor: "#e0e0ff",
  strokeWidth: 2,
  opacity: 1,
}
```

#### ストア機能
- ✅ 形状の選択管理（selectedShapeIds）
- ✅ 形状の更新機能（updateShape, batchUpdateShapes）
- ✅ Undo/Redo対応のコマンドシステム
- ❌ スタイル専用の状態管理（未実装）

#### UIコンポーネント
- ✅ 形状コンポーネントでのスタイル適用
- ❌ プロパティパネルコンポーネント（未実装）
- ❌ カラーピッカー（未実装）

## 🏗️ 実装計画

### Phase 6.1: 基盤整備とストア拡張（3日）

#### 1. スタイル管理用のストア拡張

```typescript
// packages/store/src/slices/style-slice.ts（新規）
interface StyleState {
  // 選択中形状の共通スタイル
  selectedShapeStyles: Partial<StyleProperties> | null;
  
  // スタイルプリセット
  stylePresets: StylePreset[];
  
  // コピー中のスタイル
  copiedStyle: StyleProperties | null;
  
  // アクティブなカラーパレット
  recentColors: string[];
}

interface StyleActions {
  // スタイル更新
  updateSelectedShapesStyle: (styles: Partial<StyleProperties>) => void;
  
  // スタイルコピー/ペースト
  copyStyleFromSelection: () => void;
  pasteStyleToSelection: () => void;
  
  // プリセット管理
  saveStylePreset: (name: string, style: StyleProperties) => void;
  applyStylePreset: (presetId: string) => void;
  deleteStylePreset: (presetId: string) => void;
  
  // カラー履歴
  addRecentColor: (color: string) => void;
}
```

#### 2. 型定義の拡張

```typescript
// packages/shared-types/src/styles/index.ts（新規）
interface StyleProperties {
  // 基本スタイル
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  
  // 拡張スタイル（Phase 6.2で実装）
  strokeDasharray?: string;
  cornerRadius?: number;
  shadow?: ShadowProperties;
  gradient?: GradientProperties;
}

interface StylePreset {
  id: string;
  name: string;
  style: StyleProperties;
  createdAt: Date;
}
```

### Phase 6.2: プロパティパネルUI実装（5日）

#### 1. コンポーネント構造

```
packages/ui-components/src/property-panel/
├── index.ts
├── property-panel.tsx              # メインコンテナ
├── sections/
│   ├── appearance-section.tsx     # 外観設定セクション
│   ├── stroke-section.tsx         # 線設定セクション
│   └── effects-section.tsx        # エフェクト設定セクション
├── controls/
│   ├── color-picker/
│   │   ├── color-picker.tsx       # カラーピッカー本体
│   │   ├── color-palette.tsx      # カラーパレット
│   │   └── recent-colors.tsx      # 最近使った色
│   ├── stroke-width-slider.tsx    # 線幅スライダー
│   ├── opacity-slider.tsx         # 透明度スライダー
│   └── stroke-style-selector.tsx  # 線スタイルセレクター
└── presets/
    ├── style-presets.tsx           # プリセット一覧
    └── preset-manager.tsx          # プリセット管理
```

#### 2. プロパティパネル実装

```typescript
// packages/ui-components/src/property-panel/property-panel.tsx
export const PropertyPanel: React.FC = () => {
  const selectedShapeIds = useStore(state => state.selectedShapeIds);
  const shapes = useStore(state => state.shapes);
  const selectedShapeStyles = useStore(state => state.selectedShapeStyles);
  
  // 選択中の形状がない場合
  if (selectedShapeIds.length === 0) {
    return <EmptyState message="形状を選択してください" />;
  }
  
  return (
    <div className="property-panel">
      <div className="property-panel__header">
        <h3>プロパティ</h3>
        <span className="selected-count">
          {selectedShapeIds.length}個選択中
        </span>
      </div>
      
      <ScrollArea className="property-panel__content">
        <AppearanceSection styles={selectedShapeStyles} />
        <StrokeSection styles={selectedShapeStyles} />
        <EffectsSection styles={selectedShapeStyles} />
        <StylePresets />
      </ScrollArea>
      
      <div className="property-panel__footer">
        <StyleActions /> {/* コピー/ペーストボタン */}
      </div>
    </div>
  );
};
```

#### 3. カラーピッカー実装

```typescript
// packages/ui-components/src/property-panel/controls/color-picker/color-picker.tsx
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const recentColors = useStore(state => state.recentColors);
  
  return (
    <div className="color-picker">
      <label>{label}</label>
      <div className="color-picker__trigger" onClick={() => setIsOpen(!isOpen)}>
        <div 
          className="color-preview" 
          style={{ backgroundColor: color }}
        />
        <span className="color-value">{color}</span>
      </div>
      
      {isOpen && (
        <Popover>
          <HexColorPicker color={color} onChange={onChange} />
          <RecentColors 
            colors={recentColors} 
            onSelect={onChange}
          />
        </Popover>
      )}
    </div>
  );
};
```

### Phase 6.3: スタイル管理機能実装（3日）

#### 1. スタイルのコピー/ペースト

```typescript
// packages/store/src/slices/style-slice.ts
copyStyleFromSelection: () => {
  const { selectedShapeIds, shapes } = get();
  if (selectedShapeIds.length === 0) return;
  
  const shape = shapes.get(selectedShapeIds[0]);
  if (!shape) return;
  
  set({
    copiedStyle: {
      fillColor: shape.fillColor,
      strokeColor: shape.strokeColor,
      strokeWidth: shape.strokeWidth,
      opacity: shape.opacity,
    }
  });
  
  // トースト通知
  showToast('スタイルをコピーしました');
},

pasteStyleToSelection: () => {
  const { selectedShapeIds, copiedStyle } = get();
  if (!copiedStyle || selectedShapeIds.length === 0) return;
  
  // Undoableコマンドとして実行
  const command = new UpdateShapeStyleCommand(
    selectedShapeIds,
    copiedStyle
  );
  get().executeCommand(command);
  
  showToast('スタイルを適用しました');
}
```

#### 2. スタイルプリセット機能

```typescript
// packages/ui-components/src/property-panel/presets/style-presets.tsx
export const StylePresets: React.FC = () => {
  const presets = useStore(state => state.stylePresets);
  const applyPreset = useStore(state => state.applyStylePreset);
  
  return (
    <Section title="スタイルプリセット">
      <div className="preset-grid">
        {presets.map(preset => (
          <PresetCard
            key={preset.id}
            preset={preset}
            onClick={() => applyPreset(preset.id)}
          />
        ))}
        <AddPresetButton />
      </div>
    </Section>
  );
};
```

### Phase 6.4: ホワイトボードアプリへの統合（2日）

#### 1. レイアウト更新

```typescript
// apps/whiteboard/src/components/layout.tsx
export const WhiteboardLayout: React.FC = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  
  return (
    <div className="whiteboard-layout">
      <Toolbar />
      <div className="main-area">
        <Canvas />
        {isPanelOpen && (
          <aside className="property-panel-container">
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
  'cmd+shift+c': copyStyleFromSelection,
  'cmd+shift+v': pasteStyleToSelection,
  'cmd+,': togglePropertyPanel,
};
```

## 📅 実装スケジュール

### Week 1（1月20日〜1月26日）
- **Day 1-2**: ストア拡張と型定義
  - StyleSliceの実装
  - 型定義の追加
  - テストケースの作成
  
- **Day 3-5**: 基本プロパティパネルUI
  - パネルレイアウト
  - 基本コントロール（色、線幅、透明度）
  - リアルタイムプレビュー

### Week 2（1月27日〜2月2日）
- **Day 6-7**: カラーピッカー実装
  - react-colorfulの統合
  - カラーパレット
  - 最近使った色の管理
  
- **Day 8-9**: スタイル管理機能
  - コピー/ペースト機能
  - プリセット管理
  - Undo/Redo対応

- **Day 10**: アプリケーション統合
  - レイアウト調整
  - ショートカットキー
  - パフォーマンス最適化

### Week 3（2月3日〜2月5日）
- **Day 11-12**: テストと品質保証
  - ユニットテスト
  - E2Eテスト
  - アクセシビリティ確認
  
- **Day 13**: ドキュメント作成
  - ユーザーガイド
  - APIドキュメント
  - リリースノート

## 🧪 テスト計画

### ユニットテスト
```typescript
// packages/store/src/slices/__tests__/style-slice.test.ts
describe('StyleSlice', () => {
  test('スタイルのコピー/ペースト');
  test('プリセットの保存と適用');
  test('複数形状への一括スタイル適用');
  test('Undo/Redoの動作');
});
```

### E2Eテスト
```typescript
// apps/e2e/tests/property-panel.spec.ts
test('プロパティパネルでの色変更');
test('スタイルのコピーペースト');
test('プリセットの作成と適用');
test('ショートカットキーの動作');
```

## 🎨 デザイン考慮事項

### UIデザイン原則
1. **一貫性**: 既存UIとの統一感を保つ
2. **直感性**: 学習コストを最小限に
3. **反応性**: リアルタイムフィードバック
4. **アクセシビリティ**: キーボード操作、スクリーンリーダー対応

### レスポンシブデザイン
- パネルのリサイズ対応
- モバイル表示の考慮
- 折りたたみ可能なセクション

## 📦 依存関係

### 新規導入予定のライブラリ
```json
{
  "react-colorful": "^5.6.1",     // 軽量カラーピッカー
  "@radix-ui/react-slider": "^1.1.2",  // アクセシブルなスライダー
  "@radix-ui/react-popover": "^1.0.7"  // ポップオーバーUI
}
```

## ⚡ パフォーマンス最適化

### 最適化戦略
1. **メモ化**: React.memoとuseMemoの適切な使用
2. **デバウンス**: カラー変更時のデバウンス処理
3. **仮想化**: 多数のプリセット表示時の仮想スクロール
4. **遅延読み込み**: プロパティパネルの遅延ロード

## 🚀 成功指標

### 機能的指標
- ✅ 全基本スタイルプロパティの編集可能
- ✅ スタイルのコピー/ペースト動作
- ✅ プリセット機能の動作
- ✅ Undo/Redo対応

### パフォーマンス指標
- スタイル変更の反映時間 < 16ms
- パネル表示時間 < 100ms
- メモリ使用量の増加 < 10MB

### ユーザビリティ指標
- 3クリック以内でスタイル変更可能
- ショートカットキー対応
- アクセシビリティスコア > 90

## 📝 リスクと対策

### 技術的リスク
1. **パフォーマンス低下**
   - 対策: デバウンス、メモ化、仮想化の実装
   
2. **状態管理の複雑化**
   - 対策: 明確な責任分離、テストカバレッジ向上

3. **UIの複雑化**
   - 対策: 段階的な機能追加、ユーザーテスト

## 🎯 次のステップ

Phase 6完了後は、以下の機能拡張を検討：
- **Phase 7**: レイヤー管理とグループ化
- **拡張スタイル**: グラデーション、影効果、パターン塗り
- **テーマシステム**: ダークモード、カスタムテーマ

## 📚 参考資料

- [React Colorful Documentation](https://github.com/omgovich/react-colorful)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Zustand Best Practices](https://github.com/pmndrs/zustand)
- [既存アーキテクチャ設計書](../architecture/README.md)
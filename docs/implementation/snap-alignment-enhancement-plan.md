# スナップ・整列機能強化計画書

## 📋 概要

現在のuSketchのスナップ・整列機能は基本的な動作はしているものの、既存のプロダクト（Figma、Miro、tldraw等）と比較して、ユーザビリティと機能面で改善の余地があります。本計画書では、より直感的で強力なスナップ・整列機能への強化を提案します。

## 🎯 目標

- **デフォルト設定の最適化**: グリッドスナップをデフォルトOFFにし、より自由な配置を可能に
- **包括的なスナップポイント**: 左辺・上辺だけでなく、全ての辺と中心点でのスナップ
- **視覚的フィードバックの強化**: より明確なガイドライン表示と距離表示
- **パフォーマンスの最適化**: 大量のシェイプでも滑らかな動作

## 📊 現状分析

### 現在の実装状況

#### ✅ 実装済み機能
1. **基本的なグリッドスナップ** (PR63)
   - グリッドへの自動スナップ
   - ⚠️ **問題**: デフォルトでONになっている

2. **形状間スナップ** (PR65)
   - 左辺と上辺のスナップ
   - ⚠️ **問題**: 右辺、下辺、中心点のスナップが不完全

3. **スマートガイド** (PR66)
   - ドラッグ時のガイドライン表示
   - ⚠️ **問題**: 表示条件が限定的

4. **分散配置** (PR67)
   - 等間隔配置機能
   - ✅ 正常動作

### 既存プロダクトとの機能比較

| 機能 | uSketch (現在) | Figma | Miro | tldraw | 目標 |
|------|---------------|-------|------|--------|------|
| グリッドスナップ | デフォルトON | デフォルトOFF | デフォルトOFF | デフォルトOFF | **デフォルトOFF** |
| エッジスナップ | 左・上のみ | 全辺 | 全辺 | 全辺 | **全辺** |
| 中心点スナップ | ❌ | ✅ | ✅ | ✅ | **✅** |
| コーナースナップ | ❌ | ✅ | ✅ | ✅ | **✅** |
| 距離表示 | 部分的 | ✅ | ✅ | ✅ | **✅** |
| 等間隔ガイド | ❌ | ✅ | ✅ | ❌ | **✅** |
| スナップ設定UI | ❌ | ✅ | ✅ | ✅ | **✅** |
| キーボードショートカット | ❌ | ✅ (Alt押下で無効) | ✅ | ✅ | **✅** |

### 問題点の詳細分析

#### 1. グリッドスナップのデフォルトON問題
```typescript
// 現在の実装 (packages/tools/src/utils/snap-engine.ts)
snap(position: Point, options?: SnapOptions): SnapResult {
    if (!options?.snapEnabled) {
        return { position, snapped: false };
    }
    // gridSnapがtrueの場合のみグリッドにスナップ
    if (options.gridSnap) {
        // グリッドスナップ処理
    }
}
```
**問題**: Store側でgridSnapがデフォルトtrueに設定されている可能性

#### 2. 不完全なスナップポイント
```typescript
// 現在の実装では左辺・上辺優先
findSnapPoints(...) {
    // 左辺
    snapPoints.push({ axis: "x", value: target.x, priority: 1 });
    // 上辺
    snapPoints.push({ axis: "y", value: target.y, priority: 1 });
    // 他の辺は優先度が低い
}
```
**問題**: 優先度設定により、右辺・下辺・中心点へのスナップが機能しにくい

## 🏗️ アーキテクチャ設計

### システム構成図

```
┌─────────────────────────────────────────┐
│           User Interaction              │
│    (Drag, Alt key, Settings UI)         │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│         SnapEngine (Enhanced)           │
│   - Comprehensive snap points           │
│   - Smart priority calculation          │
│   - Performance optimization            │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│       WhiteboardStore                   │
│   - Snap settings management            │
│   - Default: gridSnap = false          │
│   - User preferences                    │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│        Visual Feedback                  │
│   - Enhanced guide lines               │
│   - Distance indicators                │
│   - Snap point highlights              │
└─────────────────────────────────────────┘
```

### スナップポイントの包括的実装

```typescript
interface ComprehensiveSnapPoint {
    type: 'edge' | 'corner' | 'center' | 'midpoint';
    axis: 'x' | 'y' | 'both';
    value: Point;
    source: 'grid' | 'shape' | 'guide';
    priority: number; // 動的に計算
    visualHint?: string; // "左端", "中心", etc.
}
```

## 📝 実装計画

### Phase 1: デフォルト設定の修正とUI追加 (1日)

#### 1.1 グリッドスナップのデフォルトOFF
- [ ] Storeの初期設定を`gridSnap: false`に変更
- [ ] ローカルストレージでユーザー設定を保持
- [ ] 設定の永続化

#### 1.2 スナップ設定UIの実装
- [ ] ツールバーにスナップ設定ボタンを追加
- [ ] ポップオーバーメニューでの設定切り替え
- [ ] 視覚的なON/OFFインジケーター

#### 1.3 キーボードショートカット
- [ ] Altキー押下時のスナップ一時無効化
- [ ] Shift+Gでグリッドスナップのトグル
- [ ] ショートカット一覧の表示

### Phase 2: 包括的なスナップポイント実装 (2日)

#### 2.1 全エッジスナップの実装
- [ ] 右辺・下辺のスナップポイント追加
- [ ] 優先度計算アルゴリズムの改善
- [ ] 最近接点の動的選択

#### 2.2 中心点・コーナースナップ
- [ ] 形状の中心点計算とスナップ
- [ ] 4つのコーナーポイントへのスナップ
- [ ] エッジの中点へのスナップ

#### 2.3 スナップポイントの視覚化
- [ ] アクティブなスナップポイントのハイライト
- [ ] スナップ候補の事前表示
- [ ] スナップ強度の視覚的表現

### Phase 3: スマートガイドの強化 (2日)

#### 3.1 等間隔検出と表示
- [ ] 3つ以上の形状間の等間隔検出
- [ ] 等間隔ガイドラインの表示
- [ ] 間隔値の数値表示

#### 3.2 整列ガイドの拡張
- [ ] 垂直・水平の延長線表示
- [ ] 対角線整列の検出
- [ ] グループ整列のサポート

#### 3.3 距離インジケーター
- [ ] 形状間の正確な距離表示
- [ ] マウスポインタからの距離
- [ ] スナップ閾値の視覚化

### Phase 4: パフォーマンス最適化 (1日)

#### 4.1 計算の最適化
- [ ] 空間インデックス（QuadTree）の実装
- [ ] 視界外の形状を除外
- [ ] スナップ候補のキャッシング

#### 4.2 レンダリング最適化
- [ ] ガイドラインの差分更新
- [ ] requestAnimationFrameの適切な使用
- [ ] Canvas層の分離

### Phase 5: 高度な機能 (オプション、2日)

#### 5.1 カスタムガイド
- [ ] ユーザー定義のガイドライン
- [ ] ルーラーからのガイド生成
- [ ] ガイドのロック/アンロック

#### 5.2 スナッププリセット
- [ ] 用途別のスナップ設定プリセット
- [ ] カスタムプリセットの保存
- [ ] ワークスペース別の設定

## 🔧 実装詳細

### 1. Store設定の更新

```typescript
// packages/store/src/store.ts
export interface SnapSettings {
    enabled: boolean;           // マスタースイッチ
    gridSnap: boolean;          // デフォルト: false ← 変更
    gridSize: number;           // デフォルト: 20
    shapeSnap: boolean;         // デフォルト: true
    snapThreshold: number;      // デフォルト: 8
    showGuides: boolean;        // デフォルト: true
    showDistances: boolean;     // デフォルト: true
    
    // 新規追加
    snapToCenter: boolean;      // デフォルト: true
    snapToCorners: boolean;     // デフォルト: true
    snapToMidpoints: boolean;   // デフォルト: true
    equalSpacing: boolean;      // デフォルト: true
}

// 初期状態
const initialState = {
    snapSettings: {
        enabled: true,
        gridSnap: false,        // ← デフォルトOFFに変更
        shapeSnap: true,
        // ... 他の設定
    }
}
```

### 2. SnapEngineの拡張

```typescript
// packages/tools/src/utils/snap-engine.ts
export class EnhancedSnapEngine extends SnapEngine {
    // 包括的なスナップポイント生成
    findComprehensiveSnapPoints(
        movingShape: Shape,
        targetShapes: Shape[],
        currentPosition: Point
    ): ComprehensiveSnapPoint[] {
        const points: ComprehensiveSnapPoint[] = [];
        
        targetShapes.forEach(target => {
            // エッジ（全4辺）
            points.push(...this.getEdgeSnapPoints(movingShape, target));
            
            // コーナー（全4角）
            points.push(...this.getCornerSnapPoints(movingShape, target));
            
            // 中心点
            points.push(...this.getCenterSnapPoints(movingShape, target));
            
            // エッジ中点
            points.push(...this.getMidpointSnapPoints(movingShape, target));
        });
        
        // 優先度を距離ベースで動的計算
        return this.calculateDynamicPriorities(points, currentPosition);
    }
    
    // 距離ベースの動的優先度計算
    private calculateDynamicPriorities(
        points: ComprehensiveSnapPoint[],
        currentPos: Point
    ): ComprehensiveSnapPoint[] {
        return points.map(point => ({
            ...point,
            priority: this.calculatePriority(point, currentPos)
        })).sort((a, b) => a.priority - b.priority);
    }
    
    private calculatePriority(
        point: ComprehensiveSnapPoint,
        currentPos: Point
    ): number {
        const distance = Math.sqrt(
            Math.pow(point.value.x - currentPos.x, 2) +
            Math.pow(point.value.y - currentPos.y, 2)
        );
        
        // タイプ別の重み付け
        const typeWeight = {
            'edge': 1.0,
            'center': 0.9,
            'corner': 1.1,
            'midpoint': 1.2
        };
        
        return distance * typeWeight[point.type];
    }
}
```

### 3. UIコンポーネントの追加

```typescript
// apps/whiteboard/src/components/snap-settings.tsx
export const SnapSettings: React.FC = () => {
    const snapSettings = useStore(state => state.snapSettings);
    const updateSnapSettings = useStore(state => state.updateSnapSettings);
    
    return (
        <div className="snap-settings-panel">
            <div className="snap-toggle-group">
                <ToggleButton
                    active={snapSettings.gridSnap}
                    onClick={() => updateSnapSettings({ gridSnap: !snapSettings.gridSnap })}
                    icon="grid"
                    tooltip="グリッドスナップ (Shift+G)"
                />
                <ToggleButton
                    active={snapSettings.shapeSnap}
                    onClick={() => updateSnapSettings({ shapeSnap: !snapSettings.shapeSnap })}
                    icon="magnet"
                    tooltip="形状スナップ"
                />
                <ToggleButton
                    active={snapSettings.showGuides}
                    onClick={() => updateSnapSettings({ showGuides: !snapSettings.showGuides })}
                    icon="guides"
                    tooltip="ガイド表示"
                />
            </div>
            
            <div className="snap-options">
                <label>
                    <input
                        type="checkbox"
                        checked={snapSettings.snapToCenter}
                        onChange={e => updateSnapSettings({ snapToCenter: e.target.checked })}
                    />
                    中心点にスナップ
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={snapSettings.snapToCorners}
                        onChange={e => updateSnapSettings({ snapToCorners: e.target.checked })}
                    />
                    コーナーにスナップ
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={snapSettings.equalSpacing}
                        onChange={e => updateSnapSettings({ equalSpacing: e.target.checked })}
                    />
                    等間隔ガイド
                </label>
            </div>
        </div>
    );
};
```

## 🧪 テスト計画

### ユニットテスト

1. **SnapEngine のテスト**
   - 全エッジへのスナップ動作
   - 中心点・コーナーへのスナップ
   - 優先度計算の正確性
   - パフォーマンステスト（1000形状）

2. **Store のテスト**
   - デフォルト設定の検証
   - 設定の永続化
   - 設定変更の反映

### E2Eテスト

1. **基本動作**
   - グリッドスナップOFF時の自由配置
   - 全方向へのスナップ動作
   - Altキーでのスナップ無効化

2. **視覚的フィードバック**
   - ガイドラインの表示
   - 距離表示の正確性
   - スナップポイントのハイライト

3. **パフォーマンス**
   - 100形状での60fps維持
   - スムーズなドラッグ操作
   - メモリリークの確認

## 📊 成功指標

| 指標 | 現在 | 目標 | 測定方法 |
|------|------|------|----------|
| グリッドスナップ初期状態 | ON | OFF | 初回起動時の設定確認 |
| スナップ可能方向 | 2方向 | 8方向以上 | 機能テスト |
| ガイド表示の包括性 | 30% | 90% | ユーザビリティテスト |
| 100形状でのFPS | 45fps | 60fps | パフォーマンステスト |
| ユーザー満足度 | - | 80%以上 | アンケート調査 |

## 🎨 UI/UXガイドライン

### スナップのビジュアル表現

1. **ガイドライン**
   - 整列時: 実線、青色 (#0066cc)
   - 等間隔: 点線、緑色 (#00aa00)
   - グリッド: 極薄グレー (#f0f0f0)

2. **スナップポイント**
   - アクティブ: 青い円 (8px)
   - 候補: グレーの円 (4px)
   - スナップ時: パルスアニメーション

3. **距離表示**
   - 背景: 半透明の白
   - テキスト: 10px、グレー
   - 単位: px表示

### インタラクション

1. **キーボード操作**
   - Alt: 一時的にスナップ無効
   - Shift+G: グリッドスナップ切り替え
   - Shift+S: 形状スナップ切り替え

2. **マウス操作**
   - ホバー: スナップ候補をプレビュー
   - ドラッグ: リアルタイムガイド表示
   - クリック: スナップ設定パネル

## 📅 実装スケジュール

| Phase | 内容 | 期間 | 優先度 |
|-------|------|------|--------|
| 1 | デフォルト設定修正とUI | 1日 | 最高 |
| 2 | 包括的スナップポイント | 2日 | 高 |
| 3 | スマートガイド強化 | 2日 | 高 |
| 4 | パフォーマンス最適化 | 1日 | 中 |
| 5 | 高度な機能 | 2日 | 低 |

**合計見積もり**: 6-8日

## 🚀 段階的リリース計画

1. **v1.0** (Phase 1-2): 基本的な改善
   - グリッドスナップOFF
   - 全方向スナップ
   - 基本的なUI

2. **v1.1** (Phase 3): スマートガイド
   - 等間隔ガイド
   - 距離表示
   - 拡張ガイドライン

3. **v1.2** (Phase 4-5): 最適化と高度な機能
   - パフォーマンス改善
   - カスタムガイド
   - プリセット機能

## 📚 参考資料

- [Figma - Smart Selection and Spacing](https://help.figma.com/hc/en-us/articles/360039956914)
- [Miro - Snap to Objects](https://help.miro.com/hc/en-us/articles/360017730613)
- [tldraw - Snapping](https://github.com/tldraw/tldraw/tree/main/packages/editor/src/lib/utils/snapping)
- [Adobe XD - Layout Grids](https://helpx.adobe.com/xd/help/layout-grids.html)

## ✅ 完了条件

- [ ] グリッドスナップがデフォルトでOFF
- [ ] 全ての辺と中心点でスナップ可能
- [ ] スナップ設定UIが実装されている
- [ ] Altキーでスナップ一時無効化が可能
- [ ] 等間隔ガイドが表示される
- [ ] 距離表示が正確に動作
- [ ] 100形状で60fps維持
- [ ] E2Eテスト合格率95%以上
- [ ] ドキュメント更新完了
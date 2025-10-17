# 右サイドパネル統合システム実装計画書

**作成日**: 2025-10-17
**ステータス**: 提案中
**目的**: PropertyPanel と DebugMenu/HistoryDebugPanel の位置重複問題を解決し、拡張可能な統合サイドバーシステムを実装する

---

## 📋 目次

- [背景と動機](#背景と動機)
- [現在の問題点](#現在の問題点)
- [提案する解決策](#提案する解決策)
- [アーキテクチャ設計](#アーキテクチャ設計)
- [実装計画](#実装計画)
- [期待される効果](#期待される効果)

---

## 🎯 背景と動機

### 現在の状況

uSketch アプリケーションには、画面右側に複数のパネルが配置されています：

1. **PropertyPanel** - 選択中の図形のプロパティを編集
   - 位置: 画面右側（固定）
   - サイズ: 280px 幅
   - 開閉: `isPanelOpen` state で制御

2. **DebugMenu** - デバッグツールメニュー
   - 位置: 画面右下（`position: fixed; bottom: 20px; right: 20px`）
   - 開閉: 独自の state で制御

3. **HistoryDebugPanel** - Undo/Redo 履歴のデバッグ表示
   - 位置: 画面右下（`position: fixed; bottom: 1rem; right: 1rem`）
   - 開閉: DebugMenu から開く

### 問題の発生

PropertyPanel と DebugMenu/HistoryDebugPanel が**同じ画面右側の領域で重なり**、以下の問題が発生：

- ✗ PropertyPanel を開くと DebugMenu が隠れる
- ✗ HistoryDebugPanel が PropertyPanel の上に重なり、操作しづらい
- ✗ 新しいパネルを追加する際に配置場所の調整が必要
- ✗ 各パネルが独立して位置を管理しているため、一貫性がない

---

## ❌ 現在の問題点の詳細

### 1. 位置の重複

**現在の配置:**
```
画面レイアウト:
┌─────────────────────────────────────┐
│  Toolbar                            │
├─────────────────────┬───────────────┤
│                     │ PropertyPanel │
│                     │   (280px)     │
│   Canvas            │               │
│                     │ ← 右端に配置  │
│                     │               │
│                     │               │
│                     ├───────────────┤
│                     │  DebugMenu    │ ← 重なる！
│                     │  (fixed)      │
└─────────────────────┴───────────────┘
                       ↑
                  HistoryDebugPanel
                  (fixed, 右下)
```

**問題:**
- PropertyPanel が開いている時、DebugMenu と HistoryDebugPanel が PropertyPanel の上に表示される
- または PropertyPanel の下に隠れてアクセスできない
- z-index による重なり順の管理が複雑

### 2. 状態管理の分散

**現在の実装:**
```tsx
// app.tsx
const [isPanelOpen, setIsPanelOpen] = useState(true);
const [isInputSettingsOpen, setIsInputSettingsOpen] = useState(false);

// debug-menu.tsx
const [isOpen, setIsOpen] = useState(false);
const [showHistoryPanel, setShowHistoryPanel] = useState(false);

// property-panel.tsx
const [isCollapsed, setIsCollapsed] = useState(false);
```

**問題:**
- 各パネルが独立して状態を管理
- パネル間の連携が困難
- 「PropertyPanel を開いたら DebugMenu を自動で閉じる」などの制御が複雑

### 3. 拡張性の欠如

**新しいパネルを追加する際の課題:**
- ❌ 配置場所を手動で調整する必要がある
- ❌ 既存パネルとの位置関係を考慮する必要がある
- ❌ 状態管理コードを各所に追加する必要がある
- ❌ キーボードショートカットの管理が煩雑

**例: 新しい "LayerPanel" を追加する場合:**
```tsx
// 現在のアプローチ（複雑）
const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);

// どこに配置する？PropertyPanel の下？DebugMenu の上？
// z-index は？
// 他のパネルとの連携は？
```

### 4. ユーザー体験の問題

- ❌ パネルが画面の異なる場所に散在している
- ❌ どのパネルがアクティブか分かりにくい
- ❌ パネルの切り替えが直感的でない
- ❌ デバッグパネルが常に表示され、邪魔になる

---

## ✅ 提案する解決策

### コンセプト: 統合サイドバーシステム

画面右側に**単一の統合サイドバー**を配置し、複数のパネルを**タブで切り替え**て表示します。

**新しいレイアウト:**
```
画面レイアウト:
┌─────────────────────────────────────┐
│  Toolbar                            │
├─────────────────────┬───────────────┤
│                     │ ┌──────────┐  │
│                     │ │プロパティ│  │ ← タブで切り替え
│                     │ │デバッグ  │  │
│   Canvas            │ │履歴     │  │
│                     │ └──────────┘  │
│                     │               │
│                     │  Panel Content│
│                     │               │
│                     │               │
└─────────────────────┴───────────────┘
```

### 主要機能

1. **タブベースの切り替え**
   - 複数のパネルを同一領域に表示
   - アクティブなタブのみコンテンツを表示
   - タブのアイコン、ラベル、バッジをカスタマイズ可能

2. **プラグイン可能なパネルシステム**
   - 新しいパネルを簡単に追加できる
   - パネルの登録/登録解除が動的に可能
   - パネルごとに表示条件を設定可能

3. **統一された状態管理**
   - サイドバーの開閉状態を一元管理
   - アクティブなタブを管理
   - パネル間の切り替えをスムーズに

4. **キーボードショートカット**
   - タブ切り替え: Cmd+1, Cmd+2, Cmd+3...
   - サイドバー開閉: Cmd+\
   - パネルごとのカスタムショートカット

5. **レスポンシブ対応**
   - サイドバーの幅を調整可能
   - 折りたたみ/展開アニメーション
   - 小さい画面ではオーバーレイ表示

---

## 🏗️ アーキテクチャ設計

### コンポーネント構成

```
RightSidebar (新規)
├── SidebarTabs (タブヘッダー)
│   ├── TabButton (各タブボタン)
│   └── TabBadge (通知バッジ)
├── SidebarContent (パネルコンテンツ領域)
│   ├── PropertyPanelContent (移行)
│   ├── DebugPanelContent (移行)
│   └── HistoryPanelContent (移行)
└── SidebarToggle (開閉ボタン)
```

### 1. RightSidebar コンポーネント

**責務:**
- サイドバー全体のレイアウト管理
- アクティブなタブの状態管理
- パネルの登録と管理

**Props:**
```typescript
interface RightSidebarProps {
  defaultActiveTab?: string;
  defaultOpen?: boolean;
  panels: SidebarPanel[];
  onTabChange?: (tabId: string) => void;
  onOpenChange?: (isOpen: boolean) => void;
}
```

**実装例:**
```tsx
export const RightSidebar: React.FC<RightSidebarProps> = ({
  defaultActiveTab,
  defaultOpen = true,
  panels,
  onTabChange,
  onOpenChange,
}) => {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || panels[0]?.id);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  const activePanel = panels.find(p => p.id === activeTab);

  return (
    <div className={`right-sidebar ${isOpen ? 'open' : 'closed'}`}>
      {isOpen && (
        <>
          <SidebarTabs
            panels={panels}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
          <SidebarContent>
            {activePanel?.content}
          </SidebarContent>
        </>
      )}
      <SidebarToggle isOpen={isOpen} onToggle={handleToggle} />
    </div>
  );
};
```

### 2. SidebarPanel 型定義

**パネル登録の仕組み:**
```typescript
interface SidebarPanel {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  content: React.ReactNode;

  // 表示条件
  visible?: boolean | (() => boolean);

  // 開発モード専用パネル
  devOnly?: boolean;

  // キーボードショートカット
  shortcut?: string;

  // タブの順序
  order?: number;
}
```

**使用例:**
```tsx
const panels: SidebarPanel[] = [
  {
    id: 'properties',
    label: 'プロパティ',
    icon: <SettingsIcon />,
    content: <PropertyPanelContent />,
    shortcut: 'Cmd+1',
    order: 1,
  },
  {
    id: 'debug',
    label: 'デバッグ',
    icon: <BugIcon />,
    badge: shapeCount,
    content: <DebugPanelContent />,
    devOnly: true,
    shortcut: 'Cmd+2',
    order: 2,
  },
  {
    id: 'history',
    label: '履歴',
    icon: <HistoryIcon />,
    content: <HistoryPanelContent />,
    devOnly: true,
    shortcut: 'Cmd+3',
    order: 3,
  },
];
```

### 3. SidebarTabs コンポーネント

**責務:**
- タブボタンの表示
- アクティブタブのハイライト
- バッジ表示

**実装:**
```tsx
interface SidebarTabsProps {
  panels: SidebarPanel[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  panels,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="sidebar-tabs">
      {panels
        .filter(p => p.visible !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(panel => (
          <TabButton
            key={panel.id}
            panel={panel}
            isActive={activeTab === panel.id}
            onClick={() => onTabChange(panel.id)}
          />
        ))}
    </div>
  );
};
```

### 4. パネルレジストリパターン

**動的なパネル登録:**
```typescript
class SidebarPanelRegistry {
  private panels = new Map<string, SidebarPanel>();
  private listeners: Set<() => void> = new Set();

  register(panel: SidebarPanel): void {
    this.panels.set(panel.id, panel);
    this.notifyListeners();
  }

  unregister(panelId: string): void {
    this.panels.delete(panelId);
    this.notifyListeners();
  }

  getAll(): SidebarPanel[] {
    return Array.from(this.panels.values());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const sidebarPanelRegistry = new SidebarPanelRegistry();
```

**React Context での提供:**
```tsx
const SidebarContext = createContext<{
  registry: SidebarPanelRegistry;
  activeTab: string;
  setActiveTab: (id: string) => void;
} | null>(null);

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [registry] = useState(() => new SidebarPanelRegistry());
  const [activeTab, setActiveTab] = useState('properties');

  return (
    <SidebarContext.Provider value={{ registry, activeTab, setActiveTab }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};
```

### 5. パネルコンテンツの移行

**PropertyPanel の移行:**
```tsx
// Before: 独立したコンポーネント
export const PropertyPanel: React.FC = () => {
  // ...
  return (
    <div className="property-panel">
      {/* content */}
    </div>
  );
};

// After: サイドバーのコンテンツとして
export const PropertyPanelContent: React.FC = () => {
  // 同じロジック、レイアウトのみ調整
  return (
    <div className="property-panel-content">
      {/* content */}
    </div>
  );
};

// app.tsx でパネルを登録
const panels = [
  {
    id: 'properties',
    label: 'プロパティ',
    content: <PropertyPanelContent />,
  },
];
```

---

## 🔧 実装計画

### Phase 1: 基盤整備 (1週間)

#### タスク 1.1: 新しいコンポーネントの作成

**作成するファイル:**
```
apps/whiteboard/src/components/right-sidebar/
├── right-sidebar.tsx          # メインコンポーネント
├── right-sidebar.css          # スタイル
├── sidebar-tabs.tsx           # タブヘッダー
├── sidebar-content.tsx        # コンテンツ領域
├── sidebar-toggle.tsx         # 開閉ボタン
├── tab-button.tsx             # タブボタン
├── types.ts                   # 型定義
└── index.ts                   # エクスポート
```

**チェックリスト:**
- [ ] `RightSidebar` コンポーネント実装
- [ ] `SidebarTabs` コンポーネント実装
- [ ] `SidebarContent` コンポーネント実装
- [ ] `SidebarToggle` コンポーネント実装
- [ ] `TabButton` コンポーネント実装
- [ ] 型定義 (`SidebarPanel`, `SidebarState`) 作成
- [ ] CSS スタイル実装（アニメーション含む）

#### タスク 1.2: パネルレジストリの実装

**作成するファイル:**
```
apps/whiteboard/src/sidebar/
├── panel-registry.ts          # レジストリクラス
├── sidebar-context.tsx        # React Context
├── use-sidebar.ts             # カスタムフック
└── index.ts                   # エクスポート
```

**チェックリスト:**
- [ ] `SidebarPanelRegistry` クラス実装
- [ ] `SidebarProvider` コンポーネント実装
- [ ] `useSidebar` フック実装
- [ ] `useRegisterPanel` フック実装（パネル登録用）
- [ ] ユニットテスト作成

#### タスク 1.3: キーボードショートカットの統合

**実装内容:**
- グローバルなショートカットリスナー
- タブ切り替え: `Cmd+1`, `Cmd+2`, `Cmd+3`...
- サイドバー開閉: `Cmd+\`
- パネルごとのカスタムショートカット

**チェックリスト:**
- [ ] `useKeyboardShortcuts` フック実装
- [ ] ショートカット設定の型定義
- [ ] 既存の InputSettings との統合
- [ ] ショートカット一覧の表示

---

### Phase 2: 既存パネルの移行 (1週間)

#### タスク 2.1: PropertyPanel の移行

**変更ファイル:**
- `apps/whiteboard/src/components/property-panel/property-panel.tsx`
- `apps/whiteboard/src/app.tsx`

**作業内容:**
1. `PropertyPanel` → `PropertyPanelContent` にリネーム
2. レイアウトコードを削除（サイドバーが管理）
3. パネル登録コードを追加
4. 状態管理を `useSidebar` に移行

**チェックリスト:**
- [ ] コンポーネントのリファクタリング
- [ ] スタイルの調整
- [ ] app.tsx での統合
- [ ] 既存機能が動作することを確認

#### タスク 2.2: DebugMenu の移行

**変更ファイル:**
- `apps/whiteboard/src/components/debug-menu.tsx`

**作業内容:**
1. `DebugMenu` → `DebugPanelContent` にリファクタリング
2. 固定配置（`position: fixed`）を削除
3. サイドバーのタブとして登録
4. devOnly フラグを設定

**チェックリスト:**
- [ ] コンポーネントのリファクタリング
- [ ] 開発モード判定の実装
- [ ] パネル登録
- [ ] 既存機能の動作確認

#### タスク 2.3: HistoryDebugPanel の移行

**変更ファイル:**
- `packages/ui-components/src/history-debug-panel.tsx`

**作業内容:**
1. 固定配置を削除
2. サイドバーのタブとして登録
3. DebugMenu からの独立（直接タブとして表示）

**チェックリスト:**
- [ ] コンポーネントのリファクタリング
- [ ] パネル登録
- [ ] 既存機能の動作確認

---

### Phase 3: テストと最適化 (3日間)

#### タスク 3.1: ユニットテスト

**テストファイル:**
```
apps/whiteboard/src/components/right-sidebar/
├── right-sidebar.test.tsx
├── sidebar-tabs.test.tsx
└── panel-registry.test.ts
```

**テストケース:**
- [ ] タブ切り替えが正しく動作する
- [ ] パネル登録/登録解除が動作する
- [ ] キーボードショートカットが動作する
- [ ] 開閉アニメーションが動作する
- [ ] devOnly パネルが本番環境で非表示になる

#### タスク 3.2: E2E テスト

**テストシナリオ:**
1. サイドバーを開閉できる
2. タブを切り替えてパネルが表示される
3. キーボードショートカットでタブを切り替えられる
4. PropertyPanel の機能が正常に動作する
5. DebugMenu の機能が正常に動作する
6. HistoryDebugPanel の機能が正常に動作する

**チェックリスト:**
- [ ] E2E テストスクリプト作成
- [ ] すべてのテストケースが通る
- [ ] リグレッションテスト実施

#### タスク 3.3: パフォーマンス最適化

**最適化項目:**
- [ ] 非アクティブなパネルの遅延レンダリング
- [ ] タブ切り替えアニメーションの最適化
- [ ] メモリリークの確認
- [ ] バンドルサイズの確認

---

### Phase 4: ドキュメントとリリース (2日間)

#### タスク 4.1: ドキュメント作成

**作成するドキュメント:**
1. **使用ガイド**: 新しいパネルの追加方法
2. **API リファレンス**: `SidebarPanel` の仕様
3. **マイグレーションガイド**: 既存パネルの移行方法
4. **サンプルコード**: パネル作成の例

**チェックリスト:**
- [ ] README.md 更新
- [ ] API ドキュメント作成
- [ ] サンプルコード追加
- [ ] スクリーンショット追加

#### タスク 4.2: リリース準備

**チェックリスト:**
- [ ] CHANGELOG.md 更新
- [ ] バージョン番号の決定
- [ ] リリースノート作成
- [ ] マイグレーション手順の確認

---

## 🎯 期待される効果

### 1. ユーザビリティの向上

**Before:**
- ❌ パネルが重なって操作しづらい
- ❌ どこに何があるか分かりにくい
- ❌ デバッグパネルが常に表示されて邪魔

**After:**
- ✅ タブで直感的に切り替え可能
- ✅ 画面右側に統一されて分かりやすい
- ✅ 必要なパネルだけ表示できる

### 2. 開発者体験の向上

**Before:**
- ❌ 新しいパネルを追加するのが大変
- ❌ 配置場所を手動で調整する必要がある
- ❌ 状態管理が複雑

**After:**
- ✅ パネル登録で簡単に追加できる
- ✅ 配置は自動で管理される
- ✅ 状態管理が統一されている

**新しいパネル追加の比較:**
```tsx
// Before: 複雑な手動設定
const [isNewPanelOpen, setIsNewPanelOpen] = useState(false);
// 配置場所を調整、z-index を設定、etc...

// After: シンプルな登録
sidebarRegistry.register({
  id: 'new-panel',
  label: '新パネル',
  content: <NewPanelContent />,
});
```

### 3. 保守性の向上

- ✅ コンポーネントの責務が明確
- ✅ テストが書きやすい
- ✅ 拡張が容易

### 4. パフォーマンスの向上

- ✅ 非アクティブなパネルは遅延レンダリング
- ✅ 不要な再レンダリングを削減
- ✅ メモリ使用量の最適化

---

## 📊 成功指標

### 定量的指標

| 指標 | 現在 | 目標 | 測定方法 |
|------|------|------|----------|
| パネル切り替え時間 | - | < 100ms | Performance API |
| バンドルサイズ増加 | - | < 10KB | Webpack Bundle Analyzer |
| テストカバレッジ | - | > 90% | Jest |
| 新パネル追加時間 | ~2時間 | ~15分 | 開発者アンケート |

### 定性的指標

- [ ] ユーザーがタブの使い方を直感的に理解できる
- [ ] 開発者が新しいパネルを簡単に追加できる
- [ ] パネル間の重なり問題が解消されている
- [ ] キーボードショートカットが便利に使える

---

## 🚨 リスクと対策

### リスク 1: 既存機能の破壊

**リスク:**
- PropertyPanel の既存機能が動作しなくなる
- DebugMenu の機能が失われる

**対策:**
- 段階的な移行（既存コンポーネントを残しながら新システムを構築）
- 包括的なテストスイート
- Feature Flag による新旧切り替え

### リスク 2: パフォーマンス低下

**リスク:**
- タブ切り替え時のラグ
- メモリ使用量の増加

**対策:**
- React.lazy による遅延ロード
- useMemo/useCallback の適切な使用
- パフォーマンス計測の実施

### リスク 3: 学習コストの増加

**リスク:**
- 開発者が新しいシステムの使い方を理解できない

**対策:**
- 詳細なドキュメント作成
- サンプルコード提供
- マイグレーションガイド作成

---

## 📚 参考資料

### 類似実装

1. **VS Code のサイドバー**
   - タブベースのパネル切り替え
   - アイコンによる視覚的な識別
   - 拡張機能によるパネル追加

2. **Figma のプロパティパネル**
   - コンテキストに応じたパネル表示
   - アニメーション付きの切り替え

3. **Chrome DevTools**
   - 複数のツールをタブで管理
   - カスタマイズ可能な配置

### 設計パターン

- **Registry Pattern**: パネルの動的登録
- **Provider Pattern**: React Context での状態管理
- **Plugin Architecture**: 拡張可能な設計

---

## 📞 問い合わせ

本実装計画について質問や提案がある場合は、GitHub Issue または Discussion で連絡してください。

---

**最終更新**: 2025-10-17
**ステータス**: 提案中（レビュー待ち）

# 入力システムリファクタリング実装ドキュメント

## 概要

本ドキュメントは、uSketchプロジェクトにおける入力システムの完全なリファクタリング実装について記述します。
この実装は PR #116 の一環として、2025年9月に完了しました。

## 実装フェーズ

### Phase 1: パッケージ構成と基本実装 ✅

#### 実装内容
- `@usketch/input-manager` パッケージの作成
- `KeyboardManager`、`MouseManager`、`GestureManager` クラスの実装
- `@usketch/input-presets` パッケージでデフォルト設定を提供

#### 主要コンポーネント
```typescript
// KeyboardManager - キーボード入力の管理
class KeyboardManager {
  setBinding(command: string, keys: string[])
  handleKeyDown(event: KeyboardEvent): boolean
  pushContext(name: string, bindings?: KeyBindings)
  getBindings(): KeyBindings
}

// MouseManager - マウス入力の管理
class MouseManager {
  setBinding(command: string, binding: MouseBinding)
  handlePointerDown(event: PointerEvent): boolean
  handleWheel(event: WheelEvent): boolean
  getBindings(): MouseBindings
}

// GestureManager - タッチジェスチャーの管理
class GestureManager {
  handleTouchStart(event: TouchEvent): void
  handleTouchMove(event: TouchEvent): void
  detectGesture(): GestureType | null
}
```

### Phase 2: プリセットシステムの実装 ✅

#### 実装内容
- キーボードプリセット（Default、Vim）
- マウスプリセット（Default、Trackpad）
- 動的プリセット読み込み機能

#### プリセット構造
```typescript
interface KeyboardPreset {
  id: string;
  name: string;
  description: string;
  bindings: KeyBindings;
}

interface MousePreset {
  id: string;
  name: string;
  description: string;
  bindings: MouseBindings;
}
```

### Phase 3: Reactとの統合 ✅

#### 実装内容
- `InputProvider` コンテキストの作成
- `useInput` フックの実装
- コマンド登録システムの統合

#### React統合
```typescript
// InputProvider - 入力システムのコンテキスト提供
<InputProvider 
  keyboardPreset={defaultKeymap}
  mousePreset={defaultMouseMap}
>
  <App />
</InputProvider>

// useInput - 入力マネージャーへのアクセス
const { keyboard, mouse, gesture } = useInput();
```

### Phase 4: ホワイトボードアプリケーションへの統合 ✅

#### 実装内容
- `useWhiteboardCommands` フックの実装
- ツール切り替えコマンドの実装
- カメラ操作コマンドの実装
- React.StrictMode での重複実行問題の解決（WeakMap/Map キャッシング）

### Phase 5: UI実装 ✅

#### 実装内容
- 入力設定パネルコンポーネント
- キーボードショートカット編集UI
- マウスバインディング表示
- プリセット選択UI
- LocalStorageによる設定の永続化

#### UIコンポーネント
```typescript
// InputSettingsPanel - メイン設定パネル
// KeyboardShortcuts - キーバインディング編集
// MouseBindings - マウス設定表示
// PresetSelector - プリセット切り替え
// ConfiguredInputProvider - 設定の読み込み
```

### Phase 6: テストと最適化 ✅

#### 実装内容
- 統合テストの作成
- パフォーマンス最適化（デバウンス/スロットル）
- アクセシビリティ機能の追加
- ドキュメントの作成

## アーキテクチャ

### レイヤー構成

```
┌─────────────────────────────────┐
│     Application Layer           │
│  (@usketch/app)                │
├─────────────────────────────────┤
│     React Integration           │
│  (@usketch/react-canvas)       │
├─────────────────────────────────┤
│     Input Management            │
│  (@usketch/input-manager)      │
├─────────────────────────────────┤
│     Presets & Types            │
│  (@usketch/input-presets)      │
└─────────────────────────────────┘
```

### データフロー

1. **イベント発生**: ブラウザのネイティブイベント
2. **マネージャー処理**: KeyboardManager/MouseManager/GestureManagerで処理
3. **コマンド実行**: 登録されたコマンドハンドラーを実行
4. **状態更新**: Zustand storeまたはXState状態マシンを更新
5. **UI反映**: Reactコンポーネントが再レンダリング

## 主要機能

### 1. キーボード管理
- **コンテキスト切り替え**: モーダルや特定UI状態でのキーマップ変更
- **修飾キー対応**: Cmd/Ctrl、Alt、Shiftの組み合わせ
- **プラットフォーム非依存**: `mod`キーによる抽象化

### 2. マウス管理
- **ドラッグ検出**: クリック vs ドラッグの判定
- **修飾キー連携**: Shift+クリックで複数選択など
- **ホイールイベント**: ズーム操作のサポート

### 3. ジェスチャー管理
- **ピンチジェスチャー**: ズーム操作
- **回転ジェスチャー**: オブジェクトの回転
- **スワイプジェスチャー**: ナビゲーション

### 4. パフォーマンス最適化
- **イベントデバウンス**: 高頻度イベントの制御
- **スロットル処理**: ホイールイベントの最適化
- **WeakMapキャッシング**: React.StrictModeでの重複実行防止

### 5. アクセシビリティ
- **スクリーンリーダー対応**: ARIAライブリージョン
- **キーボードナビゲーション**: フォーカストラップ
- **ショートカットラベル**: プラットフォーム固有の表示

## 設定とカスタマイズ

### LocalStorage設定
```javascript
// 保存される設定
{
  "keyboardPreset": "default",
  "mousePreset": "default", 
  "customKeyboardBindings": {
    "customCommand": ["x"]
  },
  "pinchSensitivity": "1.5",
  "rotateSensitivity": "1.0"
}
```

### プリセットの追加方法
```typescript
// カスタムキーボードプリセット
const customKeymap: KeyboardPreset = {
  id: "custom",
  name: "Custom Layout",
  description: "My custom keyboard layout",
  bindings: {
    select: ["s"],
    rectangle: ["r"],
    // ...
  }
};
```

## テスト

### 統合テストカバレッジ
- ✅ キーボード入力処理
- ✅ マウス操作処理
- ✅ ジェスチャー認識
- ✅ コンテキスト切り替え
- ✅ 動的バインディング変更
- ✅ パフォーマンステスト
- ✅ エラーハンドリング

### テスト実行
```bash
pnpm test --filter=@usketch/input-manager
```

## 今後の拡張計画

### 検討中の機能
1. **マクロシステム**: 複数コマンドの連続実行
2. **ジェスチャーカスタマイズUI**: ジェスチャー感度の細かい調整
3. **コマンドパレット**: 全コマンドの検索と実行
4. **キーボードレイアウト自動検出**: JIS/USレイアウトの自動判別
5. **ゲームパッド対応**: ゲームコントローラーでの操作

## トラブルシューティング

### よくある問題と解決方法

#### Q: React.StrictModeでコマンドが2回実行される
**A**: WeakMap/Mapを使用したグローバルキャッシングで解決済み

#### Q: キーバインディングが反映されない
**A**: ブラウザのリロードが必要。設定変更後は自動リロードされます。

#### Q: タッチジェスチャーが認識されない
**A**: タッチイベントをサポートするデバイスでのみ動作します。

## リファレンス

### 関連ドキュメント
- [キーボードショートカット計画書](../api/keyboard-shortcut-plan.md)
- [XStateツールシステム設計](./xstate-tool-system-design.md)
- [Whiteboard統合アーキテクチャ](../architecture/whiteboard-integration-architecture.md)

## 変更履歴

- **2025-09-26**: Phase 1-6 完了、初版リリース
- **2025-09-26**: React.StrictMode問題の修正
- **2025-09-26**: アクセシビリティ機能の追加
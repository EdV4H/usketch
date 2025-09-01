# uSketch 開発プロジェクト

## プロジェクト概要

uSketchは、キャンバスベースのドローイングアプリケーションです。
Vanilla JavaScriptとReact版の2つの実装があり、共通のコアライブラリを使用しています。

## ドキュメント構成

プロジェクトのドキュメントは `docs/` ディレクトリに整理されています：

### 📁 ドキュメントフォルダ構成

```
docs/
├── README.md                 # ドキュメントのインデックス
├── api/                      # API仕様・型定義
│   ├── README.md            # API仕様書（完全なAPIリファレンス）
│   ├── drawing-tools.md     # 描画ツールのAPI
│   ├── tool-system-api-design.md  # ツールシステムAPI設計
│   └── undo-redo.md         # Undo/Redo機能
├── architecture/             # アーキテクチャ設計
│   ├── README.md            # アーキテクチャ設計書
│   ├── component-architecture-diagram.md
│   ├── component-integration-guide.md
│   └── whiteboard-integration-architecture.md
├── development/              # 開発ガイド
│   └── README.md            # 開発環境セットアップ・コーディング規約
├── examples/                 # サンプルコード
│   ├── README.md            # 使用例とベストプラクティス
│   └── component-integration-examples.md
├── implementation/           # 実装詳細
│   ├── advanced-statemachine-design.md
│   ├── ci-failure-fix-plan.md
│   ├── dependency-injection-examples.md
│   ├── functional-statemachine-design.md
│   ├── multi-selection-implementation-plan.md
│   ├── react-migration-plan.md
│   ├── tool-manager-refactoring-plan.md
│   ├── tool-system-refactoring-plan.md
│   ├── xstate-tool-system-design.md
│   └── zod-schema-adoption-analysis.md
├── testing/                  # テスト関連
│   ├── data-attributes-standard.md
│   ├── test-implementation-guidelines.md
│   └── testability-guidelines.md
└── turborepo/               # Turborepo設定
    ├── turbo-cache-strategy.md
    ├── turbo-example-configs.md
    └── turborepo-migration-plan.md
```

### 📖 ドキュメントの使い方

#### 1. **初めての方**
- まず `docs/development/README.md` で開発環境のセットアップを行う
- 次に `docs/examples/README.md` で基本的な使用例を確認

#### 2. **アーキテクチャを理解したい方**
- `docs/architecture/README.md` でシステム全体の設計を把握
- 各コンポーネントの詳細は `docs/architecture/` 内の個別ファイルを参照

#### 3. **APIリファレンスが必要な方**
- `docs/api/README.md` に完全なAPI仕様が記載されている
- TypeScript型定義やインターフェースの詳細を確認可能

#### 4. **実装の詳細を知りたい方**
- `docs/implementation/` フォルダ内に具体的な実装計画や設計文書
- ステートマシン、依存性注入、リファクタリング計画など

#### 5. **テストを書きたい方**
- `docs/testing/` フォルダ内のガイドラインを参照
- テスト実装のベストプラクティスとデータ属性の標準

### 🚀 クイックアクセス

- **開発を始める**: [開発ガイド](docs/development/README.md)
- **API仕様**: [APIリファレンス](docs/api/README.md)
- **サンプルコード**: [使用例](docs/examples/README.md)
- **アーキテクチャ**: [設計書](docs/architecture/README.md)

---

# tmuxを使った部下（サブペイン）管理方法

## 概要

リーダー（ペイン0）として、複数のペインで動作する部下のClaude Codeを管理する方法。
最大5人の部下を管理し、それぞれに専門的な役割を割り当てることで効率的なチーム開発を実現。
各ペインには役割に応じた名前を設定し、視覚的に識別しやすくする。

## 部下のClaude Code起動方法

**重要**: ペイン番号は分割順で動的に割り当てられるため、確実な番号指定のために各ステップ後にペイン一覧を確認することを推奨します。

### 1人目の部下（アーキテクト）

```bash
# ペイン1を作成（水平分割）
tmux splitw -h
# 作成されたペインに名前を設定（アーキテクト）
tmux select-pane -T "Architect"
# 作成されたペインでClaude Codeを起動
tmux send-keys "claude --dangerously-skip-permissions" ENTER
# ペイン番号を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"
```

### 2人目の部下（デベロッパー）

```bash
# 現在のペインから垂直分割でペイン2を作成
tmux splitw -v
# 作成されたペインに名前を設定（デベロッパー）
tmux select-pane -T "Developer"
# 作成されたペインでClaude Codeを起動
tmux send-keys "claude --dangerously-skip-permissions" ENTER
# ペイン番号を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"
```

### 3人目の部下（テスター）

```bash
# リーダーペイン（ペイン0）を選択してから分割
tmux select-pane -t 0
tmux splitw -v
# 作成されたペインに名前を設定（テスター）
tmux select-pane -T "Tester"
# 作成されたペインでClaude Codeを起動
tmux send-keys "claude --dangerously-skip-permissions" ENTER
# ペイン番号を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"
```

### 4人目の部下（ドキュメンター）

```bash
# デベロッパーペインを選択してから分割（ペイン番号は上記で確認した番号を使用）
# 例：ペイン2がDeveloperの場合
tmux select-pane -t 2
tmux splitw -v
# 作成されたペインに名前を設定（ドキュメンター）
tmux select-pane -T "Documenter"
# 作成されたペインでClaude Codeを起動
tmux send-keys "claude --dangerously-skip-permissions" ENTER
# ペイン番号を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"
```

### 5人目の部下（スクラムマスター）

```bash
# テスターペインを選択してから分割（ペイン番号は上記で確認した番号を使用）
# 例：ペイン3がTesterの場合
tmux select-pane -t 3
tmux splitw -h
# 作成されたペインに名前を設定（スクラムマスター）
tmux select-pane -T "ScrumMaster"
# 作成されたペインでClaude Codeを起動
tmux send-keys "claude --dangerously-skip-permissions" ENTER
# 最終的なペイン構成を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"
```

### 複数部下の配置例

```
+------------------+------------------+
|     リーダー      |   部下1(アーキテクト) |
|    (ペイン0)      |    (ペイン1)      |
|     Leader       |    Architect     |
+------------------+------------------+
|  部下3(テスター)  |  部下2(デベロッパー) |
|    (ペイン3)      |    (ペイン2)      |
|     Tester       |    Developer     |
+--------+---------+------------------+
| 部下5  | 部下4   |                  |
|(ペイン5)|(ペイン4) |                  |
|ScrumMas|Document |                  |
+--------+---------+------------------+
```

## デベロッパーの動的追加機能

### 作業量に応じた自動スケーリング

大規模な開発タスクや複数の並行作業が必要な場合、デベロッパーを動的に追加して開発効率を最大化します。

### 追加デベロッパーの起動方法

```bash
# 現在のデベロッパー数を確認
DEV_COUNT=$(tmux list-panes -F "#{pane_title}" | grep -c "Developer")
echo "現在のデベロッパー数: $DEV_COUNT"

# 新しいデベロッパーを追加（既存のデベロッパーペインから分割）
# デベロッパー番号を自動採番
NEW_DEV_NUM=$((DEV_COUNT + 1))

# 最初のDeveloperペインを取得
FIRST_DEV_PANE=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Developer" | head -1 | cut -d: -f1)

# そのペインから垂直分割
tmux select-pane -t $FIRST_DEV_PANE
tmux splitw -v

# 新しいペインに名前を設定
tmux select-pane -T "Developer-$NEW_DEV_NUM"

# Claude Codeを起動
tmux send-keys "claude --dangerously-skip-permissions" ENTER

# 新しい構成を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"
```

### 作業量判断の基準

以下の条件に該当する場合、デベロッパーの追加を検討：

1. **ファイル数基準**

   - 5つ以上のファイルを同時に編集する必要がある
   - 異なるモジュール間で並行作業が必要

2. **タスク数基準**

   - 3つ以上の独立した機能を同時に開発
   - バグ修正と新機能開発を並行実施

3. **緊急度基準**
   - デッドラインが迫っており、並列作業が必須
   - ホットフィックスと通常開発の並行

### 自動デベロッパー追加スクリプト

```bash
# check_and_add_developer.sh
#!/bin/bash

# タスク数をカウント（例：TodoListから取得）
TASK_COUNT=5  # 実際はTodoListから動的に取得

# 現在のデベロッパー数を確認
DEV_COUNT=$(tmux list-panes -F "#{pane_title}" | grep -c "Developer")

# 推奨デベロッパー数を計算（タスク3つごとに1人）
RECOMMENDED_DEVS=$((($TASK_COUNT + 2) / 3))

# 最大デベロッパー数は5人まで
if [ $RECOMMENDED_DEVS -gt 5 ]; then
    RECOMMENDED_DEVS=5
fi

# 必要に応じてデベロッパーを追加
if [ $DEV_COUNT -lt $RECOMMENDED_DEVS ]; then
    DEVS_TO_ADD=$(($RECOMMENDED_DEVS - $DEV_COUNT))
    echo "デベロッパーを${DEVS_TO_ADD}人追加します"

    for i in $(seq 1 $DEVS_TO_ADD); do
        # 最初のDeveloperペインを取得
        FIRST_DEV_PANE=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Developer" | head -1 | cut -d: -f1)

        # 新しいデベロッパー番号
        NEW_DEV_NUM=$(($DEV_COUNT + $i))

        # ペインを分割して新しいデベロッパーを作成
        tmux select-pane -t $FIRST_DEV_PANE
        tmux splitw -h
        tmux select-pane -T "Developer-$NEW_DEV_NUM"
        tmux send-keys "claude --dangerously-skip-permissions" ENTER

        echo "Developer-$NEW_DEV_NUM を追加しました"
    done

    # レイアウトを調整
    tmux select-layout tiled
fi
```

### 複数デベロッパーへのタスク分配

```bash
# 全デベロッパーにタスクを均等分配
DEV_PANES=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Developer" | cut -d: -f1)
DEV_COUNT=$(echo "$DEV_PANES" | wc -l)

# タスク配列（例）
TASKS=(
    "ユーザー認証機能を実装"
    "商品検索機能を実装"
    "カート機能を実装"
    "決済機能を実装"
    "注文履歴機能を実装"
)

# タスクを各デベロッパーに割り当て
i=0
for task in "${TASKS[@]}"; do
    # ラウンドロビンでデベロッパーを選択
    DEV_INDEX=$((i % DEV_COUNT + 1))
    DEV_PANE=$(echo "$DEV_PANES" | sed -n "${DEV_INDEX}p")

    # タスクを割り当て
    tmux send-keys -t $DEV_PANE "$task してください"
    tmux send-keys -t $DEV_PANE Enter

    i=$((i + 1))
done
```

### デベロッパー間の協調作業

```bash
# メインデベロッパーからサブデベロッパーへの指示
MAIN_DEV=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Developer" | grep -v "Developer-" | cut -d: -f1)
SUB_DEVS=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Developer-" | cut -d: -f1)

# メインデベロッパーに全体設計を指示
tmux send-keys -t $MAIN_DEV "全体のアーキテクチャを設計し、各サブデベロッパーに作業を振り分けてください"
tmux send-keys -t $MAIN_DEV Enter

# サブデベロッパーに協力を指示
for dev in $SUB_DEVS; do
    tmux send-keys -t $dev "メインデベロッパーの指示に従って作業を進めてください"
    tmux send-keys -t $dev Enter
done
```

### デベロッパーの削減

```bash
# 作業完了後、不要なデベロッパーペインを閉じる
# 最後に追加されたデベロッパーから順に削除
EXTRA_DEVS=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Developer-" | sort -t- -k2 -nr | cut -d: -f1)

for dev in $EXTRA_DEVS; do
    # 作業状況を確認
    echo "Developer pane $dev の状態を確認中..."
    STATUS=$(tmux capture-pane -t $dev -p | tail -5)

    # アイドル状態なら削除
    if [[ "$STATUS" == *"作業完了"* ]] || [[ "$STATUS" == *"待機中"* ]]; then
        tmux kill-pane -t $dev
        echo "Developer pane $dev を削除しました"
    fi
done
```

## 部下への指示方法

**重要事項**:

- tmuxでは指示とEnterキーを2回に分けて送信する必要があります
- ペイン番号は動的に割り当てられるため、必ず`tmux list-panes`で確認してから指示してください

### 現在のペイン構成を確認

```bash
# ペイン番号と名前を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"
```

### 部下への指示テンプレート

```bash
# 1. まず指示内容を送信（[ペイン番号]は実際の番号に置き換え）
tmux send-keys -t [ペイン番号] "指示内容をここに記載"

# 2. 次にEnterキーを送信して実行
tmux send-keys -t [ペイン番号] Enter
```

### 役割別の指示例

```bash
# 事前にペイン構成を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"

# 例：Architectが1番ペインの場合
tmux send-keys -t 1 "package.jsonを確認してください"
tmux send-keys -t 1 Enter

# 例：Developerが2番ペインの場合
tmux send-keys -t 2 "srcディレクトリの構造を調査してください"
tmux send-keys -t 2 Enter

# 例：Testerが3番ペインの場合
tmux send-keys -t 3 "テストコードを実行してください"
tmux send-keys -t 3 Enter

# 例：Documenterが4番ペインの場合
tmux send-keys -t 4 "ドキュメントを更新してください"
tmux send-keys -t 4 Enter

# 例：ScrumMasterが5番ペインの場合
tmux send-keys -t 5 "全体のタスク進捗を確認してください"
tmux send-keys -t 5 Enter
```

## 部下からの報告受信方法

部下にリーダーペイン（ペイン0）に報告させる方法：

### 報告テンプレート

```bash
# 部下が実行するコマンド（[ペイン番号]と[役割名]を実際の値に置き換え）
tmux send-keys -t [ペイン番号] 'tmux send-keys -t 0 "# [役割名]からの報告: メッセージ内容"'
tmux send-keys -t [ペイン番号] Enter
tmux send-keys -t [ペイン番号] 'tmux send-keys -t 0 Enter'
tmux send-keys -t [ペイン番号] Enter
```

### 役割別報告例

```bash
# 事前にペイン構成を確認
tmux list-panes -F "#{pane_index}: #{pane_title}"

# 例：Architectが1番ペインの場合
tmux send-keys -t 1 'tmux send-keys -t 0 "# Architectからの報告: package.json分析完了、依存関係に問題なし"'
tmux send-keys -t 1 Enter
tmux send-keys -t 1 'tmux send-keys -t 0 Enter'
tmux send-keys -t 1 Enter

# 例：Developerが2番ペインの場合
tmux send-keys -t 2 'tmux send-keys -t 0 "# Developerからの報告: 新機能実装完了、テスト可能"'
tmux send-keys -t 2 Enter
tmux send-keys -t 2 'tmux send-keys -t 0 Enter'
tmux send-keys -t 2 Enter

# 例：Developerがコミット完了を報告
tmux send-keys -t 2 'tmux send-keys -t 0 "# Developerからの報告: ✨ feat: ログイン機能を実装 としてコミット完了"'
tmux send-keys -t 2 Enter
tmux send-keys -t 2 'tmux send-keys -t 0 Enter'
tmux send-keys -t 2 Enter

# 例：Testerが3番ペインの場合
tmux send-keys -t 3 'tmux send-keys -t 0 "# Testerからの報告: 全テスト合格、カバレッジ95%"'
tmux send-keys -t 3 Enter
tmux send-keys -t 3 'tmux send-keys -t 0 Enter'
tmux send-keys -t 3 Enter

# 例：Documenterが4番ペインの場合
tmux send-keys -t 4 'tmux send-keys -t 0 "# Documenterからの報告: README更新完了"'
tmux send-keys -t 4 Enter
tmux send-keys -t 4 'tmux send-keys -t 0 Enter'
tmux send-keys -t 4 Enter

# 例：ScrumMasterが5番ペインの場合
tmux send-keys -t 5 'tmux send-keys -t 0 "# ScrumMasterからの報告: スプリント進捗80%、残タスク3件"'
tmux send-keys -t 5 Enter
tmux send-keys -t 5 'tmux send-keys -t 0 Enter'
tmux send-keys -t 5 Enter
```

## 部下の状態確認方法

```bash
# 全ペインの構成を確認（名前付き）
tmux list-panes -F "#{pane_index}: #{pane_title} (#{pane_width}x#{pane_height})"

# 特定ペインの出力を確認（[ペイン番号]は実際の番号に置き換え）
tmux capture-pane -t [ペイン番号] -p | tail -20

# 全部下の状態を一括確認（実際のペイン番号に合わせて調整）
for pane in $(tmux list-panes -F "#{pane_index}" | grep -v "0"); do
  echo "=== ペイン $pane の状態 ==="
  tmux capture-pane -t $pane -p | tail -10
  echo ""
done
```

### ペイン名による確認

```bash
# ペイン名でペインを特定
tmux list-panes -F "#{pane_index}: #{pane_title}"

# 例：Architectペインが1番の場合
echo "=== Architect (ペイン1) の状態 ==="
tmux capture-pane -t 1 -p | tail -20
```

## 複数部下の管理テクニック

### 専門的な役割分担

各部下に明確な専門分野を割り当てることで、効率的なチーム開発を実現：

#### 部下1: アーキテクト（設計・調査担当）

- コードベースの構造分析
- 依存関係の調査
- 設計パターンの提案
- 技術的な実現可能性の検証

#### 部下2: デベロッパー（実装・開発担当）

- 新機能の実装
- バグ修正
- リファクタリング
- コードレビュー
- 適切なタイミングでのgit commit（gitmojiを使用）
- 変更の意味が明確になるようコミットを小さく保つ

#### 部下3: テスター（品質保証担当）

- ユニットテストの作成・実行
- 統合テストの実施
- テストカバレッジの確認
- バグの発見と報告

#### 部下4: ドキュメンター（文書・保守担当）

- ドキュメントの作成・更新
- コメントの追加
- README/CHANGELOGの管理
- API仕様書の作成

#### 部下5: スクラムマスター（タスク管理・進行担当）

- タスクの優先順位管理
- スプリント計画の立案
- 進捗状況の監視と報告
- ブロッカーの特定と解決支援
- チーム間の調整と連携促進
- デイリースクラムの進行
- バーンダウンチャートの管理

### Gitmojiを使ったコミットガイドライン（デベロッパー用）

デベロッパーは以下のgitmojiを使用してコミットメッセージを作成：

- ✨ `:sparkles:` - 新機能追加
- 🐛 `:bug:` - バグ修正
- ♻️ `:recycle:` - リファクタリング
- 🎨 `:art:` - コードの構造/フォーマット改善
- ⚡️ `:zap:` - パフォーマンス改善
- 🔥 `:fire:` - コードやファイルの削除
- 💄 `:lipstick:` - UI/スタイルの更新
- ✅ `:white_check_mark:` - テストの追加/修正
- 🔧 `:wrench:` - 設定ファイルの変更
- 📝 `:memo:` - ドキュメントの追加/更新

コミット例：

```bash
# 新機能追加
git commit -m "✨ feat: ユーザー認証機能を追加"

# バグ修正
git commit -m "🐛 fix: ログイン時のエラーハンドリングを修正"

# リファクタリング
git commit -m "♻️ refactor: 認証ロジックを整理"
```

### 並行作業の例

```bash
# 新機能開発の場合
# 部下1: 設計調査
tmux send-keys -t 1 "新機能に必要な既存コードの構造を分析してください"
tmux send-keys -t 1 Enter

# 部下2: 実装準備
tmux send-keys -t 2 "新機能のための基本的なファイル構造を作成してください"
tmux send-keys -t 2 Enter

# 部下2: コミット指示
tmux send-keys -t 2 "機能の実装が一段落したら、gitmojiを使って適切にコミットしてください"
tmux send-keys -t 2 Enter

# 部下3: テスト準備
tmux send-keys -t 3 "新機能用のテストフレームワークを準備してください"
tmux send-keys -t 3 Enter

# 部下4: ドキュメント準備
tmux send-keys -t 4 "新機能の仕様書テンプレートを作成してください"
tmux send-keys -t 4 Enter

# 部下5: タスク管理
tmux send-keys -t 5 "新機能開発のタスクリストを作成し、優先順位を設定してください"
tmux send-keys -t 5 Enter
```

### 効果的な指示の出し方

#### 1. 役割に応じた具体的な指示

```bash
# アーキテクトへの指示例
tmux send-keys -t 1 "認証システムの現在のアーキテクチャを分析し、OAuth2.0導入の影響を評価してください"
tmux send-keys -t 1 Enter

# デベロッパーへの指示例
tmux send-keys -t 2 "user.service.tsにログアウト機能を実装してください"
tmux send-keys -t 2 Enter

# デベロッパーにgitmojiを使ったコミットを指示
tmux send-keys -t 2 "実装が完了したら、gitmojiを使って適切にコミットしてください。例: ✨ feat: ログアウト機能を追加"
tmux send-keys -t 2 Enter

# スクラムマスターへの指示例
tmux send-keys -t 5 "現在のスプリントの進捗を確認し、遅延リスクを評価してください"
tmux send-keys -t 5 Enter
```

#### 2. 連携作業の指示

```bash
# 部下1の調査結果を待って部下2に実装を指示
tmux send-keys -t 1 "APIエンドポイントの仕様を調査し、部下2に報告してください"
tmux send-keys -t 1 Enter

# 部下2の実装後に部下3にテストを指示
tmux send-keys -t 2 "実装が完了したら部下3にテスト開始を報告してください"
tmux send-keys -t 2 Enter

# スクラムマスターにタスク完了を報告するよう指示
tmux send-keys -t 5 "各部下のタスク完了状況を集計し、バーンダウンチャートを更新してください"
tmux send-keys -t 5 Enter
```

#### 3. 全体進捗の把握

```bash
# 全部下に進捗報告を要求（動的ペイン番号対応）
for pane in $(tmux list-panes -F "#{pane_index}" | grep -v "0"); do
  tmux send-keys -t $pane "現在の作業進捗を報告してください"
  tmux send-keys -t $pane Enter
done
```

#### 4. ペイン名を使った柔軟な指示

```bash
# ペイン構成を確認してから指示
tmux list-panes -F "#{pane_index}: #{pane_title}"

# 特定の役割に指示（ペイン番号を動的に取得）
ARCHITECT_PANE=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Architect" | cut -d: -f1)
if [ -n "$ARCHITECT_PANE" ]; then
  tmux send-keys -t $ARCHITECT_PANE "新しいアーキテクチャを検討してください"
  tmux send-keys -t $ARCHITECT_PANE Enter
fi

DEVELOPER_PANE=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "Developer" | cut -d: -f1)
if [ -n "$DEVELOPER_PANE" ]; then
  tmux send-keys -t $DEVELOPER_PANE "機能を実装してください"
  tmux send-keys -t $DEVELOPER_PANE Enter
fi

SCRUMMASTER_PANE=$(tmux list-panes -F "#{pane_index}:#{pane_title}" | grep "ScrumMaster" | cut -d: -f1)
if [ -n "$SCRUMMASTER_PANE" ]; then
  tmux send-keys -t $SCRUMMASTER_PANE "タスクの進捗を更新してください"
  tmux send-keys -t $SCRUMMASTER_PANE Enter
fi
```

## 注意事項

- **Enterキーの送信は必ず別のコマンドとして実行する**
- **部下にも同様に2段階送信の必要性を理解させる**
- **ペイン番号は動的に割り当てられるため、必ず`tmux list-panes`で確認してから指示する**
- ペイン番号は分割順序によって変わる可能性がある（0: リーダー、その他: 部下）
- 報告時は役割名とペイン番号を明記させることで、どの部下からの報告かを明確にする
- 各部下の専門性を活かした指示を心がける
- 部下間の連携が必要な場合は、明確に伝達方法を指示する
- **ペイン作成後は必ずペイン構成を確認し、想定通りの番号が割り当てられているかチェックする**

## トラブルシューティング

### ペイン番号がずれた場合

```bash
# 現在のペイン構成を確認（名前と番号を表示）
tmux list-panes -F "#{pane_index}: #{pane_title}"

# ペイン名でペインを特定
tmux select-pane -t '{top-left}' # リーダーペインを選択
```

### 部下が応答しない場合

```bash
# 該当ペインの状態を確認
tmux capture-pane -t [ペイン番号] -p | tail -50

# 必要に応じて再起動
tmux send-keys -t [ペイン番号] C-c
tmux send-keys -t [ペイン番号] "claude --dangerously-skip-permissions" ENTER
```

### ペイン名の変更

```bash
# リーダーペインに名前を設定
tmux select-pane -t 0 -T "Leader"

# 部下の名前を変更
tmux select-pane -t 1 -T "Architect"
tmux select-pane -t 2 -T "Developer"
tmux select-pane -t 3 -T "Tester"
tmux select-pane -t 4 -T "Documenter"
tmux select-pane -t 5 -T "ScrumMaster"
```

### ペイン名を使ったナビゲーション

```bash
# ペイン名で直接選択
tmux select-pane -t "%1"  # Architectペインを選択
tmux select-pane -t "%2"  # Developerペインを選択

# ペインタイトルを表示する
tmux set -g pane-border-status top
tmux set -g pane-border-format "#{pane_index}: #{pane_title}"
```

### レイアウトを整える

```bash
# 均等な4分割レイアウトに調整
tmux select-layout tiled
```

# PRD: uSketch — 「Not Whiteboard」コミュニケーション空間としてのキャンバス

## Context

uSketch v2 は MVP ロードマップ（8週間）で基本的なホワイトボード機能（描画・永続化・コラボ・共有）を構築中。ここに2つ目のコアビジョンとして「Not Whiteboard」を掲げ、既存のデジタルホワイトボード製品との根本的な差別化を図る。

「AIネイティブ」PRD（`docs/prd-ai-native.md`）と補完関係にある。AIネイティブが「AI をキャンバスの共同作業者にする」ビジョンなら、Not Whiteboard は「人間がキャンバスで空間的にコミュニケーションする」ビジョン。

v1 の教訓「ユーザー価値を先に出せ」を守りつつ、コミュニケーション機能を後付けではなくアーキテクチャレベルで組み込む方針を定義する。

---

## 1. ビジョン: なぜ「Not Whiteboard」か

### 物理ホワイトボードのメタファーの限界

既存のデジタルホワイトボード（Miro, FigJam, tldraw, Excalidraw）はすべて「物理ホワイトボードのデジタル版」という発想に留まっている。

物理ホワイトボードとは何か:
- **受動的な面**。誰かが書くまで何も起きない
- **文脈を持たない**。前回の議論の流れ、誰が何を書いたか、いつ書いたかの情報がない
- **会話を運べない**。書いた内容は残るが、そこで起きた議論は消える
- **存在は物理空間に束縛される**。その部屋にいない人には見えない

既存のデジタルホワイトボードは「面」をデジタル化しただけで、これらの本質的な限界を再発明していない。

### uSketch のポジション

> uSketch のキャンバスはホワイトボードではない。**コミュニケーションチャネル**である。
> Slack だが空間的、Zoom だが永続的。

### 核心コンセプト①: 空間が先、道具は後

uSketch = 人が集まるバーチャル空間（オフィスのフロア）。ホワイトボード = その空間内で使える「道具」の1つ。

物理の例で考える:
1. オフィスフロアがある（**空間**）
2. チームがフロアに集まっている（**プレゼンス**）
3. 「議論しよう」→ 会議室に集まる（**フォーカス**）
4. ホワイトボードを使って図を描く（**道具**）
5. 議論が終わる → ホワイトボードの写真を撮って共有（**成果物**）

uSketch は「フロア」（ステップ1-2）であって「ホワイトボード」（ステップ4）ではない。ホワイトボードは空間内で必要に応じて召喚する「道具」の1つに過ぎない。

### 核心コンセプト②: 接続していなくても空間にいる

既存の同期ツール（Miro, FigJam 等）の問題:
- WebSocket 接続中しかプレゼンスが見えない
- アプリを閉じた瞬間、その人は「存在しない人」になる
- 非同期コラボレーションが成立しない

**Slack のモデル**を考える:
- アプリを閉じていてもチャンネルの**メンバー**
- 通知が来る。非同期でも「参加している」感覚がある
- オンライン/オフラインはステータスであって、存在/不在ではない

**uSketch が目指すモデル**:
- 空間の「メンバー」は永続的。接続状態はステータス（online / away / offline）であって、存在/不在ではない
- メンバーリストはサーバー側（D1 `board_members` テーブル）に永続化。Yjs Awareness の接続状態とは独立
- オフラインのメンバーもアバター（グレーアウト）で空間上に表示される
- @メンションすると、オフラインのメンバーにもプッシュ通知/メール通知が届く
- オフライン中に起きた変更は「アクティビティフィード」で追える（Slack の未読メッセージ的）
- 「最後にいた場所」にゴーストアバターが残る（この人は前回ここを見ていた、がわかる）

### 競合比較

| 軸 | Miro | FigJam | tldraw | Excalidraw | **uSketch** |
|---|---|---|---|---|---|
| **メタファー** | デジタルホワイトボード | コラボ付箋ボード | ミニマルキャンバス | 手書きスケッチ | **コミュニケーション空間** |
| **プレゼンス** | 接続中のみ | 接続中のみ | 接続中のみ | 接続中のみ | **永続メンバーシップ** |
| **コミュニケーション** | コメント、ビデオ | コメント、スタンプ | なし | なし | **空間チャット、@メンション、リアクション** |
| **非同期** | コメント通知のみ | コメント通知のみ | なし | なし | **アクティビティフィード、プッシュ通知** |
| **ソーシャル** | 投票、タイマー | スタンプ | なし | なし | **リアクション、ステータス、投票、Applause** |
| **接続モデル** | 接続中 = 存在 | 接続中 = 存在 | 接続中 = 存在 | 接続中 = 存在 | **メンバー = 永続、接続 = ステータス** |

---

## 2. コアコミュニケーションプリミティブ

### 2.1 空間プレゼンス（永続メンバーシップ）

**概要**: メンバーはサーバー永続化、接続状態≠存在。空間に「いる」感覚を常に維持する。

| 機能 | 説明 | 技術基盤 |
|------|------|----------|
| 永続メンバーリスト | D1 `board_members` にメンバーを永続化。接続切断後も「メンバー」 | D1 + REST API |
| オンラインステータス | online / away / offline の3状態。Yjs Awareness の接続状態と連動 | Yjs Awareness + TransientRegistry |
| ゴーストアバター | オフラインメンバーを空間上にグレーアウト表示。「最後にいた場所」に配置 | D1（最終ビューポート保存）+ TransientRegistry |
| アクティビティヘイロー | 最近アクティブだったメンバーのアバター周辺に光輪を表示 | TransientRegistry `activity-halo` |
| ビューポートインジケータ | 他のメンバーが見ている領域を薄い矩形で表示 | Yjs Awareness（既存プレゼンス拡張） |

### 2.2 アテンション機構

**概要**: 特定のポイントやエリアに他のメンバーの注目を集める。

| 機能 | 説明 | 技術基盤 |
|------|------|----------|
| レーザーポインタ | 一時的な軌跡を描くポインタ。プレゼンテーション中に使用 | TransientRegistry `laser-trail`（TTL: 軌跡ポイントごとに 1,000ms） |
| スポットライト | キャンバスの特定エリアをハイライトし、他を暗転 | TransientRegistry `spotlight` |
| Follow Me | プレゼンターのビューポートに他のメンバーが自動追従 | Yjs Awareness + EventBus `follow:start` / `follow:stop` |

### 2.3 コンテキスト型コミュニケーション

**概要**: 空間上の位置やシェイプに紐づいたコミュニケーション。

| 機能 | 説明 | 技術基盤 |
|------|------|----------|
| シェイプコメント | シェイプにアンカーされたスレッド形式コメント | 別 Y.Map `comments`（永続）+ D1 |
| 空間チャットバブル（transient） | 空間上に一時的に表示されるチャットメッセージ。会話のテンポを維持 | TransientRegistry `chat-bubble`（TTL: 10,000ms） |
| 空間チャットバブル（persistent） | 空間上に永続配置されるメモ・メッセージ。議論の文脈を残す | Y.Map `spatial-messages`（永続） |

### 2.4 非同期コラボパターン

**概要**: 接続していないメンバーとのコラボレーションを可能にする。

| 機能 | 説明 | 技術基盤 |
|------|------|----------|
| @メンション付箋 | 特定メンバー宛のメッセージ付箋。オフラインメンバーにもプッシュ通知/メール通知 | Y.Map `mentions` + D1通知キュー + プッシュ通知API |
| アクティビティタイムライン | 前回接続以降の変更をタイムライン表示（Slackの未読メッセージ的） | D1イベントログ + REST API |
| レビューモード | シェイプにレビューステータス（承認/却下/コメント中）を付与 | Y.Map `review-status`（永続） |

### 2.5 ソーシャルシグナル

**概要**: 軽量なフィードバックと空間上の感情表現。

| 機能 | 説明 | 技術基盤 |
|------|------|----------|
| リアクション強化 | 既存リアクションの拡張。シェイプ/位置へのアンカー、集計表示 | TransientRegistry `reaction` 拡張 |
| ユーザーステータス | テキスト+絵文字のステータス表示（「ランチ中 🍜」「レビュー中 👀」） | TransientRegistry `user-status` |
| 投票 | 空間上に投票を配置。選択肢にシェイプを紐づけ可能 | TransientRegistry `vote` + D1（集計永続化） |
| Applause カスケード | 画面全体に拍手/紙吹雪を表示。プレゼン終了時等 | TransientRegistry `applause`（TTL: 5,000ms） |

### 2.6 道具としてのホワイトボード（Sub-Space）

**概要**: 空間内に「ホワイトボード」を道具として召喚する新概念。キャンバスのキャンバス。

**コンセプト**:
- 空間上で「ホワイトボードを作ろう」→ サブスペース（別キャンバス領域/埋め込みボード）が生成される
- サブスペースは独自のスコープ（ツール・背景・レイヤー）を持つ
- 複数のサブスペースを同時に空間上に配置可能（議論A用ボード、議論B用ボード）
- サブスペースは折りたたみ/展開、サムネイル表示が可能
- 終了後はアーカイブ（スナップショット化）して空間上に成果物として残る

| 機能 | 説明 | 技術基盤 |
|------|------|----------|
| サブスペース生成 | 空間上に独立したキャンバス領域を作成 | 入れ子の Y.Map スコープ or 別 Y.Doc |
| スコープ分離 | サブスペースごとにツール・背景・レイヤーが独立 | PluginContext のスコープ切り替え |
| 折りたたみ/展開 | サブスペースをサムネイルとして折りたたみ、クリックで展開 | TransientRegistry `sub-space-thumbnail` + レイヤー制御 |
| 複数配置 | 空間上に複数のサブスペースを同時配置 | Y.Map `sub-spaces`（永続） |
| アーカイブ | サブスペースを読み取り専用のスナップショットとして保存 | D1 + ストレージ（PNG/SVGスナップショット） |

**プラグイン**: `usketch-plugin-sub-space` として実装

---

## 3. ユーザーシナリオ

### シナリオ A: 非同期デザインレビュー

1. デザイナーがワイヤーフレームをボードに配置し、レビューステータスを「レビュー待ち」に設定
2. @PM @エンジニア とメンション付箋を貼る → オフラインの2人にプッシュ通知が届く
3. PM がアプリを開く → アクティビティフィードに「デザイナーがワイヤーフレームを追加」と表示
4. PM がワイヤーフレームの横にコメントバブルを配置:「ナビゲーションの位置を再検討したい」
5. エンジニアが後からログイン → PM のコメントがアクティビティフィードに表示。その場で空間チャットで返答
6. コメントスレッドがシェイプの空間的な位置に紐づいて配置される

### シナリオ B: リモートスタンドアップ

1. スクラムマスターがボードを開き、Follow Me を有効化
2. チームメンバーがログイン → スクラムマスターのビューポートに自動追従
3. スクラムマスターがレーザーポインタでタスクボードを指しながら説明
4. メンバーがリアクション（👍 ✅）で進捗を示す
5. ブロッカーがある箇所にスポットライトを当て、空間チャットで議論
6. 最後に Applause カスケードでスタンドアップ終了

### シナリオ C: ファシリテーション型ブレスト

1. ファシリテーターがお題を空間上に配置
2. 参加者がアイデアを付箋で追加（各自の色で識別）
3. ファシリテーターがスポットライトで注目エリアを切り替えながら議論を進行
4. 投票機能で有望なアイデアを絞り込み
5. AI（AIネイティブPRD連携）がリアクションクラスタを検知し、議論を自動要約
6. 要約テキストが空間上にシェイプとして生成される

### シナリオ D: 教育ワークショップ

1. 講師が教材をボードに配置し、Follow Me を有効化
2. レーザーポインタで重要ポイントを指し示す
3. 受講者が空間チャットバブルで質問 → 質問が教材の該当箇所の近くに表示
4. 受講者がリアクション（💡 ❓ 👍）でリアルタイムにフィードバック
5. 講師が質問バブルの集中箇所にスポットライトを当てて補足説明

### シナリオ E: チームの常駐空間

1. チームが常設の「チーム空間」を持っている（プロジェクト情報、メンバーアバター、ステータスが見える）
2. PM が「スプリント計画やろう」→ 空間上に「ホワイトボード」を召喚（サブスペース生成）
3. チームがサブスペースに集まり、従来のホワイトボード的に付箋やフローを配置
4. 計画が終わったらサブスペースを折りたたみ → サムネイル+タイトルとして空間上に成果物が残る
5. 翌日デザイナーが「UIレビューしよう」→ 別のホワイトボードを召喚、ワイヤーフレームを配置
6. 空間上には複数のホワイトボード成果物が並び、チームの活動履歴が視覚的に蓄積される

### シナリオ F: クライアントとのワークショップ

1. コンサルタントが「ワークショップ空間」を作成、クライアントをリンクで招待
2. まず空間上で自己紹介・アイスブレイク（リアクション、空間チャット）
3. 「課題整理しましょう」→ ホワイトボード①を召喚、課題を付箋で出し合う
4. 「解決策を考えましょう」→ ホワイトボード②を召喚、ソリューション案を描く
5. 空間に戻り、2つのボード成果物を見比べながら議論・投票
6. AI（AIネイティブPRD連携）が両ボードの内容を読み取り、まとめを空間上に生成

---

## 4. 技術アプローチ

### 4.1 原則: コミュニケーション機能 = プラグイン

すべてのコミュニケーション機能は標準 `UsketchPlugin` として実装（`plugin-system-design.md` で定義された `FeaturePlugin` サブタイプを使用予定）。`packages/core` はコミュニケーションのために変更しない。

MVP基盤インフラ（`architecture-v2.md` / `plugin-system-design.md` で設計済み、MVP期間中に実装予定）が Not Whiteboard の要件を満たすことを確認:

| MVP基盤インフラ（設計済み） | Not Whiteboard での役割 |
|---|---|
| `TransientRegistry` | レーザー軌跡、チャットバブル、リアクション、投票、ステータス等の一時オブジェクト管理 |
| `EventBus` | `follow:start`, `vote:cast`, `chat:send` 等のプラグイン間イベント通信 |
| `PluginContext` | コミュニケーションプラグインが `ctx.transient`, `ctx.events`, `ctx.store` にアクセス |
| Yjs Awareness | リアルタイムプレゼンス、Follow Me のビューポート同期 |
| `BoardStore` | コメント・レビューステータス等の永続データを Y.Map 経由で管理 |
| D1 `board_members` | 永続メンバーシップ、オフラインメンバー管理、通知先の解決 |

### 4.2 新しい TransientObject タイプ一覧

| タイプ | 用途 | TTL | Phase |
|---|---|---|---|
| `laser-trail` | レーザーポインタの軌跡 | 1,000ms（ポイントごと） | NW-2 |
| `spotlight` | フォーカスモードのハイライト | なし（手動制御） | NW-4 |
| `chat-bubble` | 一時的な空間チャットメッセージ | 10,000ms | NW-1 |
| `user-status` | ユーザーステータス表示 | なし（手動更新） | NW-1 |
| `vote` | 投票の選択肢と投票状態 | なし（投票終了まで） | NW-4 |
| `applause` | 拍手/紙吹雪エフェクト | 5,000ms | NW-1 |
| `activity-halo` | アクティブメンバーの光輪 | 30,000ms | NW-2 |
| `follow-indicator` | Follow Me の追従インジケータ | なし（Follow中） | NW-2 |
| `sub-space-thumbnail` | 折りたたまれたサブスペースのサムネイル | なし（永続的） | NW-5 |

### 4.3 永続コミュニケーションのデータモデル

一時的でないコミュニケーションデータ（コメント、レビューステータス等）は Yjs Document 内の**別 Y.Map** に格納する。シェイプデータの Y.Map `shapes` とは分離。

```typescript
// Yjs Document 構造（拡張）
interface BoardDocument {
  shapes: Y.Map<ShapeData>            // 既存: シェイプデータ
  layers: Y.Array<string>              // 既存: レイヤー順序
  metadata: Y.Map<unknown>             // 既存: ボード設定

  // Not Whiteboard 拡張
  comments: Y.Map<CommentThread>       // シェイプアンカーコメント
  spatialMessages: Y.Map<SpatialMessage> // 永続空間チャット
  reviewStatus: Y.Map<ReviewStatus>    // レビューステータス
  mentions: Y.Map<Mention>             // @メンション
  subSpaces: Y.Map<SubSpaceData>       // サブスペース定義
}

interface CommentThread {
  id: string
  anchorShapeId: string                // 紐づくシェイプのID
  anchorPosition: Point                // シェイプ上の位置
  messages: CommentMessage[]
  resolved: boolean
  createdAt: number
  updatedAt: number
}

interface CommentMessage {
  id: string
  authorId: string
  text: string
  createdAt: number
}

interface SubSpaceData {
  id: string
  title: string
  position: Point                      // 空間上の配置位置
  size: { width: number; height: number }
  state: 'active' | 'collapsed' | 'archived'
  createdBy: string
  createdAt: number
  archivedAt?: number
  snapshotUrl?: string                 // アーカイブ時のスナップショット
}
```

### 4.4 サーバーサイド拡張

```
apps/server/src/routes/  （新設予定）
  notifications.ts       — プッシュ通知 / メール通知 API
  activity.ts            — アクティビティログ取得 API
  members.ts             — 永続メンバー管理 API（既存 board_members 拡張）
```

D1 テーブル拡張:
```sql
-- アクティビティログ
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'shape:created', 'comment:added', 'mention:sent' 等
  target_id TEXT,                -- 対象シェイプ/コメントのID
  summary TEXT,                  -- 人間可読な要約
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 通知キュー
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  board_id TEXT NOT NULL REFERENCES boards(id),
  type TEXT NOT NULL,            -- 'mention', 'comment', 'review-request'
  payload TEXT NOT NULL,         -- JSON
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- メンバー拡張
ALTER TABLE board_members ADD COLUMN last_viewport TEXT;    -- 最終ビューポートJSON
ALTER TABLE board_members ADD COLUMN last_seen_at TEXT;     -- 最終接続日時
ALTER TABLE board_members ADD COLUMN status TEXT;           -- ユーザーステータス
```

---

## 5. プラグイン構成（追加予定）

```
plugins/（追加予定）
  usketch-plugin-presence-enhanced/  — 拡張プレゼンス（永続メンバー表示、ゴーストアバター、ステータス）
  usketch-plugin-spatial-chat/       — 空間チャットバブル（transient + persistent）
  usketch-plugin-laser/              — レーザーポインタ（軌跡描画）
  usketch-plugin-follow-me/          — プレゼンタービューポート追従
  usketch-plugin-comments/           — シェイプアンカーコメントスレッド
  usketch-plugin-spotlight/          — フォーカスモード（エリアハイライト + 暗転）
  usketch-plugin-voting/             — 空間投票（シェイプ紐づけ可能）
  usketch-plugin-activity-feed/      — アクティビティタイムライン（未読管理）
  usketch-plugin-sub-space/          — サブスペース（道具としてのホワイトボード）
```

各プラグインは `UsketchPlugin`（`FeaturePlugin` サブタイプ、`plugin-system-design.md` で設計済み）として実装し、`setup(ctx)` 内で:
- `ctx.transient.registerType()` で一時オブジェクトの種別を登録
- `ctx.events.on()` でイベントを購読
- `ctx.layers.register()` で必要なレイヤーを登録
- `ctx.commands.execute()` でコマンドを実行（Undo対応）

---

## 6. AI ネイティブ PRD との関係

### 役割の分担

| | AI ネイティブ | Not Whiteboard |
|---|---|---|
| 主語 | AI | 人間 |
| 核心 | AI がキャンバス上の共同作業者 | 人間が空間でコミュニケーション |
| キー機能 | NL2Canvas、Copilot、Smart Actions | プレゼンス、チャット、レーザー、投票 |
| データフロー | LLM ↔ BoardStore ↔ キャンバス | ユーザー ↔ TransientRegistry/Yjs ↔ 他ユーザー |

### 組み合わせシナジー

- AI がリアクションクラスタを検知 → 議論のホットスポットを自動要約
- Follow Me 中に AI が「次のトピックに関連するシェイプ」をハイライト
- 投票結果を AI が分析 → 次のアクションを提案
- AI がオフラインメンバー向けに変更サマリーを自動生成（アクティビティフィード拡充）
- サブスペースの内容を AI が読み取り、空間上に要約シェイプを生成

### 共有インフラ

- **TransientRegistry**: AI提案ゴーストもチャットバブルも同じ仕組み
- **EventBus**: AI イベント（`ai:request`, `ai:response`）とコミュニケーションイベント（`chat:send`, `vote:cast`）が同じバスを流れる
- **Plugin API**: AI プラグインもコミュニケーションプラグインも同じ `UsketchPlugin` インターフェース
- **Yjs Awareness**: AI プレゼンスも人間プレゼンスも同じチャネル

### タイムライン並行

AI ネイティブと Not Whiteboard のフェーズは独立プラグインのため並行開発可能。共有インフラ（TransientRegistry, EventBus, Plugin API）は MVP で構築済み。

---

## 7. フェーズドロールアウト

Not Whiteboard 機能は既存 MVP ロードマップをブロックしない。Week 8（基本ホワイトボード完成）後に開発を開始。

### Phase 0: MVP 基盤（Week 1-8、既存ロードマップ）

コミュニケーション作業なし。ただし MVP 中に以下の基盤が構築される（設計済み、MVP期間中に実装予定）:
- `TransientRegistry`（カーソル、リップルエフェクト用）
- Yjs Awareness（プレゼンス用）
- `EventBus`（プラグイン間通信用）
- D1 `board_members`（アクセス制御用）

### Phase NW-1: リアクション + 空間チャット（Week 9-10、2週間）

- `usketch-plugin-spatial-chat` 実装
- リアクション強化（既存 `reaction` TransientObject の拡張）
- ユーザーステータス
- Applause カスケード
- **出荷価値:** ミーティング中の軽量コミュニケーションが空間的に行える

### Phase NW-2: レーザーポインタ + Follow Me + 拡張プレゼンス（Week 11-12、2週間）

- `usketch-plugin-laser` 実装
- `usketch-plugin-follow-me` 実装
- `usketch-plugin-presence-enhanced` 実装（永続メンバー、ゴーストアバター）
- D1 `board_members` に `last_viewport`, `last_seen_at` カラム追加
- **出荷価値:** プレゼンテーション + 「この空間にはこのメンバーがいる」感覚

### Phase NW-3: コメントスレッド + レビューステータス（Week 13-15、3週間）

- `usketch-plugin-comments` 実装
- Yjs Document に `comments` Y.Map 追加
- レビューモード（承認/却下/コメント中）
- @メンション + プッシュ通知基盤
- D1 `notifications` テーブル + 通知 API
- **出荷価値:** 非同期デザインレビューが空間的に完結する

### Phase NW-4: 投票 + アクティビティフィード + スポットライト（Week 16-17、2週間）

- `usketch-plugin-voting` 実装
- `usketch-plugin-activity-feed` 実装
- `usketch-plugin-spotlight` 実装
- D1 `activity_log` テーブル + アクティビティ API
- **出荷価値:** ファシリテーション + 非同期キャッチアップ

### Phase NW-5: サブスペース（Week 18+、継続）

- `usketch-plugin-sub-space` 実装
- 入れ子 Y.Doc or Y.Map スコープのデータモデル検証
- 折りたたみ/展開 UI
- アーカイブ（スナップショット化）
- **出荷価値:** 「空間が先、道具は後」のビジョンが完全に体現される

---

## 8. ビジネスインパクト

### フリーミアムモデル調整

| プラン | Not Whiteboard 機能 | 根拠 |
|---|---|---|
| **Free** | プレゼンス + リアクション + Applause | バイラルループ（リアクションは楽しい → 他の人も使いたくなる） |
| **Pro**（¥980/月） | レーザー、Follow Me、空間チャット、コメント | ミーティング・プレゼンテーション機能 |
| **Team**（¥1,980/人/月） | アクティビティフィード、レビューワークフロー、投票、サブスペース | チームワークフロー機能 |

### KPI シフト

Not Whiteboard は uSketch の KPI 構造を変える:

| 従来の KPI（ホワイトボード） | Not Whiteboard の KPI |
|---|---|
| boards created | **daily active sessions**（空間に来る頻度） |
| shapes per board | **reactions / session**（コミュニケーション密度） |
| export count | **return frequency**（再訪率） |
| — | **notification-driven returns**（通知経由の復帰率） |
| — | **multi-user session ratio**（マルチユーザーセッション比率） |

---

## 9. リスクと対策

| リスク | 深刻度 | 対策 |
|---|---|---|
| コミュニケーションプラットフォームの過剰設計（v1教訓！） | 高 | Phase NW-1 のみ先に ship。ユーザーフィードバックを見てから次フェーズ判断 |
| スコープクリープ（Slack + Miro + Zoom 化） | 高 | 空間コミュニケーションのみ。テキストチャット（Slack代替）・ビデオ通話（Zoom代替）は**対象外** |
| UX 複雑化 | 中 | プログレッシブディスクロージャー。基本はシンプルなキャンバス、コミュニケーション機能は右クリック/コマンドパレットから |
| TransientRegistry スケーラビリティ | 中 | TTL 管理 + レートリミット。1ユーザーあたりの同時 TransientObject 数を制限 |
| 永続メンバーシップのプライバシー | 中 | メンバーの「最後にいた場所」表示はオプトイン。ステータスは自分で設定 |
| サブスペースの技術的複雑性 | 高 | Phase NW-5（最後）に配置。入れ子 Y.Doc の PoC を先行実施 |
| 通知疲れ | 中 | 通知粒度の設定（@メンションのみ / すべて / なし）。DND モード |

---

## 10. 成功指標

| フェーズ | 指標 | 目標 |
|---|---|---|
| NW-1 | リアクション使用率（セッションあたり） | >30% のセッションでリアクションが使われる |
| NW-1 | 空間チャットメッセージ数 | >3 msg/session（マルチユーザーセッション） |
| NW-2 | Follow Me 使用率 | >20% のマルチユーザーセッションで使用 |
| NW-2 | セッション時間の変化 | >25% 増（プレゼンテーション利用による） |
| NW-3 | コメント使用率 | >15% のボードにコメントが付く |
| NW-3 | 通知経由の復帰率 | >15%（@メンション通知でオフラインメンバーが戻ってくる率） |
| 6ヶ月後 | DAU/MAU | >30% |
| 6ヶ月後 | マルチユーザーセッション比率 | >40% |
| 6ヶ月後 | 再訪率（7日以内リターン） | >50% |

---

## 11. 未決事項

1. **チャットの永続/一時性のバランス** — 一時チャットバブル（TTL で消える）と永続メッセージの UX をどう分けるか。ユーザーが意識せずに使えるか？
2. **コメントデータモデル** — Y.Map `comments` の構造。スレッド形式 vs フラット。シェイプ削除時のコメントの扱い
3. **Follow Me の権限** — 誰でも Follow Me を開始できるか、ボードオーナー/エディター限定か
4. **通知システムのインフラ** — Web Push API、メール通知の具体的実装。サービスワーカーの管理
5. **モバイル対応** — 空間チャットやリアクションのモバイル UX。タッチでのレーザーポインタ操作
6. **サブスペースのデータモデル** — 入れ子 Y.Doc（完全分離、別の同期チャネル）vs 単一 Y.Doc 内の Y.Map スコープ分離（同一同期チャネル、実装シンプル）
7. **サブスペースの権限** — 空間のメンバー全員がアクセス可能 or サブスペースごとに個別権限設定
8. **サブスペースのアーカイブ形式** — スナップショット画像（軽量、閲覧専用）or 読み取り専用の編集可能シェイプ（重い、再利用可能）

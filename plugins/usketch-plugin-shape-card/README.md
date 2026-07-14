# @edv4h/usketch-plugin-shape-card

トランプ・UNO・メディアカード等を表現できる **card-type 拡張ポイント**を持つカードシェイプ・プラグイン。
カードは表/裏を持ち、**選択時の操作メニューから裏返し（flip）**でき、**配置時アニメーション**・
**デッキ（山札）機構**・**手札（hand）**を備える。

## 使い方

このプラグインは**コア機構のみ**を提供し、card-type は**既定では空**です。
トランプ等は同梱の**サンプル（`EXAMPLE_CARD_TYPES`）**で、明示的に渡したときだけ有効になります。
（card-type が1つも無いと描画ツールは表示されません。）

```ts
import { createCardPlugin, EXAMPLE_CARD_TYPES } from "@edv4h/usketch-plugin-shape-card";

createApp({
  plugins: [
    // サンプル（media / playing-card / uno / custom）を使う:
    createCardPlugin({ cardTypes: EXAMPLE_CARD_TYPES }),
    // 自前の card-type だけにするなら:
    // createCardPlugin({ cardTypes: [myCardType] }),
    // 空でも生成可能（描画ツールは出ない）:
    // createCardPlugin(),
  ],
});
```

ツール（card-type が1つ以上ある場合のみ表示）:
- `card-draw`（ショートカット `k`）— カードを描画。ドラッグでサイズ（アスペクト比固定）、クリックで既定サイズ。
- `card-deck-draw` — 山札を配置。

インタラクション:
- カード / 山札を**選択すると近傍に操作メニュー**が出る（`ShapeAnchorOverlay`）。
  - カード: 「めくる」「手札に入れる」
  - 山札: 「1枚ドロー」「シャッフル」
- 山札を選択して **Shift+S** でシャッフル（ショートカット）。
- カード/山札はアスペクト比を保ったままのみリサイズ可能。
- ⚠️ 旧来の**ダブルクリック**での flip / ドローは、select 等と競合しやすいため**既定で無効**。
  後方互換で戻すには `legacyDoubleClickActions: true`。

## 手札（hand）

カードを選択メニューの「手札に入れる」で**画面下部のトレイ**に移動できる（「場に出す」で盤面へ戻す）。

- 手札の**中身はこのクライアント内（localStorage）にのみ保持**され、共有ドキュメント/awareness には出さない。他クライアントは**枚数だけ**（「他 N枚」）を見る。
- これはクライアントローカルの**暫定 privacy** 実装。中身の漏れない・クロス端末・権威のある「真の伏せ手札」はサーバー権威方式が必要（#686 で追跡）。
- 枚数共有には `wsProvider`（awareness）注入が必要。無ければ手札はローカルのみで動作。

## card-type の追加

`CardTypeDefinition` を満たすオブジェクトを `createCardPlugin` に渡す:

```tsx
import { createCardPlugin, type CardTypeDefinition } from "@edv4h/usketch-plugin-shape-card";

interface TarotFields { name: string; }

const tarotCardType: CardTypeDefinition<TarotFields> = {
  id: "tarot",
  label: "タロット",
  icon: () => <svg width="16" height="16" viewBox="0 0 16 16">{/* ... */}</svg>,
  defaultSize: { width: 120, height: 210 },
  aspectRatio: 120 / 210,
  createDefaultFields: () => ({ name: "The Fool" }),
  renderFront: (f) => <div>{f.name}</div>,
  renderBack: () => <div>★</div>,
  placementAnimation: { preset: "deal" },
  buildDeck: () => [/* 78枚 */],
};

createCardPlugin({ cardTypes: [tarotCardType] });
```

サンプル card-type: `media` / `playing-card` / `uno` / `custom`（`EXAMPLE_CARD_TYPES`）。既定では未登録なので、使うときに明示的に渡す。

## テクスチャ + テキスト配置（`custom` card-type / `CardFace`）

コードを書かずに、表/裏それぞれの**テクスチャ（背景画像・色・グラデーション）**と、
**テキストの配置を細かく**指定できます。サンプルの `custom` card-type が `meta.fields` に
`{ front: CardFace; back: CardFace }` を持ち、データ差し替えだけで見た目を完全制御できます。

```ts
import type { CardFace } from "@edv4h/usketch-plugin-shape-card";

const front: CardFace = {
  texture: { image: "https://.../bg.png", fit: "cover" }, // cover|contain|fill|tile / color も可
  texts: [
    {
      text: "見出し",
      x: 0.5, y: 0.2,          // 既定は割合(ratio, 0..1)。unit:"px" で px 指定も可
      align: "center", vAlign: "middle", // アンカー（x,y が指す基準点）
      rotation: -6,            // 回転（度）
      fontSize: 24, fontWeight: 700, color: "#fff",
      letterSpacing: 2, lineHeight: 1.4, maxWidth: 200, // maxWidth で折り返し
    },
  ],
};
```

- 位置は `unit: "ratio"`（既定・リサイズ追従）か `"px"`。
- `align` / `vAlign` で x,y がテキストのどこを指すか（左上・中央・右下など）を決定。
- `renderFace(face)` をエクスポートしているので、独自 card-type の `renderFront`/`renderBack` でも再利用できます。

## カード / デッキの生成（ファクトリ）

生成は「データ作り」なので、`store.addShape` に渡せる shape データを返す**純ファクトリ**を提供します
（ツールも内部でこれを使っています）。Undo したい場合は `createAddShapeCommand` に渡します。

```ts
import { createCardShape, createDeckShape } from "@edv4h/usketch-plugin-shape-card";

// 1枚配置
store.addShape(createCardShape(myCardType, { x, y }));

// 既定デッキ（card-type の buildDeck() を使用）
store.addShape(createDeckShape(myCardType, { x, y }));

// 可変デッキ（TCG の構築済みデッキなど）: cards を明示的に渡す
store.addShape(
  createDeckShape(myTcgType, { x, y, cards: playerDeckList /* 先頭が山の一番上 */ }),
);
```

`cards` は任意の配列なので、固定構成だけでなく**プレイヤーが組んだ山（TCG）**も表現できます。
ドロー（ダブルクリック）/シャッフル（Shift+S）はこの配列に対して動きます。

## オプション

```ts
createCardPlugin({
  cardTypes,                         // 追加 card-type
  placementAnimation: { preset: "drop" }, // 既定の配置アニメ（card-type 個別指定が優先）
  enableDeck: true,                  // デッキ機構の ON/OFF（既定 true）
  userId: "u1",                      // 手札のローカル保持キー（既定 "local"）
  boardId: "board-123",              // 手札の localStorage キーを board 単位に分ける（任意）
  wsProvider,                        // 手札“枚数”共有用の awareness（任意。中身は共有しない）
  legacyDoubleClickActions: false,   // 旧ダブルクリック flip/ドロー（既定 false = 操作メニューに一本化）
});
```

配置アニメは次のいずれか：
- プリセット `{ preset: "deal" | "drop" | "bounce" | "none" }`
- **Slam（ドン！）** `{ preset: "slam-light" | "slam-medium" | "slam-heavy" }` — 重みのある着地。
  **一瞬持ち上がってから加速して着地（ズドン）**し、衝撃リング + 全周への放射状飛沫がカードの外側に弾ける。
  **重いほど大きく・ゆっくり**（light < medium < heavy）。
  組込例では playing-card = `slam-medium`、uno = `slam-heavy`。
- 独自 `{ keyframes: string; durationMs: number; easing?: string }`

> Slam の見た目・重み3段階は Claude Design の「Card Animations」ショーケース（Slam Place）を移植したもの。
> ドロップ/移動（`shapes:move-end`）/ドロー時に、配置点を中心とした一発の衝撃エフェクトとして再生される。

## アーキテクチャ

- データモデルは `ShapeData<CardMeta>` / `ShapeData<DeckMeta>` の **generic（meta）** 方式。
- 単一 `card` shape type + `meta.cardType` ディスクリミネータ + 内部 card-type レジストリ。
- 配置アニメは `ctx.transient`（ripple と同じ transient レイヤー）で実装。
- 山札は card データ配列を保持する**データパイル方式**（枚数分の shape を作らない）。

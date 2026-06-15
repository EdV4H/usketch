# @edv4h/usketch-plugin-shape-card

トランプ・UNO・メディアカード等を表現できる **card-type 拡張ポイント**を持つカードシェイプ・プラグイン。
カードは表/裏を持ち、**ダブルクリックで裏返し（flip）**でき、**配置時アニメーション**と
**デッキ（山札）機構**を備える。

## 使い方

```ts
import { createCardPlugin } from "@edv4h/usketch-plugin-shape-card";

createApp({
  plugins: [
    // ...
    createCardPlugin(),
  ],
});
```

ツール:
- `card-draw`（ショートカット `k`）— カードを描画。ドラッグでサイズ（アスペクト比固定）、クリックで既定サイズ。
- `card-deck-draw` — 山札を配置。

インタラクション:
- カードを**ダブルクリック**で裏返し（0.4s の 3D フリップ）。
- 山札を**ダブルクリック**で1枚ドロー（最前面に配置）。
- 山札を選択して **Shift+S** でシャッフル。
- カード/山札はアスペクト比を保ったままのみリサイズ可能。

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

組込 card-type: `media` / `playing-card` / `uno`（`BUILTIN_CARD_TYPES`）。

## オプション

```ts
createCardPlugin({
  cardTypes,                         // 追加 card-type
  placementAnimation: { preset: "drop" }, // 既定の配置アニメ（card-type 個別指定が優先）
  enableDeck: true,                  // デッキ機構の ON/OFF（既定 true）
});
```

配置アニメは `{ preset: "deal" | "drop" | "bounce" | "none" }` か、独自の
`{ keyframes: string; durationMs: number; easing?: string }` を指定できる。

## アーキテクチャ

- データモデルは `ShapeData<CardMeta>` / `ShapeData<DeckMeta>` の **generic（meta）** 方式。
- 単一 `card` shape type + `meta.cardType` ディスクリミネータ + 内部 card-type レジストリ。
- 配置アニメは `ctx.transient`（ripple と同じ transient レイヤー）で実装。
- 山札は card データ配列を保持する**データパイル方式**（枚数分の shape を作らない）。

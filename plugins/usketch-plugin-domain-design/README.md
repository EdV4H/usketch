# @edv4h/usketch-plugin-domain-design

uSketch 上で **DDD（ドメイン駆動設計）の戦略 / 戦術モデリング図** を描くためのプラグイン。

## 提供する shape

戦略レベル:

- `domain-bounded-context` — Bounded Context 枠（チーム名 / Core Domain 区分）
- `domain-context-map-connector` — ContextMap 関係 connector（Customer/Supplier、ACL、Conformist など）

戦術レベル:

- `domain-aggregate` — Aggregate Root を表す丸枠
- `domain-class-box` — Entity / ValueObject / Service / Repository / DomainEvent / Factory のクラスボックス
- `domain-tactical-connector` — クラス間の関係矢印（inheritance / composition / association ほか）

## 提供する tool

- `domain-draw` — 上記 shape を切り替えながら描画するツール（ショートカット: `d`）

## ドメイン固有データの保持

このプラグインは **`ShapeData<TMeta>` の `meta` フィールド** に DDD 固有のデータ（クラス名、属性、コンテキスト名、関係種別など）を保持する。
core ShapeData の geometry / style とは分離されているため、core ロジックに DDD 知識が漏れない。

```typescript
interface ClassBoxMeta {
  className: string;
  stereotype: "Entity" | "ValueObject" | "Service" | "Repository" | "DomainEvent" | "Factory";
  attributes: string[];
  methods: string[];
}
type ClassBoxShape = ShapeData<ClassBoxMeta>;
```

## インライン編集

ClassBox / Aggregate / BoundedContext はダブルクリックでインライン編集できる。
ClassBox は「クラス名 / 属性 / メソッド」の 3 セクション、Aggregate / BoundedContext はタイトル 1 行編集。
編集確定（blur / Enter）で `meta` が更新され、undo / redo に対応する。

## 使い方

```typescript
import { domainDesignPlugin } from "@edv4h/usketch-plugin-domain-design";

createApp({
  plugins: [/* ..., */ domainDesignPlugin],
});
```

詳しくは [ドメイン設計プラグインのガイド](https://edv4h.github.io/usketch/docs/guides/domain-design-plugin/) を参照。

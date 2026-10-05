# @edv4h/usketch-plugin-sync-localstorage-yjs

Yjs を使ったローカル永続化プラグイン。

> **注意（名称）**: パッケージ名は `sync-localstorage-yjs` ですが、**実体は
> `localStorage` ではなく IndexedDB（[`y-indexeddb`](https://github.com/yjs/y-indexeddb)）**
> による永続化です。ブラウザを閉じても Y.Doc の内容が IndexedDB に残り、次回ロード時に復元されます。

## 使い方

```ts
import { createSyncLocalstorageYjsPlugin } from "@edv4h/usketch-plugin-sync-localstorage-yjs";

// 既定（IndexedDB doc 名 "usketch-default"）
createSyncLocalstorageYjsPlugin();

// ボード単位でキーを分ける（複数ボードで IndexedDB が衝突しない）
createSyncLocalstorageYjsPlugin({ docName: "board-123" });

// 既存の Y.Doc に IndexedDB 永続化を後付けする（下記参照）
createSyncLocalstorageYjsPlugin({ docName: "board-123", doc: hostDoc });
```

## オプション

```ts
interface SyncLocalstorageYjsOptions {
  /**
   * IndexedDB のドキュメント名。ボード単位のキーに使える。
   * 値でも getter (() => string) でも可。省略時は "usketch-default"（後方互換）。
   */
  docName?: string | (() => string);
  /**
   * 永続化を後付けする既存 Y.Doc。未指定なら内部で新規 doc を生成する。
   */
  doc?: Y.Doc;
}
```

### 複数ボード

`docName` を省略すると全ボードが同一の IndexedDB doc（`"usketch-default"`）に書き込むため、
複数ボードを開くアプリでは衝突します。**ボードごとに `docName` を分けてください**。

### 既存 Y.Doc への後付け（ネットワーク同期との共存）

ホストが `y-websocket` などのネットワーク provider に接続済みの `Y.Doc` を持っている場合、
その doc をそのまま渡すと、**同一 doc に IndexedDB 永続化を足せます**。

```ts
const hostDoc = new Y.Doc();
new WebsocketProvider(url, room, hostDoc); // ネットワーク同期
createSyncLocalstorageYjsPlugin({ docName: room, doc: hostDoc }); // ローカル永続化を後付け
```

- CRDT なので IndexedDB とネットワークの両 provider が同じ doc に共存でき、
  オフライン編集 → リロード → IndexedDB から復元 → 再接続でサーバとマージされます。
- 渡した doc は**ホスト所有**として扱われ、プラグインの teardown（`destroy()`）では
  **破棄されません**（IndexedDB provider のみ破棄）。doc のライフサイクルはホストが管理します。
- 未指定時は従来どおりプラグインが内部で `new Y.Doc()` を生成し、teardown で破棄します。

## シェイプの格納構造（外部 doc を渡す場合の前提）

このプラグインはシェイプを **Y.Doc の `getMap("shapes")`** に、シェイプ ID をキー・
プレーンオブジェクト化したシェイプを値として格納します（パーティションは `getMap(partitionName)`）。
外部 doc を渡す場合は、ホスト側も**同じ map 名 `"shapes"`** を使っている必要があります。
（現状 map 名は固定です。可変化が必要なら Issue でご相談ください。）

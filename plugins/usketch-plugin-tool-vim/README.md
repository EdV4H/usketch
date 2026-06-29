# @edv4h/usketch-plugin-tool-vim

uSketch にVim ライクなキーボード操作を追加するツールプラグイン。XState 5 のステートマシンで
`normal` / `insert` / `visual` / `command` モードを管理する。ステータスライン・カーソル・候補表示・
which-key ヘルプはすべてプラグインが**自前のレイヤーとして描画**するため、ホストアプリは UI を追加
する必要がない。

## 使い方

```ts
import { createVimToolPlugin } from "@edv4h/usketch-plugin-tool-vim";

const plugins = [
  // ...他のプラグイン
  createVimToolPlugin({
    cursorStep: 20,
    shapeMap: {
      rect: { type: "rectangle", width: 120, height: 80 },
      note: { type: "sticky", meta: { stickyColor: "#fef08a" } },
    },
  }),
];
```

ツール ID は `vim`。`store.setActiveToolId("vim")` でアクティブにすると、capture フェーズの
keydown リスナがキー入力を奪い、ステートマシンへ送る。

## モードと操作

### normal
| キー | 動作 |
| --- | --- |
| `h j k l` | 論理カーソル移動（`5j` のように回数指定可） |
| `H J K L` | 画角を移動（pan） |
| `i` | insert モードへ |
| `v` / `V` | visual / 複数選択 |
| `:` | command モードへ |
| `x` / `d` | 削除（選択 or カーソル最近傍） |
| `y` / `p` | ヤンク / 貼り付け |
| `u` / `Ctrl+r` | undo / redo |
| `+` / `-` | ズーム、`zz` ビューをカーソルへ寄せる |
| `M` | カーソルを画面中央へ（`:center` でも可） |
| `f` | hop: shape にラベルを表示し、入力でジャンプ |
| `gg` / `G` | 最初 / 最後の shape へ |
| `m{a-z}` / `` `{a-z} `` | マーク設定 / ジャンプ |
| `?` | which-key ヘルプ表示切替 |

### hop（ラベルジャンプ）
`f` で全 shape にラベル（`hopKeys` の文字）が表示される。ラベルを入力するとカーソルがその shape
中心へ一気にジャンプする。shape 数が多いと自動で2文字ラベルになり、2打で確定。`Esc` で取消。

### insert
文字列を入力すると `shapeMap`（明示）と shape レジストリ（自動補完）から候補が絞り込まれ、
カーソル位置にゴーストが表示される。`Tab` で候補切替、`Enter` で確定、`Esc` で normal へ。

### visual
入った瞬間カーソル最近傍の shape が選択される。`hjkl` で方向最近傍へ選択を移動。`V` で複数選択
（`hjkl` で選択を追加）。`d`/`x` 削除、`y` ヤンク、`Esc` で解除。

### command
`:q`（Vim 終了）、`:tool <id>`、`:set bg=dots|grid|none`、`:zoom <n>`、`:export <fmt>`、`:help`。

## 設定

`createVimToolPlugin(config)` の第1引数は Zod で検証される（`VimConfigSchema`）。`shapeMap` と
`keymap` は既定値とマージされ、それ以外のスカラ値は上書きされる。

## 拡張（独自コマンド / キーバインド）

関数は JSON 化できないため、`config`（JSON可）とは分離した**第2引数 `extensions`** で渡す。

```ts
import { createVimToolPlugin, type VimExtensions } from "@edv4h/usketch-plugin-tool-vim";

const extensions: VimExtensions = {
  // 独自 ex コマンド（:deploy）。組み込みより優先。戻り値はステータスラインに表示。
  commands: {
    deploy: (args, api) => {
      api.store.addShape(/* ... */);
      return `deployed ${args[0] ?? ""}`;
    },
  },
  // キー → 独自関数（モード別）。組み込みキーマップより優先（全モードで最優先）。
  bindings: {
    normal: {
      D: (api) => api.commands.execute(/* ... */),
      o: (api) => api.setMode("insert"),
    },
  },
};

createVimToolPlugin({ cursorStep: 20 }, extensions);
```

ハンドラに渡る `api`（`VimApi`）でできること:

- `store` / `shapes` / `commands` / `events` — 実サービスへの直接アクセス
- `getCursor()` / `setCursor(p)` — 論理カーソルの取得・移動
- `getMode()` / `setMode(mode)` — モードの取得・切替
- `getSelection()` — 選択中 shape ID
- `message(msg)` — ステータスラインへのメッセージ表示

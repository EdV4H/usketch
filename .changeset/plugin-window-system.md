---
"@edv4h/usketch-plugin-window-system": minor
"@edv4h/usketch-web": patch
---

feat(window-system): Canvas をブラウザ常駐のウィンドウシステムにするプラグインを追加

`@edv4h/usketch-plugin-window-system` を新規追加。トップレベル shape を「ウィンドウ」として扱い、
2 つの責務を持つ:

- **画角固定 (viewport lock)** — カメラを 100% / 原点に固定し Canvas を固定スクリーン化。
- **配置モード切替** — 自由配置 (`free`) ⇄ タイル (`tile`, **i3 / sway 風ツリー**)。

タイルは固定スクリーン矩形を n-ary の split コンテナ（`h`/`v`）＋ leaf の木で再帰分割する純粋な
モデル（`tile-tree.ts`）で、木は config shape に JSON 永続化するため同期（Yjs）と Undo は shape 経由で
無料。各操作（`focus`/`move`/`split`/`resize`/`fullscreen`/`retile` ほか）は **イベント emit ＋ HUD
ボタン ＋ キーボードショートカット ＋ サービス API** の 4 経路で公開し、キーボード操作可能にした。

- フォーカスは算出矩形で隣を選ぶ**幾何的**移動で、木構造から独立して堅牢。
- ショートカット既定はクロスプラットフォームで安全な矢印ベース（フォーカス=`Alt+矢印`、
  移動=`Alt+Shift+矢印`）。共有レジストリが `event.key` で照合し macOS で Option+英字が別文字へ
  合成されるため、英字系は既定を持たず `shortcuts` オプションで任意に割当/無効化できる。
- `createWindowSystemPlugin(options?)`（`autoEnable`/`mode`/`viewportLock`/`gap`/`defaultSplit`/
  `shortcuts`）。既定 `autoEnable:false`（メインボードを勝手に変換しない、HUD「ウィンドウ化」で opt-in）。
- apps/web に `autoEnable:false` で登録（dashboard と同じく container/free-position の後）。

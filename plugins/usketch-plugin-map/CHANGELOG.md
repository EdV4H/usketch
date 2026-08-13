# @edv4h/usketch-plugin-map

## 0.10.0

### Minor Changes

- a1de384: feat(map)!: world-layer icons are now GRID DATA on the tilemap, not free shapes (#955)

  Placed map icons and base beacons are unified into the tilemap's cell-grid model
  (the same island pattern as terrain), so the generic Select tool can't touch the
  world layer — there are no shapes to grab — while the Map tool edits it directly.
  - Icons live on `TileMapShapeData.icons` (`cellKey → iconKey`, one per cell). The
    Map tool's **stamp** writes a cell and **eraser** removes it (icons take priority
    over terrain). They render via the new `MapIconGridLayer` (order 44: above
    terrain/base, below host resource shapes). Persist / sync / undo for free.
  - Base beacons are now **cells**: `BaseInfo.beaconCell` (`cellKey`) replaces
    `beaconIconId`. Base mode sets the beacon at the clicked cell; territory + the
    radius ring derive from the cell centre.

  **BREAKING** (clean break — no data migration; pre-1.0):
  - The `map-icon` shape type is **removed**: `MAP_ICON_TYPE`, `MapIconShapeData`,
    `makeMapIcon`, and the shape definition no longer exist / are no longer exported.
    Old boards' free `map-icon` shapes are ignored (not rendered). Hosts wanting
    freely-movable markers should use their own shape type.
  - `BaseInfo.beaconIconId` and `MapIconShapeData.meta.baseId` are gone; existing
    bases without a `beaconCell` have no territory until a beacon is re-placed.
  - New: `renderIconAt(iconKey, col, row, tile)` exported for drawing a grid icon.

## 0.9.0

### Minor Changes

- 5e301c0: map: ホスト向け `MapApi` サービスを追加（`getMapApi(app.services)` / #927・#946 の一般化）

  これまで #927（tool-state）・#946（無限地形）で場当たりに export していたホスト向け操作を、
  `defineService` の標準シームに集約。プラグインが `setup` で `mapService.provide(ctx.services, createMapApi(ctx.store))`
  し、ホストは `getMapApi(app.services)?.enableInfiniteTerrain({ seed })` のように、個別 export 名も
  store も知らずに駆動できる（プラグイン不在なら `undefined`）。

  `MapApi` は store バインド済みの無限地形操作（enable/disable/get/set/isEnabled）＋ reactive
  stores（`toolState` / `renderConfig`）を公開。既存の関数/ストア export は後方互換で維持。これが
  「操作ロジックは純関数、HUD はそれを呼ぶだけ、ホスト向けは service で公開」規約の参照実装。

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-store@3.5.3

## 0.8.0

### Minor Changes

- 96777bd: map: 無限ベース地形を HUD 以外から制御できる公開 API（#946 / #937 follow-up）

  `#937` の無限ベース地形（`tilemap.baseSeed`）を、Control HUD の「無限地形」トグルに依存せず
  **ホスト独自 UI から enable/disable/seed** できるようにする公開 API を追加。seed は shape に載る
  同期状態なので、`renderConfigStore` のような module-scoped store ではなく **`BoardStore` を受け取る
  関数**として提供する。HUD のトグルもこの API を呼ぶよう変更し、実装を一本化。
  - `infinite-terrain.ts`: `enableInfiniteTerrain(store, { seed?, tile? })` / `disableInfiniteTerrain(store)` /
    `getInfiniteSeed(store)` / `isInfiniteTerrainEnabled(store)` / `setInfiniteSeed(store, seed|null)` /
    `DEFAULT_INFINITE_SEED`。HUD と同じロジック（seededTilemap ?? lowestTilemap ?? 生成、`baseGen` 凍結、
    seed 整数丸め、決定論的ターゲット選択）。
  - `use-infinite-terrain.ts`: `useInfiniteTerrain(store)` — reactive な `seed`＋`enable/disable/setSeed`
    を返す React hook（issue の option 1 の使い勝手）。shape 変更のみ購読（pan/zoom では再描画しない）。
  - index から re-export: 上記 API に加え、issue が挙げた `seededTilemap` / `lowestTilemap` / `isTileMap` /
    `makeTileMap` / `resolveTilemap` / `DEFAULT_BASE_GEN` / `baseTerrainAt` / `BaseGenParams`。
  - 公開 API の単体テストを追加。

## 0.7.0

### Minor Changes

- 3de7408: map: 無限・手続き生成のベース地形（チャンク読み込み Phase 1 / #926）

  ワールドマップを**実質無限**にする最初の段階。未設定セルを、seed とワールド座標の
  **決定論的な純関数** `baseTerrainAt(seed, col, row)` で埋める。関数はどの座標でも定義され、
  連続ノイズを world 座標でサンプルするため、**チャンク境界でシームレス**・**保存不要**
  （未編集の地形は seed から再生成でき、無限に広げてもデータが増えない）。編集した差分は
  従来どおりスパースな override として shape に残る。
  - 新規 `base-terrain.ts`: `baseTerrainAt`（固定グローバル閾値で band 分類）＋チャンク単位の
    LRU キャッシュ＋`makeTerrainSampler`（override ?? base）。
  - `map-layer.tsx`: 無限ベース描画パス（可視セル範囲のみ描画＝O(visible)、full/coarse 両対応、
    オートタイルは総関数 sampler 経由でチャンク境界の破綻なし）。空ボードでも描画。
  - `tilemap-shape.ts`: `baseSeed?: number` を `tilemap` shape に追加。seed は**アプリローカルな
    render config ではなく shape（同期・永続対象）に持つ**ので、生成した世界は**リロードしても
    消えず、ボード上の全員に同期**される。
  - `tilemap-shape.ts`: `baseGen?: BaseGenParams`（`version`＋`scale`/`seaLevel`/`gMin`/`gMax`）を
    shape に記録し、**生成契約を凍結**。既定値をチューニングしたりアルゴリズムを差し替えても、
    既存ボードは自分が生成された時のパラメータで描かれ続ける（未設定＝v1 として `resolveBaseGen`
    でフォールバック）。`baseTerrainAt`/`makeTerrainSampler` はこの params 駆動に変更。
  - HUD「RPG マップ」の **「無限地形」トグル＋「シード」** は tilemap shape の `baseSeed`＋`baseGen`
    を読み書きする（無ければ空 tilemap を生成して stamp）。
  - 決定論・分布・sampler・パラメータ凍結（`baseGen`）の単体テスト。

  後続（Phase 2/3）で、編集差分のチャンク shape 化（独立同期）／サーバー空間ストリーミングを予定。

- 3ec0a5c: map: 領域塗り／塗りつぶしを無限ベース地形に対応（sampler ベース＋上限で安全化）

  無限ベース地形（`baseSeed`）が有効なとき、塗りつぶし／領域塗りが**未編集セルの見た目どおりの
  地形（sampler = override ?? base）**を対象に flood するようになった。従来はスパースな override
  （`cells`）だけを見ていたため、生成された地形の上ではまともに塗れなかった。
  - 新規 `samplerFloodFill(sample, startCol, startRow, maxCells)`（`autotile.ts`）: サンプラ上を
    **幅優先**で flood。無限に連結しうるので `maxCells`（8192）で上限を設け、上限に達したら
    `truncated` を返す。
  - `map-tool` の `doFill` / `doRegionFill`: 無限ベースが有効なら sampler 経路を使い、**囲まれた
    領域（上限内で自然終了）はそのまま塗り、囲まれていない開けた地形（上限到達）は塗らずに中止**
    （`map:fill-aborted` イベントを発火）。有限ボードの従来挙動は不変。
  - 単体テスト（enclosed 充填・open 打ち切り・BFS・sampled 地形の尊重）を追加。

  後続: 中止時のユーザー通知（HUD トースト）と、`emptyTerrain`（無限の海）モードへの拡張。

## 0.6.0

### Minor Changes

- 091ef4a: map: ツール状態の公開 reactive store を export（#927）— ホスト独自 UI から mode/terrain/icon を駆動可能に

  Control HUD（`debug-hud`）以外の UI（ActionRing / ラジアルメニュー / 独自ツールバー等）から
  マップツールの状態を切り替えられるよう、内部の app-local reactive store を公開した。
  `renderConfigStore` と同じ「public reactive store（get/set/subscribe）」パターンで一貫。

  追加 export（`@edv4h/usketch-plugin-map`）:
  - `toolStateStore` ＋ `type MapToolState` ＋ `useMapToolState()` — mode / terrain / iconKey / excludeTerrains
  - `MAP_MODES`（`brush|eraser|fill|region|stamp|generate|base` の順序付き配列。`MapMode` はこれから派生）
  - `rangeEraseStore` ＋ `type RangeEraseTargets` ＋ `useRangeEraseTargets()`
  - `genStateStore` ＋ `type GenState` / `type WorldRect` ＋ `useGenState()`
  - `baseStateStore` ＋ `type BaseToolState` ＋ `useBaseState()`
  - `type ReactiveStore`（各 store の共通インターフェース）

  既に export 済みの `TERRAINS` / `ICONS` / `MAP_MODES` と組み合わせて、ホストが Control HUD に
  依存しないツール切替 UI を実装できる。いずれも同期対象外（presentation/interaction state）。

## 0.5.2

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-store@3.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-store@3.5.1

## 0.5.0

### Minor Changes

- 1014b79: 拠点をレジストリごと削除する「アクティブ拠点を削除」アクションを HUD に追加。アクティブ拠点を選んで実行すると、その拠点が一覧から消え領地も消える（ビーコンアイコンの `meta.baseId` も解除、アイコン自体は残す）。undo 可能。`deleteBase(deps, baseId)` を base-ops に追加。
- 9be5be3: 拠点テリトリーを「ビーコン派生」モデルに作り直し。各拠点はビーコン（map-icon）を1つ持ち、テリトリーは保存値ではなく **派生値** として計算する:
  - ビーコン中心から **半径内のコア円は塗りに関係なく常に領地**。
  - コアに **4連結した「塗られたマス」も領地**（連結していない塗りマスは無効）。
  - 拡張は **除外地形（例: 海）を壁として通さない**。
  - 2拠点が競合する塗りマスは **最近傍ビーコン** が取得。

  派生は `cells` の同一性＋ビーコン署名でメモ化（`WeakMap`）し、地形塗り commit / ビーコン移動・半径変更時のみ再計算。ビーコンを動かす・半径を変える・地形を塗ると**自動追従**する。owner を同期しないため各クライアントで決定的。

  破壊的変更: 手動の拠点ブラシ（割り当て/消す/島に割当）と `base-map.owner` フィールドを**廃止**（旧保存データの領地は失われる）。範囲消去の「拠点」対象も撤去（地形のみ）。`@edv4h/usketch-plugin-map` の `OwnerMap` を撤去し `Territory` / `computeTerritory` を追加、`BaseInfo` に `radius` / `beaconIconId` を追加。#847 の一発コマンド（`assignRadiusFromIcon`）を本モデルで置換。

- 294a5e8: 拠点ツールに「アイコン中心」モードを追加。map-icon をクリックすると、その中心から指定半径（マス）内のタイルをアクティブ拠点の領地として一括で塗る（1 操作 = 1 undo）。除外地形（例: 海）をグローバル設定でき、除外マスや空きマス（emptyTerrain）は領地から外れる。半径はアイコンごとに設定でき（クリック時の半径がアイコンに記録される）、base モードではビーコンアイコンに半径リングを表示する。
- faba3c7: 拠点テリトリーを「手塗り連結」モデルに変更。コア（半径内）は塗りに関係なく常時エリア。加えて、**ユーザーが手で塗ったマス**（ブラシ/塗りつぶし/領域塗り）が拠点コアに連結していればエリアに（半径上限なし）。**自動生成された地形は拡張に使わない**ため、生成した大陸をビーコン設置しただけで丸ごと取られることがなくなる。海・除外地形は壁。

  tilemap に手塗りセルの記録 `handPaint` を追加（生成はこれを設定しない／上書き時はクリア）。territory の拡張は `handPaint` かつ非除外セルのみを通す。

- 49f0043: 拠点テリトリーを「半径内＋連結した陸」に限定するよう変更。従来は連結した塗り陸が半径を超えて島全体まで広がったが、**ビーコンから半径マス以内で、かつビーコンに連結した塗り陸だけ**を領地にする（海・除外地形は壁、半径外は切り捨て、ビーコンのセルは常にシード）。radius が拡張距離の上限として機能し、繋がった大陸全体を占有しなくなる。

### Patch Changes

- e5b276f: 拠点モードでアイコンをクリックしたとき、アクティブ拠点が無いと無反応だった問題を改善。拠点が無ければ**自動で1つ作成してアクティブにし**、そのアイコンをビーコンに設定する（1クリックで領地が出る）。任意の map-icon がビーコンになる。
- 865ed69: 拠点テリトリーの拡張が `emptyTerrain`（例: 海）のフォールバックを通ってしまい、未塗りの空マスまで「塗られている」扱いで連結が無限に広がる不具合を修正。拡張は**実際に塗られたマス**（tilemap.cells に存在するセル）のみを通すようにした。これによりビーコン設定時にテリトリーが表示されない/固まる問題を解消。`computeTerritory` の `empty` 引数を撤去。

## 0.4.0

### Minor Changes

- 733df55: 各プラグインの独自 UI を Control HUD（`ctx.actions` / `ctx.hud.registerSettings`）へ移行し、オンキャンバスの独自コントロールを削減。
  - map: `MapPalette` / `RangeErasePalette` を撤去し、モード・地形・アイコン・領域塗りの除外・生成・拠点・範囲消去対象を HUD の settings/actions に移行（`registerMapHud`）。マップツールのキャンバス操作は不変。
  - reactions: 絵文字選択を HUD action 化（数字キーは維持）。
  - voting: 「投票を作成」を HUD の param-form action に。
  - shape-group: グループ化/解除を HUD action に（選択状態で活性、ショートカット維持）。
  - canvas-filter: 常設インジケータを撤去し、フィルタ設定を開く/解除/タイムトラベル終了を HUD action に。
  - avatar: ツール切替と重複するラジアルメニューを撤去（ツール切替は HUD のツール一覧に一本化）。アバター描画は不変。

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0

## 0.3.0

### Minor Changes

- 58198c5: マップパレットに「領域塗り」モードを追加。クリックした地点と同じ地形で繋がっている連結領域を、選択した地形で一括塗りする。パレットで「除外」地形（複数選択可）を指定でき、除外した地形のセルは塗り替えられず保護される（除外地形をクリックしても無効）。1 操作 = 1 undo。
- ce0864b: 「チーム」機能を「拠点」に全面改名。UI 表記だけでなく内部識別子も刷新した（shape 型 `team-map`→`base-map`、`TeamMapShapeData`→`BaseMapShapeData`、`TeamInfo`→`BaseInfo`、`teamStateStore`→`baseStateStore`、マップツールの `team` サブモード→`base` など）。

  破壊的変更: 旧 `team-map` 型で保存済みの拠点データは読み込まれなくなる（shape 型が変わるため）。`@edv4h/usketch-plugin-map` から re-export していた `TeamInfo` / `TeamMapShapeData` などの型名も変更。

### Patch Changes

- f8a3669: マップパレット／範囲消去パレットのクリックがキャンバスに貫通し、パネル操作時に意図しない地形・アイコンが追加されてしまう不具合を修正。パネルの pointer イベントの伝播を止め、アクティブツールが発火しないようにした（他プラグインの UI オーバーレイと同じ規約）。
- 24c6159: 範囲消去ツールを map ツールの左パレット（モード行）からも起動できるように。「範囲消去」チップを押すと範囲消去ツールに切り替わる。範囲消去パレットには「← マップツールへ」ボタンを追加し、キーボード無しで相互に行き来できる。
- 7d84d7b: チームの陣地色塗り（TeamAreaLayer）をチームモード時だけ表示するように変更。入場バナー（EnterBanner）と同じく `map ツール + team サブモード` のときのみ描画し、他モードでは地図がすっきり見えるようにした。
- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-store@3.4.1

## 0.2.0

### Minor Changes

- 4090179: RPG マップ・タイルペイントプラグイン `@edv4h/usketch-plugin-map` を新規追加。

  デザイン「手描きRPGマップ・素材」の語彙を uSketch の layer/shape/tool 機構に実装:
  - **地形タイルペイント**: 12 種の地形（草原/森/水辺/砂漠/山/道/雪原/沼地/溶岩/石床/畑/花畑）を
    40×40 グリッドにブラシで塗る。外周（辺）が一段濃くなるオートタイル。ブラシ / 消しゴム / 塗りつぶし。
  - **アイコン 36 種**（ランドマーク12・オブジェクト12・マーカー12）をパレットから選んでスタンプ配置。
  - **Tweaks**: カラフル⇔モノクロ、揺らぎ線⇔クリーン線、線の太さ（パレット＋Control HUD 両対応）。

  アーキテクチャ: 地形の描画は専用 **MapLayer**（全 shape の背面）、地形データは data-only の
  `tilemap` shape に保持（shape ストア経由で Yjs 同期・Undo が無料。`island` と同じ
  「データは shape・描画は layer」パターン）。アイコンは通常の選択可能な `map-icon` shape。
  SVG 素材は `dangerouslySetInnerHTML` 不使用（パース済みノード木を React で描画）。

  community ページ（ワールドマップ空間）の基本プラグインに組み込み（`createMapPlugin()`）。
  ツール `map`（ショートカット `m`、アバターのラジアルメニューにも表示）。

- d8daaaa: 空きマス（未設定タイル）の扱いを設定可能に。`createMapPlugin({ emptyTerrain: "water" })` オプション、または Control HUD の「空きマス」設定で、未ペイント/画面外のマスを指定地形（例: 海）として**描画＋判定**できる。null（既定）は従来どおり透明。`terrainAtCell(cells, col, row, empty?)` ヘルパで「未設定なら fallback 地形」を取得できる。
- c7f0499: マップ生成に「島（海に囲まれた1つの島）」ジェネレータを追加。

  標高に**乗算の放射状マスク**（box 中心で 1、辺で 0）を掛けることで、外周が必ず海になる
  単一の島を生成する。パラメータは 地形の細かさ / 海面 / 島の大きさ（大きいほど陸が縁に近づく）。
  既存の「群島（islands）」は縁フォールオフで複数島、「島（island）」は 1 つの島を海が完全に囲む点が異なる。

- 0fd371a: マップ生成機能を追加（アルゴリズムを選んで地形を自動生成）。
  - **拡張可能な Generator レジストリ**（`GENERATORS`）。ビルトイン 2 種:
    - `noise`（大陸）: value-noise fBm 標高 → 水/砂/草/森/山/雪のバンド。
    - `islands`（群島）: 縁フォールオフで水に囲まれた複数島（将来のコミュニティグループ化の土台）。
  - **展開範囲**: 「生成」モードで**キャンバスをドラッグ→矩形範囲**に生成、または**「ビュー全体に生成」**（無限キャンバスのため "全体" = 現在のビュー可視範囲）。範囲は最大 256×256 セルにクランプ。
  - **シード＋パラメータ**: シード入力＋🎲（新シード）＋「再生成」（同一シード/パラメータで直前範囲へ再適用）。海面・細かさ・島らしさをスライダー調整。決定論的（同 seed → 同マップ）。
  - 生成は既存 `tilemap` shape の対象ボックス内を置換し、**1 生成 = 1 undoable コマンド**（既存の shape ストア経由で Yjs 同期・Undo）。
  - 生成器は seeded PRNG（mulberry32）＋外部依存なしの value-noise。単体テスト（決定論・被覆・海面/フォールオフ）を追加。

- 46f4dfc: map ツールに「範囲消去」モードを追加。ドラッグした矩形範囲の地形タイルを一括削除できる（生成の範囲ドラッグと対の操作）。破線プレビュー付き、1 操作 = 1 undoable コマンド。範囲外・空セルは無変更。
- 57a6489: MapLayer（地形タイル）に LOD（Level of Detail）を追加。

  画面上のタイルサイズ（`tile × zoom` px）と全体の `renderMode` に応じて段階的に簡略化し、
  ズームアウトや大きなマップでの描画コスト（SVG ノード数・pattern/filter）を抑える:
  - **full**（14px/tile 以上）: pattern＋オートタイル外周strip＋セル境界＋揺らぎ filter（従来）。
  - **mid**（6px 以上）: pattern 塗りのみ（strip/境界/揺らぎなし）。
  - **low**（6px 未満）: 単色塗り＋セルを N×N ブロックに**ダウンサンプル（多数決）**して DOM ノードを削減。

  グローバル `renderMode === "lod"` のときは最大でも mid に制限。pure ロジック（tier 判定・
  ブロック係数・ダウンサンプル）に単体テストを追加。

- 75f2fd2: 範囲消去ツールに「消す対象」の選択（複数選択）を追加。ツール起動中に表示される小パレットで **地形 / チーム** を個別に ON/OFF でき、ドラッグした範囲では選んだ対象だけを消去する（例: チームのみ ON なら地形は残してチームエリアだけ範囲削除）。既定は両方 ON。どちらも OFF なら no-op。
- 2bdecbb: 「範囲消去」を map ツールのモードから**独立したツール**に分離。アバターのラジアルメニューに別項目として並び、ショートカット `x` で起動できる。ドラッグした矩形範囲の地形＋チーム所有をまとめて消去（1 操作 = 1 undo）。共通ロジックは `range-erase.ts` に切り出し。
- b743adf: チームのエリア機能を追加（タイルベース所有＋RPG 風の入場演出）。

  community のワールドマップ上で、各チームが持つエリアをタイルで指定し、そこに入ると分かるようにする。認証チーム機構が無いため **完全に client-side（Yjs 同期の shape）** で実装。
  - **チーム** = 地図上で作る名前付きグループ（色付き）。data-only の `team-map` shape に `teams`（レジストリ）と `owner`（cellKey→teamId の疎マップ）を集約し同期・Undo。
  - **エリア指定** = map ツールの「チーム」モードで、割り当て/消すブラシでタイル所有を塗る＋**島に割当**（tilemap の連結 land を flood-fill で一括割当）。1 操作 = 1 undoable コマンド。
  - **描画** = `TeamAreaLayer`（地形の上・shape の下、order 42）が半透明の陣地色＋国境枠＋チーム名ラベルを描画。terrain と同じ LOD（tier/ブロック統合）＋可視カリング。
  - **入場演出** = 自分のビューポート中心が乗っているチームを監視し、入った瞬間に「⚔ ◯◯ のエリアに入った」バナー＋現在地チップを表示（ローカルのみ）。
  - 純ロジック（島 flood / 所有ルックアップ / ラベルアンカー）に単体テスト。

### Patch Changes

- c272dcf: emptyTerrain 設定時、空きマス（未設定タイル）にもタイルグリッド線を表示するよう修正。これまで空きマス背景は不透明な1枚塗りでグリッドが出ず、塗ったタイル（各セルの CELL_LINE）との間で格子の見え方が不一致だった。背景に同じ tile グリッドのパターンを重ねて揃える。
- 9399a4e: マップ生成: 初期値だとほぼ全面が海になる問題を修正。
  - 生成ごとに標高フィールドを実際の min/max で 0..1 に**コントラスト正規化**し、`seaLevel`
    が「海面の割合」として安定して効くように（raw fBm は 0.5 付近に密集し、しきい値が過敏で
    少しの海面上昇で全面海になっていた）。
  - 既定海面を引き下げ（noise 0.38→0.30、islands 0.50→0.40、falloff 0.60→0.50）。
  - 既定パラメータで陸と海が必ず混在することを担保するテストを追加。

- 484e554: Map ツール内で配置済みアイコンを削除できるようにした。

  これまで削除は select ツール専用（`getActiveToolId() !== "select"` でガード）のため、
  Map ツール中はアイコンを消せなかった。消しゴムモードでアイコンをクリックすると、その
  アイコンを削除するようにした（地形セルは従来どおりドラッグで消去）。パレットに
  「アイコンはクリックで削除」のヒントを追加。select ツールに切り替えての削除も従来どおり可能。

- d8c0d09: Map タイル LOD の引き（ズームアウト）時のパフォーマンスを大幅改善。

  これまでの中間段（mid）はズームアウトしてもセルごとに SVG pattern 塗りを続けており、
  画面に大量のセルが入ると pattern 付き `<rect>` が数千〜数万個生成されて激重になっていた。
  - LOD を **full / coarse の2段**に整理:
    - **full**（画面上タイル ≥ 24px）: pattern＋外周strip＋揺らぎ。**可視セル範囲のみ**走査（O(可視)、O(全セル)でない）。
    - **coarse**（< 24px＝引き）: **pattern をやめて単色**、かつ**必ずブロック統合**（`ceil` で factor ≥ 2）。
      画面上のブロックサイズを ~24px に保つため、**描画ノード数が地図サイズ・ズームに依存せず頭打ち**に。
  - 揺らぎ filter は full のみ。global `renderMode === "lod"` は常に coarse。

- 5020834: 「範囲消去」でチームエリアも消せるように。ドラッグした矩形範囲内の地形タイルに加え、チーム所有（team-map の owner）も同じ範囲でまとめて削除する。地形＋チームを **1 操作 = 1 undoable コマンド**で消去（どちらも疎スキャンで、変更が無い方はコマンドに含めない）。
- 108d4be: チームの入場インジケーター（入場バナー＋「現在地: ◯◯」チップ）を、map ツールが「チーム」モードのときだけ表示するように変更。通常の地形編集・閲覧中は非表示になる。
- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0

---
"@edv4h/usketch-plugin-pdf-import": minor
---

PDF のペースト／ドロップで全ページを展開する新プラグインを追加。PDF 本体をアセットストアに 1 件だけ格納し、各ページは `pdf-page` シェイプとして `assetId` + ページ番号で参照する。ページは取り込み時にラスタライズせず、現在のズームに必要な解像度で pdf.js に描き直させるため、拡大しても劣化しない。描画幅は 2 の冪に量子化し、ドキュメントは全ページで共有（参照カウント）、同時描画は 3 件までに制限、描画済みビットマップは LRU で保持する。

ページを複数選択すると、Control HUD から 1 行に並ぶページ数を変えられる（アクション `pdf-import:set-columns` / `pdf-import:square-grid` と、現在の列数をライブ表示する設定 `pdf-import:grid`）。並べ替えは選択範囲の上端と水平中心を固定したまま（グリッドは下方向に伸びる）、ドキュメント順・ページ番号順に整列する。現在の列数はシェイプに保存せずページの位置から読み取るため、手で動かした後や同期後でも素直な値になる。操作ロジックは `BoardStore` を受け取る純関数（`createSetPdfColumnsCommand` / `getSelectedPdfColumns`）として公開し、ホスト向けには `defineService` のサービス `getPdfImportApi(ctx.services)`（`getSelectedColumns` / `setSelectedColumns` / `resetSelectedToSquareGrid`）として提供する。HUD の列数入力は打鍵ごとではなく入力が止まってから 1 回だけ並べ替える。

pdf.js のワーカーはホストが自前で配信し `workerSrc` で渡す（必須。CDN へのフォールバックはしない）。PDF は開けることとページサイズを確認してからアセットストアへアップロードする。サイズ上限は `maxSizeMB`（既定 50MB）と、アセットストアの `maxUploadBytes()`（既定の uploader のままなら 4MB）の小さい方。描画バッファは面積で上限をかける（`maxRenderPixels`、既定 800 万 px）。

グリッドが画面に収まらない場合はズームアウトして全体を表示する。取り込みも並べ替えも 1 操作 1 コマンドなので undo で戻せる（複数の PDF を一度に取り込んでも undo 1 回）。混在ペイロードの非 PDF ファイルは先に再ディスパッチして既存ハンドラに委譲し、PDF はそれらの右隣に並べる。

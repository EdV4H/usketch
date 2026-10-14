---
"@edv4h/usketch-plugin-presence-activity": minor
---

feat(presence-activity): awareness の `activity` に `motion`（キーフレーム列）を追加し、「カーソルが図形 A へ移動して選択し、B へ移動して編集する」といった連続した動きを 1 つの値で表せるようにした。カーソルと矩形選択はキーフレーム間を補間、`moves` で図形の移動をゴースト（移動前→移動後）として再生、`shapeIds` / `action` は次のキーフレームまで保持する。受け手は自分の時計で再生し（ピア間の時刻同期は不要）、最後のフレームを `activity` が消えるまで保持する。`prefers-reduced-motion` では最終フレームを即表示。純関数 `sampleMotion` / `normalizeMotion` / `motionDuration` と `createMotionClock` を公開し、`style.cursor` / `style.ghost` で再生中カーソルとゴーストの見た目を変えられる。`motion` を解釈しない旧クライアントは従来の `shapeIds` / `action`（最終状態）を表示する。

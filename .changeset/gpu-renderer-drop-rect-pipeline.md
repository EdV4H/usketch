---
"@edv4h/usketch-gpu-renderer": patch
---

どこからも使われていない矩形専用の描画パイプライン（`pipelines/rect-pipeline.ts`）と、そのシェーダー（`shaders/rect.ts`・`shaders/rect.wgsl`）を削除した。矩形と楕円は以前から `shape-sdf` パイプラインで描いており、描画は変わらない。パッケージから公開している API も変わらない。

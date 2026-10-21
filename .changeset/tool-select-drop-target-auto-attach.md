---
"@edv4h/usketch-plugin-tool-select": patch
---

図形をドラッグ中のドロップ先ハイライトを、固定の type（`frame` / `group`）ではなく shape 定義の `container.autoAttach`（`isContainerAutoAttach`）で判定する。実際に子として取り込むコンテナ（containment attacher と同じ条件）だけがハイライトされるようになり、ドロップしても取り込まれない `group` はハイライトされなくなる。

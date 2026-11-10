---
"@edv4h/usketch-plugin-shape-freedraw": patch
---

使われていなかった独自フローティングパレット（`src/ui/palette.tsx` の `FreedrawPalette`）と、それだけのために持っていた「ツールがアクティブか」のストア・`SIZE_RANGE` 定数を削除。どこからも描画されていなかったため、見た目と挙動は変わらない。

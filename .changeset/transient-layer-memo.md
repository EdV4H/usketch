---
"@edv4h/usketch-canvas-engine": patch
---

perf(canvas-engine): TransientLayer で 1 つの transient を emit / dismiss したときに、変わっていない他の transient（リモートカーソル・アバターなど）を描き直さない

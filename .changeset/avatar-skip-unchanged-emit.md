---
"@edv4h/usketch-plugin-avatar": patch
---

カーソル移動など、アバターの見た目に関係しない awareness の更新では、リモート参加者のアバターを emit し直さないようにした。アバターや viewportCenter が変わった人だけ emit する。

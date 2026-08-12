---
"@edv4h/usketch-plugin-deep-link": patch
---

deep-link: URL にカメラが含まれるとき `viewport:claimed`（source: "deep-link", priority: 100）を
emit するように。他のカメラ系プラグイン（start-position 等）が疎結合に「ディープリンクが優先」を
判断できる。挙動の追加のみで、既存の復元動作は不変。

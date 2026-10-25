---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-map": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-character": minor
---

map のセルに高さを追加。地形タイプから段（水 0 / 陸 1 / 岩 2 / 山 3 / 雪 4）を自動で決め、Mode 7 では段差を崖として立体表示する。キャラクターは「登れる段差」より高い崖を登れない（降りるのは自由）。高さは共有の `groundHeightService` で公開し、`getMapApi().getHeightAt()` でも取得できる。

---
"@edv4h/usketch-plugin-ai-image": patch
"@edv4h/usketch-plugin-tool-openui": patch
"@edv4h/usketch-plugin-voice-notes": patch
---

AI 画像・OpenUI の生成物と音声メモのフレームを置く「画面中央」を、各プラグインの手書き計算から shared の `screenCenterWorld` に置き換え。ビューが回転しているときも画面の中央に置かれるようになった。

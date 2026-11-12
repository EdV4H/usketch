---
"@edv4h/usketch-plugin-mode7": patch
---

fix(mode7): キャラ追従などが `view3dService.setCameraHeight` でカメラの高さを動かしている間は、高さキー（Space / Shift）で高さを変えない。両方が毎フレーム高さを書き換えて画面がガタガタしていた。

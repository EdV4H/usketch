---
"@edv4h/usketch-plugin-character": minor
---

Add a "キー設定" HUD panel: rebind every action (up / down / left / right / jump / drift, up to two keys each) by clicking a key and pressing the new one, with conflicts moved over, unbound directions flagged and "既定に戻す". Bindings are saved per viewer in localStorage (`saveKeys: false` to opt out). The old "ドリフトのキー" / "ジャンプのキー" HUD fields are folded into the panel. New API: `setKeys(keys, { save })`, `getDefaultKeys`, `resetKeys`, `onKeysChange`, `captureNextKey`; pure helpers in `character-keys`.

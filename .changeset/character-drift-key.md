---
"@edv4h/usketch-plugin-character": minor
---

The drift has its own key: the default drift key is now Shift (it was Space, shared with the jump; the jump stays on Space). The HUD "キャラクター" group gains ドリフトのキー / ジャンプのキー (a few keys each, `KEY_CHOICES`) and ドリフトでホップ; `api.getKeys()` returns the bindings. `DriftParams.hop` (default off) makes a drift-key press on the ground hop `hopHeight` (default 10) first, with the drift starting on landing if still held and steering. Since the keys no longer clash, the vehicle scheme now gets air jumps and hover too.

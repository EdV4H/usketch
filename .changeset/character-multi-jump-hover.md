---
"@edv4h/usketch-plugin-character": minor
---

Multi-jump and hover. `jump.airJumps` (default 0) gives extra jumps in the air (1 = a double jump), each `airJumpRatio` (default 0.8) × the jump height, reset on landing. `jump.hover` (`true` or a partial `HoverParams`, default off) lets the jump key, held while falling once the air jumps are used up, fix the descent at `fallSpeed` while a gauge drains (`duration`); an empty gauge falls normally, and the gauge refills on the ground over `rechargeTime`. The pose and render props gain `hovering` / `hoverGauge` (both broadcast; older clients read as not hovering), and the HUD "キャラクター" group gains 空中ジャンプ回数 / ホバー / ホバー時間(秒). The vehicle scheme keeps a single hop.

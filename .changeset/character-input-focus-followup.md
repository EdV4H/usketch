---
"@edv4h/usketch-plugin-character": patch
---

Refine the focus rules for movement keys. A dialog that contains the board no longer blocks driving, and a menubar or listbox now counts as an arrow-key widget instead of taking every key. Focus is read through `composedPath()`, so dialogs inside web components are seen. Composite arrow-key roles (combobox, grid, tablist, radiogroup, toolbar …) are added. Numpad keys that act as arrows are treated as arrows. When focus moves, only the held keys the new target uses are released, so WASD doesn't stutter on a radio and a button pressed with Space while drifting still fires.

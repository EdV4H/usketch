---
"@edv4h/usketch-plugin-ai-actions": minor
---

選択追従のフローティング ActionBar（✨ Tidy / 🏷 Label / ✍ Recognize / 💬 Comment / ⌨ Ask AI）を撤去し、すべて Control HUD の Action に統合。Tidy/Label/Recognize/Ask AI は **AI** グループ、Comment は **Collab** グループ。`isEnabled` は選択状態（Recognize は freedraw/image のみ）に連動。実処理は従来どおり別プラグイン（ai-agent / ai-recognize / comments）が担当し、trigger のみを HUD に寄せた。ホストアプリに追従 UI を足さなくても操作できる。

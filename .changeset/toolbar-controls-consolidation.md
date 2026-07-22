---
"@edv4h/usketch-plugin-follow-me": minor
"@edv4h/usketch-plugin-presence-cursor": minor
"@edv4h/usketch-plugin-ai-copilot": minor
"@edv4h/usketch-plugin-debug-hud": minor
---

Toolbar 操作を Control HUD へ集約する一環で、各プラグインが操作を Control HUD のアクションレジストリ／パネル経由で提供するようになった。

- **follow-me**: 「Follow」アクショングループを動的登録（オンライン各メンバー＋Unfollow、awareness 変化で再構築）。`f` ショートカットは従来どおり。
- **presence-cursor**: プレゼンス状態(active/away/busy) を「Presence」アクショングループとして登録（`isActive` で現在値をハイライト、ローカル awareness の `user.status` を更新）。
- **ai-copilot**: Copilot ON/OFF を「Copilot」トグルアクションとして登録（状態の単一ソースは `copilot:toggle` イベント）。
- **debug-hud**: オンラインメンバーを表示する Members パネルを追加（`globalThis.__usketchPresence` を購読）、ミニマップにズーム（拡大縮小・現在倍率・リセット）を追加、Controls ドックにアクション検索フィルタを追加。

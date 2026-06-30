---
"@edv4h/usketch-plugin-tool-select": patch
---

選択オーバーレイ色をモジュール共有シングルトンから setup(インスタンス)スコープへ変更（#640）。
複数 App 同時生成（React StrictMode / 非同期 createApp の二重マウント）で、破棄された
インスタンスの teardown が生存インスタンスの色を既定へ戻す不具合を修正。`createOverlayColorStore`
を setup 内で生成し overlay に props で渡す（teardown reset は撤去）。`createSelectToolPlugin`
/ `select:configure` の API は不変。

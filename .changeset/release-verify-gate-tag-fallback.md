---
---

CI: release.yml の「Verify publish succeeded」ゲートに tag ベースのフォールバック判定を追加。tag push の transient エラーで changesets が `published` 出力をセットできずに赤くなる誤判定を解消（パッケージリリースなし）。

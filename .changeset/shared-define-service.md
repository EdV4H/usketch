---
"@edv4h/usketch-shared": minor
---

shared: `defineService` — 型付きサービスハンドルで `ctx.services` / `app.services` を扱う

プラグインが「ホスト向けの操作 API」を HUD 非依存で公開するための標準シーム。`defineService<T>(key)`
が `ServiceHandle<T>`（`key` ＋型付き `provide`/`get`/`has`）を返す。provider と consumer が
key・型でズレず、`ctx.services`（plugin）と `app.services`（host）は同一 registry なので同じ
アクセサで両方に使える。プラグイン不在時は `get` が `undefined`（optional 扱い）。

用途は docs/plugin-system-design.md を参照（操作ロジックは HUD クロージャに埋めず純関数化し、
ホスト向けは `defineService` で公開する規約）。

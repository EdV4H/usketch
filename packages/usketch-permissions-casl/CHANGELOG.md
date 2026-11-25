# @edv4h/usketch-permissions-casl

## 0.1.1

### Patch Changes

- Updated dependencies [1b665c3]
  - @edv4h/usketch-shared@4.33.0

## 0.1.0

### Minor Changes

- 61ee9e6: CASL のアダプター `@edv4h/usketch-permissions-casl` を足した。
  
  - `createCaslPermissionProvider({ rules })`: CASL のルールで答える `PermissionProvider`（ブラウザ用）。`update(rules)` でルールを差し替えると HUD・読み取り専用がすぐ追う。
  - `createCaslServerResolver({ loadRules })` / `createCaslSnapshot(rules)`: サーバー（Workers / Durable Object）用。判定とブラウザへ送るルールを返す。
  - 権限の名前は CASL の「操作 + 対象」に分けて聞く（`"page.edit"` → `edit` on `page`、`"<plugin id>:<op>"` → `<op>` on `<plugin id>`）。聞くときの resource が対象の中身なので、条件付きのルール（`{ ownerId: userId }`）が効く。
  
  shared に `scopePermissions(base, resource)` を足した: resource を省いて聞かれたら、そのページ（など）について聞く。ホストがページごとの App に渡すときに使う。

### Patch Changes

- Updated dependencies [61ee9e6]
- Updated dependencies [56a137e]
  - @edv4h/usketch-shared@4.32.0

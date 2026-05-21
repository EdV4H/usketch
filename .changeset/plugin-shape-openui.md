---
"@edv4h/usketch-plugin-shape-openui": patch
"@edv4h/usketch-plugin-tool-openui": patch
---

✨ OpenUI Generative UI ウィジェットプラグインを追加 (experimental, requires @openuidev/* 0.2.x):

- `usketch-plugin-shape-openui`: `openui` shape を `@openuidev/react-lang` の `<Renderer>` でマウント。Zod schema 駆動の library に対して validate された OpenUI Lang のみが render される。
- `usketch-plugin-tool-openui`: toolbar tool + side-panel prompt UI + 選択上の「Make Real」ボタン (`@edv4h/usketch-plugin-export` の `exportCanvas` で PNG snapshot)。OpenAI 直接と OpenAI 互換 endpoint (Azure / Ollama / LiteLLM / OpenUI server) の 2 provider。
- デフォルト library に 12 汎用 component (Stack / Heading / Text / Card / Button / Input / Badge / Avatar / Image / List / Row / Spacer) を同梱、host が `defineComponent` + `createLibrary` でブランド component を追加可能。
- `apps/web` に統合 (default: `http://localhost:7878/v1`、`VITE_OPENUI_PROVIDER=openai` で OpenAI 直叩き)。

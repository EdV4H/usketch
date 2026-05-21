---
"@edv4h/usketch-plugin-tool-openui": minor
"@edv4h/usketch-plugin-server-ai": minor
---

OpenUI: make production-deployable via a server-side proxy.

- `@edv4h/usketch-plugin-tool-openui` adds `createServerProxyProvider`, which routes LLM calls through your own `/api/ai/openui` endpoint with cookie-based auth (`credentials: "include"`). The existing OpenAI-compatible provider also gains an opt-in `credentials` option.
- `@edv4h/usketch-plugin-server-ai` adds `registerOpenUIRoute` (mounted at `POST /api/ai/openui`), an OpenAI-compatible Chat Completions proxy that reuses the worker's `OPENAI_API_KEY` secret, enforces board access control when `?boardId=...` is supplied, and streams SSE pass-through.

`apps/web` now uses `createServerProxyProvider` exclusively, so the OpenAI API key no longer ships in the browser bundle.

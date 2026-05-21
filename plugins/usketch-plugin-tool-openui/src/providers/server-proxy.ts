import { createOpenAICompatibleProvider } from "./openai-compatible.js";
import type { OpenUIProvider } from "./types.js";

export interface ServerProxyProviderOptions {
	/**
	 * API origin (no trailing `/api`). e.g. `https://api.usketch.app` or
	 * `http://localhost:8787`. The provider POSTs to
	 * `${apiUrl}${routePath}` (default route: `/api/ai/openui`).
	 */
	apiUrl: string;
	/**
	 * Extra request headers. Used for the dev `X-User-Id` shim; production
	 * relies on the session cookie sent via `credentials: "include"`.
	 */
	extraHeaders?: Record<string, string>;
	/** Forwarded as `?boardId=...` for board-scoped access control. */
	boardId?: string;
	defaultModel?: string;
	label?: string;
	availableModels?: string[];
	supportsVision?: boolean;
	/** Override the route path. Defaults to `"/api/ai/openui"`. */
	routePath?: string;
}

/**
 * Server-proxy provider: route LLM calls through uSketch's own
 * `/api/ai/openui` endpoint instead of calling OpenAI from the browser.
 *
 * Production-safe because the OpenAI API key lives only in the Workers
 * Secret store on the server — the browser bundle never sees it. Auth is
 * delegated to better-auth's session cookie (`credentials: "include"`),
 * with `X-User-Id` accepted as a dev-mode bypass.
 *
 * Internally this is a thin wrapper around `createOpenAICompatibleProvider`
 * because the server route is intentionally OpenAI-API-compatible.
 */
export function createServerProxyProvider(options: ServerProxyProviderOptions): OpenUIProvider {
	const {
		apiUrl,
		extraHeaders,
		boardId,
		defaultModel = "gpt-4o",
		label = "uSketch server",
		availableModels,
		supportsVision = true,
		routePath = "/api/ai/openui",
	} = options;

	const base = apiUrl.replace(/\/+$/, "");
	const url = new URL(`${base}${routePath}`);
	if (boardId) url.searchParams.set("boardId", boardId);

	const provider = createOpenAICompatibleProvider({
		endpoint: url.toString(),
		// No `apiKey` — the server attaches the OpenAI bearer token from its
		// own secret store.
		extraHeaders,
		defaultModel,
		availableModels,
		supportsVision,
		label,
		credentials: "include",
	});
	return { ...provider, id: "server-proxy" };
}

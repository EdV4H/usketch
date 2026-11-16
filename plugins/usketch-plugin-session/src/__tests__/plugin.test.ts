import type { PluginContext, ServiceRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createSessionPlugin } from "../plugin.js";
import { getSessionApi } from "../session-service.js";
import type { ClientSessionType } from "../session-type.js";
import { createYjsSessionClient } from "../yjs-session-client.js";

function fakeCtx() {
	const map = new Map<string, unknown>();
	const services: ServiceRegistry = {
		provide(key, service) {
			map.set(key, service);
			return () => map.delete(key);
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
	const registerPanel = vi.fn(() => () => {});
	const ctx = {
		store: {},
		services,
		events: { on: () => () => {}, emit: () => {} },
		hud: { registerPanel },
	} as unknown as PluginContext;
	return { ctx, registerPanel, services };
}

const client = () => createYjsSessionClient({ doc: new Y.Doc(), userId: "me", types: [] });

describe("createSessionPlugin", () => {
	it("どの型も描かないなら HUD パネルを出さず、サービスと attach だけ動かす", () => {
		const { ctx, registerPanel, services } = fakeCtx();
		const off = vi.fn();
		const attach = vi.fn(() => off);
		const type: ClientSessionType = { type: "silent", label: "silent", attach };
		const teardown = createSessionPlugin({ client: client(), userId: "me", types: [type] }).setup(
			ctx,
		);
		expect(registerPanel).not.toHaveBeenCalled();
		expect(attach).toHaveBeenCalledTimes(1);
		expect(getSessionApi(services)?.userId).toBe("me");
		teardown?.();
		expect(off).toHaveBeenCalled();
		expect(getSessionApi(services)).toBeUndefined();
	});

	it("カードを描く型があれば HUD パネルを出す", () => {
		const { ctx, registerPanel } = fakeCtx();
		const type: ClientSessionType = { type: "card", label: "card", renderCard: () => null };
		createSessionPlugin({ client: client(), userId: "me", types: [type] }).setup(ctx);
		expect(registerPanel).toHaveBeenCalledTimes(1);
	});
});

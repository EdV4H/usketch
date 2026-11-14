import type { BoardStore, SelectionHandleProvider } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../create-app.js";
import { createSelectionHandleRegistry } from "../selection-handle-registry.js";

const provider = (id: string, priority?: number): SelectionHandleProvider => ({
	id,
	priority,
	getHandles: () => [],
	startDrag: () => null,
	render: () => null,
});

describe("createSelectionHandleRegistry", () => {
	it("priority の高い順に並べ、同じなら登録順", () => {
		const reg = createSelectionHandleRegistry();
		reg.register(provider("a"));
		reg.register(provider("b", 10));
		reg.register(provider("c"));
		reg.register(provider("d", 10));
		expect(reg.getAll().map((p) => p.id)).toEqual(["b", "d", "a", "c"]);
	});

	it("同じ id で登録し直すと置き換わる", () => {
		const reg = createSelectionHandleRegistry();
		const first = provider("a");
		const second = provider("a");
		reg.register(first);
		reg.register(second);
		expect(reg.getAll()).toEqual([second]);
		expect(reg.get("a")).toBe(second);
	});

	it("登録を戻す関数は、置き換わった後は何もしない", () => {
		const reg = createSelectionHandleRegistry();
		const off = reg.register(provider("a"));
		const second = provider("a");
		reg.register(second);
		off();
		expect(reg.get("a")).toBe(second);
		reg.unregister("a");
		expect(reg.getAll()).toEqual([]);
	});

	it("増減を知らせ、getAll は変わるまで同じ配列を返す", () => {
		const reg = createSelectionHandleRegistry();
		const listener = vi.fn();
		reg.subscribe(listener);
		const off = reg.register(provider("a"));
		const list = reg.getAll();
		expect(reg.getAll()).toBe(list);
		off();
		expect(listener).toHaveBeenCalledTimes(2);
		expect(reg.getAll()).not.toBe(list);
		reg.unregister("missing");
		expect(listener).toHaveBeenCalledTimes(2);
	});
});

describe("createApp の selectionHandles", () => {
	it("plugin の ctx.ui と app で同じ registry を使う", async () => {
		// createApp only wires the store up; every method can be a no-op here.
		const store = new Proxy({}, { get: () => () => () => {} }) as unknown as BoardStore;
		let seen: unknown;
		const app = await createApp({
			store,
			plugins: [
				{
					id: "p",
					name: "p",
					setup(ctx) {
						seen = ctx.ui.selectionHandles;
						ctx.ui.selectionHandles?.register(provider("x"));
					},
				},
			],
		});
		expect(seen).toBe(app.selectionHandles);
		expect(app.selectionHandles.get("x")).toBeDefined();
		app.destroy();
	});
});

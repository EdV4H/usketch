import type { BoardStore, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../create-app.js";

function createStubStore(): BoardStore {
	const listeners = new Set<() => void>();
	return {
		getShapes: () => new Map(),
		getShapesSorted: () => [],
		getShape: () => undefined,
		addShape() {},
		updateShape() {},
		deleteShape() {},
		ensureZIndex() {},
		getSelection: () => new Set(),
		setSelection() {},
		addToSelection() {},
		removeFromSelection() {},
		clearSelection() {},
		getActiveToolId: () => "select",
		setActiveToolId() {},
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		setViewport() {},
		panBy() {},
		zoomTo() {},
		fitToBounds() {},
		getStyleSettings: () => ({
			fill: "#ffffff",
			stroke: "#1e1e1e",
			strokeWidth: 2,
			opacity: 1,
		}),
		setStyleSettings() {},
		getVisibleShapeIds: () => [],
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation: () => () => {},
	} as unknown as BoardStore;
}

/**
 * Reproduces the bug from Issue #609: under React StrictMode, `useEffect` runs
 * setup → cleanup → setup. If a plugin is a module-level singleton that stashes
 * its teardown on `this`, the second setup overwrites the first instance's
 * closure — and when the first `createApp`'s `destroy()` later fires, it tears
 * down the live second instance instead.
 *
 * The factory-function form (each `createApp` gets its own plugin object via
 * `createXxxPlugin()`) plus `setup` returning the teardown closure makes this
 * impossible at the type level. These tests pin that contract.
 */
describe("createApp — strict-mode safety", () => {
	it("destroying app1 does not affect app2's registry when both use a fresh plugin instance", async () => {
		// Factory: each call returns an independent plugin object (the recommended pattern).
		function createTestPlugin(): UsketchPlugin {
			return {
				id: "test-plugin",
				name: "test",
				setup(ctx: PluginContext) {
					const off = ctx.ui.registerSelectionForeground({
						id: "test-foreground",
						priority: 0,
						render: () => null,
					});
					return () => off();
				},
			};
		}

		const app1 = await createApp({
			store: createStubStore(),
			plugins: [createTestPlugin()],
		});
		const app2 = await createApp({
			store: createStubStore(),
			plugins: [createTestPlugin()],
		});

		// Both apps see their own registration.
		expect(app1.selectionForeground.getActive()?.id).toBe("test-foreground");
		expect(app2.selectionForeground.getActive()?.id).toBe("test-foreground");

		// Destroying app1 must not unregister app2's entry — the per-instance
		// teardown closure is owned by app1's plugin instance only.
		app1.destroy();
		expect(app2.selectionForeground.getActive()?.id).toBe("test-foreground");

		app2.destroy();
		expect(app2.selectionForeground.getActive()).toBeNull();
	});

	it("destroy() is idempotent — teardown only runs once even if destroy is called twice", async () => {
		let teardownCount = 0;
		const plugin: UsketchPlugin = {
			id: "idempotent-test",
			name: "idempotent",
			setup() {
				return () => {
					teardownCount += 1;
				};
			},
		};

		const app = await createApp({ store: createStubStore(), plugins: [plugin] });
		app.destroy();
		app.destroy();
		app.destroy();
		expect(teardownCount).toBe(1);
	});

	it("setup throw triggers LIFO rollback of teardowns from previously-set-up plugins", async () => {
		const order: string[] = [];
		const pluginA: UsketchPlugin = {
			id: "A",
			name: "A",
			setup() {
				return () => order.push("teardown-A");
			},
		};
		const pluginB: UsketchPlugin = {
			id: "B",
			name: "B",
			setup() {
				return () => order.push("teardown-B");
			},
		};
		const pluginC: UsketchPlugin = {
			id: "C",
			name: "C",
			setup() {
				throw new Error("C failed");
			},
		};

		await expect(
			createApp({ store: createStubStore(), plugins: [pluginA, pluginB, pluginC] }),
		).rejects.toThrow("C failed");

		// LIFO: B was set up after A, so B's teardown should run first.
		expect(order).toEqual(["teardown-B", "teardown-A"]);
	});

	it("teardowns run in LIFO order on destroy", async () => {
		const order: string[] = [];
		const make = (id: string): UsketchPlugin => ({
			id,
			name: id,
			setup() {
				return () => order.push(id);
			},
		});

		const app = await createApp({
			store: createStubStore(),
			plugins: [make("first"), make("second"), make("third")],
		});

		app.destroy();
		expect(order).toEqual(["third", "second", "first"]);
	});

	it("plugins that return nothing from setup are skipped during teardown (no error)", async () => {
		const plugin: UsketchPlugin = {
			id: "no-teardown",
			name: "no teardown",
			setup() {
				// returns void
			},
		};

		const app = await createApp({ store: createStubStore(), plugins: [plugin] });
		expect(() => app.destroy()).not.toThrow();
	});
});

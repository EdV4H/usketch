import {
	type BoardStore,
	createStaticPermissionProvider,
	isReadOnly,
	PERMISSIONS,
	type StoreEvent,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../create-app.js";

/** Tools and read-only are real here; shapes are not needed. */
function createStubStore(): BoardStore {
	const listeners = new Set<() => void>();
	const mutationListeners = new Set<(event: StoreEvent) => void>();
	let activeToolId = "select";
	let readOnly = false;
	const emit = (event: StoreEvent) => {
		for (const l of listeners) l();
		for (const l of [...mutationListeners]) l(event);
	};
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
		getActiveToolId: () => activeToolId,
		setActiveToolId(id: string) {
			if (id === activeToolId) return;
			activeToolId = id;
			emit({ type: "tool:changed", payload: { id } });
		},
		getDefaultToolId: () => "select",
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		getStyleSettings: () => ({ fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 }),
		getVisibleShapeIds: () => [],
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation(listener: (event: StoreEvent) => void) {
			mutationListeners.add(listener);
			return () => mutationListeners.delete(listener);
		},
		isReadOnly: () => readOnly,
		setReadOnly(next: boolean) {
			if (next === readOnly) return;
			readOnly = next;
			emit({ type: "read-only:changed", payload: { readOnly } });
		},
	} as unknown as BoardStore;
}

const icon = () => null as never;

/** select（見るだけでも使える）と rect（描く）を足す。 */
const toolsPlugin: UsketchPlugin = {
	id: "tools",
	name: "tools",
	setup(ctx) {
		ctx.tools.register("select", { icon, readOnlySafe: true });
		ctx.tools.register("rect", { icon });
	},
};

describe("createApp read-only", () => {
	it("is writable by default", async () => {
		const store = createStubStore();
		const app = await createApp({ store, plugins: [toolsPlugin] });
		expect(isReadOnly(store)).toBe(false);
		store.setActiveToolId("rect");
		expect(store.getActiveToolId()).toBe("rect");
		app.destroy();
	});

	it("is read-only when the permissions deny page.edit, and follows them", async () => {
		const store = createStubStore();
		const permissions = createStaticPermissionProvider([PERMISSIONS.pageView]);
		const app = await createApp({ store, plugins: [toolsPlugin], permissions });
		expect(isReadOnly(store)).toBe(true);

		permissions.set([PERMISSIONS.pageView, PERMISSIONS.pageEdit]);
		expect(isReadOnly(store)).toBe(false);
		permissions.set([PERMISSIONS.pageView]);
		expect(isReadOnly(store)).toBe(true);
		app.destroy();
	});

	it("is read-only already while the plugins set up", async () => {
		const store = createStubStore();
		let duringSetup: boolean | undefined;
		const app = await createApp({
			store,
			readOnly: true,
			plugins: [
				{
					id: "p",
					name: "p",
					setup: () => {
						duringSetup = isReadOnly(store);
					},
				},
			],
		});
		expect(duringSetup).toBe(true);
		app.destroy();
	});

	it("`readOnly: true` wins over the permissions and denies page.edit to the HUD", async () => {
		const store = createStubStore();
		const app = await createApp({ store, plugins: [toolsPlugin], readOnly: true });
		expect(isReadOnly(store)).toBe(true);
		expect(app.permissions.can(PERMISSIONS.pageEdit)).toBe(false);
		expect(app.permissions.can(PERMISSIONS.pageView)).toBe(true);
		app.destroy();
	});

	it("switches away from a tool that edits", async () => {
		const store = createStubStore();
		const permissions = createStaticPermissionProvider([
			PERMISSIONS.pageView,
			PERMISSIONS.pageEdit,
		]);
		const app = await createApp({ store, plugins: [toolsPlugin], permissions });
		store.setActiveToolId("rect");
		expect(store.getActiveToolId()).toBe("rect");

		// Turning read-only leaves the drawing tool…
		permissions.set([PERMISSIONS.pageView]);
		expect(store.getActiveToolId()).toBe("select");
		// …and it can't be picked again.
		store.setActiveToolId("rect");
		expect(store.getActiveToolId()).toBe("select");
		app.destroy();
	});

	it("gives the store back as it was when destroyed", async () => {
		const store = createStubStore();
		const app = await createApp({ store, plugins: [toolsPlugin], readOnly: true });
		app.destroy();
		expect(isReadOnly(store)).toBe(false);
		store.setActiveToolId("rect");
		expect(store.getActiveToolId()).toBe("rect");
	});
});

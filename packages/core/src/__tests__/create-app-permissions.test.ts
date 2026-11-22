import {
	type BoardStore,
	createStaticPermissionProvider,
	PERMISSIONS,
	type PermissionProvider,
	permissionsOf,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
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
		getStyleSettings: () => ({ fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 }),
		setStyleSettings() {},
		getVisibleShapeIds: () => [],
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation: () => () => {},
	} as unknown as BoardStore;
}

describe("createApp permissions", () => {
	it("allows everything when the host connects no permission system", async () => {
		let seen: PermissionProvider | undefined;
		const app = await createApp({
			store: createStubStore(),
			plugins: [
				{
					id: "p",
					name: "p",
					setup(ctx) {
						seen = permissionsOf(ctx);
					},
				} satisfies UsketchPlugin,
			],
		});
		expect(app.permissions.can(PERMISSIONS.pageEdit)).toBe(true);
		expect(seen).toBe(app.permissions);
		app.destroy();
	});

	it("hands the host's provider to the app and to every plugin", async () => {
		const permissions = createStaticPermissionProvider([PERMISSIONS.pageView]);
		const seen: PermissionProvider[] = [];
		const make = (id: string): UsketchPlugin => ({
			id,
			name: id,
			setup(ctx) {
				if (ctx.permissions) seen.push(ctx.permissions);
			},
		});
		const app = await createApp({
			store: createStubStore(),
			plugins: [make("a"), make("b")],
			permissions,
		});
		expect(app.permissions).toBe(permissions);
		expect(seen).toEqual([permissions, permissions]);
		expect(seen[0]?.can(PERMISSIONS.pageEdit)).toBe(false);
		app.destroy();
	});
});

import { describe, expect, it, vi } from "vitest";
import {
	allowAllPermissions,
	createStaticPermissionProvider,
	denyAllPermissions,
	isPermitted,
	PERMISSIONS,
	permissionsOf,
	scopePermissions,
} from "../permissions.js";

describe("permissions", () => {
	it("allow-all and deny-all answer the same for anything", () => {
		expect(allowAllPermissions().can(PERMISSIONS.pageEdit)).toBe(true);
		expect(allowAllPermissions().can("usketch-plugin-x:do")).toBe(true);
		expect(denyAllPermissions().can(PERMISSIONS.pageView)).toBe(false);
	});

	it("a static provider grants only the listed permissions", () => {
		const p = createStaticPermissionProvider([PERMISSIONS.pageView]);
		expect(p.can(PERMISSIONS.pageView)).toBe(true);
		expect(p.can(PERMISSIONS.pageEdit)).toBe(false);
	});

	it("a static provider can take a function that sees the resource", () => {
		const p = createStaticPermissionProvider(
			(permission, resource) => permission === PERMISSIONS.pageEdit && resource?.pageId === "mine",
		);
		expect(p.can(PERMISSIONS.pageEdit, { pageId: "mine" })).toBe(true);
		expect(p.can(PERMISSIONS.pageEdit, { pageId: "theirs" })).toBe(false);
	});

	it("set() replaces the rule and tells the listeners", () => {
		const p = createStaticPermissionProvider([PERMISSIONS.pageView]);
		const listener = vi.fn();
		const off = p.subscribe(listener);
		p.set([PERMISSIONS.pageView, PERMISSIONS.pageEdit]);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(p.can(PERMISSIONS.pageEdit)).toBe(true);
		off();
		p.set([]);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(p.can(PERMISSIONS.pageView)).toBe(false);
	});

	it("isPermitted lets through anything without `requires` or without a provider", () => {
		const deny = denyAllPermissions();
		expect(isPermitted(deny, undefined)).toBe(true);
		expect(isPermitted(undefined, PERMISSIONS.pageEdit)).toBe(true);
		expect(isPermitted(deny, PERMISSIONS.pageEdit)).toBe(false);
		expect(isPermitted(allowAllPermissions(), PERMISSIONS.pageEdit)).toBe(true);
	});

	it("permissionsOf falls back to allow-all for a context without permissions", () => {
		expect(permissionsOf({}).can(PERMISSIONS.boardAdmin)).toBe(true);
		const deny = denyAllPermissions();
		expect(permissionsOf({ permissions: deny })).toBe(deny);
	});
});

describe("scopePermissions", () => {
	it("asks about the scope when no resource is given, and layers a given one on it", () => {
		const seen: unknown[] = [];
		const base = createStaticPermissionProvider((_p, resource) => {
			seen.push(resource);
			return resource?.pageId === "a";
		});
		const scoped = scopePermissions(base, { boardId: "b", pageId: "a" });
		expect(scoped.can(PERMISSIONS.pageEdit)).toBe(true);
		expect(scoped.can(PERMISSIONS.pageEdit, { pageId: "other" })).toBe(false);
		expect(seen).toEqual([
			{ boardId: "b", pageId: "a" },
			{ boardId: "b", pageId: "other" },
		]);
	});

	it("reads a function scope each time and passes subscriptions through", () => {
		let pageId = "a";
		const base = createStaticPermissionProvider((_p, r) => r?.pageId === "a");
		const scoped = scopePermissions(base, () => ({ pageId }));
		expect(scoped.can(PERMISSIONS.pageView)).toBe(true);
		pageId = "b";
		expect(scoped.can(PERMISSIONS.pageView)).toBe(false);
		let calls = 0;
		const off = scoped.subscribe(() => calls++);
		base.set(() => true);
		off();
		base.set(() => false);
		expect(calls).toBe(1);
	});
});

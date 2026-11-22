import { describe, expect, it, vi } from "vitest";
import {
	allowAllPermissions,
	createStaticPermissionProvider,
	denyAllPermissions,
	isPermitted,
	PERMISSIONS,
	permissionsOf,
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

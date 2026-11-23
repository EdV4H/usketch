import { PERMISSIONS } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import {
	createCaslPermissionProvider,
	createCaslServerResolver,
	createCaslSnapshot,
	toCaslTarget,
	type UsketchRawRule,
} from "../casl-permissions.js";

describe("toCaslTarget", () => {
	it("splits core and plugin permissions into action and subject", () => {
		expect(toCaslTarget("page.edit")).toEqual({ subject: "page", action: "edit" });
		expect(toCaslTarget("board.admin")).toEqual({ subject: "board", action: "admin" });
		expect(toCaslTarget("usketch-plugin-ai:use")).toEqual({
			subject: "usketch-plugin-ai",
			action: "use",
		});
		expect(toCaslTarget("export")).toEqual({ subject: "all", action: "export" });
	});
});

describe("createCaslPermissionProvider", () => {
	it("can do nothing without rules", () => {
		const p = createCaslPermissionProvider();
		expect(p.can(PERMISSIONS.pageView)).toBe(false);
	});

	it("answers from plain and conditional rules", () => {
		const rules: UsketchRawRule[] = [
			{ action: "view", subject: "page" },
			{ action: "edit", subject: "page", conditions: { ownerId: "u1" } },
		];
		const p = createCaslPermissionProvider({ rules });
		expect(p.can(PERMISSIONS.pageView)).toBe(true);
		expect(p.can(PERMISSIONS.pageEdit, { pageId: "a", ownerId: "u1" })).toBe(true);
		expect(p.can(PERMISSIONS.pageEdit, { pageId: "b", ownerId: "u2" })).toBe(false);
		// Without the field the condition doesn't match.
		expect(p.can(PERMISSIONS.pageEdit)).toBe(false);
	});

	it("`manage all` allows everything", () => {
		const p = createCaslPermissionProvider({ rules: [{ action: "manage", subject: "all" }] });
		expect(p.can(PERMISSIONS.boardAdmin)).toBe(true);
		expect(p.can("usketch-plugin-ai:use")).toBe(true);
	});

	it("`cannot` rules win over `can`", () => {
		const p = createCaslPermissionProvider({
			rules: [
				{ action: "edit", subject: "page" },
				{ action: "edit", subject: "page", conditions: { locked: true }, inverted: true },
			],
		});
		expect(p.can(PERMISSIONS.pageEdit, { pageId: "a" })).toBe(true);
		expect(p.can(PERMISSIONS.pageEdit, { pageId: "a", locked: true })).toBe(false);
	});

	it("update() swaps the rules and tells listeners", () => {
		const p = createCaslPermissionProvider({ rules: [{ action: "view", subject: "page" }] });
		const listener = vi.fn();
		const off = p.subscribe(listener);
		expect(p.can(PERMISSIONS.pageEdit)).toBe(false);
		p.update([{ action: ["view", "edit"], subject: "page" }]);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(p.can(PERMISSIONS.pageEdit)).toBe(true);
		off();
		p.update([]);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("uses a custom mapping", () => {
		const p = createCaslPermissionProvider({
			rules: [{ action: "page.edit", subject: "all" }],
			toTarget: (permission) => ({ action: permission, subject: "all" }),
		});
		expect(p.can(PERMISSIONS.pageEdit)).toBe(true);
	});
});

describe("server side", () => {
	it("a snapshot answers like the browser does", () => {
		const s = createCaslSnapshot([{ action: "view", subject: "page" }]);
		expect(s.can(PERMISSIONS.pageView)).toBe(true);
		expect(s.can(PERMISSIONS.pageEdit)).toBe(false);
	});

	it("the resolver loads the rules for the person and hands them back too", async () => {
		const loadRules = vi.fn(async (subject: { userId: string | null }) =>
			subject.userId
				? [{ action: "edit", subject: "page" }]
				: [{ action: "view", subject: "page" }],
		);
		const resolver = createCaslServerResolver({ loadRules });
		const member = await resolver.resolve({ userId: "u1" }, { boardId: "b" });
		const guest = await resolver.resolve({ userId: null }, { boardId: "b" });
		expect(member.can(PERMISSIONS.pageEdit)).toBe(true);
		expect(guest.can(PERMISSIONS.pageEdit)).toBe(false);
		expect(guest.rules).toEqual([{ action: "view", subject: "page" }]);
		expect(loadRules).toHaveBeenCalledWith({ userId: "u1" }, { boardId: "b" });
	});
});

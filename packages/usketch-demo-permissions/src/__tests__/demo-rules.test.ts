import { createCaslPermissionProvider } from "@edv4h/usketch-permissions-casl";
import { PERMISSIONS } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	type DemoPageAccess,
	type DemoViewer,
	defaultPageAccess,
	defineDemoRules,
	pageResource,
} from "../demo-rules.js";

const ask = (viewer: DemoViewer) => {
	const p = createCaslPermissionProvider({ rules: defineDemoRules(viewer) });
	return (permission: string, access: DemoPageAccess) =>
		p.can(permission, pageResource({ boardId: "b", pageId: "p" }, access));
};

const owner: DemoViewer = { userId: "owner", boardRole: "owner" };
const editor: DemoViewer = { userId: "ed", boardRole: "editor" };
const viewer: DemoViewer = { userId: "vw", boardRole: "viewer" };
const outsider: DemoViewer = { userId: "out", boardRole: null };
const guest: DemoViewer = { userId: null, boardRole: null };

const membersPage: DemoPageAccess = { visibility: "members", edit: "members", ownerId: "someone" };
const publicPage: DemoPageAccess = { visibility: "public", edit: "members", ownerId: "someone" };
const privatePage: DemoPageAccess = {
	visibility: "private",
	edit: "invited",
	ownerId: "ed",
	members: { vw: "viewer", out: "editor" },
};

describe("demo rules", () => {
	it("the board owner can do everything", () => {
		const can = ask(owner);
		for (const p of Object.values(PERMISSIONS)) expect(can(p, privatePage)).toBe(true);
	});

	it("a page for the members: editors edit, viewers look, others see nothing", () => {
		expect(ask(editor)(PERMISSIONS.pageEdit, membersPage)).toBe(true);
		expect(ask(viewer)(PERMISSIONS.pageView, membersPage)).toBe(true);
		expect(ask(viewer)(PERMISSIONS.pageEdit, membersPage)).toBe(false);
		expect(ask(outsider)(PERMISSIONS.pageView, membersPage)).toBe(false);
		expect(ask(guest)(PERMISSIONS.pageView, membersPage)).toBe(false);
	});

	it("a public page is seen by anyone, edited by the members' editors", () => {
		expect(ask(guest)(PERMISSIONS.pageView, publicPage)).toBe(true);
		expect(ask(guest)(PERMISSIONS.pageEdit, publicPage)).toBe(false);
		expect(ask(outsider)(PERMISSIONS.pageEdit, publicPage)).toBe(false);
		expect(ask(editor)(PERMISSIONS.pageEdit, publicPage)).toBe(true);
	});

	it("a private page: its owner and the invited", () => {
		// ed made it: everything about the page.
		expect(ask(editor)(PERMISSIONS.pageManage, privatePage)).toBe(true);
		// vw was invited to look; out (not a board member) was invited to edit.
		expect(ask(viewer)(PERMISSIONS.pageView, privatePage)).toBe(true);
		expect(ask(viewer)(PERMISSIONS.pageEdit, privatePage)).toBe(false);
		expect(ask(outsider)(PERMISSIONS.pageEdit, privatePage)).toBe(true);
		expect(ask(guest)(PERMISSIONS.pageView, privatePage)).toBe(false);
		// Another editor of the board who wasn't invited can't even see it.
		expect(ask({ userId: "ed2", boardRole: "editor" })(PERMISSIONS.pageView, privatePage)).toBe(
			false,
		);
		expect(ask({ userId: "ed2", boardRole: "editor" })(PERMISSIONS.pageEdit, privatePage)).toBe(
			false,
		);
	});

	it("owner-only pages are edited by the one who made them", () => {
		const page: DemoPageAccess = { visibility: "members", edit: "owner-only", ownerId: "ed" };
		expect(ask(editor)(PERMISSIONS.pageEdit, page)).toBe(true);
		expect(ask({ userId: "ed2", boardRole: "editor" })(PERMISSIONS.pageEdit, page)).toBe(false);
	});

	it("only the board's editors create pages; only its owner administers the board", () => {
		const page = defaultPageAccess(false);
		expect(ask(editor)(PERMISSIONS.pageCreate, page)).toBe(true);
		expect(ask(viewer)(PERMISSIONS.pageCreate, page)).toBe(false);
		expect(ask(editor)(PERMISSIONS.boardAdmin, page)).toBe(false);
	});

	it("pages without settings follow the board: members, or anyone on a public board", () => {
		expect(ask(viewer)(PERMISSIONS.pageView, defaultPageAccess(false))).toBe(true);
		expect(ask(guest)(PERMISSIONS.pageView, defaultPageAccess(false))).toBe(false);
		expect(ask(guest)(PERMISSIONS.pageView, defaultPageAccess(true))).toBe(true);
		expect(ask(editor)(PERMISSIONS.pageEdit, defaultPageAccess(true))).toBe(true);
	});

	it("pages nobody owns yet are managed by the board's editors", () => {
		expect(ask(editor)(PERMISSIONS.pageManage, defaultPageAccess(false))).toBe(true);
		expect(ask(viewer)(PERMISSIONS.pageManage, defaultPageAccess(false))).toBe(false);
		// Somebody else's page: not theirs to manage.
		expect(ask(editor)(PERMISSIONS.pageManage, membersPage)).toBe(false);
	});

	it("the rules are plain JSON (sent from the server as is)", () => {
		const rules = defineDemoRules(editor);
		expect(JSON.parse(JSON.stringify(rules))).toEqual(rules);
	});
});

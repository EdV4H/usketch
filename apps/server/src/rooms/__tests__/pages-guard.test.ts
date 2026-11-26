import { createPage, getPage, listPages, renamePage } from "@edv4h/usketch-sync";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
	applyPagesGuard,
	judgePagesChanges,
	maskPageName,
	recordPagesChanges,
	unmaskPageName,
} from "../pages-guard.js";

/** サーバーの doc と、同じ中身から始めたクライアントの doc。 */
function setup() {
	const server = new Y.Doc();
	const a = createPage(server, { name: "A", after: null, now: 1 });
	const b = createPage(server, { name: "B", after: a.id, now: 2 });
	const client = new Y.Doc();
	Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
	return { server, client, a, b };
}

/** クライアントの編集を update にして、サーバーで記録しながら適用する。 */
function applyFromClient(server: Y.Doc, client: Y.Doc, edit: () => void) {
	const before = Y.encodeStateVector(client);
	edit();
	const update = Y.encodeStateAsUpdate(client, before);
	return recordPagesChanges(server, () => Y.applyUpdate(server, update));
}

const allow = { canCreate: () => true, canManage: () => true, isMasked: () => false };

describe("pages-guard", () => {
	it("records added, changed and deleted pages", () => {
		const { server, client, a, b } = setup();
		const changes = applyFromClient(server, client, () => {
			createPage(client, { name: "C", after: b.id, now: 3 });
			renamePage(client, a.id, "A2");
			client.getMap("pages").delete(b.id);
		});
		const byAction = Object.fromEntries(changes.map((c) => [c.action, c]));
		expect(Object.keys(byAction).sort()).toEqual(["add", "delete", "update"]);
		expect(byAction.update?.pageId).toBe(a.id);
		expect(byAction.update?.oldValue).toMatchObject({ name: "A" });
		expect(judgePagesChanges(server, changes, allow).revert.size).toBe(0);
	});

	it("reverts changes the writer may not make", () => {
		const { server, client, a, b } = setup();
		const changes = applyFromClient(server, client, () => {
			createPage(client, { name: "C", after: b.id, now: 3 });
			renamePage(client, a.id, "hacked");
			client.getMap("pages").delete(b.id);
		});
		const result = judgePagesChanges(server, changes, {
			canCreate: () => false,
			canManage: () => false,
			isMasked: () => false,
		});
		server.transact(() => applyPagesGuard(server, result), "server");
		expect(listPages(server).map((p) => p.name)).toEqual(["A", "B"]);
	});

	it("keeps changes to pages the writer manages and reverts the others", () => {
		const { server, client, a, b } = setup();
		const changes = applyFromClient(server, client, () => {
			renamePage(client, a.id, "mine");
			renamePage(client, b.id, "theirs");
		});
		const result = judgePagesChanges(server, changes, {
			...allow,
			canManage: (pageId) => pageId === a.id,
		});
		applyPagesGuard(server, result);
		expect(getPage(server, a.id)?.name).toBe("mine");
		expect(getPage(server, b.id)?.name).toBe("B");
	});

	it("moves a name written to a masked page out of the root doc", () => {
		const { server, client, a } = setup();
		expect(maskPageName(server, a.id)).toBe("A");
		expect(getPage(server, a.id)?.name).toBe("");
		Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
		const changes = applyFromClient(server, client, () => renamePage(client, a.id, "secret"));
		const result = judgePagesChanges(server, changes, {
			...allow,
			isMasked: (pageId) => pageId === a.id,
		});
		expect(result.renamed.get(a.id)).toBe("secret");
		applyPagesGuard(server, result);
		expect(getPage(server, a.id)?.name).toBe("");
		expect(unmaskPageName(server, a.id, "secret")).toBe(true);
		expect(getPage(server, a.id)?.name).toBe("secret");
	});
});

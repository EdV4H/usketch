import { createPage, getPage, initPagedBoard, listPages } from "@edv4h/usketch-sync";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
	DEMO_BOARD_TITLE,
	DEMO_PAGES_DONE_KEY,
	type DemoPagesDeps,
	regionPageId,
	retargetPortals,
	setupDemoPages,
} from "../demo-pages.js";

const portal = (id: string, boardId: string) => ({ id, type: "board-portal", boardId });

function setup() {
	const root = new Y.Doc();
	const lobbyId = initPagedBoard(root, { name: "ページ 1" }).id;
	const lobbyDoc = new Y.Doc();
	lobbyDoc.getMap<unknown>("shapes").set("gate", portal("gate", "community-workshop"));
	const storage = new Map<string, unknown>();
	const calls: string[] = [];
	const deps: DemoPagesDeps = {
		storage: {
			get: (async (key: string) => storage.get(key)) as DemoPagesDeps["storage"]["get"],
			put: (async (key: string, value: unknown) => {
				storage.set(key, value);
			}) as DemoPagesDeps["storage"]["put"],
		},
		getRoot: async () => root,
		writeRoot: async (write) => {
			calls.push("root");
			root.transact(() => write(root));
		},
		writePage: async (pageId, edit) => {
			calls.push(`page:${pageId}`);
			edit(lobbyDoc);
		},
		renameBoard: async (title) => {
			calls.push(`rename:${title}`);
		},
	};
	return { root, lobbyId, lobbyDoc, storage, calls, deps };
}

describe("setupDemoPages", () => {
	it("地域の空のページを決まった id で作り、Lobby のゲートをページ行きにする", async () => {
		const { root, lobbyId, lobbyDoc, storage, calls, deps } = setup();
		expect(await setupDemoPages(deps)).toEqual(["workshop", "gallery", "playground"]);

		const pages = listPages(root);
		expect(pages.map((p) => p.name)).toEqual(["Lobby", "Workshop", "Gallery", "Playground"]);
		expect(pages[0]).toMatchObject({ id: lobbyId, preset: "map" });
		expect(getPage(root, regionPageId("playground"))?.preset).toBe("map-terrain");
		expect(lobbyDoc.getMap<Record<string, unknown>>("shapes").get("gate")).toMatchObject({
			boardId: "community-workshop",
			pageId: regionPageId("workshop"),
		});
		expect(calls).toEqual(["root", `page:${lobbyId}`, `rename:${DEMO_BOARD_TITLE}`]);
		expect(storage.has(DEMO_PAGES_DONE_KEY)).toBe(true);
	});

	it("作り終えていれば何もしない", async () => {
		const { deps, calls } = setup();
		await setupDemoPages(deps);
		calls.length = 0;
		expect(await setupDemoPages(deps)).toEqual([]);
		expect(calls).toEqual([]);
	});

	it("途中で止まっても、もうあるページは作り直さない", async () => {
		const { deps, root } = setup();
		createPage(root, { id: regionPageId("workshop"), name: "Workshop" });
		expect(await setupDemoPages(deps)).toEqual(["gallery", "playground"]);
		expect(listPages(root).filter((p) => p.id === regionPageId("workshop"))).toHaveLength(1);
	});

	it("名前やプリセットを決めた 1 枚目はそのまま", async () => {
		const { deps, root, lobbyId } = setup();
		root.getMap<Record<string, unknown>>("pages").set(lobbyId, {
			...(getPage(root, lobbyId) as object),
			name: "みんなの広場",
			preset: "whiteboard",
		});
		await setupDemoPages(deps);
		expect(getPage(root, lobbyId)).toMatchObject({ name: "みんなの広場", preset: "whiteboard" });
	});

	it("ページを使わないボードでは何もしない", async () => {
		const { deps, calls } = setup();
		deps.getRoot = async () => new Y.Doc();
		expect(await setupDemoPages(deps)).toEqual([]);
		expect(calls).toEqual([]);
	});
});

describe("retargetPortals", () => {
	it("知らないボードや他のシェイプは変えない", () => {
		const doc = new Y.Doc();
		const shapes = doc.getMap<unknown>("shapes");
		shapes.set("p", portal("p", "someone-else"));
		shapes.set("r", { id: "r", type: "rect", boardId: "community-workshop" });
		expect(retargetPortals(doc, new Map([["community-workshop", "region-workshop"]]))).toBe(0);
	});
});

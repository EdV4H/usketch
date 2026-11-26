import type { DemoPageAccess } from "@edv4h/usketch-demo-permissions";
import { describe, expect, it } from "vitest";
import type { BoardViewer } from "../../page-access/queries.js";
import { PageNotFoundError } from "../board-shapes.js";
import { authorizeHttp, authorizeHttpPage, type HttpAccessDeps } from "../http-access.js";

const PRIVATE: DemoPageAccess = { ownerId: "owner", visibility: "private", edit: "owner-only" };

function deps(viewers: Record<string, BoardViewer | null>, boardPublic = false): HttpAccessDeps {
	return {
		loadViewer: async (_boardId, userId) =>
			userId === null
				? boardPublic
					? { boardRole: null, boardPublic }
					: null
				: (viewers[userId] ?? null),
		loadPageAccess: async () => new Map([["secret", PRIVATE]]),
		resolvePage: async (pageId) => {
			if (pageId === "gone") throw new PageNotFoundError(pageId);
			return pageId ?? "first";
		},
	};
}

const url = (query: string) => new URL(`https://internal/x?boardId=b1&${query}`);

describe("authorizeHttpPage", () => {
	const d = deps({
		owner: { boardRole: "owner", boardPublic: false },
		editor: { boardRole: "editor", boardPublic: false },
		viewer: { boardRole: "viewer", boardPublic: false },
	});

	it("見られないページは 404、見られるが書けないページは 403", async () => {
		expect((await authorizeHttpPage(url("userId=editor"), "", "secret", "view", d))?.status).toBe(
			404,
		);
		expect((await authorizeHttpPage(url("userId=viewer"), "", "first", "edit", d))?.status).toBe(
			403,
		);
		expect(await authorizeHttpPage(url("userId=viewer"), "", null, "view", d)).toBeNull();
	});

	it("作った人は非公開ページに書ける", async () => {
		expect(await authorizeHttpPage(url("userId=owner"), "", "secret", "edit", d)).toBeNull();
	});

	it("ボードを見られない人・無いページは 404", async () => {
		expect((await authorizeHttpPage(url("userId=stranger"), "", null, "view", d))?.status).toBe(
			404,
		);
		expect((await authorizeHttpPage(url("userId=owner"), "", "gone", "view", d))?.status).toBe(404);
	});

	it("ログインしていない人は公開ボードの既定のページだけ見られる", async () => {
		const pub = deps({}, true);
		expect(await authorizeHttpPage(url(""), "", "first", "view", pub)).toBeNull();
		expect((await authorizeHttpPage(url(""), "", "secret", "view", pub))?.status).toBe(404);
		expect((await authorizeHttpPage(url(""), "", "first", "edit", pub))?.status).toBe(403);
	});
});

describe("authorizeHttp", () => {
	it("boardId が無ければ DO の覚えている id を使い、それも無ければ 400", async () => {
		const d = deps({ owner: { boardRole: "owner", boardPublic: false } });
		const withFallback = await authorizeHttp(new URL("https://internal/x?userId=owner"), "b1", d);
		expect(withFallback).not.toBeInstanceOf(Response);
		const none = await authorizeHttp(new URL("https://internal/x?userId=owner"), "", d);
		expect((none as Response).status).toBe(400);
	});
});

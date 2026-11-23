import { describe, expect, it } from "vitest";
import { createPageDocs } from "../page-docs.js";
import {
	type AccessSocket,
	canEditPage,
	canEditRoot,
	canViewPage,
	getSocketAccess,
	readAccessParams,
	setSocketAccess,
} from "../room-access.js";

class FakeSocket implements AccessSocket {
	private attachment: unknown = null;
	serializeAttachment(value: unknown) {
		this.attachment = structuredClone(value);
	}
	deserializeAttachment() {
		return this.attachment;
	}
}

function socketFor(query: string): FakeSocket {
	const ws = new FakeSocket();
	setSocketAccess(ws, readAccessParams(new URL(`https://internal/ws?${query}`), "b1"));
	return ws;
}

describe("room-access", () => {
	it("reads the role and the public flag the Worker put on the URL", () => {
		expect(
			readAccessParams(new URL("https://x/ws?userId=u1&role=editor&boardPublic=1"), "b1"),
		).toEqual({ userId: "u1", boardId: "b1", boardRole: "editor", boardPublic: true });
		expect(readAccessParams(new URL("https://x/ws?userId=anonymous&role=admin"), "b1")).toEqual({
			userId: null,
			boardId: "b1",
			boardRole: null,
			boardPublic: false,
		});
	});

	it("lets owners and editors write and everyone connected view", () => {
		for (const role of ["owner", "editor"]) {
			const ws = socketFor(`userId=u1&role=${role}`);
			expect(canEditRoot(ws)).toBe(true);
			expect(canEditPage(ws, "p1")).toBe(true);
			expect(canViewPage(ws, "p1")).toBe(true);
		}
	});

	it("drops writes from viewers", () => {
		const ws = socketFor("userId=u1&role=viewer");
		expect(canViewPage(ws, "p1")).toBe(true);
		expect(canEditPage(ws, "p1")).toBe(false);
		expect(canEditRoot(ws)).toBe(false);
	});

	it("lets non-members view public boards but not write", () => {
		const ws = socketFor("userId=u1&boardPublic=1");
		expect(canViewPage(ws, "p1")).toBe(true);
		expect(canEditPage(ws, "p1")).toBe(false);
		expect(canEditRoot(ws)).toBe(false);
	});

	it("allows nothing on a private board without a role", () => {
		const ws = socketFor("userId=u1&boardPublic=0");
		expect(canViewPage(ws, "p1")).toBe(false);
		expect(canEditRoot(ws)).toBe(false);
	});

	it("allows nothing on a socket without recorded access", () => {
		const ws = new FakeSocket();
		expect(getSocketAccess(ws)).toBeNull();
		expect(canViewPage(ws, "p1")).toBe(false);
		expect(canEditRoot(ws)).toBe(false);
	});

	it("keeps the access when page subscriptions are written to the same attachment", async () => {
		const ws = Object.assign(socketFor("userId=u1&role=editor"), { send() {} });
		const storage = new Map<string, unknown>();
		const docs = createPageDocs({
			storage: {
				get: async (key: string) => storage.get(key),
				put: async (key: string, value: unknown) => {
					storage.set(key, value);
				},
				delete: async (key: string) => storage.delete(key),
				list: async () => new Map(),
			} as unknown as DurableObjectStorage,
			getSockets: () => [ws],
		});
		await docs.handleSubscribe(ws, "p1", undefined);
		expect(getSocketAccess(ws)?.boardRole).toBe("editor");
		expect(canEditPage(ws, "p1")).toBe(true);
	});
});

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ShapeData } from "../../types/shape.js";
import { hashHistoryObject } from "../hash.js";
import {
	createBlob,
	createCommit,
	parseBlob,
	parseCommit,
	parseTree,
	snapshotShapes,
} from "../objects.js";

const style = { fillColor: "#fff", strokeColor: "#000", strokeWidth: 1, opacity: 1 };

function rect(id: string, x: number, extra: Partial<ShapeData> = {}): ShapeData {
	return { id, type: "rectangle", x, y: 0, width: 10, height: 10, style, ...extra } as ShapeData;
}

describe("hashHistoryObject", () => {
	it("is SHA-256 of '<kind> <body>' in hex", async () => {
		const expected = createHash("sha256").update("blob {}").digest("hex");
		expect(await hashHistoryObject("blob", "{}")).toBe(expected);
	});

	it("gives different hashes to different kinds with the same body", async () => {
		expect(await hashHistoryObject("blob", "{}")).not.toBe(await hashHistoryObject("tree", "{}"));
	});
});

describe("createBlob", () => {
	it("ignores key order and updatedAt", async () => {
		const a = await createBlob(rect("a", 1, { updatedAt: 1 }));
		const reordered = { updatedAt: 2, ...rect("a", 1) } as ShapeData;
		const b = await createBlob(reordered);
		expect(a.hash).toBe(b.hash);
		expect(parseBlob(a.body)).toEqual(rect("a", 1));
	});

	it("changes when a visible field changes", async () => {
		expect((await createBlob(rect("a", 1))).hash).not.toBe((await createBlob(rect("a", 2))).hash);
	});
});

describe("snapshotShapes", () => {
	it("gives the same tree for a Map, a record and a list of the same shapes", async () => {
		const shapes = [rect("a", 1), rect("b", 2)];
		const fromList = await snapshotShapes(shapes);
		const fromMap = await snapshotShapes(new Map(shapes.map((s) => [s.id, s])));
		const fromRecord = await snapshotShapes({ b: shapes[1], a: shapes[0] });
		expect(fromMap.tree.hash).toBe(fromList.tree.hash);
		expect(fromRecord.tree.hash).toBe(fromList.tree.hash);
		expect(Object.keys(parseTree(fromList.tree.body))).toEqual(["a", "b"]);
	});

	it("only produces a new blob for the shape that changed", async () => {
		const before = await snapshotShapes([rect("a", 1), rect("b", 2)]);
		const after = await snapshotShapes([rect("a", 1), rect("b", 3)]);
		expect(after.tree.hash).not.toBe(before.tree.hash);
		expect(after.entries.a).toBe(before.entries.a);
		expect(after.entries.b).not.toBe(before.entries.b);
	});

	it("deduplicates identical blobs and skips non-object values", async () => {
		const shape = rect("a", 1);
		const snapshot = await snapshotShapes({
			a: shape,
			broken: null as unknown as ShapeData,
		});
		expect(Object.keys(snapshot.entries)).toEqual(["a"]);
		expect(snapshot.blobs).toHaveLength(1);
	});
});

describe("createCommit", () => {
	it("round-trips and keeps parent order", async () => {
		const commit = {
			tree: "t",
			parents: ["p2", "p1"],
			createdAt: "2026-11-02T00:00:00.000Z",
			author: null,
			message: "auto",
			trigger: "auto" as const,
		};
		const object = await createCommit(commit);
		expect(parseCommit(object.body)).toEqual(commit);
		expect((await createCommit({ ...commit, parents: ["p1", "p2"] })).hash).not.toBe(object.hash);
	});
});

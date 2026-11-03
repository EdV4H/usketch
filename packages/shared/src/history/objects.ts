import type { ShapeData } from "../types/shape.js";
import { canonicalJson } from "./canonical-json.js";
import { type HistoryObjectKind, hashHistoryObject } from "./hash.js";

/**
 * Shape keys left out of a blob. The store rewrites `updatedAt` on every
 * mutation, so keeping it would give a shape that was re-saved without any
 * visible change a new hash.
 */
export const HISTORY_EXCLUDED_SHAPE_KEYS: ReadonlySet<string> = new Set(["updatedAt"]);

/** A content-addressed object: `hash` is {@link hashHistoryObject} of `kind` + `body`. */
export interface HistoryObject {
	hash: string;
	kind: HistoryObjectKind;
	/** Canonical JSON. Store it as-is; re-serializing it could change the hash. */
	body: string;
}

/** A tree's content: shape id → blob hash. */
export type HistoryTreeEntries = Readonly<Record<string, string>>;

/** What caused a commit to be recorded. */
export type HistoryCommitTrigger = "auto" | "manual" | "restore";

/** A commit's content. */
export interface HistoryCommit {
	/** Hash of the tree object holding the board's shapes. */
	tree: string;
	/** Parent commit hashes (empty for the first commit, two for a merge). */
	parents: readonly string[];
	/** ISO 8601 timestamp. Part of the hash, like in Git. */
	createdAt: string;
	/** Host-defined author id, or `null` when nobody in particular made it (auto commits). */
	author: string | null;
	message: string;
	trigger: HistoryCommitTrigger;
}

/** Everything needed to persist one snapshot of a board. */
export interface BoardSnapshot {
	tree: HistoryObject;
	entries: HistoryTreeEntries;
	/** One object per distinct blob, deduplicated by hash. */
	blobs: HistoryObject[];
}

/** Shapes as a host holds them: `store.getShapes()`, a Y.Map's `toJSON()`, or a list. */
export type ShapeCollection =
	| ReadonlyMap<string, ShapeData>
	| Readonly<Record<string, ShapeData>>
	| Iterable<ShapeData>;

/** Copy of `shape` without {@link HISTORY_EXCLUDED_SHAPE_KEYS}. */
export function normalizeShapeForHistory(shape: ShapeData): Record<string, unknown> {
	const normalized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(shape)) {
		if (!HISTORY_EXCLUDED_SHAPE_KEYS.has(key)) normalized[key] = value;
	}
	return normalized;
}

/** Turn any {@link ShapeCollection} into `[id, shape]` pairs, skipping non-object values. */
export function shapeEntries(shapes: ShapeCollection): [string, ShapeData][] {
	let pairs: [string, unknown][];
	if (shapes instanceof Map) {
		pairs = [...shapes.entries()];
	} else if (Symbol.iterator in shapes) {
		pairs = [...(shapes as Iterable<ShapeData>)].map((shape) => [shape?.id, shape]);
	} else {
		pairs = Object.entries(shapes);
	}
	return pairs.filter(
		(pair): pair is [string, ShapeData] =>
			typeof pair[0] === "string" && pair[1] !== null && typeof pair[1] === "object",
	);
}

/** Blob for one shape. */
export async function createBlob(shape: ShapeData): Promise<HistoryObject> {
	const body = canonicalJson(normalizeShapeForHistory(shape));
	return { hash: await hashHistoryObject("blob", body), kind: "blob", body };
}

/** Tree for a set of `shape id → blob hash` entries. */
export async function createTree(entries: HistoryTreeEntries): Promise<HistoryObject> {
	const body = canonicalJson(entries);
	return { hash: await hashHistoryObject("tree", body), kind: "tree", body };
}

/** Commit object. `parents` keeps its order (the first parent is the main line). */
export async function createCommit(commit: HistoryCommit): Promise<HistoryObject> {
	const body = canonicalJson({ ...commit, parents: [...commit.parents] });
	return { hash: await hashHistoryObject("commit", body), kind: "commit", body };
}

/**
 * Hash every shape and build the tree. Two calls with the same shape content
 * return the same `tree.hash`, whatever the key order, `updatedAt`, or the
 * collection type, so comparing it with the previous commit's tree tells
 * whether anything changed.
 */
export async function snapshotShapes(shapes: ShapeCollection): Promise<BoardSnapshot> {
	const entries: Record<string, string> = {};
	const blobs = new Map<string, HistoryObject>();
	for (const [id, shape] of shapeEntries(shapes)) {
		const blob = await createBlob(shape);
		entries[id] = blob.hash;
		blobs.set(blob.hash, blob);
	}
	return { tree: await createTree(entries), entries, blobs: [...blobs.values()] };
}

/** Parse a blob body back into the shape (without the excluded keys). */
export function parseBlob(body: string): ShapeData {
	return JSON.parse(body) as ShapeData;
}

/** Parse a tree body back into its entries. */
export function parseTree(body: string): HistoryTreeEntries {
	return JSON.parse(body) as HistoryTreeEntries;
}

/** Parse a commit body. */
export function parseCommit(body: string): HistoryCommit {
	return JSON.parse(body) as HistoryCommit;
}

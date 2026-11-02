/**
 * Git 風のボード履歴（content-addressed なコミット）を Durable Object storage に保存する。
 *
 * - オブジェクト（blob / tree / commit）は `history:object:<hash>` に `"<kind> <body>"` で保存。
 *   同じ内容は同じハッシュなので、変わっていないシェイプは書き込まれない。
 * - コミット一覧は `history:log:<作成時刻ms 15桁>:<hash>` に要約を保存（新しい順に list できる）。
 * - 現在の先頭コミットは `history:ref:main`。
 *
 * Yjs は作業ツリーのまま残し、このマネージャはその上にスナップショットを積むだけ。
 */
import {
	createCommit,
	diffShapeFields,
	diffTrees,
	type HistoryCommit,
	type HistoryCommitTrigger,
	type HistoryObject,
	type HistoryObjectKind,
	type HistoryTreeEntries,
	parseBlob,
	parseCommit,
	parseTree,
	type ShapeData,
	type ShapeFieldChange,
	snapshotShapes,
} from "@edv4h/usketch-shared";

export const HISTORY_OBJECT_PREFIX = "history:object:";
export const HISTORY_LOG_PREFIX = "history:log:";
export const HISTORY_HEAD_KEY = "history:ref:main";

/** DO storage の get/put は 1 回 128 キーまで。 */
const STORAGE_BATCH = 128;

/** 編集が止まってから自動コミットするまで。 */
export const AUTO_COMMIT_IDLE_MS = 3 * 60 * 1000;
/** 編集が続いていても、最初の未コミット編集からこの時間で自動コミットする。 */
export const AUTO_COMMIT_MAX_WAIT_MS = 15 * 60 * 1000;

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function isHistoryHash(value: string): boolean {
	return HASH_PATTERN.test(value);
}

/** コミット一覧の 1 行。リスト表示に要るものだけで、シェイプ本体は含まない。 */
export interface HistoryCommitSummary extends HistoryCommit {
	hash: string;
	shapeCount: number;
	/** 親コミット（最初の親）からの変更数。最初のコミットは全シェイプが added。 */
	stats: { added: number; removed: number; modified: number };
}

export interface HistoryCommitPage {
	head: string | null;
	commits: HistoryCommitSummary[];
	/** 続きがあるとき、次のページの `cursor` に渡す値。 */
	nextCursor: string | null;
}

export interface HistoryCommitDetail {
	hash: string;
	commit: HistoryCommit;
	shapes: ShapeData[];
}

export interface HistoryShapeModification {
	id: string;
	before: ShapeData;
	after: ShapeData;
	changes: ShapeFieldChange[];
}

export interface HistoryDiffResult {
	from: string;
	/** コミットハッシュ、または現在のボード（`"working"`）。 */
	to: string;
	added: ShapeData[];
	removed: ShapeData[];
	modified: HistoryShapeModification[];
}

export interface RecordCommitOptions {
	trigger: HistoryCommitTrigger;
	author?: string | null;
	message?: string;
	/** true なら前回から何も変わっていなくてもコミットする（手動の「版に名前を付ける」用）。 */
	allowEmpty?: boolean;
}

export interface HistoryManagerDeps {
	storage: DurableObjectStorage;
	/** 現在のボードのシェイプ（Y.Map `shapes` の `toJSON()`）。 */
	getShapes: () => Promise<Record<string, ShapeData>>;
	now?: () => number;
	idleMs?: number;
	maxWaitMs?: number;
}

interface HeadState {
	hash: string;
	commit: HistoryCommit;
	entries: HistoryTreeEntries;
}

interface StoredObject {
	kind: HistoryObjectKind;
	body: string;
}

function encodeObject(object: HistoryObject): string {
	return `${object.kind} ${object.body}`;
}

function decodeObject(raw: unknown): StoredObject | null {
	if (typeof raw !== "string") return null;
	const space = raw.indexOf(" ");
	if (space < 0) return null;
	const kind = raw.slice(0, space);
	if (kind !== "blob" && kind !== "tree" && kind !== "commit") return null;
	return { kind, body: raw.slice(space + 1) };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

function logKey(createdAtMs: number, hash: string): string {
	return `${HISTORY_LOG_PREFIX}${String(createdAtMs).padStart(15, "0")}:${hash}`;
}

export function createHistoryManager(deps: HistoryManagerDeps) {
	const { storage } = deps;
	const now = deps.now ?? (() => Date.now());
	const idleMs = deps.idleMs ?? AUTO_COMMIT_IDLE_MS;
	const maxWaitMs = deps.maxWaitMs ?? AUTO_COMMIT_MAX_WAIT_MS;

	/** undefined = まだ読んでいない、null = コミットがまだ無い。 */
	let head: HeadState | null | undefined;
	/** コミットは 1 本ずつ（先頭の読み書きが交差して枝分かれしないように）。 */
	let queue: Promise<unknown> = Promise.resolve();
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	let firstPendingEditAt: number | null = null;

	function serialize<T>(task: () => Promise<T>): Promise<T> {
		const run = queue.then(task, task);
		queue = run.catch(() => undefined);
		return run;
	}

	async function readObjects(hashes: readonly string[]): Promise<Map<string, StoredObject>> {
		const found = new Map<string, StoredObject>();
		const unique = [...new Set(hashes)];
		for (const keys of chunk(
			unique.map((h) => HISTORY_OBJECT_PREFIX + h),
			STORAGE_BATCH,
		)) {
			const values = await storage.get<string>(keys);
			for (const [key, raw] of values) {
				const object = decodeObject(raw);
				if (object) found.set(key.slice(HISTORY_OBJECT_PREFIX.length), object);
			}
		}
		return found;
	}

	async function readObject(hash: string, kind: HistoryObjectKind): Promise<string | null> {
		const object = (await readObjects([hash])).get(hash);
		return object && object.kind === kind ? object.body : null;
	}

	/** まだ保存されていないオブジェクトだけを書く。 */
	async function writeMissingObjects(objects: readonly HistoryObject[]): Promise<void> {
		const byHash = new Map(objects.map((o) => [o.hash, o]));
		const existing = await readObjects([...byHash.keys()]);
		const missing = [...byHash.values()].filter((o) => !existing.has(o.hash));
		for (const batch of chunk(missing, STORAGE_BATCH)) {
			const record: Record<string, string> = {};
			for (const object of batch)
				record[HISTORY_OBJECT_PREFIX + object.hash] = encodeObject(object);
			await storage.put(record);
		}
	}

	async function readTreeEntries(treeHash: string): Promise<HistoryTreeEntries> {
		const body = await readObject(treeHash, "tree");
		if (body === null) throw new Error(`history tree ${treeHash} is missing`);
		return parseTree(body);
	}

	async function readCommit(hash: string): Promise<HistoryCommit | null> {
		const body = await readObject(hash, "commit");
		return body === null ? null : parseCommit(body);
	}

	async function loadHead(): Promise<HeadState | null> {
		if (head !== undefined) return head;
		const hash = await storage.get<string>(HISTORY_HEAD_KEY);
		const commit = hash ? await readCommit(hash) : null;
		head = hash && commit ? { hash, commit, entries: await readTreeEntries(commit.tree) } : null;
		return head;
	}

	/**
	 * 現在のボードをコミットする。自動コミット（`allowEmpty` なし）は、先頭と同じ内容なら
	 * 何もしないで `null` を返す。
	 */
	function recordCommit(options: RecordCommitOptions): Promise<HistoryCommitSummary | null> {
		return serialize(async () => {
			const parent = await loadHead();
			const snapshot = await snapshotShapes(await deps.getShapes());
			const shapeCount = Object.keys(snapshot.entries).length;
			if (!options.allowEmpty) {
				if (parent ? parent.commit.tree === snapshot.tree.hash : shapeCount === 0) return null;
			}

			const createdAtMs = now();
			const commit: HistoryCommit = {
				tree: snapshot.tree.hash,
				parents: parent ? [parent.hash] : [],
				createdAt: new Date(createdAtMs).toISOString(),
				author: options.author ?? null,
				message: options.message ?? "",
				trigger: options.trigger,
			};
			const commitObject = await createCommit(commit);
			const diff = diffTrees(parent?.entries ?? {}, snapshot.entries);
			const summary: HistoryCommitSummary = {
				...commit,
				parents: [...commit.parents],
				hash: commitObject.hash,
				shapeCount,
				stats: {
					added: diff.added.length,
					removed: diff.removed.length,
					modified: diff.modified.length,
				},
			};

			// オブジェクトを先に書き、ログと先頭は 1 回の put でまとめて更新する。
			// 途中で落ちても残るのは参照されないオブジェクトだけ。
			await writeMissingObjects([...snapshot.blobs, snapshot.tree, commitObject]);
			await storage.put({
				[logKey(createdAtMs, commitObject.hash)]: summary,
				[HISTORY_HEAD_KEY]: commitObject.hash,
			});
			head = { hash: commitObject.hash, commit, entries: snapshot.entries };
			return summary;
		});
	}

	/** コミット一覧（新しい順）。`cursor` は前のページの `nextCursor`。 */
	async function listCommits(
		options: { limit?: number; cursor?: string | null } = {},
	): Promise<HistoryCommitPage> {
		const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 200);
		const cursor = options.cursor?.startsWith(HISTORY_LOG_PREFIX) ? options.cursor : undefined;
		const rows = await storage.list<HistoryCommitSummary>({
			prefix: HISTORY_LOG_PREFIX,
			reverse: true,
			limit: limit + 1,
			...(cursor ? { end: cursor } : {}),
		});
		const keys = [...rows.keys()];
		const page = keys.slice(0, limit);
		return {
			head: (await loadHead())?.hash ?? null,
			commits: page.map((key) => rows.get(key) as HistoryCommitSummary),
			nextCursor: keys.length > limit ? (page[page.length - 1] ?? null) : null,
		};
	}

	async function readShapes(
		entries: HistoryTreeEntries,
		ids: readonly string[],
		extra?: ReadonlyMap<string, string>,
	): Promise<Map<string, ShapeData>> {
		const hashes = ids.map((id) => entries[id]).filter((h): h is string => h !== undefined);
		const stored = await readObjects(hashes.filter((h) => !extra?.has(h)));
		const shapes = new Map<string, ShapeData>();
		for (const id of ids) {
			const hash = entries[id];
			if (hash === undefined) continue;
			const object = stored.get(hash);
			const body = extra?.get(hash) ?? (object?.kind === "blob" ? object.body : undefined);
			if (body === undefined) throw new Error(`history blob ${hash} is missing`);
			shapes.set(id, parseBlob(body));
		}
		return shapes;
	}

	/** コミット時点のボード全体。無ければ null。 */
	async function getCommit(hash: string): Promise<HistoryCommitDetail | null> {
		if (!isHistoryHash(hash)) return null;
		const commit = await readCommit(hash);
		if (!commit) return null;
		const entries = await readTreeEntries(commit.tree);
		const ids = Object.keys(entries).sort();
		const shapes = await readShapes(entries, ids);
		return { hash, commit, shapes: ids.map((id) => shapes.get(id) as ShapeData) };
	}

	/**
	 * 2 つの版の差分。`to` を省略（または `"working"`）すると現在のボードと比べる。
	 * どちらかのコミットが無ければ null。
	 */
	async function diff(from: string, to: string = "working"): Promise<HistoryDiffResult | null> {
		if (!isHistoryHash(from)) return null;
		const fromCommit = await readCommit(from);
		if (!fromCommit) return null;
		const fromEntries = await readTreeEntries(fromCommit.tree);

		let toEntries: HistoryTreeEntries;
		let workingBlobs: Map<string, string> | undefined;
		if (to === "working") {
			const snapshot = await snapshotShapes(await deps.getShapes());
			toEntries = snapshot.entries;
			workingBlobs = new Map(snapshot.blobs.map((b) => [b.hash, b.body]));
		} else {
			if (!isHistoryHash(to)) return null;
			const toCommit = await readCommit(to);
			if (!toCommit) return null;
			toEntries = await readTreeEntries(toCommit.tree);
		}

		const changed = diffTrees(fromEntries, toEntries);
		const before = await readShapes(fromEntries, [...changed.removed, ...changed.modified]);
		const after = await readShapes(
			toEntries,
			[...changed.added, ...changed.modified],
			workingBlobs,
		);
		return {
			from,
			to,
			added: changed.added.map((id) => after.get(id) as ShapeData),
			removed: changed.removed.map((id) => before.get(id) as ShapeData),
			modified: changed.modified.map((id) => {
				const b = before.get(id) as ShapeData;
				const a = after.get(id) as ShapeData;
				return { id, before: b, after: a, changes: diffShapeFields(b, a) };
			}),
		};
	}

	function clearTimer(): void {
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
	}

	/**
	 * 未コミットの変更を自動コミットする（先頭と同じ内容なら何もしない）。
	 * 最後の接続が切れたときにも呼ぶ。失敗は握りつぶしてログだけ残す。
	 */
	async function flushAutoCommit(): Promise<void> {
		clearTimer();
		firstPendingEditAt = null;
		try {
			await recordCommit({ trigger: "auto" });
		} catch (err) {
			console.error("[BoardRoom] auto commit failed:", err);
		}
	}

	/**
	 * ボードが編集されたことを知らせる。編集が `idleMs` 止まるか、最初の未コミット編集から
	 * `maxWaitMs` 経つと自動コミットする。
	 */
	function noteEdit(): void {
		const t = now();
		if (firstPendingEditAt === null) firstPendingEditAt = t;
		clearTimer();
		const delay = Math.max(0, Math.min(idleMs, firstPendingEditAt + maxWaitMs - t));
		idleTimer = setTimeout(() => {
			idleTimer = null;
			void flushAutoCommit();
		}, delay);
	}

	return { recordCommit, listCommits, getCommit, diff, noteEdit, flushAutoCommit };
}

export type HistoryManager = ReturnType<typeof createHistoryManager>;

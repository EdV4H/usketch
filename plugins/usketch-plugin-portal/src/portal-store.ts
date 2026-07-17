import { generateId } from "@edv4h/usketch-shared";
import type * as Y from "yjs";

/** A pinned widget: which shape, and where/how big on screen (screen px). */
export interface PortalEntry {
	id: string;
	shapeId: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A portal plus whether it lives in the shared (everyone) or private (me) backend. */
export interface PortalItem {
	entry: PortalEntry;
	shared: boolean;
}

export interface PortalBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PortalStore {
	/** All portals (private + shared), stable reference until the next change. */
	getAll(): PortalItem[];
	/** Pin a shape (private by default). Returns the created entry. */
	add(shapeId: string, box: PortalBox, shared?: boolean): PortalEntry;
	/** Move/resize a portal (screen px). */
	update(id: string, patch: Partial<PortalBox>): void;
	remove(id: string): void;
	/** Move a portal between the private and shared backends (keeps its id). */
	setShared(id: string, shared: boolean): void;
	/** Remove all of this user's private portals. */
	clearPrivate(): void;
	subscribe(cb: () => void): () => void;
	destroy(): void;
}

type MinimalStorage = Pick<Storage, "getItem" | "setItem">;

function storageKey(boardId: string | undefined, userId: string): string {
	return `usketch:portals:${boardId ?? "local"}:${userId}`;
}

/** localStorage may be unavailable (SSR / node tests / privacy mode) → in-memory fallback. */
function safeStorage(): MinimalStorage | null {
	try {
		if (typeof localStorage === "undefined") return null;
		return localStorage;
	} catch {
		return null;
	}
}

export interface CreatePortalStoreOptions {
	/** Shared Yjs doc — shared portals live in its `portals` map. */
	doc: Y.Doc;
	userId: string;
	boardId?: string;
	/** Injectable storage (tests). Defaults to `localStorage` when available. */
	storage?: MinimalStorage | null;
}

/** Portal panel header height (px) — shared with the layer for body sizing. */
export const PORTAL_HEADER_H = 30;
const MAX_W = 260;
const MAX_H = 200;
const MIN_W = 140;
const MIN_H = 100;

/**
 * Default panel box for a freshly pinned shape: fit its bounds into MAX_W×MAX_H
 * preserving aspect — the fit itself only downscales (`k ≤ 1`) — then apply a
 * MIN_W/MIN_H floor (which may enlarge the panel for very small shapes; the
 * renderer scales content to fill). Header height is added and the box cascades
 * from the top-right corner by `index` so multiple pins don't stack exactly.
 */
export function defaultPortalBox(
	bounds: { width: number; height: number },
	index: number,
	viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200,
): PortalBox {
	const k = Math.min(MAX_W / Math.max(1, bounds.width), MAX_H / Math.max(1, bounds.height), 1);
	const w = Math.max(MIN_W, Math.round(bounds.width * k));
	const h = Math.max(MIN_H, Math.round(bounds.height * k)) + PORTAL_HEADER_H;
	const margin = 16;
	const step = 28;
	const x = Math.max(margin, viewportWidth - w - margin - index * step);
	const y = margin + index * step;
	return { x, y, w, h };
}

export function createPortalStore(options: CreatePortalStoreOptions): PortalStore {
	const { doc, userId, boardId } = options;
	const storage = options.storage !== undefined ? options.storage : safeStorage();
	const key = storageKey(boardId, userId);
	const sharedMap = doc.getMap<PortalEntry>("portals");
	const listeners = new Set<() => void>();

	let priv: PortalEntry[] = loadPrivate();

	function loadPrivate(): PortalEntry[] {
		if (!storage) return [];
		try {
			const raw = storage.getItem(key);
			const parsed = raw ? JSON.parse(raw) : null;
			return Array.isArray(parsed) ? (parsed as PortalEntry[]) : [];
		} catch {
			return [];
		}
	}

	function persistPrivate() {
		if (!storage) return;
		try {
			storage.setItem(key, JSON.stringify(priv));
		} catch {
			// quota / disabled — keep in-memory copy only
		}
	}

	function computeSnapshot(): PortalItem[] {
		const shared: PortalItem[] = [];
		sharedMap.forEach((entry) => {
			if (entry) shared.push({ entry, shared: true });
		});
		const mine: PortalItem[] = priv.map((entry) => ({ entry, shared: false }));
		return [...mine, ...shared].sort((a, b) => a.entry.id.localeCompare(b.entry.id));
	}

	let snapshot = computeSnapshot();

	function refresh() {
		snapshot = computeSnapshot();
		for (const cb of listeners) cb();
	}

	const observer = () => refresh();
	sharedMap.observe(observer);

	const findPrivate = (id: string) => priv.find((e) => e.id === id);

	return {
		getAll: () => snapshot,

		add(shapeId, box, shared = false) {
			const entry: PortalEntry = { id: generateId(), shapeId, ...box };
			if (shared) {
				sharedMap.set(entry.id, entry); // observe → refresh
			} else {
				priv = [...priv, entry];
				persistPrivate();
				refresh();
			}
			return entry;
		},

		update(id, patch) {
			const p = findPrivate(id);
			if (p) {
				priv = priv.map((e) => (e.id === id ? { ...e, ...patch } : e));
				persistPrivate();
				refresh();
				return;
			}
			const s = sharedMap.get(id);
			if (s) sharedMap.set(id, { ...s, ...patch }); // observe → refresh
		},

		remove(id) {
			if (findPrivate(id)) {
				priv = priv.filter((e) => e.id !== id);
				persistPrivate();
				refresh();
				return;
			}
			if (sharedMap.has(id)) sharedMap.delete(id);
		},

		setShared(id, shared) {
			// In both directions we mutate the *other* backend first (silently), then
			// touch the Y.Map last so its observer fires exactly one refresh over an
			// already-consistent state — no double-notify, no transient frame where
			// the portal is missing or duplicated.
			if (shared) {
				const p = findPrivate(id);
				if (!p) return;
				priv = priv.filter((e) => e.id !== id);
				persistPrivate();
				sharedMap.set(id, p); // observer → single refresh
			} else {
				const s = sharedMap.get(id);
				if (!s) return;
				priv = [...priv, s];
				persistPrivate();
				sharedMap.delete(id); // observer → single refresh
			}
		},

		clearPrivate() {
			if (priv.length === 0) return;
			priv = [];
			persistPrivate();
			refresh();
		},

		subscribe(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},

		destroy() {
			sharedMap.unobserve(observer);
			listeners.clear();
		},
	};
}

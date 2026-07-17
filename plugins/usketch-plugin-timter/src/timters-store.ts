import type * as Y from "yjs";
import type { TimerEntry } from "./timer-model.js";

/**
 * Reactive view over the shared `timters` Y.Map (id → TimerEntry). The Y.Map is
 * the single source of truth (no separate local store), so there is no write-
 * back echo to guard against: mutations call `set`/`remove`, the map's `observe`
 * fires, and a fresh snapshot is pushed to subscribers. Writes relay + persist
 * for free via the existing Durable Object (any Y.Map update is generic).
 */
export interface TimtersStore {
	/** Current entries, sorted oldest-first. Stable reference until the next change. */
	getAll(): TimerEntry[];
	get(id: string): TimerEntry | undefined;
	/** Upsert an entry. */
	set(entry: TimerEntry): void;
	remove(id: string): void;
	clear(): void;
	subscribe(cb: () => void): () => void;
	destroy(): void;
}

export function createTimtersStore(doc: Y.Doc): TimtersStore {
	const map = doc.getMap<TimerEntry>("timters");
	const listeners = new Set<() => void>();

	function readAll(): TimerEntry[] {
		const out: TimerEntry[] = [];
		map.forEach((v) => {
			if (v) out.push(v);
		});
		out.sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id));
		return out;
	}

	let snapshot = readAll();

	const observer = () => {
		snapshot = readAll();
		for (const cb of listeners) cb();
	};
	map.observe(observer);

	return {
		getAll: () => snapshot,
		get: (id) => map.get(id),
		set: (entry) => map.set(entry.id, entry),
		remove: (id) => map.delete(id),
		clear: () =>
			doc.transact(() => {
				for (const key of [...map.keys()]) map.delete(key);
			}),
		subscribe: (cb) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		destroy: () => {
			map.unobserve(observer);
			listeners.clear();
		},
	};
}

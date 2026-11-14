// The board's height: one place that answers how high the ground and the solids on it
// stand at a world point, for everything that moves over the ground (a walking
// character, 3D shapes standing on hills, a follow camera).
//
// Plugins register providers instead of providing one service each:
//   - `ground` providers (a terrain): the highest-priority ACTIVE one answers, so a
//     terrain that only covers some boards (the elevation field) can sit above another
//     (the map's cells) without wrapping it;
//   - `solid` providers (walls and raised blocks): all of them count, the highest wins.
//
// The older single-provider services (`groundHeightService` / `solidHeightService`)
// keep working both ways until the next major: the registry answers them, and a plugin
// that still provides them is read as a provider.

import { groundHeightService } from "./ground-height.js";
import { defineService } from "./service.js";
import { solidHeightService } from "./solid-height.js";
import type { ServiceRegistry } from "./types/plugin.js";

/** What a height provider stands for. */
export type HeightKind = "ground" | "solid";

/** A height provider (see {@link BoardHeightApi.register}). */
export interface HeightProvider {
	/** Unique id, e.g. the plugin id. Registering the same id again replaces it. */
	id: string;
	kind: HeightKind;
	/**
	 * `ground`: the highest-priority active provider answers (default 0; ties: the later
	 * one). An older plugin still providing `groundHeightService` ranks just above 0.
	 */
	priority?: number;
	/** Whether it answers now (default: always). E.g. a terrain only on boards that have one. */
	active?: () => boolean;
	/**
	 * Height at a world point (world units). `ground`: `>= 0`, `null` = no answer here
	 * (the next provider answers). `solid`: `null` where there is none, a finite top that
	 * can be stood on, `Infinity` for a wall that can't be passed.
	 */
	heightAt(x: number, y: number): number | null;
}

/** The board's height (see the module comment). */
export interface BoardHeightApi {
	/** Add a provider. Returns its removal. */
	register(provider: HeightProvider): () => void;
	/** The ground's height at a world point (`0` with no provider). */
	groundAt(x: number, y: number): number;
	/** The top of the solids at a world point: `null` = none, `Infinity` = a wall. */
	solidAt(x: number, y: number): number | null;
	/** Where something standing at a world point stands: the ground, or a solid's finite top above it. */
	surfaceAt(x: number, y: number): number;
	/** The id of the ground provider answering now (`null`: none, or an older plugin's service). */
	owner(): string | null;
	/** Providers call it when their heights or `active` change. */
	notify(): void;
	/** Called after a provider is added / removed or calls `notify`. */
	subscribe(listener: () => void): () => void;
}

/** Typed service handle for the board's height. */
export const boardHeightService = defineService<BoardHeightApi>("usketch:board-height");

interface Slot {
	provider: HeightProvider;
	priority: number;
	seq: number;
}

/** The higher of two solid tops (`null` = none). */
function higherSolid(a: number | null, b: number | null): number | null {
	if (a === null || Number.isNaN(a)) return b;
	if (b === null || Number.isNaN(b)) return a;
	return Math.max(a, b);
}

/**
 * A board-height registry on its own (tests, or a host without the shared one). Pass
 * `services` to bridge the older ground / solid services (see the module comment).
 */
export function createBoardHeight(services?: ServiceRegistry): BoardHeightApi {
	let grounds: Slot[] = [];
	let solids: Slot[] = [];
	let seq = 0;
	const listeners = new Set<() => void>();
	const notify = (): void => {
		for (const fn of [...listeners]) fn();
	};
	const isActive = (p: HeightProvider): boolean => {
		try {
			return p.active ? p.active() : true;
		} catch {
			return false;
		}
	};

	// ── The older services ──
	// Their adapters answer from this registry. A plugin that provided one before the
	// registry existed is kept as the lowest ground / one more solid; one that provides
	// it later (replacing the adapter) answers first, as "the last provider wins" did.
	const groundAdapter = { heightAt: (x: number, y: number) => api.groundAt(x, y) };
	const solidAdapter = { heightAt: (x: number, y: number) => api.solidAt(x, y) };
	let earlyGround: { heightAt(x: number, y: number): number } | undefined;
	let earlySolid: { heightAt(x: number, y: number): number | null } | undefined;
	if (services) {
		earlyGround = groundHeightService.get(services);
		earlySolid = solidHeightService.get(services);
		groundHeightService.provide(services, groundAdapter);
		solidHeightService.provide(services, solidAdapter);
	}
	const lateGround = () => {
		const g = services ? groundHeightService.get(services) : undefined;
		return g && g !== groundAdapter ? g : undefined;
	};
	const lateSolid = () => {
		const s = services ? solidHeightService.get(services) : undefined;
		return s && s !== solidAdapter ? s : undefined;
	};
	// An older provider may fall back to the service it replaced (our adapter): while it
	// answers, a call back in skips the older providers so it can't loop.
	let inLegacy = false;
	const legacy = <T>(read: () => T, fallback: T): T => {
		if (inLegacy) return fallback;
		inLegacy = true;
		try {
			return read();
		} finally {
			inLegacy = false;
		}
	};

	// The registered grounds in order, with an older plugin's late-provided service read
	// between those ranked above the default priority and the rest (so a new terrain that
	// ranks itself higher still wins over an older one, and an older one over the default).
	const resolveGround = (x: number, y: number): { id: string | null; h: number } | null => {
		let lateChecked = inLegacy;
		const tryLate = (): { id: null; h: number } | null => {
			lateChecked = true;
			const late = lateGround();
			if (!late) return null;
			const h = legacy(() => late.heightAt(x, y), Number.NaN);
			return Number.isFinite(h) ? { id: null, h } : null;
		};
		for (const slot of grounds) {
			if (!lateChecked && slot.priority <= 0) {
				const hit = tryLate();
				if (hit) return hit;
			}
			if (!isActive(slot.provider)) continue;
			const h = slot.provider.heightAt(x, y);
			if (h !== null && Number.isFinite(h)) return { id: slot.provider.id, h };
		}
		if (!lateChecked) return tryLate();
		return null;
	};

	const api: BoardHeightApi = {
		register(provider) {
			const slot: Slot = { provider, priority: provider.priority ?? 0, seq: seq++ };
			const list = provider.kind === "solid" ? solids : grounds;
			const next = list.filter((s) => s.provider.id !== provider.id);
			next.push(slot);
			// Highest priority first; ties: the later registration first.
			next.sort((a, b) => b.priority - a.priority || b.seq - a.seq);
			if (provider.kind === "solid") solids = next;
			else grounds = next;
			notify();
			return () => {
				const before = provider.kind === "solid" ? solids : grounds;
				if (!before.includes(slot)) return;
				const after = before.filter((s) => s !== slot);
				if (provider.kind === "solid") solids = after;
				else grounds = after;
				notify();
			};
		},
		groundAt(x, y) {
			const hit = resolveGround(x, y);
			if (hit) return hit.h;
			if (earlyGround && !inLegacy) {
				const early = earlyGround;
				const h = legacy(() => early.heightAt(x, y), 0);
				if (Number.isFinite(h)) return h;
			}
			return 0;
		},
		solidAt(x, y) {
			let top: number | null = null;
			for (const slot of solids) {
				if (isActive(slot.provider)) top = higherSolid(top, slot.provider.heightAt(x, y));
			}
			if (!inLegacy) {
				const late = lateSolid();
				if (late)
					top = higherSolid(
						top,
						legacy(() => late.heightAt(x, y), null),
					);
				if (earlySolid && earlySolid !== late) {
					const early = earlySolid;
					top = higherSolid(
						top,
						legacy(() => early.heightAt(x, y), null),
					);
				}
			}
			return top;
		},
		surfaceAt(x, y) {
			const ground = api.groundAt(x, y);
			const solid = api.solidAt(x, y);
			return solid !== null && Number.isFinite(solid) ? Math.max(ground, solid) : ground;
		},
		owner() {
			for (const slot of grounds) {
				if (slot.priority <= 0 && lateGround()) return null;
				if (isActive(slot.provider)) return slot.provider.id;
			}
			return null;
		},
		notify,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
	return api;
}

/**
 * The board's height, providing it on first use. Both sides call this (a provider
 * registering and a reader asking), so neither has to come first. The core also puts
 * it on `ctx.height`.
 */
export function boardHeight(services: ServiceRegistry): BoardHeightApi {
	const existing = boardHeightService.get(services);
	if (existing) return existing;
	const registry = createBoardHeight(services);
	boardHeightService.provide(services, registry);
	return registry;
}

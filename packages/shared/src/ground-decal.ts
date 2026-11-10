import { defineService } from "./service.js";
import type { ServiceRegistry } from "./types/plugin.js";

/**
 * Ground decals: things painted ONTO the ground surface (a race course, a road, a
 * marking) rather than drawn as shapes over it. A terrain renderer (e.g. the elevation
 * plugin) paints them into its own ground, so under a 3D view (Mode 7) they follow
 * every hill and slope and are hidden behind hills like the ground itself, instead of
 * staying on the flat board plane as DOM layers do.
 *
 * Any plugin can add decals; the renderers read them. The registry is provided on first
 * use by whichever side comes first ({@link groundDecals}), so plugin order doesn't
 * matter. Without a renderer the decals are simply not drawn.
 */

/** Where a decal is painted: the flat board's ground (`"flat"`) and / or the 3D ground (`"3d"`). */
export type GroundDecalView = "flat" | "3d";

/** An axis-aligned world rect (world units). */
export interface GroundDecalRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** What one paint call covers. */
export interface GroundDecalArea {
	/** The world rect being painted (one ground tile, plus a small margin). */
	rect: GroundDecalRect;
	/** Bitmap px per world unit here: coarser for far / zoomed-out ground. */
	pxPerUnit: number;
	/** Which ground is being painted. */
	view: GroundDecalView;
}

export interface GroundDecal {
	/**
	 * Paint the decal in WORLD units: `ctx` is already transformed (1 unit = 1 world
	 * unit) and clipped to `area.rect`, so draw as if on an infinite board. Called for
	 * every ground tile that meets {@link bounds} whenever that tile is (re)painted:
	 * keep it cheap and pure (it may run many times, in any order). Use
	 * `area.pxPerUnit` for things that must stay a minimum size on screen.
	 */
	paint(ctx: CanvasRenderingContext2D, area: GroundDecalArea): void;
	/**
	 * The world rect the decal can paint in, or `null` / absent for anywhere. Tiles
	 * outside it are skipped (and need no bitmap at all), so give it when you can.
	 * Read on `set` and on every `invalidate` (cached in between): call `invalidate`
	 * when it changes.
	 */
	bounds?(): GroundDecalRect | null;
	/** Which grounds it is painted on. Default both. */
	views?: readonly GroundDecalView[];
	/** Paint order among decals: lower first (underneath). Default 0, then by id. */
	order?: number;
}

/** A registered decal with its id. */
export interface GroundDecalEntry {
	id: string;
	decal: GroundDecal;
}

export interface GroundDecalApi {
	/** Add decal `id`, or replace it. Returns a function that removes it (if still this one). */
	set(id: string, decal: GroundDecal): () => void;
	/** Remove decal `id` (no-op if absent). */
	remove(id: string): void;
	/**
	 * Repaint decal `id` because what it paints changed, and re-read its bounds. `rect`
	 * limits the repaint to that world area (e.g. the stroke that changed); default: its
	 * bounds before and after (everywhere without bounds).
	 */
	invalidate(id: string, rect?: GroundDecalRect | null): void;
	/** The decals in paint order. */
	list(): readonly GroundDecalEntry[];
	/** The decals painted on `view` whose bounds meet `rect`, in paint order. */
	listFor(view: GroundDecalView, rect: GroundDecalRect): readonly GroundDecalEntry[];
	/** Increases on every change (a renderer remembers it per painted tile). */
	version(): number;
	/**
	 * Whether anything painted on `view` within `rect` changed after `version` — i.e. a
	 * tile painted at `version` must be repainted. `true` when the change log no longer
	 * reaches back that far.
	 */
	changedSince(version: number, view: GroundDecalView, rect: GroundDecalRect): boolean;
	/** Notified after every change. Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

/** Typed service handle for the board's ground-decal registry. */
export const groundDecalService = defineService<GroundDecalApi>("usketch:ground-decals");

/** The default views of a decal. */
export const ALL_GROUND_DECAL_VIEWS: readonly GroundDecalView[] = ["flat", "3d"];

/** Whether two world rects overlap (touching edges don't count). `null` = everywhere. Pure. */
export function decalRectsMeet(a: GroundDecalRect | null, b: GroundDecalRect | null): boolean {
	if (!a || !b) return true;
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The smallest rect holding both; `null` (everywhere) if either is. Pure. */
function unionRect(a: GroundDecalRect | null, b: GroundDecalRect | null): GroundDecalRect | null {
	if (!a || !b) return null;
	return {
		left: Math.min(a.left, b.left),
		top: Math.min(a.top, b.top),
		right: Math.max(a.right, b.right),
		bottom: Math.max(a.bottom, b.bottom),
	};
}

function sameRect(a: GroundDecalRect | null, b: GroundDecalRect | null): boolean {
	if (!a || !b) return a === b;
	return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

/** A decal's bounds, checked (a non-finite or inverted rect counts as everywhere). */
function boundsOf(decal: GroundDecal): GroundDecalRect | null {
	const b = decal.bounds?.() ?? null;
	if (!b) return null;
	const ok =
		[b.left, b.top, b.right, b.bottom].every(Number.isFinite) &&
		b.right >= b.left &&
		b.bottom >= b.top;
	return ok ? b : null;
}

/** A decal's views (default both). */
function viewsOf(decal: GroundDecal): readonly GroundDecalView[] {
	return decal.views && decal.views.length > 0 ? decal.views : ALL_GROUND_DECAL_VIEWS;
}

/** A registered decal with its bounds and views, read on `set` / `invalidate`. */
interface Slot {
	decal: GroundDecal;
	bounds: GroundDecalRect | null;
	views: readonly GroundDecalView[];
}

const slotOf = (decal: GroundDecal): Slot => ({
	decal,
	bounds: boundsOf(decal),
	views: viewsOf(decal),
});

interface Change {
	version: number;
	rect: GroundDecalRect | null;
	views: readonly GroundDecalView[];
}

/** Changes kept for {@link GroundDecalApi.changedSince}; older tiles just repaint. */
const CHANGE_LOG = 256;

/** A new, empty registry (the service's implementation; usually reached via {@link groundDecals}). */
export function createGroundDecalRegistry(): GroundDecalApi {
	const decals = new Map<string, Slot>();
	let sorted: (GroundDecalEntry & { slot: Slot })[] | null = null;
	let version = 0;
	let changes: Change[] = [];
	// Versions up to this one are no longer in the log.
	let forgotten = 0;
	const listeners = new Set<() => void>();

	const record = (rect: GroundDecalRect | null, views: readonly GroundDecalView[]) => {
		version++;
		changes.push({ version, rect, views });
		if (changes.length > CHANGE_LOG) {
			const drop = changes.length - CHANGE_LOG;
			forgotten = changes[drop - 1].version;
			changes = changes.slice(drop);
		}
		for (const l of [...listeners]) l();
	};

	const sortedSlots = () => {
		if (!sorted) {
			sorted = [...decals]
				.map(([id, slot]) => ({ id, decal: slot.decal, slot }))
				.sort(
					(a, b) =>
						(a.decal.order ?? 0) - (b.decal.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
				);
		}
		return sorted;
	};
	const list = (): readonly GroundDecalEntry[] =>
		sortedSlots().map(({ id, decal }) => ({ id, decal }));

	const api: GroundDecalApi = {
		set(id, decal) {
			const prev = decals.get(id);
			const slot = slotOf(decal);
			decals.set(id, slot);
			sorted = null;
			const views = prev ? [...new Set([...prev.views, ...slot.views])] : slot.views;
			record(prev ? unionRect(prev.bounds, slot.bounds) : slot.bounds, views);
			return () => {
				if (decals.get(id)?.decal === decal) api.remove(id);
			};
		},
		remove(id) {
			const prev = decals.get(id);
			if (!prev) return;
			decals.delete(id);
			sorted = null;
			record(prev.bounds, prev.views);
		},
		invalidate(id, rect) {
			const slot = decals.get(id);
			if (!slot) return;
			const before = slot.bounds;
			slot.bounds = boundsOf(slot.decal);
			// Bounds that moved also repaint where they were and are (tiles that already
			// hold other decals there must pick this one up / drop it).
			const moved = !sameRect(before, slot.bounds);
			const changed =
				rect === undefined
					? unionRect(before, slot.bounds)
					: moved
						? unionRect(rect, unionRect(before, slot.bounds))
						: rect;
			record(changed, slot.views);
		},
		list,
		listFor(view, rect) {
			const out: GroundDecalEntry[] = [];
			for (const { id, decal, slot } of sortedSlots()) {
				if (slot.views.includes(view) && decalRectsMeet(slot.bounds, rect)) out.push({ id, decal });
			}
			return out;
		},
		version: () => version,
		changedSince(since, view, rect) {
			if (since >= version) return false;
			if (since < forgotten) return true;
			for (let i = changes.length - 1; i >= 0; i--) {
				const c = changes[i];
				if (c.version <= since) break;
				if (c.views.includes(view) && decalRectsMeet(c.rect, rect)) return true;
			}
			return false;
		},
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
 * The board's ground-decal registry, providing a new one on first use. Both sides call
 * this — a plugin adding decals and a renderer painting them — so neither has to come
 * first.
 */
export function groundDecals(services: ServiceRegistry): GroundDecalApi {
	const existing = groundDecalService.get(services);
	if (existing) return existing;
	const registry = createGroundDecalRegistry();
	groundDecalService.provide(services, registry);
	return registry;
}

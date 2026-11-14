// Shapes another renderer draws instead of the flat one right now (e.g. stood up in 3D):
// the 2D renderer reads the claims and skips those shapes. Each `source` owns its own set
// — claiming again replaces it, an empty set releases it — so several renderers don't
// undo each other; the union of all of them is skipped.
//
// It replaces the DOM renderer's `renderer:hide-shapes` event, which the DOM renderer
// still honours until the next major.
import { defineService } from "./service.js";
import type { ServiceRegistry } from "./types/plugin.js";

/** The board's shape claims (see the module comment). */
export interface ShapeClaimsApi {
	/** Claim exactly `ids` for `source` (replacing its earlier claim); empty = release. */
	claim(source: string, ids: Iterable<string>): void;
	/** Every source's claims together; `undefined` when nothing is claimed. */
	claimed(): ReadonlySet<string> | undefined;
	/** Notified after the claimed set changes. Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

/** Typed service handle for the board's shape claims. */
export const shapeClaimsService = defineService<ShapeClaimsApi>("usketch:shape-claims");

/** The union of every source's ids (`undefined` when there are none). Pure. */
export function unionShapeIds(
	bySource: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlySet<string> | undefined {
	let only: ReadonlySet<string> | undefined;
	let merged: Set<string> | undefined;
	for (const ids of bySource.values()) {
		if (ids.size === 0) continue;
		if (!only) {
			only = ids;
			continue;
		}
		merged ??= new Set(only);
		for (const id of ids) merged.add(id);
	}
	return merged ?? only;
}

function sameIds(a: ReadonlySet<string> | undefined, b: ReadonlySet<string>): boolean {
	if ((a?.size ?? 0) !== b.size) return false;
	for (const id of b) if (!a?.has(id)) return false;
	return true;
}

/** A shape-claims registry on its own (tests, or a host without the shared one). */
export function createShapeClaims(): ShapeClaimsApi {
	const bySource = new Map<string, ReadonlySet<string>>();
	let union: ReadonlySet<string> | undefined;
	const listeners = new Set<() => void>();
	return {
		claim(source, ids) {
			const next = new Set<string>();
			for (const id of ids) if (typeof id === "string") next.add(id);
			if (sameIds(bySource.get(source), next)) return;
			if (next.size === 0) bySource.delete(source);
			else bySource.set(source, next);
			union = unionShapeIds(bySource);
			for (const fn of [...listeners]) fn();
		},
		claimed: () => union,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

/**
 * The board's shape claims, providing them on first use. Both sides call this (a renderer
 * claiming and the 2D renderer reading), so neither has to come first.
 */
export function shapeClaims(services: ServiceRegistry): ShapeClaimsApi {
	const existing = shapeClaimsService.get(services);
	if (existing) return existing;
	const claims = createShapeClaims();
	shapeClaimsService.provide(services, claims);
	return claims;
}

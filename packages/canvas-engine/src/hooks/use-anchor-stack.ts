import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

/** Registered anchor overlay occupying space on a side of a shape group. */
export interface AnchorSlot {
	id: string;
	position: "top" | "bottom" | "left" | "right";
	height: number;
	width: number;
	/** True if this overlay is at a fallback position (moved from its primary). */
	isFallback: boolean;
}

/** Shared registry for anchor overlay positions to avoid overlapping. */
export class AnchorStackRegistry {
	private slots = new Map<string, AnchorSlot>();
	private listeners = new Set<() => void>();

	register(slot: AnchorSlot): void {
		this.slots.set(slot.id, slot);
		this.notify();
	}

	unregister(id: string): void {
		this.slots.delete(id);
		this.notify();
	}

	/**
	 * Get the offset for an overlay to avoid overlapping with others on the same side.
	 *
	 * Non-fallback overlays sit closest to the shape (offset = 0).
	 * Fallback overlays stack beyond non-fallback ones.
	 */
	getStackOffset(
		position: "top" | "bottom" | "left" | "right",
		excludeId: string,
		isFallback: boolean,
		gap: number,
	): number {
		let offset = 0;
		for (const [id, slot] of this.slots) {
			if (id === excludeId) continue;
			if (slot.position !== position) continue;
			// A non-fallback overlay doesn't need to move for anyone
			// A fallback overlay stacks beyond non-fallback ones (and other fallbacks registered before it)
			if (!isFallback) continue;
			offset += (position === "top" || position === "bottom" ? slot.height : slot.width) + gap;
		}
		return offset;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): ReadonlyMap<string, AnchorSlot> {
		return this.slots;
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}

export const AnchorStackContext = createContext<AnchorStackRegistry | null>(null);

export function useAnchorStack(): AnchorStackRegistry {
	const ctx = useContext(AnchorStackContext);
	if (!ctx) {
		throw new Error("useAnchorStack must be used within an AnchorStackContext.Provider");
	}
	return ctx;
}

export function useAnchorStackOffset(
	registry: AnchorStackRegistry,
	position: "top" | "bottom" | "left" | "right",
	excludeId: string,
	isFallback: boolean,
	gap: number,
): number {
	const subscribe = useCallback((cb: () => void) => registry.subscribe(cb), [registry]);
	const getSnapshot = useCallback(
		() => registry.getStackOffset(position, excludeId, isFallback, gap),
		[registry, position, excludeId, isFallback, gap],
	);
	return useSyncExternalStore(subscribe, getSnapshot);
}

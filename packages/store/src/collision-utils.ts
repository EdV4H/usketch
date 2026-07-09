import type { BoardStore, BoundingBox, EventBus, ShapeData } from "@edv4h/usketch-shared";

/** AABB intersection test */
export function intersectsAABB(a: BoundingBox, b: BoundingBox): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Returns true if container fully contains child */
export function containsAABB(container: BoundingBox, child: BoundingBox): boolean {
	return (
		container.x <= child.x &&
		container.y <= child.y &&
		container.x + container.width >= child.x + child.width &&
		container.y + container.height >= child.y + child.height
	);
}

function shapeToBounds(shape: ShapeData): BoundingBox {
	return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

/** Find all shapes that intersect with the target shape */
export function findIntersecting(
	store: BoardStore,
	targetId: string,
	filter?: (s: ShapeData) => boolean,
): ShapeData[] {
	const target = store.getShape(targetId);
	if (!target) return [];
	const targetBounds = shapeToBounds(target);
	const result: ShapeData[] = [];
	for (const [id, shape] of store.getShapes()) {
		if (id === targetId) continue;
		if (filter && !filter(shape)) continue;
		if (intersectsAABB(targetBounds, shapeToBounds(shape))) {
			result.push(shape);
		}
	}
	return result;
}

/** Find shapes that fully contain the child shape (for frame detection) */
export function findContainers(
	store: BoardStore,
	childId: string,
	filter?: (s: ShapeData) => boolean,
): ShapeData[] {
	const child = store.getShape(childId);
	if (!child) return [];
	const childBounds = shapeToBounds(child);
	const result: ShapeData[] = [];
	for (const [id, shape] of store.getShapes()) {
		if (id === childId) continue;
		if (filter && !filter(shape)) continue;
		if (containsAABB(shapeToBounds(shape), childBounds)) {
			result.push(shape);
		}
	}
	return result;
}

/** Find shapes fully contained within the container shape */
export function findContained(
	store: BoardStore,
	containerId: string,
	filter?: (s: ShapeData) => boolean,
): ShapeData[] {
	const container = store.getShape(containerId);
	if (!container) return [];
	const containerBounds = shapeToBounds(container);
	const result: ShapeData[] = [];
	for (const [id, shape] of store.getShapes()) {
		if (id === containerId) continue;
		if (filter && !filter(shape)) continue;
		if (containsAABB(containerBounds, shapeToBounds(shape))) {
			result.push(shape);
		}
	}
	return result;
}

export interface CollisionWatcherOptions {
	store: BoardStore;
	events: EventBus;
	/** Shape types to monitor (all types if omitted) */
	watchTypes?: string[];
	/** Collision detection mode */
	mode: "intersect" | "contain";
	/**
	 * Predicate identifying container shapes for `mode: "contain"`. Defaults to
	 * the legacy `type === "frame"` check; pass a registry-aware predicate to
	 * treat any shape whose definition marks it as a container.
	 */
	isContainer?: (shape: ShapeData) => boolean;
}

/** Watch for shape changes and emit collision events */
export function createCollisionWatcher(options: CollisionWatcherOptions): () => void {
	const { store, events, watchTypes, mode } = options;
	const isContainer = options.isContainer ?? ((s: ShapeData) => s.type === "frame");
	const containmentMap = new Map<string, string>(); // childId -> containerId

	const unsubscribe = store.onMutation((event) => {
		if (event.type !== "shape:updated" && event.type !== "shape:added") return;
		const payload = event.payload as { id: string } | undefined;
		if (!payload?.id) return;

		const shape = store.getShape(payload.id);
		if (!shape) return;
		if (watchTypes && !watchTypes.includes(shape.type)) return;

		if (mode === "contain") {
			// Check if this shape is now contained by a frame
			const containers = findContainers(store, payload.id, isContainer);
			const smallestContainer = containers.reduce<ShapeData | null>((best, c) => {
				if (!best) return c;
				return c.width * c.height < best.width * best.height ? c : best;
			}, null);

			const prevContainerId = containmentMap.get(payload.id);
			const newContainerId = smallestContainer?.id;

			if (prevContainerId !== newContainerId) {
				if (prevContainerId) {
					containmentMap.delete(payload.id);
					events.emit("collision:released", {
						childId: payload.id,
						containerId: prevContainerId,
					});
				}
				if (newContainerId) {
					containmentMap.set(payload.id, newContainerId);
					events.emit("collision:contained", {
						childId: payload.id,
						containerId: newContainerId,
					});
				}
			}
		} else {
			// Intersect mode — for connector source/target movement tracking
			events.emit("collision:source-moved", {
				connectorId: payload.id,
				sourceId: payload.id,
			});
		}
	});

	return unsubscribe;
}

// The pointer in a 3D view of the board: while the board is shown in 3D (its 3D view
// state's amount above 0), a pointer's world point is what is under it in the view —
// a 3D shape's face (mapped back into the shape's own box), a flat shape where it lies,
// or the ground — instead of the flat screen → world transform. A drag keeps the height
// it went down at and its offset from the point picked, so what is dragged follows the
// ground under the pointer without a jump. The same for every 3D renderer (the shapes
// are where `shapeView3dFaces` puts them).
import {
	type BoardHeightApi,
	type BoardStore,
	createView3dTracker,
	declaredView3dShapeTypes,
	type EventBus,
	type Point,
	pickView3d,
	type RenderMode,
	type ServiceRegistry,
	type ShapeRegistry,
	type ShapeView3d,
	type StageSize,
	sanitizeView3dShapeLimits,
	screenRectToWorldBounds,
	selectView3dShapes,
	unprojectWorld,
	type View3dPick,
	type View3dProjection,
	view3dCellOf,
	view3dDragPoint,
	view3dOverscanPx,
	view3dProjection,
	view3dShapeSourceService,
} from "@edv4h/usketch-shared";

/** Which part of a pointer gesture a point is for. */
export type View3dPointerPhase = "down" | "move" | "up";

export interface View3dPointer {
	/**
	 * The world point under a stage point (px from the container's top-left) while the
	 * board is shown in 3D, or `null` when it is flat (or the point shows only sky): use
	 * the flat transform then. `pointerId` ties a drag's moves to its down.
	 */
	map(
		screen: Point,
		stage: StageSize,
		phase: View3dPointerPhase,
		pointerId: number,
		renderMode: RenderMode,
	): Point | null;
	/** What is under a stage point in the 3D view, or `null` (flat, or only sky). */
	pick(screen: Point, stage: StageSize, renderMode: RenderMode): View3dPick | null;
	dispose(): void;
}

export interface View3dPointerDeps {
	store: BoardStore;
	shapes: ShapeRegistry;
	services: ServiceRegistry;
	events: EventBus;
	height: BoardHeightApi;
}

/** The pointer's 3D mapping for a board (see the file comment). */
export function createView3dPointer(deps: View3dPointerDeps): View3dPointer {
	const cell = view3dCellOf(deps.store);
	// Built on first use in 3D, so a canvas that never goes 3D (or a bare test app
	// without services) never watches for it.
	let tracker: ReturnType<typeof createView3dTracker> | null = null;
	let declared: ReturnType<typeof declaredView3dShapeTypes> | null = null;
	const yawNow = (): number => {
		if (!deps.services) return 0;
		tracker ??= createView3dTracker(deps.services, deps.events);
		return tracker.get().yaw;
	};
	const declaredTypes = () => {
		declared ??= declaredView3dShapeTypes(deps.shapes, () => {});
		return declared.get();
	};
	let drag: { pointerId: number; height: number; offset: Point } | null = null;

	const shapesIn3d = (
		view: View3dProjection,
		amount: number,
		renderMode: RenderMode,
	): Map<string, ShapeView3d> => {
		const source = deps.services ? view3dShapeSourceService.get(deps.services) : undefined;
		const { viewport, stage } = view;
		const entries = selectView3dShapes({
			shapes: deps.store.getShapesSorted(),
			types: source?.types?.() ?? declaredTypes(),
			viewport,
			viewportBounds: screenRectToWorldBounds(stage.width, stage.height, viewport),
			overscanPx: cell ? view3dOverscanPx(cell.get(), viewport.zoom, stage.height) : 0,
			renderMode,
			amount,
			limits: sanitizeView3dShapeLimits(source?.limits?.()),
			heightAt: (x, y) => deps.height.groundAt(x, y),
		});
		return new Map(entries.map((e) => [e.shape.id, e.params]));
	};

	const pickIn = (
		screen: Point,
		view: View3dProjection,
		amount: number,
		renderMode: RenderMode,
	): View3dPick | null =>
		pickView3d({
			x: screen.x,
			y: screen.y,
			view,
			shapes: deps.store.getShapesSorted(),
			view3d: shapesIn3d(view, amount, renderMode),
			amount,
			yaw: yawNow(),
			hitTest: (shape, point) => deps.shapes.get(shape.type)?.hitTest(shape, point) ?? false,
			groundAt: (x, y) => deps.height.groundAt(x, y),
		});

	/** The 3D view's projection now, or `null` while the board is flat. */
	const viewNow = (stage: StageSize): { view: View3dProjection; amount: number } | null => {
		const state = cell?.get();
		if (!state || !(state.amount > 0) || !(stage.width > 0 && stage.height > 0)) return null;
		return {
			view: view3dProjection(state, deps.store.getViewport(), stage),
			amount: state.amount,
		};
	};

	return {
		map(screen, stage, phase, pointerId, renderMode) {
			const now = viewNow(stage);
			if (!now) {
				drag = null;
				return null;
			}
			const { view } = now;
			if (drag && drag.pointerId === pointerId && phase !== "down") {
				const p = view3dDragPoint(screen.x, screen.y, view, drag);
				if (phase === "up") drag = null;
				return p;
			}
			const pick = pickIn(screen, view, now.amount, renderMode);
			if (!pick) return null;
			if (phase === "down") {
				const under = unprojectWorld(screen.x, screen.y, view, pick.height);
				drag = {
					pointerId,
					height: pick.height,
					offset: under ? { x: pick.point.x - under.x, y: pick.point.y - under.y } : { x: 0, y: 0 },
				};
			}
			return pick.point;
		},
		pick(screen, stage, renderMode) {
			const now = viewNow(stage);
			return now ? pickIn(screen, now.view, now.amount, renderMode) : null;
		},
		dispose() {
			tracker?.dispose();
			declared?.dispose();
			tracker = null;
			declared = null;
			drag = null;
		},
	};
}

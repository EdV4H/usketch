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
	type OutlineRun,
	type Point,
	pickView3d,
	projectQuad3d,
	type Quad3d,
	quadOutlineRuns,
	type RenderMode,
	type ServiceRegistry,
	type ShapeData,
	type ShapeRegistry,
	type ShapeView3d,
	type StageSize,
	sanitizeView3dShapeLimits,
	screenRectToWorldBounds,
	selectView3dShapes,
	shapeView3dQuad,
	unprojectWorld,
	type View3dPick,
	type View3dProjection,
	type View3dShapeFaces,
	type View3dState,
	view3dCellOf,
	view3dDragPoint,
	view3dOverscanPx,
	view3dProjection,
	view3dShapeFacesIn,
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
	/** Where a shape is drawn on the stage in the 3D view (corners), or `null`. */
	outline(shapeId: string, stage: StageSize, renderMode: RenderMode): Point[] | null;
	/** The same outline, cut where the ground hides it from the eye, or `null`. */
	outlineRuns(shapeId: string, stage: StageSize, renderMode: RenderMode): OutlineRun[] | null;
	/** The faces of the shapes drawn in the 3D view now (in view + overscan); `[]` when flat. */
	facesInView(stage: StageSize, renderMode: RenderMode): View3dShapeFaces[];
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

	// Which shapes are drawn in 3D scans the whole board. The select tool outlines every
	// selected shape in one render (`outline` / `outlineRuns` per id), so the last answer
	// is kept for the same shapes, viewport, 3D state, stage and render mode until the
	// task ends (a microtask) or the ground changes, instead of one scan per shape.
	let memo: {
		shapes: readonly ShapeData[];
		viewport: View3dProjection["viewport"];
		state: View3dState | undefined;
		width: number;
		height: number;
		amount: number;
		renderMode: RenderMode;
		result: Map<string, ShapeView3d>;
	} | null = null;
	let offHeight: (() => void) | null = null;

	const shapesIn3d = (
		view: View3dProjection,
		amount: number,
		renderMode: RenderMode,
	): Map<string, ShapeView3d> => {
		const shapes = deps.store.getShapesSorted();
		const state = cell?.get();
		const { viewport, stage } = view;
		if (
			memo &&
			memo.shapes === shapes &&
			memo.viewport === viewport &&
			memo.state === state &&
			memo.width === stage.width &&
			memo.height === stage.height &&
			memo.amount === amount &&
			memo.renderMode === renderMode
		) {
			return memo.result;
		}
		const source = deps.services ? view3dShapeSourceService.get(deps.services) : undefined;
		const entries = selectView3dShapes({
			shapes,
			types: source?.types?.() ?? declaredTypes(),
			viewport,
			viewportBounds: screenRectToWorldBounds(stage.width, stage.height, viewport),
			overscanPx: cell ? view3dOverscanPx(cell.get(), viewport.zoom, stage.height) : 0,
			renderMode,
			amount,
			limits: sanitizeView3dShapeLimits(source?.limits?.()),
			heightAt: (x, y) => deps.height.groundAt(x, y),
		});
		const result = new Map(entries.map((e) => [e.shape.id, e.params]));
		if (!memo) queueMicrotask(() => (memo = null));
		offHeight ??= deps.height.subscribe(() => (memo = null));
		memo = {
			shapes,
			viewport,
			state,
			width: stage.width,
			height: stage.height,
			amount,
			renderMode,
			result,
		};
		return result;
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

	const groundAt = (x: number, y: number) => deps.height.groundAt(x, y);

	/** Where a shape is drawn in the 3D view now (world units), or `null`. */
	const drawnQuad = (
		shapeId: string,
		stage: StageSize,
		renderMode: RenderMode,
	): { quad: Quad3d; view: View3dProjection } | null => {
		const now = viewNow(stage);
		const shape = now ? deps.store.getShape(shapeId) : undefined;
		if (!now || !shape || shape.hidden) return null;
		const params = shapesIn3d(now.view, now.amount, renderMode).get(shapeId);
		const quad = shapeView3dQuad(shape, params, {
			amount: now.amount,
			yaw: params ? yawNow() : 0,
			viewportRotation: now.view.viewport.rotation ?? 0,
			groundAt,
		});
		return { quad, view: now.view };
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
		outline(shapeId, stage, renderMode) {
			const drawn = drawnQuad(shapeId, stage, renderMode);
			return drawn ? projectQuad3d(drawn.quad, drawn.view) : null;
		},
		outlineRuns(shapeId, stage, renderMode) {
			const drawn = drawnQuad(shapeId, stage, renderMode);
			return drawn ? quadOutlineRuns(drawn.quad, drawn.view, groundAt) : null;
		},
		facesInView(stage, renderMode) {
			const now = viewNow(stage);
			if (!now) return [];
			const { viewport } = now.view;
			const view3d = shapesIn3d(now.view, now.amount, renderMode);
			const b = screenRectToWorldBounds(stage.width, stage.height, viewport);
			const overscan = cell ? view3dOverscanPx(cell.get(), viewport.zoom, stage.height) : 0;
			const pad = viewport.zoom > 0 && overscan > 0 ? overscan / viewport.zoom : 0;
			return view3dShapeFacesIn({
				shapes: deps.store.getShapesSorted(),
				view3d,
				amount: now.amount,
				yaw: view3d.size > 0 ? yawNow() : 0,
				viewportRotation: viewport.rotation ?? 0,
				bounds: {
					x: b.x - pad,
					y: b.y - pad,
					width: b.width + 2 * pad,
					height: b.height + 2 * pad,
				},
				groundAt,
			});
		},
		dispose() {
			tracker?.dispose();
			declared?.dispose();
			offHeight?.();
			tracker = null;
			declared = null;
			offHeight = null;
			memo = null;
			drag = null;
		},
	};
}

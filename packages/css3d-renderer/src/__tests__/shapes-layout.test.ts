import {
	normalizeShapeView3d as normalizeShape3d,
	LEGACY_SHAPE_VIEW_3D_KEY as SHAPE_3D_KEY,
	type ShapeView3d as Shape3dParams,
	type ShapeData,
	type Viewport,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	boxTopTransform,
	boxWalls,
	DEFAULT_CSS3D_SHAPE_LIMITS as DEFAULT_SHAPE_3D_LIMITS,
	GROUND_FLAT_PARAMS,
	lerpAngle,
	poseBox,
	poseTransform,
	render3dFrame,
	selectShapes3d,
	shadowStyle,
	shapeAnchor,
	shapePose,
	standFoot,
	wallColor,
} from "../shapes-layout.js";

const shape = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): ShapeData =>
	({
		id,
		type: "rect",
		x,
		y,
		width: 40,
		height: 20,
		style: {},
		[SHAPE_3D_KEY]: { mode: "stand" },
		...extra,
	}) as unknown as ShapeData;

const params = (raw: Record<string, unknown> = {}) =>
	normalizeShape3d({ mode: "stand", ...raw }) as Shape3dParams;
const vp = (zoom = 1, rotation = 0): Viewport => ({ x: 0, y: 0, zoom, rotation });

describe("standFoot", () => {
	it("is the middle of the bottom edge", () => {
		expect(standFoot(shape("a", 0, 0))).toEqual({ x: 20, y: 20 });
	});
	it("follows the shape's rotation", () => {
		const foot = standFoot(shape("a", 0, 0, { rotation: 90 }));
		// Rotated 90° clockwise about its centre (20, 10): the bottom edge points left.
		expect(foot.x).toBeCloseTo(10);
		expect(foot.y).toBeCloseTo(10);
	});
});

describe("lerpAngle", () => {
	it("turns the short way round", () => {
		expect(lerpAngle(170, -170, 0.5)).toBe(180);
		expect(lerpAngle(10, 30, 0.5)).toBe(20);
	});
});

describe("shapePose / poseTransform", () => {
	it("lies flat where the board draws it at amount 0", () => {
		const p = shapePose(shape("a", 0, 0, { rotation: 30 }), params(), {
			viewport: vp(2, 15),
			amount: 0,
			yaw: 40,
			groundHeight: 0,
		});
		expect(p.raise).toBe(0);
		expect(p.face).toBe(45); // rotation + viewport rotation
		expect(poseTransform(p)).toBe("rotateZ(45deg)");
	});
	it("stands up and faces the camera (against its yaw) at amount 1", () => {
		const p = shapePose(shape("a", 0, 0), params(), {
			viewport: vp(2),
			amount: 1,
			yaw: 40,
			groundHeight: 16,
		});
		expect(p).toMatchObject({ x: 40, y: 40, face: -40, raise: 1, lift: 32 });
		expect(poseTransform(p)).toBe("translateZ(32px) rotateZ(-40deg) rotateX(-90deg)");
	});
	it("keeps its own heading when fixed", () => {
		const p = shapePose(shape("a", 0, 0, { rotation: 30 }), params({ facing: "fixed" }), {
			viewport: vp(),
			amount: 1,
			yaw: 40,
			groundHeight: 0,
		});
		expect(p.face).toBe(30);
	});
	it("ignores the ground when told to", () => {
		const p = shapePose(shape("a", 0, 0), params({ ground: false }), {
			viewport: vp(),
			amount: 1,
			yaw: 0,
			groundHeight: 48,
		});
		expect(p.lift).toBe(0);
	});
	it("half stands up mid-transition", () => {
		const p = shapePose(shape("a", 0, 0), params(), {
			viewport: vp(),
			amount: 0.5,
			yaw: 0,
			groundHeight: 0,
		});
		expect(poseTransform(p)).toBe("rotateX(-45deg)");
	});
});

describe("poseBox / shadowStyle", () => {
	it("sizes the node to the shape on screen with its bottom-centre at the foot", () => {
		expect(poseBox({ x: 100, y: 50, width: 40, height: 20, zoom: 2 })).toEqual({
			left: 60,
			top: 10,
			width: 80,
			height: 40,
		});
	});
	it("has no transform when flat, unrotated and on flat ground", () => {
		const p = shapePose(shape("a", 0, 0), params(), {
			viewport: vp(),
			amount: 0,
			yaw: 0,
			groundHeight: 0,
		});
		expect(poseTransform(p)).toBeUndefined();
	});
	it("floats the shadow just above the ground and fades it in", () => {
		const p = shapePose(shape("a", 0, 0), params(), {
			viewport: vp(),
			amount: 0.5,
			yaw: 0,
			groundHeight: 10,
		});
		const s = shadowStyle(p);
		if (!s) throw new Error("no shadow");
		expect(s.transform).toBe("translateZ(10.5px) rotateZ(0deg) translate(-50%, -50%)");
		expect(s.opacity).toBe(0.5);
		expect(s.width).toBe(36);
	});
});

describe("box / float", () => {
	const view = (amount: number, groundHeight = 0) => ({
		viewport: vp(2),
		amount,
		yaw: 30,
		groundHeight,
	});
	it("anchors at the centre", () => {
		expect(shapeAnchor(shape("a", 0, 0), "box")).toEqual({ x: 20, y: 10 });
		const p = shapePose(shape("a", 0, 0), params({ mode: "float" }), view(1));
		expect(poseBox(p)).toEqual({ left: 0, top: 0, width: 80, height: 40 });
	});
	it("floats up by its height with the view, keeping its heading (not the camera's)", () => {
		const s = shape("a", 0, 0, { rotation: 20 });
		const p = shapePose(s, params({ mode: "float", facing: "camera" }), view(0.5, 8));
		expect(p.rise).toBe(24); // 24 × 0.5 × 2
		expect(p.face).toBe(20);
		expect(poseTransform(p)).toBe("translateZ(40px) rotateZ(20deg)");
		expect(shadowStyle(p)?.transform).toBe(
			"translateZ(16.5px) rotateZ(20deg) translate(-50%, -50%)",
		);
	});
	it("lies flat at amount 0", () => {
		const p = shapePose(shape("a", 0, 0), params({ mode: "box" }), view(0));
		expect(p.rise).toBe(0);
		expect(poseTransform(p)).toBeUndefined();
		expect(boxTopTransform(p)).toBeUndefined();
		expect(boxWalls(p)).toEqual([]);
	});
	it("lifts a box's top and folds four walls up from its edges", () => {
		const p = shapePose(shape("a", 0, 0), params({ mode: "box", height: 10 }), view(1, 8));
		expect(poseTransform(p)).toBe("translateZ(16px)");
		expect(boxTopTransform(p)).toBe("translateZ(20px)");
		expect(shadowStyle(p)).toBeNull();
		const walls = Object.fromEntries(boxWalls(p).map((w) => [w.side, w]));
		expect(walls.n).toMatchObject({ left: 0, top: 0, width: 80, height: 20 });
		expect(walls.n?.transform).toBe("rotateX(90deg)");
		expect(walls.s).toMatchObject({ left: 0, top: 20, width: 80, height: 20 });
		expect(walls.s?.transform).toBe("rotateX(-90deg)");
		expect(walls.w).toMatchObject({ left: 0, top: 0, width: 20, height: 40 });
		expect(walls.w?.transform).toBe("rotateY(-90deg)");
		expect(walls.e).toMatchObject({ left: 60, top: 0, width: 20, height: 40 });
		expect(walls.e?.transform).toBe("rotateY(90deg)");
	});
	it("colours walls with the shape's fill, or grey", () => {
		expect(wallColor(shape("a", 0, 0, { style: { fill: "#ff0000" } }))).toBe("#ff0000");
		expect(wallColor(shape("a", 0, 0, { style: {}, color: "#00ff00" }))).toBe("#00ff00");
		expect(wallColor(shape("a", 0, 0, { style: { fill: "transparent" } }))).toBe("#9e9e9e");
		expect(wallColor(shape("a", 0, 0))).toBe("#9e9e9e");
	});
});

describe("selectShapes3d", () => {
	const base = {
		types: {},
		viewport: vp(),
		viewportBounds: { x: 0, y: 0, width: 500, height: 500 },
		overscanPx: 0,
		renderMode: "interactive" as const,
		amount: 1,
		limits: DEFAULT_SHAPE_3D_LIMITS,
	};
	it("is empty while flat or in the global LOD mode", () => {
		const shapes = [shape("a", 10, 10)];
		expect(selectShapes3d({ ...base, shapes, amount: 0 })).toEqual([]);
		expect(selectShapes3d({ ...base, shapes, renderMode: "lod" })).toEqual([]);
	});
	it("keeps only 3D shapes on the drawn ground, big enough to see", () => {
		const shapes = [
			shape("in", 10, 10),
			shape("flat", 10, 10, { [SHAPE_3D_KEY]: undefined }),
			shape("far", 900, 10),
			shape("tiny", 10, 10, { width: 2, height: 2 }),
		];
		expect(selectShapes3d({ ...base, shapes }).map((e) => e.shape.id)).toEqual(["in"]);
	});
	it("lays parameterless shapes on raised ground flat at its height (groundFlat)", () => {
		const shapes = [
			shape("hill", 10, 10, { [SHAPE_3D_KEY]: undefined }),
			shape("low", 200, 10, { [SHAPE_3D_KEY]: undefined }),
			shape("own", 10, 10),
			shape("embed", 10, 10, { type: "embed", [SHAPE_3D_KEY]: undefined }),
		];
		const types = { embed: { modes: [] } };
		const heightAt = (x: number) => (x < 100 ? 32 : 0);
		const out = selectShapes3d({ ...base, types, shapes, heightAt });
		expect(out.map((e) => e.shape.id)).toEqual(["hill", "own"]);
		expect(out[0].params).toEqual(GROUND_FLAT_PARAMS);
		expect(out[1].params.mode).toBe("stand");
		const off = { ...DEFAULT_SHAPE_3D_LIMITS, groundFlat: false };
		expect(
			selectShapes3d({ ...base, shapes, heightAt, limits: off }).map((e) => e.shape.id),
		).toEqual(["own"]);
	});
	it("samples the terrain only for parameterless shapes it may draw", () => {
		const shapes = [
			shape("hill", 10, 10, { [SHAPE_3D_KEY]: undefined }),
			shape("far", 900, 10, { [SHAPE_3D_KEY]: undefined }),
			shape("tiny", 10, 10, { width: 2, height: 2, [SHAPE_3D_KEY]: undefined }),
			shape("own", 10, 10),
		];
		const asked: number[] = [];
		const heightAt = (x: number) => {
			asked.push(x);
			return 32;
		};
		const out = selectShapes3d({ ...base, shapes, heightAt });
		expect(out.map((e) => e.shape.id)).toEqual(["hill", "own"]);
		expect(asked).toHaveLength(1);
	});
	it("grows the drawn ground by the 3D overscan", () => {
		const shapes = [shape("far", 900, 10)];
		expect(selectShapes3d({ ...base, shapes, overscanPx: 500 })).toHaveLength(1);
	});
	it("keeps the nearest (lowest on screen) when over the limit, in z-order", () => {
		const shapes = [shape("top", 10, 0), shape("bottom", 10, 300), shape("mid", 10, 100)];
		const out = selectShapes3d({ ...base, shapes, limits: { minPx: 0, maxCount: 2 } });
		expect(out.map((e) => e.shape.id)).toEqual(["bottom", "mid"]);
	});
});

describe("render3dFrame", () => {
	it("lifts and turns to the shape's own heading, and says how to face the camera", () => {
		const s = shape("a", 0, 0, { rotation: 30 });
		const f = render3dFrame(s, params({ facing: "camera" }), {
			viewport: vp(2),
			amount: 0.5,
			yaw: 60,
			groundHeight: 8,
		});
		expect(f.pose.face).toBe(30);
		expect(f.transform).toBe("translateZ(16px) rotateZ(30deg)");
		expect(f.faceCamera).toBe(-45); // (-60 - 30) × 0.5
	});
});

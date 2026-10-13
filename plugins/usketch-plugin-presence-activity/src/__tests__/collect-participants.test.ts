import type { BoardStore, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { describe, expect, it } from "vitest";
import { collectParticipants } from "../activity-overlay.js";
import { createMotionClock } from "../motion.js";

type Awareness = WsProviderHandle["awareness"];

const SELF = 1;

/** Fake awareness whose local client is `SELF`, with the given remote states. */
function fakeAwareness(states: Record<number, Record<string, unknown>>): Awareness {
	const map = new Map<number, Record<string, unknown>>(
		Object.entries(states).map(([k, v]) => [Number(k), v]),
	);
	return { doc: { clientID: SELF }, getStates: () => map } as unknown as Awareness;
}

/** Fake store: shapes present in `byId` resolve, others are missing. */
function fakeStore(byId: Record<string, ShapeData>): BoardStore {
	return { getShape: (id: string) => byId[id] } as unknown as BoardStore;
}

/** Registry that returns a def whose getBounds echoes a fixed box, unless type is "raw". */
const shapes = {
	get: (type: string) =>
		type === "raw" ? undefined : { getBounds: () => ({ x: 100, y: 200, width: 10, height: 20 }) },
} as unknown as ShapeRegistry;

const shape = (id: string, type = "rect"): ShapeData =>
	({ id, type, x: 1, y: 2, width: 3, height: 4 }) as ShapeData;

describe("collectParticipants", () => {
	it("skips the local client", () => {
		const aw = fakeAwareness({
			[SELF]: { user: { name: "me" }, activity: { shapeIds: ["a"] } },
		});
		expect(collectParticipants(aw, fakeStore({ a: shape("a") }), shapes)).toEqual([]);
	});

	it("resolves shapeIds to registered bounds and carries color/name", () => {
		const aw = fakeAwareness({
			2: { user: { name: "Bob", color: "#f00" }, activity: { shapeIds: ["a"], action: "select" } },
		});
		const [p] = collectParticipants(aw, fakeStore({ a: shape("a") }), shapes);
		expect(p.name).toBe("Bob");
		expect(p.color).toBe("#f00");
		expect(p.boxes).toEqual([{ x: 100, y: 200, width: 10, height: 20 }]);
	});

	it("falls back to raw x/y/w/h when the shape type has no registered def", () => {
		const aw = fakeAwareness({ 2: { user: { name: "Bob" }, activity: { shapeIds: ["r"] } } });
		const [p] = collectParticipants(aw, fakeStore({ r: shape("r", "raw") }), shapes);
		expect(p.boxes).toEqual([{ x: 1, y: 2, width: 3, height: 4 }]);
	});

	it("skips shapeIds that no longer exist in the store", () => {
		const aw = fakeAwareness({
			2: { user: { name: "Bob" }, activity: { shapeIds: ["gone", "a"] } },
		});
		const [p] = collectParticipants(aw, fakeStore({ a: shape("a") }), shapes);
		expect(p.boxes).toHaveLength(1);
	});

	it("drops a participant whose activity resolves to nothing", () => {
		const aw = fakeAwareness({ 2: { user: { name: "Bob" }, activity: { shapeIds: ["gone"] } } });
		expect(collectParticipants(aw, fakeStore({}), shapes)).toEqual([]);
	});

	it("keeps a marquee-only participant (no shapeIds)", () => {
		const aw = fakeAwareness({
			2: { user: { name: "Bob" }, activity: { marquee: { x: 0, y: 0, width: 5, height: 5 } } },
		});
		const [p] = collectParticipants(aw, fakeStore({}), shapes);
		expect(p.boxes).toEqual([]);
		expect(p.marquee).toEqual({ x: 0, y: 0, width: 5, height: 5 });
	});

	it("uses a deterministic fallback color when user.color is absent", () => {
		const aw = fakeAwareness({ 2: { user: { name: "Bob" }, activity: { shapeIds: ["a"] } } });
		const [p] = collectParticipants(aw, fakeStore({ a: shape("a") }), shapes);
		expect(p.color).toMatch(/^#/);
	});

	it("prefers activity.label over user.name for the badge", () => {
		const aw = fakeAwareness({
			2: { user: { name: "Bob" }, activity: { shapeIds: ["a"], label: "AI 🤖" } },
		});
		const [p] = collectParticipants(aw, fakeStore({ a: shape("a") }), shapes);
		expect(p.name).toBe("AI 🤖");
	});

	it("ignores clients with no activity field", () => {
		const aw = fakeAwareness({ 2: { user: { name: "Bob" } } });
		expect(collectParticipants(aw, fakeStore({}), shapes)).toEqual([]);
	});
});

describe("collectParticipants with activity.motion", () => {
	const motionActivity = {
		// Static fields = the motion's final state, for clients that don't play motions.
		shapeIds: ["a", "b"],
		action: "edit",
		label: "AI 🤖",
		motion: {
			id: "m1",
			easing: "linear",
			keyframes: [
				{ at: 0, cursor: { x: 0, y: 0 } },
				{ at: 100, cursor: { x: 100, y: 0 }, shapeIds: ["a"], action: "select" },
				{ at: 200, cursor: { x: 200, y: 0 }, shapeIds: ["a", "b"], action: "edit" },
			],
		},
	};
	const store = fakeStore({ a: shape("a"), b: shape("b") });

	it("ignores the motion without a clock (legacy behaviour)", () => {
		const aw = fakeAwareness({ 2: { user: { name: "AI" }, activity: motionActivity } });
		const [p] = collectParticipants(aw, store, shapes);
		expect(p.boxes).toHaveLength(2);
		expect(p.cursor).toBeUndefined();
		expect(p.playing).toBeUndefined();
	});

	it("samples the motion on the receiver's clock", () => {
		let now = 0;
		const clock = createMotionClock(() => now);
		const aw = fakeAwareness({ 2: { user: { name: "AI" }, activity: motionActivity } });

		// First sight starts the clock: cursor only, still playing.
		let [p] = collectParticipants(aw, store, shapes, clock);
		expect(p.boxes).toEqual([]);
		expect(p.cursor).toEqual({ x: 0, y: 0 });
		expect(p.playing).toBe(true);

		now = 150;
		[p] = collectParticipants(aw, store, shapes, clock);
		expect(p.boxes).toHaveLength(1);
		expect(p.action).toBe("select");
		expect(p.cursor).toEqual({ x: 150, y: 0 });

		now = 500;
		[p] = collectParticipants(aw, store, shapes, clock);
		expect(p.boxes).toHaveLength(2);
		expect(p.action).toBe("edit");
		expect(p.playing).toBe(false);
	});

	it("keeps a playing participant whose current frame shows nothing yet", () => {
		const clock = createMotionClock(() => 0);
		const aw = fakeAwareness({
			2: {
				user: { name: "AI" },
				activity: { motion: { id: "m", keyframes: [{ at: 0 }, { at: 300, shapeIds: ["a"] }] } },
			},
		});
		const [p] = collectParticipants(aw, store, shapes, clock);
		expect(p.playing).toBe(true);
		expect(p.boxes).toEqual([]);
	});

	it("falls back to the static fields when the motion is malformed", () => {
		const clock = createMotionClock(() => 0);
		const aw = fakeAwareness({
			2: { user: { name: "AI" }, activity: { shapeIds: ["a"], motion: { id: 5 } } },
		});
		const [p] = collectParticipants(aw, store, shapes, clock);
		expect(p.boxes).toHaveLength(1);
		expect(p.playing).toBeUndefined();
	});

	it("carries ghosts of shapes in transit", () => {
		const clock = createMotionClock(() => 50);
		const aw = fakeAwareness({
			2: {
				user: { name: "AI" },
				activity: {
					motion: {
						id: "mv",
						easing: "linear",
						keyframes: [
							{ at: 0, moves: [{ shapeId: "a", box: { x: 0, y: 0, width: 10, height: 10 } }] },
							{ at: 100, moves: [{ shapeId: "a", box: { x: 100, y: 0, width: 10, height: 10 } }] },
						],
					},
				},
			},
		});
		// First sight starts the clock at 50 → elapsed 0.
		const [p] = collectParticipants(aw, store, shapes, clock);
		expect(p.ghosts).toEqual([{ shapeId: "a", box: { x: 0, y: 0, width: 10, height: 10 } }]);
	});
});

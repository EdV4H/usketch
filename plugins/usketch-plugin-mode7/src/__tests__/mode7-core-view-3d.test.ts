import { createView3dCell } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { createMode7Store } from "../mode7-store.js";
import { createYawTurner, yawPivot, yawTurn } from "../mode7-yaw.js";

describe("Mode 7 store on the board's 3D view state", () => {
	it("writes its camera (without yaw) and amount into the cell it is bound to", () => {
		const store = createMode7Store({ camera: { pitch: 60, yaw: 30, height: 12 } });
		const cell = createView3dCell();
		store.bindView3d(cell);
		expect(cell.get()).toEqual({
			camera: { pitch: 60, fov: 600, horizon: 0.45, height: 12 },
			amount: 0,
			drawDistance: 1500,
		});
		store.setDrawDistance(2400);
		expect(cell.get().drawDistance).toBe(2400);
		expect(store.getState().drawDistance).toBe(2400);
		store.setPresentation({ active: true, progress: 0.5, amount: 0.25, transitioning: true });
		expect(cell.get().amount).toBe(0.25);
		store.setCamera({ pitch: 40, yaw: 10 });
		expect(cell.get().camera.pitch).toBe(40);
		expect(store.getState().camera).toMatchObject({ pitch: 40, yaw: 10 });
	});

	it("follows changes others make to the cell, notifying once per change", () => {
		const store = createMode7Store({ camera: { yaw: 20 } });
		const cell = createView3dCell();
		store.bindView3d(cell);
		let n = 0;
		store.subscribe(() => n++);
		cell.set({ camera: { height: 50 } });
		expect(store.getState().camera).toMatchObject({ height: 50, yaw: 20 });
		expect(n).toBe(1);
		store.setActive(true); // active, progress and amount in one notification
		expect(n).toBe(2);
		expect(cell.get().amount).toBe(1);
	});

	it("keeps the state object while nothing changes", () => {
		const store = createMode7Store();
		const cell = createView3dCell();
		store.bindView3d(cell);
		const before = store.getState();
		store.setCamera({ pitch: before.camera.pitch });
		cell.set({ amount: 0 });
		expect(store.getState()).toBe(before);
	});

	it("unbinding keeps the camera locally and stops following the cell", () => {
		const store = createMode7Store();
		const cell = createView3dCell();
		const unbind = store.bindView3d(cell);
		store.setCamera({ pitch: 33 });
		unbind();
		cell.set({ camera: { pitch: 70 } });
		expect(store.getState().camera.pitch).toBe(33);
	});

	it("uses BoardStore.getView3d through view3dCellOf", async () => {
		const { view3dCellOf } = await import("@edv4h/usketch-shared");
		const board = createBoardStore();
		const cell = view3dCellOf(board);
		expect(cell).not.toBeNull();
		if (!cell) return;
		const store = createMode7Store({ active: true, camera: { pitch: 50 } });
		store.bindView3d(cell);
		expect(board.getView3d?.()).toMatchObject({ amount: 1, camera: { pitch: 50 } });
	});
});

describe("yaw turns the viewport", () => {
	it("yawTurn scales with the transition and wraps", () => {
		expect(yawTurn(40, 0)).toBe(0);
		expect(yawTurn(40, 0.5)).toBe(20);
		expect(yawTurn(170, 1)).toBe(170);
		expect(yawTurn(Number.NaN, 1)).toBe(0);
	});

	it("pivots about the middle of the horizon line", () => {
		expect(yawPivot({ width: 1280, height: 800 }, 0.45)).toEqual({ x: 640, y: 360 });
	});

	it("turns the viewport about the pivot and back by what it applied", () => {
		const board = createBoardStore();
		board.setViewport({ x: 100, y: -50, zoom: 1.5, rotation: 10 });
		const turner = createYawTurner(board);
		const pivot = () => ({ x: 640, y: 360 });
		const worldAtPivot = () => {
			const vp = board.getViewport();
			const r = ((vp.rotation ?? 0) * Math.PI) / 180;
			const dx = (640 - vp.x) / vp.zoom;
			const dy = (360 - vp.y) / vp.zoom;
			return { x: dx * Math.cos(-r) - dy * Math.sin(-r), y: dx * Math.sin(-r) + dy * Math.cos(-r) };
		};
		const at = worldAtPivot();
		turner.sync(30, 0.5, pivot);
		expect(board.getViewport().rotation).toBeCloseTo(25, 9);
		turner.sync(30, 1, pivot);
		expect(board.getViewport().rotation).toBeCloseTo(40, 9);
		// The world point under the pivot stays put.
		expect(worldAtPivot().x).toBeCloseTo(at.x, 6);
		expect(worldAtPivot().y).toBeCloseTo(at.y, 6);
		// Someone else turns the viewport meanwhile: only Mode 7's part is taken back.
		board.rotateTo(55, { x: 0, y: 0 });
		turner.sync(30, 0, pivot);
		expect(board.getViewport().rotation).toBeCloseTo(25, 9);
		expect(turner.applied()).toBe(0);
	});

	it("waits for a stage before turning", () => {
		const board = createBoardStore();
		const turner = createYawTurner(board);
		turner.sync(30, 1, () => null);
		expect(board.getViewport().rotation ?? 0).toBe(0);
		turner.sync(30, 1, () => ({ x: 0, y: 0 }));
		expect(board.getViewport().rotation).toBeCloseTo(30, 9);
		turner.restore(() => ({ x: 0, y: 0 }));
		expect(board.getViewport().rotation ?? 0).toBeCloseTo(0, 9);
	});
});

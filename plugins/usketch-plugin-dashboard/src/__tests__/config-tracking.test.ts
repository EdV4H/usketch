import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { getDashboardConfig, trackDashboardConfig } from "../config-ops.js";
import { makeDashboardConfig } from "../dashboard-config-shape.js";

const rect = (id: string) => ({
	id,
	type: "rectangle",
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
});

/** Count full scans by counting how often the shape map is iterated. */
function countScans(store: ReturnType<typeof createBoardStore>) {
	let scans = 0;
	const getShapes = store.getShapes.bind(store);
	store.getShapes = () => {
		const shapes = getShapes();
		return new Proxy(shapes, {
			get(target, key) {
				if (key === "values" || key === Symbol.iterator) scans++;
				const v = Reflect.get(target, key, target);
				return typeof v === "function" ? v.bind(target) : v;
			},
		});
	};
	return () => scans;
}

describe("trackDashboardConfig", () => {
	it("図形の移動では走査し直さず、config が無いことも覚えておく", () => {
		const store = createBoardStore();
		store.addShape(rect("a"));
		const stop = trackDashboardConfig(store);
		const scans = countScans(store);
		expect(getDashboardConfig(store)).toBeUndefined();
		for (let i = 0; i < 10; i++) {
			store.updateShape("a", { x: i });
			expect(getDashboardConfig(store)).toBeUndefined();
		}
		expect(scans()).toBe(1);
		stop();
	});

	it("config の更新は覚えた id から最新の値を返す", () => {
		const store = createBoardStore();
		store.addShape({ ...makeDashboardConfig({ columns: 3 }), id: "cfg" });
		const stop = trackDashboardConfig(store);
		expect(getDashboardConfig(store)?.columns).toBe(3);
		store.updateShape("cfg", { columns: 7 } as never);
		expect(getDashboardConfig(store)?.columns).toBe(7);
		stop();
	});

	it("config の追加・削除と、id の小さい config の追加に追従する", () => {
		const store = createBoardStore();
		store.addShape(rect("a"));
		const stop = trackDashboardConfig(store);
		expect(getDashboardConfig(store)).toBeUndefined();
		store.addShape({ ...makeDashboardConfig(), id: "cfg-b" });
		expect(getDashboardConfig(store)?.id).toBe("cfg-b");
		store.addShape({ ...makeDashboardConfig(), id: "cfg-a" });
		expect(getDashboardConfig(store)?.id).toBe("cfg-a");
		store.deleteShape("cfg-a");
		expect(getDashboardConfig(store)?.id).toBe("cfg-b");
		store.deleteShape("cfg-b");
		expect(getDashboardConfig(store)).toBeUndefined();
		stop();
	});

	it("自分より先に登録されたリスナーからも、追加直後の config が見える", () => {
		const store = createBoardStore();
		const seen: (string | undefined)[] = [];
		store.onMutation((e) => {
			if (e.type === "shape:added") seen.push(getDashboardConfig(store)?.id);
		});
		const stop = trackDashboardConfig(store);
		expect(getDashboardConfig(store)).toBeUndefined();
		store.addShape({ ...makeDashboardConfig(), id: "cfg" });
		expect(seen).toEqual(["cfg"]);
		stop();
	});

	it("type が変わる更新でも走査し直す", () => {
		const store = createBoardStore();
		store.addShape(rect("a"));
		const stop = trackDashboardConfig(store);
		expect(getDashboardConfig(store)).toBeUndefined();
		store.updateShape("a", { type: "dashboard-config" });
		expect(getDashboardConfig(store)?.id).toBe("a");
		stop();
	});

	it("teardown 後は毎回走査に戻る", () => {
		const store = createBoardStore();
		const stop = trackDashboardConfig(store);
		stop();
		const scans = countScans(store);
		getDashboardConfig(store);
		getDashboardConfig(store);
		expect(scans()).toBe(2);
	});
});

import type { Layer } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createLayerManager } from "../layer-manager.js";

const STEP = 2 ** -10;

function layer(id: string, order: number, over: Partial<Layer> = {}): Layer {
	return { id, order, render: () => null, ...over };
}

/** Convenience: the ordered list of layer ids from the manager. */
function ids(mgr: ReturnType<typeof createLayerManager>): string[] {
	return mgr.getLayers().map((l) => l.id);
}

describe("createLayerManager", () => {
	it("sorts plain layers by ascending order", () => {
		const mgr = createLayerManager();
		mgr.register(layer("c", 90));
		mgr.register(layer("a", 10));
		mgr.register(layer("b", 50));
		expect(ids(mgr)).toEqual(["a", "b", "c"]);
	});

	it("breaks plain-layer ties by registration order (legacy behavior)", () => {
		const mgr = createLayerManager();
		mgr.register(layer("first", 84));
		mgr.register(layer("second", 84));
		// Stable sort → later registration renders on top (last in the list).
		expect(ids(mgr)).toEqual(["first", "second"]);
	});

	it("avoidCollision bumps a layer just above an existing same-order layer", () => {
		const mgr = createLayerManager();
		mgr.register(layer("existing", 84));
		mgr.register(layer("avoider", 84, { avoidCollision: true }));
		// avoider sits above existing, and below the next integer band (85).
		expect(ids(mgr)).toEqual(["existing", "avoider"]);
		mgr.register(layer("band85", 85));
		expect(ids(mgr)).toEqual(["existing", "avoider", "band85"]);
	});

	it("stacks multiple avoiders deterministically by registration order", () => {
		const mgr = createLayerManager();
		mgr.register(layer("base", 84));
		mgr.register(layer("a1", 84, { avoidCollision: true })); // 84 + STEP
		mgr.register(layer("a2", 84, { avoidCollision: true })); // 84 + 2*STEP
		expect(ids(mgr)).toEqual(["base", "a1", "a2"]);
	});

	it("stays within the band with the default step even after many collisions", () => {
		const mgr = createLayerManager();
		mgr.register(layer("base", 84));
		for (let i = 0; i < 50; i++) {
			mgr.register(layer(`a${i}`, 84, { avoidCollision: true }));
		}
		mgr.register(layer("next", 85));
		// Every avoider must remain below 85 (default step keeps them in-band).
		expect(ids(mgr)[ids(mgr).length - 1]).toBe("next");
		expect(50 * STEP).toBeLessThan(1);
	});

	it("supports integer port-style bumps via collisionStep: 1", () => {
		const mgr = createLayerManager();
		mgr.register(layer("p84", 84));
		mgr.register(layer("p85", 85));
		mgr.register(layer("port", 84, { avoidCollision: true, collisionStep: 1 }));
		// 84 and 85 taken → next free integer is 86, so `port` goes on top.
		expect(ids(mgr)).toEqual(["p84", "p85", "port"]);
	});

	it("re-registering the same id re-resolves without self-collision", () => {
		const mgr = createLayerManager();
		mgr.register(layer("other", 84));
		mgr.register(layer("x", 84, { avoidCollision: true })); // → 84 + STEP
		// Re-register x: it must not bump off its own previous slot.
		mgr.register(layer("x", 84, { avoidCollision: true }));
		expect(mgr.getLayers().filter((l) => l.id === "x")).toHaveLength(1);
		expect(ids(mgr)).toEqual(["other", "x"]);
	});

	it("reuses a freed slot after unregister", () => {
		const mgr = createLayerManager();
		mgr.register(layer("base", 84));
		mgr.register(layer("a1", 84, { avoidCollision: true })); // 84 + STEP
		mgr.unregister("a1");
		mgr.register(layer("a2", 84, { avoidCollision: true })); // reuses 84 + STEP
		expect(ids(mgr)).toEqual(["base", "a2"]);
	});

	it("keeps a later plain layer below an avoider that was bumped above the band", () => {
		const mgr = createLayerManager();
		mgr.register(layer("existing", 84));
		mgr.register(layer("avoider", 84, { avoidCollision: true })); // 84 + STEP
		mgr.register(layer("plain", 84)); // exact 84 → below avoider's 84 + STEP
		// existing & plain both at 84 (tie → registration order), avoider on top.
		expect(ids(mgr)).toEqual(["existing", "plain", "avoider"]);
	});

	it("unregister removes the layer", () => {
		const mgr = createLayerManager();
		mgr.register(layer("a", 10));
		mgr.register(layer("b", 20));
		mgr.unregister("a");
		expect(ids(mgr)).toEqual(["b"]);
	});
});

import { describe, expect, it } from "vitest";
import { DOMAIN_SUBTYPES } from "../registry.js";
import {
	type AggregateMeta,
	type BoundedContextMeta,
	type ClassBoxMeta,
	type ContextMapConnectorMeta,
	DOMAIN_TYPES,
	type TacticalConnectorMeta,
} from "../types.js";

describe("DOMAIN_SUBTYPES", () => {
	it("provides all 5 subtypes", () => {
		const types = DOMAIN_SUBTYPES.map((s) => s.type);
		expect(types).toEqual([
			DOMAIN_TYPES.boundedContext,
			DOMAIN_TYPES.contextMapConnector,
			DOMAIN_TYPES.aggregate,
			DOMAIN_TYPES.classBox,
			DOMAIN_TYPES.tacticalConnector,
		]);
	});

	it("each subtype's createDefault sets type, geometry, and meta", () => {
		for (const subtype of DOMAIN_SUBTYPES) {
			const shape = subtype.createDefault({ id: "test", x: 10, y: 20 });
			expect(shape.id).toBe("test");
			expect(shape.type).toBe(subtype.type);
			expect(shape.x).toBe(10);
			expect(shape.y).toBe(20);
			expect(shape.style).toBeDefined();
			expect(shape.meta).toBeDefined();
		}
	});

	it("BoundedContext default has contextName + coreDomain", () => {
		const subtype = DOMAIN_SUBTYPES.find((s) => s.type === DOMAIN_TYPES.boundedContext);
		const shape = subtype?.createDefault({ id: "bc", x: 0, y: 0 });
		const meta = shape?.meta as BoundedContextMeta;
		expect(meta.contextName).toBe("BoundedContext");
		expect(meta.coreDomain).toBe("supporting");
	});

	it("Aggregate default has rootName", () => {
		const subtype = DOMAIN_SUBTYPES.find((s) => s.type === DOMAIN_TYPES.aggregate);
		const shape = subtype?.createDefault({ id: "ag", x: 0, y: 0 });
		const meta = shape?.meta as AggregateMeta;
		expect(meta.rootName).toBe("AggregateRoot");
	});

	it("ClassBox default has className, stereotype, attributes, methods", () => {
		const subtype = DOMAIN_SUBTYPES.find((s) => s.type === DOMAIN_TYPES.classBox);
		const shape = subtype?.createDefault({ id: "cb", x: 0, y: 0 });
		const meta = shape?.meta as ClassBoxMeta;
		expect(meta.className).toBe("ClassName");
		expect(meta.stereotype).toBe("Entity");
		expect(meta.attributes).toEqual(["id: ID"]);
		expect(meta.methods).toEqual([]);
	});

	it("ContextMap connector default has relation + upstream", () => {
		const subtype = DOMAIN_SUBTYPES.find((s) => s.type === DOMAIN_TYPES.contextMapConnector);
		const shape = subtype?.createDefault({ id: "cm", x: 0, y: 0 });
		const meta = shape?.meta as ContextMapConnectorMeta;
		expect(meta.relation).toBe("customer-supplier");
		expect(meta.upstream).toBe("from");
	});

	it("Tactical connector default has relation", () => {
		const subtype = DOMAIN_SUBTYPES.find((s) => s.type === DOMAIN_TYPES.tacticalConnector);
		const shape = subtype?.createDefault({ id: "tc", x: 0, y: 0 });
		const meta = shape?.meta as TacticalConnectorMeta;
		expect(meta.relation).toBe("association");
	});

	it("each subtype belongs to a category (strategic / tactical / relation)", () => {
		const categories = new Set(DOMAIN_SUBTYPES.map((s) => s.category));
		expect(categories).toEqual(new Set(["strategic", "tactical", "relation"]));
	});
});

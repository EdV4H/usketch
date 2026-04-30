import { describe, expect, it } from "vitest";
import { DOMAIN_SUBTYPES, type DomainShapeSubtype } from "../registry.js";
import {
	type AggregateMeta,
	type BoundedContextMeta,
	type ClassBoxMeta,
	DOMAIN_TYPES,
} from "../types.js";

describe("DOMAIN_SUBTYPES", () => {
	it("provides all 5 picker entries (3 shapes + 2 connectors)", () => {
		expect(DOMAIN_SUBTYPES).toHaveLength(5);
		const shapeCount = DOMAIN_SUBTYPES.filter((s) => s.kind === "shape").length;
		const connectorCount = DOMAIN_SUBTYPES.filter((s) => s.kind === "connector").length;
		expect(shapeCount).toBe(3);
		expect(connectorCount).toBe(2);
	});

	it("each shape subtype's createDefault sets type, geometry, and meta", () => {
		for (const subtype of DOMAIN_SUBTYPES) {
			if (subtype.kind !== "shape") continue;
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
		const subtype = DOMAIN_SUBTYPES.find(
			(s): s is DomainShapeSubtype => s.kind === "shape" && s.type === DOMAIN_TYPES.boundedContext,
		);
		const shape = subtype?.createDefault({ id: "bc", x: 0, y: 0 });
		const meta = shape?.meta as BoundedContextMeta;
		expect(meta.contextName).toBe("BoundedContext");
		expect(meta.coreDomain).toBe("supporting");
	});

	it("Aggregate default has rootName", () => {
		const subtype = DOMAIN_SUBTYPES.find(
			(s): s is DomainShapeSubtype => s.kind === "shape" && s.type === DOMAIN_TYPES.aggregate,
		);
		const shape = subtype?.createDefault({ id: "ag", x: 0, y: 0 });
		const meta = shape?.meta as AggregateMeta;
		expect(meta.rootName).toBe("AggregateRoot");
	});

	it("ClassBox default has className, stereotype, attributes, methods", () => {
		const subtype = DOMAIN_SUBTYPES.find(
			(s): s is DomainShapeSubtype => s.kind === "shape" && s.type === DOMAIN_TYPES.classBox,
		);
		const shape = subtype?.createDefault({ id: "cb", x: 0, y: 0 });
		const meta = shape?.meta as ClassBoxMeta;
		expect(meta.className).toBe("ClassName");
		expect(meta.stereotype).toBe("Entity");
		expect(meta.attributes).toEqual(["id: ID"]);
		expect(meta.methods).toEqual([]);
	});

	it("Context map connector subtype has domainKind=context-map and a default relation", () => {
		const subtype = DOMAIN_SUBTYPES.find(
			(s) => s.kind === "connector" && s.domainKind === "context-map",
		);
		expect(subtype).toBeDefined();
		expect(subtype?.kind).toBe("connector");
		if (subtype?.kind === "connector") {
			expect(subtype.domainKind).toBe("context-map");
			expect(subtype.defaultRelation).toBe("customer-supplier");
		}
	});

	it("Tactical connector subtype has domainKind=tactical and a default relation", () => {
		const subtype = DOMAIN_SUBTYPES.find(
			(s) => s.kind === "connector" && s.domainKind === "tactical",
		);
		expect(subtype).toBeDefined();
		expect(subtype?.kind).toBe("connector");
		if (subtype?.kind === "connector") {
			expect(subtype.domainKind).toBe("tactical");
			expect(subtype.defaultRelation).toBe("association");
		}
	});

	it("each subtype belongs to a category (strategic / tactical / relation)", () => {
		const categories = new Set(DOMAIN_SUBTYPES.map((s) => s.category));
		expect(categories).toEqual(new Set(["strategic", "tactical", "relation"]));
	});
});

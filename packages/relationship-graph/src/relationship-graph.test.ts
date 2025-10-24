/**
 * RelationshipGraph のユニットテスト
 */

import type { ShapeRelationship } from "@usketch/shared-types";
import { beforeEach, describe, expect, it } from "vitest";
import { RelationshipGraph } from "./relationship-graph";

describe("RelationshipGraph", () => {
	let graph: RelationshipGraph;

	beforeEach(() => {
		graph = new RelationshipGraph();
	});

	describe("addRelationship", () => {
		it("should add a relationship", () => {
			const relation: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(relation);

			expect(graph.size).toBe(1);
			expect(graph.getRelationship("rel-1")).toEqual(relation);
		});

		it("should update indexes when adding relationship", () => {
			const relation: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(relation);

			const childRelations = graph.getChildRelationships("parent-1");
			expect(childRelations).toHaveLength(1);
			expect(childRelations[0]).toEqual(relation);

			const parentRelations = graph.getParentRelationships("child-1");
			expect(parentRelations).toHaveLength(1);
			expect(parentRelations[0]).toEqual(relation);
		});
	});

	describe("removeRelationship", () => {
		it("should remove a relationship", () => {
			const relation: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(relation);
			expect(graph.size).toBe(1);

			const removed = graph.removeRelationship("rel-1");
			expect(removed).toBe(true);
			expect(graph.size).toBe(0);
			expect(graph.getRelationship("rel-1")).toBeUndefined();
		});

		it("should update indexes when removing relationship", () => {
			const relation: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(relation);
			graph.removeRelationship("rel-1");

			expect(graph.getChildRelationships("parent-1")).toHaveLength(0);
			expect(graph.getParentRelationships("child-1")).toHaveLength(0);
		});

		it("should return false when removing non-existent relationship", () => {
			const removed = graph.removeRelationship("non-existent");
			expect(removed).toBe(false);
		});
	});

	describe("getChildRelationships", () => {
		it("should return all child relationships for a parent", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "containment",
				parentId: "parent-1",
				childId: "child-2",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);

			const children = graph.getChildRelationships("parent-1");
			expect(children).toHaveLength(2);
			expect(children).toContainEqual(rel1);
			expect(children).toContainEqual(rel2);
		});

		it("should return empty array for parent with no children", () => {
			const children = graph.getChildRelationships("non-existent");
			expect(children).toHaveLength(0);
		});
	});

	describe("getParentRelationships", () => {
		it("should return all parent relationships for a child", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "layout",
				parentId: "parent-2",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);

			const parents = graph.getParentRelationships("child-1");
			expect(parents).toHaveLength(2);
			expect(parents).toContainEqual(rel1);
			expect(parents).toContainEqual(rel2);
		});
	});

	describe("getRelationshipsByType", () => {
		it("should return all relationships of a specific type", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "layout",
				parentId: "parent-2",
				childId: "child-2",
				createdAt: Date.now(),
				effects: [],
			};

			const rel3: ShapeRelationship = {
				id: "rel-3",
				type: "containment",
				parentId: "parent-3",
				childId: "child-3",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);
			graph.addRelationship(rel3);

			const containments = graph.getRelationshipsByType("containment");
			expect(containments).toHaveLength(2);
			expect(containments).toContainEqual(rel1);
			expect(containments).toContainEqual(rel3);
		});
	});

	describe("hasRelationship", () => {
		it("should return true if relationship exists", () => {
			const relation: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(relation);

			expect(graph.hasRelationship("parent-1", "child-1")).toBe(true);
			expect(graph.hasRelationship("parent-1", "child-1", "containment")).toBe(true);
		});

		it("should return false if relationship does not exist", () => {
			expect(graph.hasRelationship("parent-1", "child-1")).toBe(false);
		});

		it("should return false if type does not match", () => {
			const relation: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(relation);

			expect(graph.hasRelationship("parent-1", "child-1", "layout")).toBe(false);
		});
	});

	describe("wouldCreateCycle", () => {
		it("should detect direct cycle", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "shape-a",
				childId: "shape-b",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);

			// shape-b -> shape-a would create a cycle
			expect(graph.wouldCreateCycle("shape-b", "shape-a")).toBe(true);
		});

		it("should detect indirect cycle", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "shape-a",
				childId: "shape-b",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "containment",
				parentId: "shape-b",
				childId: "shape-c",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);

			// shape-c -> shape-a would create a cycle
			expect(graph.wouldCreateCycle("shape-c", "shape-a")).toBe(true);
		});

		it("should return false when no cycle would be created", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "shape-a",
				childId: "shape-b",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);

			expect(graph.wouldCreateCycle("shape-a", "shape-c")).toBe(false);
		});
	});

	describe("getAncestors", () => {
		it("should return all ancestors", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "root",
				childId: "level-1",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "containment",
				parentId: "level-1",
				childId: "level-2",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);

			const ancestors = graph.getAncestors("level-2");
			expect(ancestors).toEqual(["level-1", "root"]);
		});

		it("should filter by type", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "root",
				childId: "level-1",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "layout",
				parentId: "level-1",
				childId: "level-2",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);

			const ancestors = graph.getAncestors("level-2", "containment");
			expect(ancestors).toHaveLength(0);
		});
	});

	describe("getDescendants", () => {
		it("should return all descendants", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "root",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "containment",
				parentId: "root",
				childId: "child-2",
				createdAt: Date.now(),
				effects: [],
			};

			const rel3: ShapeRelationship = {
				id: "rel-3",
				type: "containment",
				parentId: "child-1",
				childId: "grandchild-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);
			graph.addRelationship(rel3);

			const descendants = graph.getDescendants("root");
			expect(descendants).toHaveLength(3);
			expect(descendants).toContain("child-1");
			expect(descendants).toContain("child-2");
			expect(descendants).toContain("grandchild-1");
		});
	});

	describe("clear", () => {
		it("should clear all relationships", () => {
			const relation: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(relation);
			expect(graph.size).toBe(1);

			graph.clear();
			expect(graph.size).toBe(0);
			expect(graph.toArray()).toHaveLength(0);
		});
	});

	describe("getStats", () => {
		it("should return statistics", () => {
			const rel1: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			const rel2: ShapeRelationship = {
				id: "rel-2",
				type: "layout",
				parentId: "parent-2",
				childId: "child-2",
				createdAt: Date.now(),
				effects: [],
			};

			graph.addRelationship(rel1);
			graph.addRelationship(rel2);

			const stats = graph.getStats();
			expect(stats.totalRelationships).toBe(2);
			expect(stats.byType.containment).toBe(1);
			expect(stats.byType.layout).toBe(1);
			expect(stats.avgChildrenPerParent).toBe(1);
		});
	});
});

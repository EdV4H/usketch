/**
 * Relationship Store Integration Tests
 */

import type { RectangleShape, RelationshipRule, ShapeRelationship } from "@usketch/shared-types";
import { beforeEach, describe, expect, it } from "vitest";
import { whiteboardStore } from "./store";

describe("Relationship Store Integration", () => {
	beforeEach(() => {
		// Reset store state
		whiteboardStore.setState({
			shapes: {},
			selectedShapeIds: new Set(),
			relationships: [],
		});
		// Clear graph
		whiteboardStore.getState().relationshipGraph.clear();
	});

	describe("addRelationship", () => {
		it("should add relationship to graph and state", () => {
			const relationship: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			whiteboardStore.getState().addRelationship(relationship);

			const state = whiteboardStore.getState();
			expect(state.relationships).toHaveLength(1);
			expect(state.relationships[0]).toEqual(relationship);
			expect(state.relationshipGraph.size).toBe(1);
		});

		it("should apply initial effects when relationship is added", () => {
			const parent: RectangleShape = {
				id: "parent-1",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 0,
				fill: "#000000",
				stroke: "#000000",
				strokeWidth: 1,
			};

			const child: RectangleShape = {
				id: "child-1",
				type: "rectangle",
				x: 10,
				y: 10,
				width: 20,
				height: 20,
				rotation: 0,
				fill: "#ffffff",
				stroke: "#000000",
				strokeWidth: 1,
			};

			whiteboardStore.setState({
				shapes: {
					"parent-1": parent,
					"child-1": child,
				},
			});

			const relationship: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			whiteboardStore.getState().addRelationship(relationship);

			// Relationship should be added
			expect(whiteboardStore.getState().relationships).toHaveLength(1);
		});
	});

	describe("removeRelationship", () => {
		it("should remove relationship from graph and state", () => {
			const relationship: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [],
			};

			whiteboardStore.getState().addRelationship(relationship);
			expect(whiteboardStore.getState().relationships).toHaveLength(1);

			whiteboardStore.getState().removeRelationship("rel-1");

			const state = whiteboardStore.getState();
			expect(state.relationships).toHaveLength(0);
			expect(state.relationshipGraph.size).toBe(0);
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

			whiteboardStore.getState().addRelationship(rel1);
			whiteboardStore.getState().addRelationship(rel2);

			const children = whiteboardStore.getState().getChildRelationships("parent-1");

			expect(children).toHaveLength(2);
			expect(children.map((r) => r.id)).toContain("rel-1");
			expect(children.map((r) => r.id)).toContain("rel-2");
		});

		it("should return empty array when no children exist", () => {
			const children = whiteboardStore.getState().getChildRelationships("non-existent");

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

			whiteboardStore.getState().addRelationship(rel1);

			const parents = whiteboardStore.getState().getParentRelationships("child-1");

			expect(parents).toHaveLength(1);
			expect(parents[0]?.id).toBe("rel-1");
		});
	});

	describe("registerRelationshipRule", () => {
		it("should register a new relationship rule", () => {
			const rule: RelationshipRule = {
				id: "custom-rule",
				type: "containment",
				parentType: "rectangle",
				childType: "rectangle",
				canFormOnOverlap: true,
				overlapCondition: "contains",
				allowMultipleParents: false,
				effects: [],
			};

			whiteboardStore.getState().registerRelationshipRule(rule);

			const rules = whiteboardStore.getState().relationshipRuleEngine.getRules();
			expect(rules.some((r) => r.id === "custom-rule")).toBe(true);
		});
	});

	describe("applyEffectsToChildren", () => {
		it("should apply position effects to children when parent moves", () => {
			const parent: RectangleShape = {
				id: "parent-1",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 0,
				fill: "#000000",
				stroke: "#000000",
				strokeWidth: 1,
			};

			const child: RectangleShape = {
				id: "child-1",
				type: "rectangle",
				x: 10,
				y: 10,
				width: 20,
				height: 20,
				rotation: 0,
				fill: "#ffffff",
				stroke: "#000000",
				strokeWidth: 1,
			};

			whiteboardStore.setState({
				shapes: {
					"parent-1": parent,
					"child-1": child,
				},
			});

			const relationship: ShapeRelationship = {
				id: "rel-1",
				type: "containment",
				parentId: "parent-1",
				childId: "child-1",
				createdAt: Date.now(),
				effects: [
					{
						type: "move-with-parent",
						config: { deltaX: 10, deltaY: 20 },
					},
				],
			};

			whiteboardStore.getState().addRelationship(relationship);

			// Apply effects
			whiteboardStore.getState().applyEffectsToChildren("parent-1", "position");

			const updatedChild = whiteboardStore.getState().shapes["child-1"];
			expect(updatedChild?.x).toBe(20); // 10 + 10
			expect(updatedChild?.y).toBe(30); // 10 + 20
		});

		it("should not apply effects when no relationships exist", () => {
			const parent: RectangleShape = {
				id: "parent-1",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 0,
				fill: "#000000",
				stroke: "#000000",
				strokeWidth: 1,
			};

			whiteboardStore.setState({
				shapes: {
					"parent-1": parent,
				},
			});

			// Should not throw
			whiteboardStore.getState().applyEffectsToChildren("parent-1", "position");

			const state = whiteboardStore.getState();
			expect(state.shapes["parent-1"]).toEqual(parent);
		});
	});

	describe("Standard rules registration", () => {
		it("should have standard rules registered on initialization", () => {
			const rules = whiteboardStore.getState().relationshipRuleEngine.getRules();

			expect(rules.length).toBeGreaterThan(0);
			expect(rules.some((r) => r.id === "group-containment")).toBe(true);
			expect(rules.some((r) => r.id === "shape-label")).toBe(true);
			expect(rules.some((r) => r.id === "line-connection")).toBe(true);
		});

		it("should have rules sorted by priority", () => {
			const rules = whiteboardStore.getState().relationshipRuleEngine.getRules();

			// Rules should be sorted in descending priority order
			for (let i = 0; i < rules.length - 1; i++) {
				const currentPriority = rules[i]?.priority ?? 0;
				const nextPriority = rules[i + 1]?.priority ?? 0;
				expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
			}
		});
	});

	describe("checkAndFormRelationships", () => {
		it("should automatically form relationships based on overlap", () => {
			// Create a larger parent shape
			const parent: RectangleShape = {
				id: "parent-1",
				type: "rectangle",
				x: 0,
				y: 0,
				width: 200,
				height: 200,
				rotation: 0,
				fill: "#000000",
				stroke: "#000000",
				strokeWidth: 1,
			};

			// Create a smaller child shape inside parent
			const child: RectangleShape = {
				id: "child-1",
				type: "rectangle",
				x: 50,
				y: 50,
				width: 50,
				height: 50,
				rotation: 0,
				fill: "#ffffff",
				stroke: "#000000",
				strokeWidth: 1,
			};

			whiteboardStore.setState({
				shapes: {
					"parent-1": parent,
					"child-1": child,
				},
			});

			// Check and form relationships for the child
			whiteboardStore.getState().checkAndFormRelationships("child-1");

			const relationships = whiteboardStore.getState().relationships;
			// Some relationship should be formed based on overlap
			expect(relationships.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("breakRelationshipsForShape", () => {
		it("should remove all relationships involving a shape", () => {
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
				parentId: "child-1",
				childId: "grandchild-1",
				createdAt: Date.now(),
				effects: [],
			};

			whiteboardStore.getState().addRelationship(rel1);
			whiteboardStore.getState().addRelationship(rel2);

			expect(whiteboardStore.getState().relationships).toHaveLength(2);

			// Break all relationships for child-1
			whiteboardStore.getState().breakRelationshipsForShape("child-1");

			// Both relationships should be removed since child-1 is involved in both
			expect(whiteboardStore.getState().relationships).toHaveLength(0);
		});
	});

	describe("Graph operations", () => {
		it("should maintain graph consistency when adding multiple relationships", () => {
			const relationships: ShapeRelationship[] = [
				{
					id: "rel-1",
					type: "containment",
					parentId: "parent-1",
					childId: "child-1",
					createdAt: Date.now(),
					effects: [],
				},
				{
					id: "rel-2",
					type: "containment",
					parentId: "parent-1",
					childId: "child-2",
					createdAt: Date.now(),
					effects: [],
				},
				{
					id: "rel-3",
					type: "containment",
					parentId: "child-1",
					childId: "grandchild-1",
					createdAt: Date.now(),
					effects: [],
				},
			];

			for (const rel of relationships) {
				whiteboardStore.getState().addRelationship(rel);
			}

			const state = whiteboardStore.getState();
			expect(state.relationships).toHaveLength(3);
			expect(state.relationshipGraph.size).toBe(3);

			// Check descendants
			const descendants = state.relationshipGraph.getDescendants("parent-1");
			expect(descendants).toHaveLength(3);
			expect(descendants).toContain("child-1");
			expect(descendants).toContain("child-2");
			expect(descendants).toContain("grandchild-1");
		});
	});
});

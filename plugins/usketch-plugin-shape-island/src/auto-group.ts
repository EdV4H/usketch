import type { BoardStore, BoundingBox, ShapeData } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import {
	computeGroupBounds,
	createGroupCommand,
	createUngroupCommand,
	getChildShapes,
	intersectsAABB,
} from "@edv4h/usketch-store";

const TOUCH_PADDING = 4;
const MERGE_ANIMATION_MS = 700;

function expandBounds(b: BoundingBox, pad: number): BoundingBox {
	return {
		x: b.x - pad,
		y: b.y - pad,
		width: b.width + pad * 2,
		height: b.height + pad * 2,
	};
}

// Union-Find for connected component analysis
class UnionFind {
	private parent: Map<string, string> = new Map();

	find(x: string): string {
		if (!this.parent.has(x)) {
			this.parent.set(x, x);
		}
		let root = x;
		while (this.parent.get(root) !== root) {
			root = this.parent.get(root)!;
		}
		let curr = x;
		while (curr !== root) {
			const next = this.parent.get(curr)!;
			this.parent.set(curr, root);
			curr = next;
		}
		return root;
	}

	union(a: string, b: string): void {
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) {
			if (ra < rb) {
				this.parent.set(rb, ra);
			} else {
				this.parent.set(ra, rb);
			}
		}
	}
}

// Track merge animation timers
const mergeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function triggerMergeAnimation(store: BoardStore, islandId: string) {
	store.updateShape(islandId, { _islandJustMerged: true });

	const existing = mergeTimers.get(islandId);
	if (existing) clearTimeout(existing);

	mergeTimers.set(
		islandId,
		setTimeout(() => {
			mergeTimers.delete(islandId);
			const shape = store.getShapes().get(islandId);
			if (shape?._islandJustMerged) {
				store.updateShape(islandId, { _islandJustMerged: undefined });
			}
		}, MERGE_ANIMATION_MS),
	);
}

/**
 * 全島の接触状態を分析し、接触している島同士を group シェイプでまとめる。
 * 離れた島はグループから外す。
 */
export function reconcileIslandGroups(
	store: BoardStore,
	commands: { execute: (cmd: { execute: () => void; undo: () => void }) => void },
): void {
	// 1. Collect all top-level island shapes (not already in an island-group)
	//    and islands that are in island-groups
	const allIslands: { id: string; bounds: BoundingBox; parentId?: string }[] = [];
	const islandGroupIds = new Set<string>();

	for (const [id, shape] of store.getShapes()) {
		if (shape.type !== "island") continue;
		const parentId = shape.parentId as string | undefined;
		// Track which groups are island-groups
		if (parentId) {
			const parent = store.getShapes().get(parentId);
			if (parent?.type === "group" && parent._isIslandGroup) {
				islandGroupIds.add(parentId);
			}
		}
		allIslands.push({
			id,
			bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
			parentId,
		});
	}

	if (allIslands.length < 2) {
		// If only 0-1 islands, dissolve any existing island-groups
		for (const groupId of islandGroupIds) {
			commands.execute(createUngroupCommand(store, groupId));
		}
		return;
	}

	// 2. Build adjacency via Union-Find
	const uf = new UnionFind();
	for (let i = 0; i < allIslands.length; i++) {
		uf.find(allIslands[i].id);
		for (let j = i + 1; j < allIslands.length; j++) {
			const a = expandBounds(allIslands[i].bounds, TOUCH_PADDING);
			const b = expandBounds(allIslands[j].bounds, TOUCH_PADDING);
			if (intersectsAABB(a, b)) {
				uf.union(allIslands[i].id, allIslands[j].id);
			}
		}
	}

	// 3. Build desired clusters
	const desiredClusters = new Map<string, string[]>();
	for (const island of allIslands) {
		const root = uf.find(island.id);
		if (!desiredClusters.has(root)) {
			desiredClusters.set(root, []);
		}
		desiredClusters.get(root)?.push(island.id);
	}

	// 4. Build current clusters (based on existing island-groups)
	const currentClusters = new Map<string, Set<string>>(); // groupId → island IDs
	for (const island of allIslands) {
		if (island.parentId && islandGroupIds.has(island.parentId)) {
			if (!currentClusters.has(island.parentId)) {
				currentClusters.set(island.parentId, new Set());
			}
			currentClusters.get(island.parentId)?.add(island.id);
		}
	}

	// 5. Find which island belongs to which current group
	const islandToCurrentGroup = new Map<string, string>();
	for (const [groupId, members] of currentClusters) {
		for (const memberId of members) {
			islandToCurrentGroup.set(memberId, groupId);
		}
	}

	// 6. Reconcile: compare desired vs current
	const processedGroups = new Set<string>();

	for (const [, members] of desiredClusters) {
		if (members.length < 2) {
			// Single island — should not be in an island-group
			const island = members[0];
			const currentGroupId = islandToCurrentGroup.get(island);
			if (currentGroupId && !processedGroups.has(currentGroupId)) {
				processedGroups.add(currentGroupId);
				commands.execute(createUngroupCommand(store, currentGroupId));
			}
			continue;
		}

		// Multi-island cluster — check if already correctly grouped
		const memberSet = new Set(members);
		let existingGroupId: string | undefined;
		let needsRegroup = false;

		// Check if all members share the same island-group
		for (const id of members) {
			const gid = islandToCurrentGroup.get(id);
			if (!gid) {
				needsRegroup = true;
				break;
			}
			if (!existingGroupId) {
				existingGroupId = gid;
			} else if (gid !== existingGroupId) {
				needsRegroup = true;
				break;
			}
		}

		// Check if the existing group has extra members
		if (existingGroupId && !needsRegroup) {
			const currentMembers = currentClusters.get(existingGroupId);
			if (currentMembers && currentMembers.size !== memberSet.size) {
				needsRegroup = true;
			}
		}

		if (!needsRegroup && existingGroupId) {
			processedGroups.add(existingGroupId);
			continue; // Already correctly grouped
		}

		// Dissolve any existing groups that overlap with this cluster
		const groupsToDissolve = new Set<string>();
		for (const id of members) {
			const gid = islandToCurrentGroup.get(id);
			if (gid && !processedGroups.has(gid)) {
				groupsToDissolve.add(gid);
			}
		}
		for (const gid of groupsToDissolve) {
			processedGroups.add(gid);
			commands.execute(createUngroupCommand(store, gid));
		}

		// Create new group
		const children: ShapeData[] = [];
		for (const id of members) {
			const shape = store.getShape(id);
			if (shape) children.push(shape);
		}
		if (children.length < 2) continue;

		const bounds = computeGroupBounds(children);
		const groupId = generateId();
		const groupShape: ShapeData = {
			id: groupId,
			type: "group",
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
			_isIslandGroup: true, // Mark as island-specific group
		};

		commands.execute(createGroupCommand(store, groupShape, members));

		// Trigger merge animation on newly grouped islands
		for (const id of members) {
			triggerMergeAnimation(store, id);
		}
	}

	// Dissolve any remaining island-groups not processed
	for (const groupId of islandGroupIds) {
		if (!processedGroups.has(groupId)) {
			// Check if this group still has the right members
			const currentMembers = currentClusters.get(groupId);
			if (!currentMembers) continue;

			let allInSameCluster = true;
			let clusterRoot: string | undefined;
			for (const memberId of currentMembers) {
				const root = uf.find(memberId);
				if (!clusterRoot) {
					clusterRoot = root;
				} else if (root !== clusterRoot) {
					allInSameCluster = false;
					break;
				}
			}

			if (!allInSameCluster) {
				commands.execute(createUngroupCommand(store, groupId));
			}
		}
	}
}

/** Detach a single island from its island-group */
export function detachIsland(
	store: BoardStore,
	commands: { execute: (cmd: { execute: () => void; undo: () => void }) => void },
	islandId: string,
): void {
	const shape = store.getShape(islandId);
	if (!shape || shape.type !== "island") return;

	const parentId = shape.parentId as string | undefined;
	if (!parentId) return;

	const parent = store.getShapes().get(parentId);
	if (!parent || parent.type !== "group" || !parent._isIslandGroup) return;

	// Get remaining children
	const siblings = getChildShapes(store, parentId).filter((s) => s.id !== islandId);

	// Ungroup the entire group
	commands.execute(createUngroupCommand(store, parentId));

	// If 2+ siblings remain, re-group them
	if (siblings.length >= 2) {
		const bounds = computeGroupBounds(siblings);
		const newGroupId = generateId();
		const newGroupShape: ShapeData = {
			id: newGroupId,
			type: "group",
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
			_isIslandGroup: true,
		};
		commands.execute(
			createGroupCommand(
				store,
				newGroupShape,
				siblings.map((s) => s.id),
			),
		);
	}
}

export function cleanupIslandGroupTimers(): void {
	for (const timer of mergeTimers.values()) {
		clearTimeout(timer);
	}
	mergeTimers.clear();
}

// === QuadTree implementation for spatial indexing ===

interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface QuadTreeItem extends Bounds {
	id: string;
	[key: string]: any;
}

interface QuadTreeNode {
	bounds: Bounds;
	items: QuadTreeItem[];
	nodes: QuadTreeNode[];
	divided: boolean;
}

// Configuration constants
const MAX_ITEMS_PER_NODE = 4;
const MAX_DEPTH = 8;
const MIN_NODE_SIZE = 50; // Minimum size before stopping subdivision

export class QuadTree {
	private root: QuadTreeNode;
	private itemsMap: Map<string, QuadTreeItem>;

	constructor(bounds: Bounds) {
		this.root = this.createNode(bounds);
		this.itemsMap = new Map();
	}

	private createNode(bounds: Bounds): QuadTreeNode {
		return {
			bounds,
			items: [],
			nodes: [],
			divided: false,
		};
	}

	// Insert an item into the QuadTree
	insert(item: QuadTreeItem): boolean {
		if (!this.itemsMap.has(item.id)) {
			this.itemsMap.set(item.id, item);
			return this.insertIntoNode(this.root, item, 0);
		}
		return false;
	}

	private insertIntoNode(node: QuadTreeNode, item: QuadTreeItem, depth: number): boolean {
		// Check if item is within bounds
		if (!this.intersects(node.bounds, item)) {
			return false;
		}

		// If node hasn't been subdivided and has space, add item
		if (!node.divided && node.items.length < MAX_ITEMS_PER_NODE) {
			node.items.push(item);
			return true;
		}

		// Check if we've reached max depth or minimum size
		if (
			depth >= MAX_DEPTH ||
			node.bounds.width < MIN_NODE_SIZE ||
			node.bounds.height < MIN_NODE_SIZE
		) {
			node.items.push(item);
			return true;
		}

		// Subdivide if not already divided
		if (!node.divided) {
			this.subdivide(node, depth);
		}

		// Try to insert into child nodes
		for (const childNode of node.nodes) {
			if (this.insertIntoNode(childNode, item, depth + 1)) {
				return true;
			}
		}

		// If item doesn't fit in children (edge case), store in parent
		node.items.push(item);
		return true;
	}

	private subdivide(node: QuadTreeNode, depth = 0): void {
		const { x, y, width, height } = node.bounds;
		const halfWidth = width / 2;
		const halfHeight = height / 2;

		// Create four quadrants
		node.nodes = [
			// Top-left
			this.createNode({ x, y, width: halfWidth, height: halfHeight }),
			// Top-right
			this.createNode({ x: x + halfWidth, y, width: halfWidth, height: halfHeight }),
			// Bottom-left
			this.createNode({ x, y: y + halfHeight, width: halfWidth, height: halfHeight }),
			// Bottom-right
			this.createNode({
				x: x + halfWidth,
				y: y + halfHeight,
				width: halfWidth,
				height: halfHeight,
			}),
		];

		node.divided = true;

		// Redistribute existing items to child nodes
		const items = [...node.items];
		node.items = [];

		for (const item of items) {
			let inserted = false;
			for (const childNode of node.nodes) {
				if (this.insertIntoNode(childNode, item, depth + 1)) {
					inserted = true;
					break;
				}
			}
			// If item doesn't fit in children, keep in parent
			if (!inserted) {
				node.items.push(item);
			}
		}
	}

	// Remove an item from the QuadTree
	remove(itemId: string): boolean {
		const item = this.itemsMap.get(itemId);
		if (!item) return false;

		this.itemsMap.delete(itemId);
		return this.removeFromNode(this.root, itemId);
	}

	private removeFromNode(node: QuadTreeNode, itemId: string): boolean {
		// Check items in current node
		const index = node.items.findIndex((item) => item.id === itemId);
		if (index !== -1) {
			node.items.splice(index, 1);
			return true;
		}

		// Check child nodes if divided
		if (node.divided) {
			for (const childNode of node.nodes) {
				if (this.removeFromNode(childNode, itemId)) {
					return true;
				}
			}
		}

		return false;
	}

	// Query items within a region
	query(bounds: Bounds): QuadTreeItem[] {
		const results: QuadTreeItem[] = [];
		this.queryNode(this.root, bounds, results);
		return results;
	}

	private queryNode(node: QuadTreeNode, bounds: Bounds, results: QuadTreeItem[]): void {
		// Check if search bounds intersect with node bounds
		if (!this.intersects(node.bounds, bounds)) {
			return;
		}

		// Check items in current node
		for (const item of node.items) {
			if (this.intersects(item, bounds)) {
				results.push(item);
			}
		}

		// Check child nodes if divided
		if (node.divided) {
			for (const childNode of node.nodes) {
				this.queryNode(childNode, bounds, results);
			}
		}
	}

	// Find nearest items to a point
	findNearest(x: number, y: number, maxDistance: number, maxItems = 10): QuadTreeItem[] {
		const searchBounds: Bounds = {
			x: x - maxDistance,
			y: y - maxDistance,
			width: maxDistance * 2,
			height: maxDistance * 2,
		};

		const candidates = this.query(searchBounds);

		// Calculate distances and sort
		const itemsWithDistance = candidates
			.map((item) => ({
				item,
				distance: this.calculateDistance(x, y, item),
			}))
			.filter(({ distance }) => distance <= maxDistance)
			.sort((a, b) => a.distance - b.distance);

		return itemsWithDistance.slice(0, maxItems).map(({ item }) => item);
	}

	private calculateDistance(x: number, y: number, item: Bounds): number {
		// Calculate distance from point to closest point on rectangle
		const closestX = Math.max(item.x, Math.min(x, item.x + item.width));
		const closestY = Math.max(item.y, Math.min(y, item.y + item.height));

		const dx = x - closestX;
		const dy = y - closestY;

		return Math.sqrt(dx * dx + dy * dy);
	}

	// Check if two bounds intersect
	private intersects(a: Bounds, b: Bounds): boolean {
		return !(
			a.x + a.width < b.x ||
			b.x + b.width < a.x ||
			a.y + a.height < b.y ||
			b.y + b.height < a.y
		);
	}

	// Clear all items
	clear(): void {
		this.root = this.createNode(this.root.bounds);
		this.itemsMap.clear();
	}

	// Update an item's position
	update(itemId: string, newBounds: Partial<Bounds>): boolean {
		const item = this.itemsMap.get(itemId);
		if (!item) return false;

		// Remove old item
		this.removeFromNode(this.root, itemId);

		// Update bounds
		Object.assign(item, newBounds);

		// Re-insert with new bounds
		return this.insertIntoNode(this.root, item, 0);
	}

	// Get statistics about the tree
	getStats(): { totalItems: number; maxDepth: number; nodeCount: number } {
		const stats = {
			totalItems: this.itemsMap.size,
			maxDepth: 0,
			nodeCount: 0,
		};

		this.calculateStats(this.root, 0, stats);
		return stats;
	}

	private calculateStats(
		node: QuadTreeNode,
		depth: number,
		stats: { maxDepth: number; nodeCount: number },
	): void {
		stats.nodeCount++;
		stats.maxDepth = Math.max(stats.maxDepth, depth);

		if (node.divided) {
			for (const childNode of node.nodes) {
				this.calculateStats(childNode, depth + 1, stats);
			}
		}
	}

	// Debug visualization helper
	getTreeStructure(): any {
		return this.nodeToStructure(this.root);
	}

	private nodeToStructure(node: QuadTreeNode): any {
		return {
			bounds: node.bounds,
			itemCount: node.items.length,
			divided: node.divided,
			children: node.divided ? node.nodes.map((n) => this.nodeToStructure(n)) : [],
		};
	}
}

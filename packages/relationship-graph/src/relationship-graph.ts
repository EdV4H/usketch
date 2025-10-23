/**
 * RelationshipGraph
 *
 * 形状間の関係性をグラフ構造として管理
 * 高速なクエリとトラバーサルをサポート
 */

import type { RelationType, ShapeRelationship } from "@usketch/shared-types";

/**
 * 関係性のグラフ構造を管理
 */
export class RelationshipGraph {
	private relationships: Map<string, ShapeRelationship> = new Map();

	// インデックス（高速検索用）
	private parentIndex: Map<string, Set<string>> = new Map(); // parentId -> relationIds
	private childIndex: Map<string, Set<string>> = new Map(); // childId -> relationIds
	private typeIndex: Map<RelationType, Set<string>> = new Map(); // type -> relationIds

	/**
	 * 関係を追加
	 */
	addRelationship(relation: ShapeRelationship): void {
		this.relationships.set(relation.id, relation);

		// インデックスを更新
		this.addToIndex(this.parentIndex, relation.parentId, relation.id);
		this.addToIndex(this.childIndex, relation.childId, relation.id);
		this.addToIndex(this.typeIndex, relation.type, relation.id);
	}

	/**
	 * 関係を削除
	 */
	removeRelationship(relationId: string): boolean {
		const relation = this.relationships.get(relationId);
		if (!relation) return false;

		this.relationships.delete(relationId);

		// インデックスから削除
		this.removeFromIndex(this.parentIndex, relation.parentId, relationId);
		this.removeFromIndex(this.childIndex, relation.childId, relationId);
		this.removeFromIndex(this.typeIndex, relation.type, relationId);

		return true;
	}

	/**
	 * 関係を取得
	 */
	getRelationship(relationId: string): ShapeRelationship | undefined {
		return this.relationships.get(relationId);
	}

	/**
	 * 親の全子関係を取得（O(1)）
	 */
	getChildRelationships(parentId: string): ShapeRelationship[] {
		const relationIds = this.parentIndex.get(parentId) ?? new Set();
		return Array.from(relationIds)
			.map((id) => this.relationships.get(id))
			.filter((r): r is ShapeRelationship => r !== undefined);
	}

	/**
	 * 子の全親関係を取得（O(1)）
	 */
	getParentRelationships(childId: string): ShapeRelationship[] {
		const relationIds = this.childIndex.get(childId) ?? new Set();
		return Array.from(relationIds)
			.map((id) => this.relationships.get(id))
			.filter((r): r is ShapeRelationship => r !== undefined);
	}

	/**
	 * 特定タイプの関係を取得（O(1)）
	 */
	getRelationshipsByType(type: RelationType): ShapeRelationship[] {
		const relationIds = this.typeIndex.get(type) ?? new Set();
		return Array.from(relationIds)
			.map((id) => this.relationships.get(id))
			.filter((r): r is ShapeRelationship => r !== undefined);
	}

	/**
	 * 2つの形状間に関係が存在するかチェック
	 */
	hasRelationship(parentId: string, childId: string, type?: RelationType): boolean {
		const relations = this.getChildRelationships(parentId);
		return relations.some((r) => r.childId === childId && (type === undefined || r.type === type));
	}

	/**
	 * 循環参照チェック（グラフ探索）
	 * childIdからparentIdへのパスが存在するかDFSでチェック
	 */
	wouldCreateCycle(parentId: string, childId: string): boolean {
		const visited = new Set<string>();
		const stack = [childId];

		while (stack.length > 0) {
			const current = stack.pop();
			if (current === undefined) continue;
			if (current === parentId) return true; // 循環検出
			if (visited.has(current)) continue;
			visited.add(current);

			// currentの全子を探索
			const children = this.getChildRelationships(current);
			for (const relation of children) {
				stack.push(relation.childId);
			}
		}

		return false;
	}

	/**
	 * 全祖先を取得（ルートまで）
	 */
	getAncestors(shapeId: string, type?: RelationType): string[] {
		const ancestors: string[] = [];
		const visited = new Set<string>();
		let current = shapeId;

		while (true) {
			const parents = this.getParentRelationships(current);
			const filtered = type ? parents.filter((r) => r.type === type) : parents;

			if (filtered.length === 0) break;

			// 複数の親がいる場合は最初の親を選択（BFS的に全祖先を取得も可能）
			const parent = filtered[0];
			if (!parent) break;
			if (visited.has(parent.parentId)) break; // 循環防止
			visited.add(parent.parentId);

			ancestors.push(parent.parentId);
			current = parent.parentId;
		}

		return ancestors;
	}

	/**
	 * 全子孫を取得（深さ優先）
	 */
	getDescendants(shapeId: string, type?: RelationType): string[] {
		const descendants: string[] = [];
		const visited = new Set<string>();
		const stack = [shapeId];

		while (stack.length > 0) {
			const current = stack.pop();
			if (current === undefined) continue;
			if (visited.has(current)) continue;
			visited.add(current);

			const children = this.getChildRelationships(current);
			const filtered = type ? children.filter((r) => r.type === type) : children;

			for (const relation of filtered) {
				descendants.push(relation.childId);
				stack.push(relation.childId);
			}
		}

		return descendants;
	}

	/**
	 * 統計情報を取得（デバッグ用）
	 */
	getStats(): {
		totalRelationships: number;
		byType: Record<string, number>;
		avgChildrenPerParent: number;
	} {
		const byType: Record<string, number> = {};
		for (const relation of this.relationships.values()) {
			byType[relation.type] = (byType[relation.type] ?? 0) + 1;
		}

		const avgChildren =
			this.parentIndex.size > 0 ? this.relationships.size / this.parentIndex.size : 0;

		return {
			totalRelationships: this.relationships.size,
			byType,
			avgChildrenPerParent: avgChildren,
		};
	}

	/**
	 * インデックスに追加
	 */
	private addToIndex<K>(index: Map<K, Set<string>>, key: K, value: string): void {
		if (!index.has(key)) {
			index.set(key, new Set());
		}
		const set = index.get(key);
		if (set) {
			set.add(value);
		}
	}

	/**
	 * インデックスから削除
	 */
	private removeFromIndex<K>(index: Map<K, Set<string>>, key: K, value: string): void {
		const set = index.get(key);
		if (set) {
			set.delete(value);
			if (set.size === 0) {
				index.delete(key);
			}
		}
	}

	/**
	 * 全関係をクリア
	 */
	clear(): void {
		this.relationships.clear();
		this.parentIndex.clear();
		this.childIndex.clear();
		this.typeIndex.clear();
	}

	/**
	 * 全関係を配列として取得
	 */
	toArray(): ShapeRelationship[] {
		return Array.from(this.relationships.values());
	}

	/**
	 * 関係の総数を取得
	 */
	get size(): number {
		return this.relationships.size;
	}
}

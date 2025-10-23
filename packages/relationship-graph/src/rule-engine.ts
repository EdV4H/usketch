/**
 * RelationshipRuleEngine
 *
 * 形状タイプの組み合わせに応じた親子関係の振る舞いを管理
 */

import type {
	EffectType,
	RelationshipEffect,
	RelationshipRule,
	Shape,
	ShapeRelationship,
} from "@usketch/shared-types";
import type { RelationshipGraph } from "./relationship-graph";

/**
 * 親子関係のルールエンジン
 */
export class RelationshipRuleEngine {
	private rules: RelationshipRule[] = [];

	constructor(private graph: RelationshipGraph) {}

	/**
	 * ルールを登録
	 */
	registerRule(rule: RelationshipRule): void {
		this.rules.push(rule);
		// 優先度でソート（高い順）
		this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	}

	/**
	 * 複数のルールを一括登録
	 */
	registerRules(rules: RelationshipRule[]): void {
		for (const rule of rules) {
			this.registerRule(rule);
		}
	}

	/**
	 * 重なり時のルール判定
	 */
	checkOverlap(
		parent: Shape,
		child: Shape,
		overlapType: "contains" | "intersects" | "center-inside",
		existingRelations: ShapeRelationship[],
	): RelationshipRule | null {
		for (const rule of this.rules) {
			// 自動形成が無効なルールはスキップ
			if (!rule.canFormOnOverlap) continue;

			// 親子タイプのマッチング
			if (!this.matchesType(parent.type, rule.parentType)) continue;
			if (!this.matchesType(child.type, rule.childType)) continue;

			// 重なり条件のチェック
			if (rule.overlapCondition !== overlapType) continue;

			// 多対多チェック
			if (!rule.allowMultipleParents) {
				const hasParent = existingRelations.some((r) => r.childId === child.id);
				if (hasParent) continue;
			}

			// カスタムバリデーション
			if (rule.validate && !rule.validate(parent, child, existingRelations)) {
				continue;
			}

			return rule;
		}
		return null;
	}

	/**
	 * 関係を作成
	 */
	createRelationship(
		parentId: string,
		childId: string,
		rule: RelationshipRule,
		metadata?: ShapeRelationship["metadata"],
	): ShapeRelationship {
		const relationship: ShapeRelationship = {
			id: this.generateId(),
			type: rule.type,
			parentId,
			childId,
			createdAt: Date.now(),
			effects: rule.effects,
		};

		if (metadata !== undefined) {
			relationship.metadata = metadata;
		}

		if (rule.constraints !== undefined) {
			relationship.constraints = rule.constraints;
		}

		return relationship;
	}

	/**
	 * 親が変更された時に子にエフェクトを適用
	 */
	applyEffectsToChildren(
		parentId: string,
		changeType: "position" | "size" | "rotation" | "style",
		shapes: Record<string, Shape>,
	): Shape[] {
		const parent = shapes[parentId];
		if (!parent) return [];

		const relations = this.graph.getChildRelationships(parentId);
		const updatedShapes: Shape[] = [];

		for (const relation of relations) {
			const child = shapes[relation.childId];
			if (!child) continue;

			const effects = relation.effects ?? [];
			for (const effect of effects) {
				if (this.shouldApplyEffect(effect, changeType)) {
					const updated = this.applyEffect(effect, parent, child, shapes);
					if (updated) {
						updatedShapes.push(updated);
					}
				}
			}
		}

		return updatedShapes;
	}

	/**
	 * 関係が変更された時の処理（新規追加・削除）
	 */
	onRelationshipChanged(
		relation: ShapeRelationship,
		action: "added" | "removed",
		shapes: Record<string, Shape>,
	): void {
		if (action === "added") {
			// 関係追加時の初期エフェクト適用
			const parent = shapes[relation.parentId];
			const child = shapes[relation.childId];
			if (!parent || !child) return;

			const effects = relation.effects ?? [];
			for (const effect of effects) {
				this.applyEffect(effect, parent, child, shapes);
			}
		}
		// removed時は特に処理不要（子は独立した状態に戻る）
	}

	/**
	 * 形状タイプのマッチング判定
	 */
	private matchesType(shapeType: string, ruleType: Shape["type"] | Shape["type"][] | "*"): boolean {
		if (ruleType === "*") return true;
		if (Array.isArray(ruleType)) {
			return ruleType.includes(shapeType as Shape["type"]);
		}
		return shapeType === ruleType;
	}

	/**
	 * エフェクトを適用すべきか判定
	 */
	private shouldApplyEffect(
		effect: RelationshipEffect,
		changeType: "position" | "size" | "rotation" | "style",
	): boolean {
		const effectChangeMap: Record<EffectType, string[]> = {
			"move-with-parent": ["position"],
			"resize-with-parent": ["size"],
			"rotate-with-parent": ["rotation"],
			"clip-by-parent": ["position", "size"],
			"inherit-style": ["style"],
			"auto-layout": ["position", "size"],
			"maintain-distance": ["position"],
		};

		const applicableChanges = effectChangeMap[effect.type];
		return applicableChanges?.includes(changeType) ?? false;
	}

	/**
	 * エフェクトを適用（実装は個別のエフェクトハンドラに委譲）
	 */
	private applyEffect(
		_effect: RelationshipEffect,
		_parent: Shape,
		_child: Shape,
		_shapes: Record<string, Shape>,
	): Shape | null {
		// Phase 2で実装予定
		// 現在はnullを返す（エフェクトハンドラ未実装）
		return null;
	}

	/**
	 * ユニークIDを生成
	 */
	private generateId(): string {
		return `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * 登録されているルールを取得
	 */
	getRules(): RelationshipRule[] {
		return [...this.rules];
	}

	/**
	 * 特定のルールを取得
	 */
	getRule(ruleId: string): RelationshipRule | undefined {
		return this.rules.find((r) => r.id === ruleId);
	}
}

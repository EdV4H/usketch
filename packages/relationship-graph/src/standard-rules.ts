/**
 * 標準的な親子関係ルールのセット
 */

import type { RelationshipRule } from "@usketch/shared-types";

/**
 * 標準的な親子関係ルール
 */
export const standardRelationshipRules: RelationshipRule[] = [
	// グループ: 任意の形状を包含
	{
		id: "group-containment",
		type: "containment",
		parentType: "group",
		childType: "*",
		canFormOnOverlap: false, // 明示的なグループ化操作のみ
		overlapCondition: "contains",
		effects: [{ type: "move-with-parent" }, { type: "rotate-with-parent" }],
		constraints: [
			{ type: "visibility", mode: "inherit" },
			{ type: "lock", mode: "inherit" },
		],
		priority: 10,
	},

	// テキストラベル: 図形に付随
	{
		id: "shape-label",
		type: "attachment",
		parentType: ["rectangle", "ellipse", "group"],
		childType: "text",
		canFormOnOverlap: true,
		overlapCondition: "center-inside",
		effects: [
			{ type: "move-with-parent" },
			{ type: "rotate-with-parent" },
			{
				type: "inherit-style",
				config: { properties: ["fillColor", "strokeColor"] },
			},
		],
		priority: 15,
	},

	// ライン: 図形間を接続
	{
		id: "line-connection",
		type: "connection",
		parentType: ["rectangle", "ellipse", "group"],
		childType: "line",
		canFormOnOverlap: true,
		overlapCondition: "intersects",
		effects: [
			{
				type: "maintain-distance",
				config: { snapToEdge: true },
			},
		],
		priority: 25,
	},
];

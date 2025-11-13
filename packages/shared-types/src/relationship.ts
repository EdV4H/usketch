/**
 * Shape Relationship System - Type Definitions
 *
 * 形状間の親子関係とその振る舞いを定義する型システム
 * Graph実装: relationships配列による柔軟な関係性管理
 */

import type { Shape } from "./index";

/**
 * 親子関係のタイプ
 */
export type RelationType =
	| "containment" // グループによる包含
	| "attachment" // ラベルなどの付随
	| "connection" // コネクタによる接続
	| "clip" // フレームによるクリッピング
	| "mask" // マスキング
	| "instance" // コンポーネントのインスタンス
	| "layout"; // レイアウトコンテナの子

/**
 * 形状間の関係性
 * relationships配列で管理される
 */
export interface ShapeRelationship {
	/** 関係ID（一意） */
	id: string;

	/** 関係のタイプ */
	type: RelationType;

	/** 親形状のID */
	parentId: string;

	/** 子形状のID */
	childId: string;

	/** 関係固有のメタデータ */
	metadata?: RelationshipMetadata;

	/** 作成日時 */
	createdAt: number;

	/** 最終更新日時 */
	updatedAt?: number;

	/** この関係が適用するエフェクト（オプション、ルールから継承も可） */
	effects?: RelationshipEffect[];

	/** この関係の制約（オプション） */
	constraints?: RelationshipConstraint[];
}

/**
 * 関係固有のメタデータ
 */
export interface RelationshipMetadata {
	/** コネクタの接続点情報 */
	connectionPoint?: {
		edge: "top" | "right" | "bottom" | "left";
		offset: number; // 0-1の範囲
	};

	/** レイアウト情報 */
	layoutConfig?: {
		flex?: number;
		order?: number;
		margin?: { top: number; right: number; bottom: number; left: number };
	};

	/** インスタンス情報 */
	instanceOverrides?: Record<string, unknown>;

	/** カスタムメタデータ */
	custom?: Record<string, unknown>;
}

/**
 * 重なり判定の条件
 */
export type OverlapCondition =
	| "contains" // 完全に内包している
	| "intersects" // 部分的に重なっている
	| "center-inside"; // 中心点が内側にある

/**
 * エフェクトのタイプ
 */
export type EffectType =
	| "move-with-parent" // 親と一緒に移動
	| "resize-with-parent" // 親のリサイズに追従
	| "rotate-with-parent" // 親の回転に追従
	| "clip-by-parent" // 親の境界でクリップ
	| "inherit-style" // スタイルを継承
	| "auto-layout" // 自動レイアウト
	| "maintain-distance"; // 親との距離を維持

/**
 * 親子関係が形成された時の作用
 */
export interface RelationshipEffect {
	/** エフェクトのタイプ */
	type: EffectType;

	/** エフェクト固有の設定 */
	config?: Record<string, unknown>;
}

/**
 * 制約のタイプ
 */
export type ConstraintType =
	| "position" // 位置の制約
	| "size" // サイズの制約
	| "style" // スタイルの制約
	| "visibility" // 可視性の制約
	| "lock"; // ロック状態の制約

/**
 * 親子関係の制約
 */
export interface RelationshipConstraint {
	/** 制約のタイプ */
	type: ConstraintType;

	/** 制約の適用モード */
	mode: "inherit" | "constrain" | "sync";

	/** 制約固有の設定 */
	config?: Record<string, unknown>;
}

/**
 * 親子関係のルール定義
 */
export interface RelationshipRule {
	/** ルールID（デバッグ用） */
	id: string;

	/** 関係性のタイプ */
	type: RelationType;

	/** 親として許可される形状タイプ */
	parentType: Shape["type"] | Shape["type"][] | "*";

	/** 子として許可される形状タイプ */
	childType: Shape["type"] | Shape["type"][] | "*";

	/** 重なり時に自動で親子関係を形成するか */
	canFormOnOverlap: boolean;

	/** 重なり判定の条件 */
	overlapCondition: OverlapCondition;

	/** 適用されるエフェクト */
	effects: RelationshipEffect[];

	/** 適用される制約（オプション） */
	constraints?: RelationshipConstraint[];

	/** 優先度（複数ルールがマッチした時の判定用） */
	priority?: number;

	/** 多対多を許可するか */
	allowMultipleParents?: boolean;
	allowMultipleChildren?: boolean;

	/** カスタムバリデーション */
	validate?: (parent: Shape, child: Shape, existing: ShapeRelationship[]) => boolean;
}

/**
 * エフェクトハンドラの型定義
 */
export type EffectHandler = (
	parent: Shape,
	child: Shape,
	config: Record<string, unknown> | undefined,
	shapes: Record<string, Shape>,
) => Shape | null;

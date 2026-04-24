import type { ShapeData } from "@edv4h/usketch-shared";

/** Community region shape extension: intrinsic data for the `community-region` shape. */
export interface CommunityRegionShapeData extends ShapeData {
	displayName?: string;
	themeColor?: string;
	icon?: string;
	onlineCount?: number;
	memberCount?: number;
	active?: boolean;
	slug?: string;
}

import { globalBackgroundRegistry } from "@usketch/react-canvas";
import {
	GradientMeshBackground,
	NeonLinesBackground,
	ParticleBackground,
	RippleBackground,
	StarsBackground,
} from "./custom-backgrounds";

/**
 * アプリケーション固有のカスタム背景を登録
 */
export function registerCustomBackgrounds(): void {
	// カスタム背景を登録
	globalBackgroundRegistry.registerMultiple({
		"custom.particles": ParticleBackground,
		"custom.ripple": RippleBackground,
		"custom.gradient-mesh": GradientMeshBackground,
		"custom.stars": StarsBackground,
		"custom.neon-lines": NeonLinesBackground,
	});
}

/**
 * カスタム背景のメタデータ
 */
export const CUSTOM_BACKGROUNDS_METADATA = {
	"custom.particles": {
		name: "パーティクル",
		description: "浮遊するパーティクル効果",
		category: "animation",
	},
	"custom.ripple": {
		name: "波紋",
		description: "波紋が広がるアニメーション",
		category: "animation",
	},
	"custom.gradient-mesh": {
		name: "グラデーションメッシュ",
		description: "複数のグラデーションが重なる効果",
		category: "static",
	},
	"custom.stars": {
		name: "星空",
		description: "きらめく星空の背景",
		category: "animation",
	},
	"custom.neon-lines": {
		name: "ネオンライン",
		description: "動くネオンライン効果",
		category: "animation",
	},
} as const;

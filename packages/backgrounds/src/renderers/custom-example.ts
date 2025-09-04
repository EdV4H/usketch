import type { Camera } from "@usketch/shared-types";
import type { BackgroundRenderer } from "../types";

/**
 * カスタム背景レンダラーの例
 * グラデーション背景を描画するシンプルな実装
 */
export interface GradientConfig {
	startColor?: string;
	endColor?: string;
	angle?: number;
}

export class GradientRenderer implements BackgroundRenderer<GradientConfig> {
	render(container: HTMLElement, camera: Camera, config?: GradientConfig): void {
		const startColor = config?.startColor || "#ff0000";
		const endColor = config?.endColor || "#0000ff";
		const angle = config?.angle || 45;

		// CSSグラデーションを設定
		container.style.background = `linear-gradient(${angle}deg, ${startColor}, ${endColor})`;
		container.style.backgroundSize = "200% 200%";

		// カメラのズームに応じて背景をスケール
		if (camera.zoom !== 1) {
			container.style.backgroundPosition = `${-camera.x}px ${-camera.y}px`;
		}
	}

	cleanup(container: HTMLElement): void {
		container.style.background = "";
		container.style.backgroundSize = "";
		container.style.backgroundPosition = "";
	}
}

/**
 * アニメーション付きカスタムレンダラーの例
 * パルス効果のある背景
 */
export interface PulseConfig {
	color?: string;
	speed?: number;
}

export class PulseRenderer implements BackgroundRenderer<PulseConfig> {
	render(container: HTMLElement, camera: Camera, config?: PulseConfig): void {
		const color = config?.color || "#007acc";
		const speed = config?.speed || 2000;

		// アニメーション用のキーフレームを動的に作成
		const styleSheet = document.createElement("style");
		styleSheet.textContent = `
			@keyframes pulse-bg {
				0% { opacity: 0.3; }
				50% { opacity: 0.1; }
				100% { opacity: 0.3; }
			}
		`;
		document.head.appendChild(styleSheet);

		container.style.backgroundColor = color;
		container.style.animation = `pulse-bg ${speed}ms infinite`;

		// カメラに応じた調整
		container.style.transform = `scale(${camera.zoom})`;
		container.style.transformOrigin = "0 0";
	}

	cleanup(container: HTMLElement): void {
		container.style.backgroundColor = "";
		container.style.animation = "";
		container.style.transform = "";
		container.style.transformOrigin = "";

		// アニメーション用スタイルシートを削除
		const styles = document.head.querySelectorAll("style");
		styles.forEach((style) => {
			if (style.textContent?.includes("pulse-bg")) {
				style.remove();
			}
		});
	}
}

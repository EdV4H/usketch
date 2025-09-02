import type { Camera } from "@usketch/shared-types";
import type { DotsConfig } from "../types";
import { BaseRenderer } from "./base";

/**
 * ドット背景レンダラー
 * ドットパターンの背景を描画
 */
export class DotsRenderer extends BaseRenderer<DotsConfig> {
	private _cachedSpacing?: number;
	private _cachedSize?: number;
	private _cachedColor?: string;

	render(container: HTMLElement, camera: Camera, config?: DotsConfig): void {
		const spacing = (config?.spacing || 20) * camera.zoom;
		const size = config?.size || 2;
		const color = config?.color || "#d0d0d0";

		// パフォーマンス最適化: 値が変更された場合のみSVGを再生成
		if (
			this._cachedSpacing !== spacing ||
			this._cachedSize !== size ||
			this._cachedColor !== color
		) {
			const svg = this.generateDotsSVG(spacing, size, color);
			container.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
			container.style.backgroundSize = `${spacing}px ${spacing}px`;
			container.style.backgroundPosition = `${-camera.x % spacing}px ${-camera.y % spacing}px`;

			this._cachedSpacing = spacing;
			this._cachedSize = size;
			this._cachedColor = color;
		} else {
			// カメラ位置のみ更新
			container.style.backgroundPosition = `${-camera.x % spacing}px ${-camera.y % spacing}px`;
		}

		this.updateCache(camera, config);
	}

	/**
	 * ドットパターンのSVGを生成
	 *
	 * @param spacing - 隣接するドットの中心間距離（px）
	 * @param size - 各ドットの直径（px）
	 * @param color - ドットの塗りつぶし色
	 * @returns SVG文字列
	 */
	private generateDotsSVG(spacing: number, size: number, color: string): string {
		return `<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${spacing / 2}" cy="${spacing / 2}" r="${size / 2}" fill="${color}" />
    </svg>`;
	}
}

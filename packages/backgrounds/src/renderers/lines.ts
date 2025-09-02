import type { Camera } from "@usketch/shared-types";
import type { LinesConfig } from "../types";
import { BaseRenderer } from "./base";

/**
 * ライン背景レンダラー
 * 横線、縦線、またはその両方を描画
 */
export class LinesRenderer extends BaseRenderer<LinesConfig> {
	private _cachedDirection?: string;
	private _cachedSpacing?: number;
	private _cachedColor?: string;
	private _cachedThickness?: number;

	render(container: HTMLElement, camera: Camera, config?: LinesConfig): void {
		const direction = config?.direction || "horizontal";
		const spacing = (config?.spacing || 25) * camera.zoom;
		const color = config?.color || "#e0e0e0";
		const thickness = config?.thickness || 1;

		// パフォーマンス最適化: 値が変更された場合のみ更新
		if (
			this._cachedDirection !== direction ||
			this._cachedSpacing !== spacing ||
			this._cachedColor !== color ||
			this._cachedThickness !== thickness
		) {
			let gradient = "";
			if (direction === "horizontal" || direction === "both") {
				gradient += `linear-gradient(to bottom, ${color} ${thickness}px, transparent ${thickness}px)`;
			}
			if (direction === "vertical" || direction === "both") {
				if (gradient) gradient += ", ";
				gradient += `linear-gradient(to right, ${color} ${thickness}px, transparent ${thickness}px)`;
			}

			container.style.backgroundImage = gradient;
			container.style.backgroundSize = `${spacing}px ${spacing}px`;
			container.style.backgroundPosition = `${-camera.x % spacing}px ${-camera.y % spacing}px`;

			this._cachedDirection = direction;
			this._cachedSpacing = spacing;
			this._cachedColor = color;
			this._cachedThickness = thickness;
		} else {
			// カメラ位置のみ更新
			container.style.backgroundPosition = `${-camera.x % spacing}px ${-camera.y % spacing}px`;
		}

		this.updateCache(camera, config);
	}
}

import type { Camera } from "@usketch/shared-types";
import type { GridConfig } from "../types";
import { BaseRenderer } from "./base";

/**
 * グリッド背景レンダラー
 * 格子状のグリッド線を描画
 */
export class GridRenderer extends BaseRenderer<GridConfig> {
	private _cachedSize?: number;
	private _cachedColor?: string;
	private _cachedThickness?: number;

	render(container: HTMLElement, camera: Camera, config?: GridConfig): void {
		const gridSize = config?.size || 20;
		const size = gridSize * camera.zoom;
		const color = config?.color || "#e0e0e0";
		const thickness = config?.thickness || 1;

		// パフォーマンス最適化: 値が変更された場合のみ更新
		if (
			this._cachedSize !== size ||
			this._cachedColor !== color ||
			this._cachedThickness !== thickness
		) {
			// グリッドパターンを CSS グラデーションで作成
			container.style.backgroundImage = `
        linear-gradient(to right, ${color} ${thickness}px, transparent ${thickness}px),
        linear-gradient(to bottom, ${color} ${thickness}px, transparent ${thickness}px)
      `;
			container.style.backgroundSize = `${size}px ${size}px`;
			container.style.backgroundPosition = `${-camera.x % size}px ${-camera.y % size}px`;

			this._cachedSize = size;
			this._cachedColor = color;
			this._cachedThickness = thickness;
		} else {
			// カメラ位置のみ更新
			container.style.backgroundPosition = `${-camera.x % size}px ${-camera.y % size}px`;
		}

		this.updateCache(camera, config);
	}
}

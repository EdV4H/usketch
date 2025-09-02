import type { Camera } from "@usketch/shared-types";
import type { IsometricConfig } from "../types";
import { BaseRenderer } from "./base";

/**
 * アイソメトリックグリッドレンダラー
 * 30度の角度の線を使用して3D効果をシミュレート
 */
export class IsometricRenderer extends BaseRenderer<IsometricConfig> {
	private _cachedSize?: number;
	private _cachedColor?: string;

	render(container: HTMLElement, camera: Camera, config?: IsometricConfig): void {
		const size = (config?.size || 30) * camera.zoom;
		const color = config?.color || "#e0e0e0";

		// パフォーマンス最適化: 値が変更された場合のみSVGを再生成
		if (this._cachedSize !== size || this._cachedColor !== color) {
			const svg = this.generateIsometricSVG(size, color);
			container.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
			container.style.backgroundSize = `${size}px ${size * 0.866 * 2}px`;
			container.style.backgroundPosition = `${-camera.x % size}px ${
				-camera.y % (size * 0.866 * 2)
			}px`;

			this._cachedSize = size;
			this._cachedColor = color;
		} else {
			// カメラ位置のみ更新
			container.style.backgroundPosition = `${-camera.x % size}px ${
				-camera.y % (size * 0.866 * 2)
			}px`;
		}

		this.updateCache(camera, config);
	}

	/**
	 * アイソメトリックグリッドのSVGパターンを生成
	 *
	 * @param size - グリッドサイズ（グリッド点間の距離）
	 * @param color - 線の色
	 * @returns SVG文字列
	 */
	private generateIsometricSVG(size: number, color: string): string {
		const height = size * 0.866; // size * sin(60°)
		const strokeWidth = Math.max(1, size * 0.02); // 線の太さをサイズに応じて調整

		return `<svg width="${size}" height="${height * 2}" viewBox="0 0 ${size} ${
			height * 2
		}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="iso-${size}-${color.replace("#", "")}" width="${size}" height="${
					height * 2
				}" patternUnits="userSpaceOnUse">
          <!-- 30度の線 -->
          <line x1="0" y1="0" x2="${size}" y2="${height}" stroke="${color}" stroke-width="${strokeWidth}"/>
          <line x1="0" y1="${
						height * 2
					}" x2="${size}" y2="${height}" stroke="${color}" stroke-width="${strokeWidth}"/>
          <!-- 150度の線 -->
          <line x1="0" y1="${height}" x2="${size}" y2="0" stroke="${color}" stroke-width="${strokeWidth}"/>
          <line x1="0" y1="${height}" x2="${size}" y2="${
						height * 2
					}" stroke="${color}" stroke-width="${strokeWidth}"/>
          <!-- 垂直線 -->
          <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${
						height * 2
					}" stroke="${color}" stroke-width="${strokeWidth}"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#iso-${size}-${color.replace("#", "")})" />
    </svg>`;
	}
}

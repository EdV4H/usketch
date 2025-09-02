import type { Camera } from "@usketch/shared-types";
import type { BackgroundRenderer } from "../types";

/**
 * 背景レンダラーの基底クラス
 * 共通のキャッシュロジックを提供
 */
export abstract class BaseRenderer<TConfig = unknown> implements BackgroundRenderer<TConfig> {
	protected _cachedCamera: Camera | undefined;
	protected _cachedConfig: TConfig | undefined;

	abstract render(container: HTMLElement, camera: Camera, config?: TConfig): void;

	/**
	 * カメラまたは設定が変更されたかチェック
	 */
	protected hasChanged(camera: Camera, config?: TConfig): boolean {
		if (!this._cachedCamera || !this._cachedConfig) {
			return true;
		}

		// カメラの変更チェック
		if (
			this._cachedCamera.x !== camera.x ||
			this._cachedCamera.y !== camera.y ||
			this._cachedCamera.zoom !== camera.zoom
		) {
			return true;
		}

		// 設定の変更チェック（簡易的な深さ1の比較）
		if (config) {
			for (const key in config) {
				if (this._cachedConfig[key] !== config[key] && typeof config[key] !== "object") {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * キャッシュを更新
	 */
	protected updateCache(camera: Camera, config?: TConfig): void {
		this._cachedCamera = { ...camera };
		this._cachedConfig = config ? { ...config } : undefined;
	}

	/**
	 * デフォルトのクリーンアップ処理
	 */
	cleanup(container: HTMLElement): void {
		container.style.backgroundColor = "";
		container.style.backgroundImage = "";
		container.style.backgroundSize = "";
		container.style.backgroundPosition = "";
		container.style.backgroundRepeat = "";
		this._cachedCamera = undefined;
		this._cachedConfig = undefined;
	}
}

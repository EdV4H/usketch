import type { Bounds, Camera, Point } from "@usketch/shared-types";

/**
 * 座標変換を統一的に管理するクラス
 *
 * ワールド座標とスクリーン座標の相互変換を提供します。
 * カメラの位置とズームを考慮した変換を行います。
 */
export class CoordinateTransformer {
	constructor(private camera: Camera) {}

	/**
	 * ワールド座標をスクリーン座標に変換
	 *
	 * @param point - ワールド座標系の点
	 * @returns スクリーン座標系の点
	 *
	 * @example
	 * ```ts
	 * const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 1 });
	 * const screen = transformer.worldToScreen({ x: 100, y: 100 });
	 * // => { x: 100, y: 100 }
	 * ```
	 */
	worldToScreen(point: Point): Point {
		return {
			x: point.x * this.camera.zoom + this.camera.x,
			y: point.y * this.camera.zoom + this.camera.y,
		};
	}

	/**
	 * スクリーン座標をワールド座標に変換
	 *
	 * @param point - スクリーン座標系の点
	 * @returns ワールド座標系の点
	 *
	 * @example
	 * ```ts
	 * const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 2 });
	 * const world = transformer.screenToWorld({ x: 200, y: 200 });
	 * // => { x: 100, y: 100 }
	 * ```
	 */
	screenToWorld(point: Point): Point {
		return {
			x: (point.x - this.camera.x) / this.camera.zoom,
			y: (point.y - this.camera.y) / this.camera.zoom,
		};
	}

	/**
	 * Bounds をスクリーン座標に変換
	 *
	 * @param bounds - ワールド座標系の境界
	 * @returns スクリーン座標系の境界
	 *
	 * @example
	 * ```ts
	 * const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 2 });
	 * const screenBounds = transformer.transformBounds({
	 *   x: 100, y: 100, width: 50, height: 50
	 * });
	 * // => { x: 200, y: 200, width: 100, height: 100 }
	 * ```
	 */
	transformBounds(bounds: Bounds): Bounds {
		const topLeft = this.worldToScreen({ x: bounds.x, y: bounds.y });
		return {
			x: topLeft.x,
			y: topLeft.y,
			width: bounds.width * this.camera.zoom,
			height: bounds.height * this.camera.zoom,
		};
	}

	/**
	 * CSS transform 文字列を生成
	 *
	 * @returns CSS transform プロパティに設定できる文字列
	 *
	 * @example
	 * ```ts
	 * const transformer = new CoordinateTransformer({ x: 10, y: 20, zoom: 1.5 });
	 * const css = transformer.toCSSTransform();
	 * // => "translate(10px, 20px) scale(1.5)"
	 * ```
	 */
	toCSSTransform(): string {
		return `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.zoom})`;
	}

	/**
	 * 現在のカメラ状態を取得
	 *
	 * @returns カメラの状態
	 */
	getCamera(): Readonly<Camera> {
		return { ...this.camera };
	}

	/**
	 * カメラ状態を更新
	 *
	 * @param camera - 新しいカメラ状態
	 * @returns 新しい CoordinateTransformer インスタンス
	 *
	 * @example
	 * ```ts
	 * const transformer = new CoordinateTransformer({ x: 0, y: 0, zoom: 1 });
	 * const newTransformer = transformer.withCamera({ x: 10, y: 10, zoom: 2 });
	 * ```
	 */
	withCamera(camera: Camera): CoordinateTransformer {
		return new CoordinateTransformer(camera);
	}
}

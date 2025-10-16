import type { Camera } from "@usketch/shared-types";
import { useMemo } from "react";
import { CoordinateTransformer } from "./coordinate-transformer";

/**
 * 座標変換を行うフック
 *
 * カメラ状態に基づいて CoordinateTransformer インスタンスを生成します。
 * カメラの x, y, zoom が変更された場合のみ再生成されます。
 *
 * @param camera - カメラ状態
 * @returns CoordinateTransformer インスタンス
 *
 * @example
 * ```tsx
 * function MyComponent({ shape }: { shape: Shape }) {
 *   const camera = useWhiteboardStore(state => state.camera);
 *   const transform = useCoordinateTransform(camera);
 *
 *   const screenPos = transform.worldToScreen({ x: shape.x, y: shape.y });
 *
 *   return (
 *     <div style={{ left: screenPos.x, top: screenPos.y }}>
 *       Shape
 *     </div>
 *   );
 * }
 * ```
 */
export function useCoordinateTransform(camera: Camera): CoordinateTransformer {
	// biome-ignore lint/correctness/useExhaustiveDependencies: camera オブジェクト全体ではなく、必要なプロパティのみを監視することでパフォーマンスを最適化
	return useMemo(() => new CoordinateTransformer(camera), [camera.x, camera.y, camera.zoom]);
}

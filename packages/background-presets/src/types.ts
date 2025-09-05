import type { Camera } from "@usketch/shared-types";
import type React from "react";

/**
 * React背景コンポーネントのプロパティ
 */
export interface BackgroundComponentProps {
	camera: Camera;
	config?: any;
}

/**
 * React背景コンポーネントのインターフェース
 */
export type BackgroundComponent = React.FC<BackgroundComponentProps>;

import type React from "react";
import { useMemo } from "react";
import type { BackgroundRegistry } from "../backgrounds/BackgroundRegistry";
import { globalBackgroundRegistry } from "../backgrounds/BackgroundRegistry";
import { registerPresetBackgrounds } from "../backgrounds/presets";
import type { BackgroundLayerProps } from "../types";
import type { BackgroundComponent } from "./BackgroundComponent";

// 初回レンダリング時にプリセット背景を登録
let presetsRegistered = false;
if (!presetsRegistered) {
	registerPresetBackgrounds();
	presetsRegistered = true;
}

export interface BackgroundLayerPropsWithRegistry extends BackgroundLayerProps {
	/**
	 * カスタムレジストリを使用する場合
	 * 指定しない場合はグローバルレジストリを使用
	 */
	registry?: BackgroundRegistry;
}

export const BackgroundLayer: React.FC<BackgroundLayerPropsWithRegistry> = ({
	camera,
	options,
	className = "",
	registry = globalBackgroundRegistry,
}) => {
	// 背景コンポーネントを解決
	const BackgroundComp = useMemo(() => {
		if (!options) {
			return null;
		}

		// 1. componentが直接指定されていればそれを使用
		if (options.component) {
			return options.component as BackgroundComponent;
		}

		// 2. IDからレジストリで解決
		if (options.id) {
			const registered = registry.get(options.id);
			if (registered) {
				return registered;
			}
			console.warn(`Background with id "${options.id}" not found in registry`);
		}

		return null;
	}, [options, registry]);

	// 背景なしまたは解決できなかった場合
	if (!BackgroundComp) {
		return (
			<div
				className={`background-layer ${className}`.trim()}
				data-testid="background-layer"
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					pointerEvents: "none",
				}}
			/>
		);
	}

	// Reactコンポーネントをレンダリング
	return (
		<div
			className={`background-layer ${className}`.trim()}
			data-testid="background-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<BackgroundComp camera={camera} config={options.config} />
		</div>
	);
};

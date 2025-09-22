import type { ShadowProperties } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { useEffect, useState } from "react";
import "./shadow-settings.css";

export const ShadowSettings = () => {
	const selectedShapeIds = useWhiteboardStore((state) => state.selectedShapeIds);
	const shapes = useWhiteboardStore((state) => state.shapes);
	const updateSelectedShapesStyle = useWhiteboardStore((state) => state.updateSelectedShapesStyle);

	const [shadowSettings, setShadowSettings] = useState<ShadowProperties>({
		offsetX: 0,
		offsetY: 4,
		blur: 8,
		color: "rgba(0, 0, 0, 0.25)",
	});

	const [isEnabled, setIsEnabled] = useState(false);
	const [colorHex, setColorHex] = useState("#000000");
	const [opacity, setOpacity] = useState(25);

	// 選択されている形状からシャドウ設定を取得
	useEffect(() => {
		if (selectedShapeIds.size === 0) {
			setIsEnabled(false);
			return;
		}

		const firstId = Array.from(selectedShapeIds)[0];
		const firstShape = firstId ? shapes[firstId] : undefined;
		if (firstShape?.shadow) {
			setShadowSettings(firstShape.shadow);
			setIsEnabled(true);

			// Parse color to hex and opacity
			const rgba = firstShape.shadow.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
			if (rgba) {
				const r = parseInt(rgba[1]);
				const g = parseInt(rgba[2]);
				const b = parseInt(rgba[3]);
				const a = parseFloat(rgba[4] || "1");
				setColorHex(`#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
				setOpacity(Math.round(a * 100));
			}
		} else {
			setIsEnabled(false);
			setShadowSettings({
				offsetX: 0,
				offsetY: 4,
				blur: 8,
				color: "rgba(0, 0, 0, 0.25)",
			});
			setColorHex("#000000");
			setOpacity(25);
		}
	}, [selectedShapeIds, shapes]);

	const handleShadowToggle = (enabled: boolean) => {
		setIsEnabled(enabled);
		const newShadow = enabled ? shadowSettings : undefined;
		updateSelectedShapesStyle({ shadow: newShadow });
	};

	const handleShadowChange = (property: keyof ShadowProperties, value: number | string) => {
		const newSettings = {
			...shadowSettings,
			[property]: value,
		};
		setShadowSettings(newSettings);

		if (isEnabled) {
			updateSelectedShapesStyle({ shadow: newSettings });
		}
	};

	const handleColorChange = (hex: string, opacity: number) => {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		const rgba = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;

		setColorHex(hex);
		setOpacity(opacity);
		handleShadowChange("color", rgba);
	};

	const applyPreset = (preset: {
		offsetX: number;
		offsetY: number;
		blur: number;
		opacity: number;
	}) => {
		const newSettings = {
			offsetX: preset.offsetX,
			offsetY: preset.offsetY,
			blur: preset.blur,
			color: `rgba(0, 0, 0, ${preset.opacity / 100})`,
		};
		setShadowSettings(newSettings);
		setColorHex("#000000");
		setOpacity(preset.opacity);

		if (isEnabled) {
			updateSelectedShapesStyle({ shadow: newSettings });
		}
	};

	if (selectedShapeIds.size === 0) {
		return (
			<div className="shadow-settings shadow-settings--empty">
				<p>形状を選択してください</p>
			</div>
		);
	}

	const previewBoxShadow = isEnabled
		? `${shadowSettings.offsetX}px ${shadowSettings.offsetY}px ${shadowSettings.blur}px ${shadowSettings.color}`
		: "none";

	return (
		<div className="shadow-settings">
			<div className="shadow-settings__header">
				<div className="shadow-settings__title">
					<svg className="shadow-settings__icon" viewBox="0 0 20 20" fill="currentColor">
						<path
							fillRule="evenodd"
							d="M10 1a9 9 0 100 18 9 9 0 000-18zm0 2a7 7 0 110 14 7 7 0 010-14z"
							clipRule="evenodd"
						/>
					</svg>
					シャドウ
				</div>
				<label className={`shadow-toggle ${isEnabled ? "shadow-toggle--active" : ""}`}>
					<input
						type="checkbox"
						checked={isEnabled}
						onChange={(e) => handleShadowToggle(e.target.checked)}
					/>
					<div className="shadow-toggle__slider" />
				</label>
			</div>

			<div className={`shadow-settings__content ${!isEnabled ? "shadow-settings--disabled" : ""}`}>
				{/* X方向のオフセット */}
				<div className="shadow-control">
					<label className="shadow-control__label">
						<span>X方向オフセット</span>
						<span className="shadow-control__value">{shadowSettings.offsetX}px</span>
					</label>
					<div className="shadow-control__slider-wrapper">
						<input
							type="range"
							className="shadow-control__slider"
							min="-50"
							max="50"
							value={shadowSettings.offsetX}
							onChange={(e) => handleShadowChange("offsetX", Number(e.target.value))}
							disabled={!isEnabled}
						/>
					</div>
				</div>

				{/* Y方向のオフセット */}
				<div className="shadow-control">
					<label className="shadow-control__label">
						<span>Y方向オフセット</span>
						<span className="shadow-control__value">{shadowSettings.offsetY}px</span>
					</label>
					<div className="shadow-control__slider-wrapper">
						<input
							type="range"
							className="shadow-control__slider"
							min="-50"
							max="50"
							value={shadowSettings.offsetY}
							onChange={(e) => handleShadowChange("offsetY", Number(e.target.value))}
							disabled={!isEnabled}
						/>
					</div>
				</div>

				{/* ぼかし */}
				<div className="shadow-control">
					<label className="shadow-control__label">
						<span>ぼかし</span>
						<span className="shadow-control__value">{shadowSettings.blur}px</span>
					</label>
					<div className="shadow-control__slider-wrapper">
						<input
							type="range"
							className="shadow-control__slider"
							min="0"
							max="100"
							value={shadowSettings.blur}
							onChange={(e) => handleShadowChange("blur", Number(e.target.value))}
							disabled={!isEnabled}
						/>
					</div>
				</div>

				{/* シャドウの色 */}
				<div className="shadow-color-control">
					<label className="shadow-control__label">
						<span>シャドウの色</span>
					</label>
					<div className="shadow-color-control__input-group">
						<div className="shadow-color-control__picker">
							<input
								type="color"
								value={colorHex}
								onChange={(e) => handleColorChange(e.target.value, opacity)}
								disabled={!isEnabled}
							/>
						</div>
						<input
							type="text"
							className="shadow-color-control__text"
							value={shadowSettings.color}
							onChange={(e) => handleShadowChange("color", e.target.value)}
							placeholder="rgba(0, 0, 0, 0.25)"
							disabled={!isEnabled}
						/>
					</div>
					<div className="shadow-opacity-control">
						<label className="shadow-opacity-control__label">透明度</label>
						<input
							type="range"
							className="shadow-control__slider shadow-opacity-control__slider"
							min="0"
							max="100"
							value={opacity}
							onChange={(e) => handleColorChange(colorHex, Number(e.target.value))}
							disabled={!isEnabled}
						/>
						<span className="shadow-control__value">{opacity}%</span>
					</div>
				</div>

				{/* プリセット */}
				<div className="shadow-presets">
					<label className="shadow-presets__label">プリセット</label>
					<div className="shadow-presets__grid">
						<button
							className="shadow-preset-button"
							onClick={() => applyPreset({ offsetX: 0, offsetY: 1, blur: 2, opacity: 10 })}
							disabled={!isEnabled}
						>
							極小
						</button>
						<button
							className="shadow-preset-button"
							onClick={() => applyPreset({ offsetX: 0, offsetY: 2, blur: 4, opacity: 15 })}
							disabled={!isEnabled}
						>
							小
						</button>
						<button
							className="shadow-preset-button"
							onClick={() => applyPreset({ offsetX: 0, offsetY: 4, blur: 8, opacity: 25 })}
							disabled={!isEnabled}
						>
							標準
						</button>
						<button
							className="shadow-preset-button"
							onClick={() => applyPreset({ offsetX: 0, offsetY: 8, blur: 16, opacity: 35 })}
							disabled={!isEnabled}
						>
							大
						</button>
						<button
							className="shadow-preset-button"
							onClick={() => applyPreset({ offsetX: 0, offsetY: 16, blur: 32, opacity: 45 })}
							disabled={!isEnabled}
						>
							極大
						</button>
						<button
							className="shadow-preset-button"
							onClick={() => applyPreset({ offsetX: 4, offsetY: 4, blur: 0, opacity: 50 })}
							disabled={!isEnabled}
						>
							ハード
						</button>
					</div>
				</div>

				{/* プレビュー */}
				<div className="shadow-preview">
					<div className="shadow-preview__box" style={{ boxShadow: previewBoxShadow }} />
				</div>
			</div>
		</div>
	);
};

import { useWhiteboardStore } from "@usketch/store";
import { useEffect, useRef, useState } from "react";
import "./color-picker.css";

interface ColorPickerProps {
	color: string;
	onChange: (color: string) => void;
	label: string;
}

// プリセットカラー
const PRESET_COLORS = [
	"#000000",
	"#333333",
	"#666666",
	"#999999",
	"#cccccc",
	"#ffffff",
	"#ef4444",
	"#f97316",
	"#f59e0b",
	"#eab308",
	"#84cc16",
	"#22c55e",
	"#10b981",
	"#14b8a6",
	"#06b6d4",
	"#0ea5e9",
	"#3b82f6",
	"#6366f1",
	"#8b5cf6",
	"#a855f7",
	"#d946ef",
	"#ec4899",
	"#f43f5e",
	"#991b1b",
];

// Constants for validation patterns
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, label }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [customColor, setCustomColor] = useState(color);
	const pickerRef = useRef<HTMLDivElement>(null);
	const recentColors = useWhiteboardStore((state) => state.recentColors);
	const addRecentColor = useWhiteboardStore((state) => state.addRecentColor);

	// クリック外で閉じる
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	// colorプロップが変更されたらcustomColorも更新
	useEffect(() => {
		setCustomColor(color);
	}, [color]);

	const handleColorChange = (newColor: string) => {
		setCustomColor(newColor);
		onChange(newColor);
		addRecentColor(newColor);
	};

	const handleCustomColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newColor = e.target.value;
		setCustomColor(newColor);
	};

	const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newColor = e.target.value;
		handleColorChange(newColor);
	};

	return (
		<div className="color-picker" ref={pickerRef}>
			<div className="color-picker__label">{label}</div>
			<button
				type="button"
				className="color-picker__trigger"
				onClick={() => setIsOpen(!isOpen)}
				aria-label={`${label}の色を選択`}
			>
				<div className="color-preview" style={{ backgroundColor: color }} />
				<span className="color-value">{color}</span>
				<span className="dropdown-arrow">▼</span>
			</button>

			{isOpen && (
				<div className="color-picker__dropdown">
					{/* カラーパレット */}
					<div className="color-picker__section">
						<div className="color-palette">
							{PRESET_COLORS.map((presetColor) => (
								<button
									type="button"
									key={presetColor}
									className={`color-swatch ${color === presetColor ? "color-swatch--active" : ""}`}
									style={{ backgroundColor: presetColor }}
									onClick={() => handleColorChange(presetColor)}
									aria-label={`色: ${presetColor}`}
								/>
							))}
						</div>
					</div>

					{/* 最近使った色 */}
					{recentColors.length > 0 && (
						<div className="color-picker__section">
							<div className="section-label">最近使った色</div>
							<div className="color-palette">
								{recentColors.map((recentColor, index) => (
									<button
										type="button"
										key={`${recentColor}-${index}`}
										className={`color-swatch ${color === recentColor ? "color-swatch--active" : ""}`}
										style={{ backgroundColor: recentColor }}
										onClick={() => handleColorChange(recentColor)}
										aria-label={`最近使った色: ${recentColor}`}
									/>
								))}
							</div>
						</div>
					)}

					{/* カスタムカラー入力 */}
					<div className="color-picker__section">
						<div className="section-label">カスタムカラー</div>
						<div className="custom-color-input">
							<input
								type="color"
								value={customColor}
								onInput={handleCustomColorInput}
								onChange={handleCustomColorChange}
								className="color-input"
							/>
							<input
								type="text"
								value={customColor}
								onChange={(e) => {
									const newColor = e.target.value;
									if (HEX_COLOR_PATTERN.test(newColor)) {
										handleColorChange(newColor);
									} else {
										setCustomColor(newColor);
									}
								}}
								className="color-text-input"
								placeholder="#000000"
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

import { useState } from "react";

const TRANSPARENT = "transparent";
export const COLOR_PALETTE = [
	TRANSPARENT,
	"#ffffff",
	"#737373",
	"#1e1e1e",
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
];

const CHECKER_BG = "repeating-conic-gradient(#e0e0e0 0% 25%, white 0% 50%) 0 0 / 10px 10px";

export function CompactColorPicker({
	label,
	value,
	mixed,
	onSwatchClick,
	onPickerPointerDown,
	onPickerChange,
	onPickerBlur,
}: {
	label: string;
	value: string;
	mixed: boolean;
	onSwatchClick: (color: string) => void;
	onPickerPointerDown: () => void;
	onPickerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onPickerBlur: () => void;
}) {
	const [showPalette, setShowPalette] = useState(false);
	const isTransparent = value === TRANSPARENT;
	const pickerValue = isTransparent ? "#ffffff" : value;

	return (
		<div style={{ position: "relative", display: "flex", alignItems: "center", gap: 3 }}>
			<span style={{ color: "#666", fontSize: 10 }}>{label}</span>
			<input
				type="color"
				value={pickerValue}
				onPointerDown={onPickerPointerDown}
				onChange={onPickerChange}
				onBlur={onPickerBlur}
				style={{
					width: 20,
					height: 20,
					border: "1px solid #e0e0e0",
					borderRadius: 4,
					padding: 0,
					cursor: "pointer",
					background: "none",
				}}
			/>
			<button
				type="button"
				onClick={() => setShowPalette((v) => !v)}
				style={{
					width: 16,
					height: 16,
					border: "none",
					background: "none",
					cursor: "pointer",
					padding: 0,
					fontSize: 8,
					color: "#999",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
				title="Color palette"
			>
				▼
			</button>
			{showPalette && (
				<div
					style={{
						position: "absolute",
						top: 28,
						left: 0,
						background: "#fff",
						border: "1px solid #e0e0e0",
						borderRadius: 8,
						padding: 6,
						display: "grid",
						gridTemplateColumns: "repeat(6, 1fr)",
						gap: 3,
						boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
						zIndex: 200,
					}}
				>
					{COLOR_PALETTE.map((color) => {
						const isActive = value === color && !mixed;
						const isTrans = color === TRANSPARENT;
						return (
							<button
								key={color}
								type="button"
								onClick={() => {
									onSwatchClick(color);
									setShowPalette(false);
								}}
								title={isTrans ? "Transparent" : color}
								style={{
									width: 18,
									height: 18,
									borderRadius: 3,
									border: isActive ? "2px solid #3b82f6" : "1px solid #e0e0e0",
									background: isTrans ? CHECKER_BG : color,
									cursor: "pointer",
									padding: 0,
									position: "relative",
									overflow: "hidden",
								}}
							>
								{isTrans && (
									<span
										style={{
											position: "absolute",
											top: "50%",
											left: -2,
											width: "130%",
											height: 2,
											background: "#ef4444",
											transform: "rotate(-45deg)",
											transformOrigin: "center",
											pointerEvents: "none",
										}}
									/>
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

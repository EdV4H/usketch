import type React from "react";
import "./opacity-slider.css";

interface OpacitySliderProps {
	value: number;
	onChange: (value: number) => void;
}

export const OpacitySlider: React.FC<OpacitySliderProps> = ({ value, onChange }) => {
	const percentage = Math.round(value * 100);

	return (
		<div className="opacity-slider">
			<div className="slider-label">
				<span>透明度</span>
				<span className="slider-value">{percentage}%</span>
			</div>
			<div className="slider-container">
				<input
					type="range"
					min={0}
					max={100}
					step={1}
					value={percentage}
					onChange={(e) => onChange(Number(e.target.value) / 100)}
					className="slider"
				/>
				<div className="slider-preview-container">
					<div
						className="opacity-preview"
						style={{
							opacity: value,
						}}
					/>
				</div>
			</div>
		</div>
	);
};

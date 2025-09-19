import type React from "react";
import "./stroke-width-slider.css";

interface StrokeWidthSliderProps {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
}

export const StrokeWidthSlider: React.FC<StrokeWidthSliderProps> = ({
	value,
	onChange,
	min = 0,
	max = 20,
}) => {
	return (
		<div className="stroke-width-slider">
			<div className="slider-label">
				<span>線の太さ</span>
				<span className="slider-value">{value}px</span>
			</div>
			<div className="slider-container">
				<input
					type="range"
					min={min}
					max={max}
					step={1}
					value={value}
					onChange={(e) => onChange(Number(e.target.value))}
					className="slider"
				/>
				<div className="slider-track-preview">
					<div
						className="stroke-preview"
						style={{
							height: `${value}px`,
							maxHeight: "20px",
						}}
					/>
				</div>
			</div>
		</div>
	);
};

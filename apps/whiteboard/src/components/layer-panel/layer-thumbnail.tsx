import type { Shape } from "@usketch/shared-types";
import type React from "react";
import "./layer-thumbnail.css";

interface LayerThumbnailProps {
	shape: Shape;
}

/**
 * レイヤーサムネイルコンポーネント
 * 形状の種類に応じたアイコンを表示
 */
export const LayerThumbnail: React.FC<LayerThumbnailProps> = ({ shape }) => {
	const renderIcon = () => {
		switch (shape.type) {
			case "rectangle":
				return (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>長方形</title>
						<rect
							x="2"
							y="3"
							width="12"
							height="10"
							rx="1"
							stroke="currentColor"
							strokeWidth="1.5"
						/>
					</svg>
				);
			case "ellipse":
				return (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>楕円</title>
						<ellipse cx="8" cy="8" rx="6" ry="5" stroke="currentColor" strokeWidth="1.5" />
					</svg>
				);
			case "line":
				return (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>線</title>
						<path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				);
			case "text":
				return (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>テキスト</title>
						<path
							d="M4 3H12M8 3V13M6 13H10"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				);
			case "freedraw":
				return (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>フリーハンド</title>
						<path
							d="M2 10C3 8 4 6 6 5C8 4 10 5 11 7C12 9 11 11 10 12C9 13 7 14 5 13"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				);
			default:
				return (
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>形状</title>
						<rect
							x="2"
							y="2"
							width="12"
							height="12"
							rx="1"
							stroke="currentColor"
							strokeWidth="1.5"
						/>
					</svg>
				);
		}
	};

	return <div className="layer-thumbnail">{renderIcon()}</div>;
};

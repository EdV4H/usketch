import { WhiteboardCanvas } from "@usketch/react-canvas";
import { useRef, useState } from "react";
import { Toolbar } from "./components/toolbar";
import "./styles/app.css";

function AppReact() {
	const canvasRef = useRef<any>(null);
	const [background, setBackground] = useState<any>({
		type: "dots",
		spacing: 20,
		size: 2,
		color: "#d0d0d0",
	});

	const handleBackgroundChange = (bg: { renderer: any; config?: any }) => {
		// Map renderer to background type
		const rendererName = bg.renderer.constructor.name.toLowerCase();
		let backgroundType = "none";

		if (rendererName.includes("dots")) backgroundType = "dots";
		else if (rendererName.includes("grid")) backgroundType = "grid";
		else if (rendererName.includes("lines")) backgroundType = "lines";
		else if (rendererName.includes("isometric")) backgroundType = "isometric";
		else if (rendererName.includes("none")) backgroundType = "none";

		setBackground({
			type: backgroundType,
			...bg.config,
		});
	};

	return (
		<div className="app">
			<Toolbar onBackgroundChange={handleBackgroundChange} />
			<div className="whiteboard-container">
				<WhiteboardCanvas
					className="whiteboard"
					background={background}
					onReady={(canvas) => {
						canvasRef.current = canvas;
						console.log("Canvas ready:", canvas);
					}}
				/>
			</div>
		</div>
	);
}

export default AppReact;

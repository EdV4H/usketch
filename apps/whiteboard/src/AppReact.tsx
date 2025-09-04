import { WhiteboardCanvas } from "@usketch/react-canvas";
import { whiteboardStore } from "@usketch/store";
import { useRef, useState } from "react";
import { Toolbar } from "./components/toolbar";
import "./styles/app.css";

function AppReact() {
	const canvasRef = useRef<any>(null);
	const shapesAddedRef = useRef(false);
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
						
						// Add test shapes only once (protect against StrictMode double render)
						// Skip demo shapes if running E2E tests (when URL has ?e2e=true)
						const isE2E = new URLSearchParams(window.location.search).has("e2e");

						if (!shapesAddedRef.current && !isE2E) {
							shapesAddedRef.current = true;

							// Add some test shapes for demonstration (matching vanilla version)
							setTimeout(() => {
								const testShape1 = {
									id: `test-rect-${Date.now()}`,
									type: "rectangle" as const,
									x: 100,
									y: 100,
									width: 200,
									height: 100,
									rotation: 0,
									opacity: 1,
									strokeColor: "#333",
									fillColor: "#e0e0ff",
									strokeWidth: 2,
								};
								whiteboardStore.getState().addShape(testShape1);
							}, 100);

							// Add another test shape
							setTimeout(() => {
								const testShape2 = {
									id: `test-ellipse-${Date.now()}`,
									type: "ellipse" as const,
									x: 350,
									y: 200,
									width: 150,
									height: 100,
									rotation: 0,
									opacity: 1,
									strokeColor: "#d63384",
									fillColor: "#ffe0e6",
									strokeWidth: 3,
								};
								whiteboardStore.getState().addShape(testShape2);
							}, 200);
						}
					}}
				/>
			</div>
		</div>
	);
}

export default AppReact;

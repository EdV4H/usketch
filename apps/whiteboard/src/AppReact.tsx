import { WhiteboardCanvas } from "@usketch/react-canvas";
import { useRef } from "react";
import { Toolbar } from "./components/toolbar";
import "./styles/app.css";

function AppReact() {
	const canvasRef = useRef<any>(null);

	const handleBackgroundChange = (background: { renderer: any; config?: any }) => {
		// TODO: Implement background change for React canvas
		console.log("Background change:", background);
	};

	return (
		<div className="app">
			<Toolbar onBackgroundChange={handleBackgroundChange} />
			<div className="whiteboard-container">
				<WhiteboardCanvas
					className="whiteboard"
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

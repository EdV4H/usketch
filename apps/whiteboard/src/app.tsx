import { useRef } from "react";
import { Toolbar } from "./components/toolbar";
import { Whiteboard, type WhiteboardRef } from "./components/whiteboard";
import "./styles/app.css";

function App() {
	const whiteboardRef = useRef<WhiteboardRef>(null);

	const handleBackgroundChange = (background: { renderer: any; config?: any }) => {
		whiteboardRef.current?.setBackground(background);
	};

	return (
		<div className="app">
			<Toolbar onBackgroundChange={handleBackgroundChange} />
			<Whiteboard ref={whiteboardRef} />
		</div>
	);
}

export default App;

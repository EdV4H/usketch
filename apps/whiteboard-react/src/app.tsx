import { Toolbar } from "./components/toolbar";
import { Whiteboard } from "./components/whiteboard";
import "./styles/app.css";

function App() {
	return (
		<div className="app">
			<Toolbar />
			<Whiteboard />
		</div>
	);
}

export default App;

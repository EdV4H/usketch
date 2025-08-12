import { Toolbar } from "./components/Toolbar";
import { Whiteboard } from "./components/Whiteboard";
import "./styles/App.css";

function App() {
	return (
		<div className="app">
			<Toolbar />
			<Whiteboard />
		</div>
	);
}

export default App;

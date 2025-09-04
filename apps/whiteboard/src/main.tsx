import React from "react";
import ReactDOM from "react-dom/client";
import AppReact from "./AppReact";
import App from "./app";
import "./styles/index.css";

// Check URL parameter to switch between implementations
const useReactCanvas = new URLSearchParams(window.location.search).get("react") === "true";
const AppComponent = useReactCanvas ? AppReact : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<AppComponent />
	</React.StrictMode>,
);

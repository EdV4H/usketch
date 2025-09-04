import React from "react";
import ReactDOM from "react-dom/client";
import AppReact from "./AppReact";
import App from "./app";
import "./styles/index.css";

// Check URL parameter to switch between implementations
// Default to React version, use ?vanilla=true for Vanilla version
const useVanilla = new URLSearchParams(window.location.search).get("vanilla") === "true";
const AppComponent = useVanilla ? App : AppReact;

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<AppComponent />
	</React.StrictMode>,
);

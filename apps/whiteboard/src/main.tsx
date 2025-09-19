import { whiteboardStore } from "@usketch/store";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./styles/index.css";

// Expose store for E2E testing
if (typeof window !== "undefined") {
	(window as any).whiteboardStore = whiteboardStore;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

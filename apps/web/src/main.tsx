import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { App } from "./app.js";
import { DashboardPage } from "./pages/dashboard.js";
import { LoginPage } from "./pages/login.js";

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<BrowserRouter>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route path="/boards/:boardId" element={<App />} />
					<Route path="/" element={<DashboardPage />} />
				</Routes>
			</BrowserRouter>
		</StrictMode>,
	);
}

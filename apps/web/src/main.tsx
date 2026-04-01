import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { App } from "./app.js";
import { BenchmarkPage } from "./pages/benchmark.js";
import { CommunityPage } from "./pages/community.js";
import { DashboardPage } from "./pages/dashboard.js";
import { LoginPage } from "./pages/login.js";
import { WorldMapPage } from "./pages/world-map.js";

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<BrowserRouter>
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route path="/benchmark" element={<BenchmarkPage />} />
					<Route path="/boards/:boardId" element={<App />} />
					<Route path="/local/:boardId" element={<App />} />
					<Route path="/dashboard" element={<DashboardPage />} />
					<Route path="/community/:slug" element={<CommunityPage />} />
					<Route path="/community" element={<WorldMapPage />} />
					<Route path="/" element={<Navigate to="/community" replace />} />
				</Routes>
			</BrowserRouter>
		</StrictMode>,
	);
}

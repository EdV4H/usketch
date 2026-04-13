import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { App } from "./app.js";
import { CommunityPage } from "./pages/community/index.js";
import { DashboardPage } from "./pages/dashboard.js";
import { LoginPage } from "./pages/login.js";

const BenchmarkPage = lazy(() =>
	import("./pages/benchmark.js").then((m) => ({ default: m.BenchmarkPage })),
);
const WorldMapPage = lazy(() =>
	import("./pages/world-map.js").then((m) => ({ default: m.WorldMapPage })),
);

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<BrowserRouter>
				<Suspense>
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
				</Suspense>
			</BrowserRouter>
		</StrictMode>,
	);
}

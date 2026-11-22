import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { App } from "./app.js";
import { initTheme } from "./lib/theme.js";
import { CommunityPage } from "./pages/community/index.js";
import { DevicePage } from "./pages/device.js";
import { LoginPage } from "./pages/login.js";
import { TryBoardPage } from "./pages/try-board.js";
import "./styles/tokens.css";

initTheme();

// 描画ベンチ（開発用）。本番のビルドには出さない。
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
						<Route path="/device" element={<DevicePage />} />
						{import.meta.env.DEV && <Route path="/benchmark" element={<BenchmarkPage />} />}
						<Route path="/boards/:boardId" element={<App />} />
						<Route path="/local/:boardId" element={<App />} />
						<Route path="/try" element={<TryBoardPage />} />
						{/* Board 一覧は廃止（#1558）。古いリンクはトップへ。 */}
						<Route path="/dashboard" element={<Navigate to="/" replace />} />
						<Route path="/community/:slug" element={<CommunityPage />} />
						<Route path="/community" element={<WorldMapPage />} />
						<Route path="/" element={<Navigate to="/community" replace />} />
					</Routes>
				</Suspense>
			</BrowserRouter>
		</StrictMode>,
	);
}

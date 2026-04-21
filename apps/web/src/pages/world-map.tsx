import { AppProvider, Canvas } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createCommunityRegionPlugin } from "@edv4h/usketch-plugin-shape-community-region";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { viewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { createBoardStore } from "@edv4h/usketch-store";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getErrorMessage } from "../lib/errors.js";
import { useAuth } from "../lib/use-auth.js";

interface CommunityRegionData {
	boardId: string;
	slug: string;
	displayName: string;
	description: string;
	themeColor: string;
	icon: string;
	gridX: number;
	gridY: number;
}

const GRID_SPACING_X = 280;
const GRID_SPACING_Y = 220;
const CARD_WIDTH = 200;
const CARD_HEIGHT = 160;
const FIT_PADDING = 0.8;

// API 取得失敗時のフォールバック
const FALLBACK_REGIONS: CommunityRegionData[] = [
	{
		boardId: "community-lobby",
		slug: "lobby",
		displayName: "Lobby",
		description: "",
		themeColor: "#6366f1",
		icon: "\u{1F3E0}",
		gridX: 0,
		gridY: 0,
	},
	{
		boardId: "community-workshop",
		slug: "workshop",
		displayName: "Workshop",
		description: "",
		themeColor: "#f59e0b",
		icon: "\u{1F528}",
		gridX: 1,
		gridY: 0,
	},
	{
		boardId: "community-gallery",
		slug: "gallery",
		displayName: "Gallery",
		description: "",
		themeColor: "#ec4899",
		icon: "\u{1F3A8}",
		gridX: 0,
		gridY: 1,
	},
	{
		boardId: "community-playground",
		slug: "playground",
		displayName: "Playground",
		description: "",
		themeColor: "#10b981",
		icon: "\u{1F3AE}",
		gridX: 1,
		gridY: 1,
	},
];

function zoomFitAll(store: ReturnType<typeof createBoardStore>) {
	const shapes = store.getShapes();
	if (shapes.size === 0) return;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const shape of shapes.values()) {
		minX = Math.min(minX, shape.x);
		minY = Math.min(minY, shape.y);
		maxX = Math.max(maxX, shape.x + shape.width);
		maxY = Math.max(maxY, shape.y + shape.height);
	}

	const contentW = maxX - minX;
	const contentH = maxY - minY;
	if (contentW <= 0 || contentH <= 0) return;

	const rawZoom =
		Math.min(window.innerWidth / contentW, window.innerHeight / contentH) * FIT_PADDING;
	const zoom = Math.min(10, Math.max(0.1, rawZoom));

	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;

	store.setViewport({
		x: window.innerWidth / 2 - cx * zoom,
		y: window.innerHeight / 2 - cy * zoom,
		zoom,
	});
}

export function WorldMapPage() {
	const navigate = useNavigate();
	const { user: authUser, logout } = useAuth();
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		let instance: AppInstance | null = null;
		const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

		(async () => {
			try {
				// 1. API から地域一覧取得（失敗時はフォールバック）
				let regions: CommunityRegionData[];
				try {
					const res = await fetch(`${apiUrl}/api/community-boards`);
					if (!res.ok) throw new Error("API error");
					regions = await res.json();
				} catch {
					regions = FALLBACK_REGIONS;
				}

				if (cancelled) return;

				// 2. ローカルストア作成（同期なし）
				const store = createBoardStore();

				// 3. 地域データを community-region シェイプとして配置
				for (const region of regions) {
					store.addShape({
						id: `region-${region.slug}`,
						type: "community-region",
						x: region.gridX * GRID_SPACING_X,
						y: region.gridY * GRID_SPACING_Y,
						width: CARD_WIDTH,
						height: CARD_HEIGHT,
						style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
						slug: region.slug,
						displayName: region.displayName,
						themeColor: region.themeColor,
						icon: region.icon,
						onlineCount: 0,
					});
				}

				// 4. キャンバス初期化
				const plugins = [
					selectToolPlugin,
					panToolPlugin,
					viewportNavPlugin,
					createCommunityRegionPlugin({
						onRegionClick: (regionSlug: string) => {
							navigate(`/community/${regionSlug}`);
						},
					}),
					createDomRendererPlugin(),
				];

				const created = await createApp({ store, plugins });
				if (cancelled) {
					created.destroy();
					return;
				}

				instance = created;

				// 5. 全シェイプが収まるように初期ビューポート設定
				zoomFitAll(store);

				setApp(instance);
			} catch (e) {
				if (!cancelled) {
					setError(getErrorMessage(e, "Failed to load world map"));
				}
			}
		})();

		return () => {
			cancelled = true;
			instance?.destroy();
			setApp(null);
		};
	}, [navigate]);

	if (error) {
		return (
			<div
				style={{
					padding: 24,
					fontFamily: "var(--font-sans)",
					color: "var(--danger)",
					background: "var(--bg-canvas)",
					minHeight: "100vh",
				}}
			>
				<p>Error: {error}</p>
			</div>
		);
	}

	if (!app) return null;

	return (
		<AppProvider app={app}>
			<div
				style={{
					width: "100%",
					height: "100%",
					overflow: "hidden",
					background: "var(--bg-canvas)",
					color: "var(--fg-primary)",
				}}
			>
				<Canvas />
				<WorldMapHeader
					user={authUser ? { name: authUser.name ?? "User" } : null}
					onLogout={() => {
						logout();
						navigate("/login");
					}}
				/>
			</div>
		</AppProvider>
	);
}

function WorldMapHeader({
	user,
	onLogout,
}: {
	user: { name: string } | null;
	onLogout: () => void;
}) {
	const navigate = useNavigate();

	return (
		<div
			style={{
				position: "fixed",
				top: 12,
				left: 12,
				zIndex: 100,
				display: "flex",
				gap: 8,
				alignItems: "center",
			}}
		>
			<div
				className="u-surface"
				style={{
					padding: "6px 14px",
					fontSize: 13,
					fontWeight: 600,
					fontFamily: "var(--font-sans)",
					color: "var(--fg-primary)",
					borderRadius: 10,
				}}
			>
				uSketch World
			</div>
			{user ? (
				<>
					<button
						type="button"
						onClick={() => navigate("/dashboard")}
						className="u-surface"
						style={{
							border: "none",
							padding: "6px 12px",
							fontSize: 12,
							cursor: "pointer",
							color: "var(--brand-violet)",
							fontFamily: "var(--font-sans)",
							borderRadius: 10,
						}}
					>
						ダッシュボード
					</button>
					<button
						type="button"
						onClick={onLogout}
						className="u-surface"
						style={{
							border: "none",
							padding: "6px 12px",
							fontSize: 11.5,
							cursor: "pointer",
							color: "var(--fg-tertiary)",
							fontFamily: "var(--font-sans)",
							borderRadius: 10,
						}}
					>
						{user.name} — サインアウト
					</button>
				</>
			) : (
				<a
					href="/login"
					className="u-surface"
					style={{
						padding: "6px 12px",
						fontSize: 11.5,
						textDecoration: "none",
						color: "var(--brand-violet)",
						fontFamily: "var(--font-sans)",
						borderRadius: 10,
					}}
				>
					サインイン
				</a>
			)}
		</div>
	);
}

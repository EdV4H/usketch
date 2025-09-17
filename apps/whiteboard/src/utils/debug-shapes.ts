import type { Shape } from "@usketch/shared-types";

// デバッグ用のシェイプ生成ユーティリティ

export type DebugShapeType =
	| "variety" // 様々な種類のシェイプをランダムに配置
	| "equalSpacing" // 等間隔に配置された矩形
	| "grid" // グリッド状に配置
	| "overlapping"; // 重なり合うシェイプ

interface DebugShapeOptions {
	count?: number;
	spacing?: number;
	startX?: number;
	startY?: number;
	width?: number;
	height?: number;
}

export function generateDebugShapes(
	type: DebugShapeType = "variety",
	options: DebugShapeOptions = {},
): any[] {
	switch (type) {
		case "equalSpacing":
			return generateEqualSpacingShapes(options);
		case "grid":
			return generateGridShapes(options);
		case "overlapping":
			return generateOverlappingShapes(options);
		case "variety":
		default:
			return generateVarietyShapes(options);
	}
}

// 等間隔に配置された矩形を生成
function generateEqualSpacingShapes(options: DebugShapeOptions): any[] {
	const {
		count = 5,
		spacing = 150,
		startX = 100,
		startY = 200,
		width = 100,
		height = 100,
	} = options;

	const shapes: Shape[] = [];
	const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];

	for (let i = 0; i < count; i++) {
		shapes.push({
			id: `equal-spacing-${Date.now()}-${i}`,
			type: "rectangle",
			x: startX + i * spacing,
			y: startY,
			width,
			height,
			fillColor: colors[i % colors.length] || "#FF6B6B",
			strokeColor: "#000000",
			strokeWidth: 2,
			rotation: 0,
			opacity: 1,
		});
	}

	return shapes;
}

// グリッド状に配置されたシェイプを生成
function generateGridShapes(options: DebugShapeOptions): any[] {
	const {
		count = 9, // 3x3 grid
		spacing = 120,
		startX = 100,
		startY = 100,
		width = 80,
		height = 80,
	} = options;

	const shapes: Shape[] = [];
	const cols = Math.ceil(Math.sqrt(count));
	const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1"];

	for (let i = 0; i < count; i++) {
		const row = Math.floor(i / cols);
		const col = i % cols;

		shapes.push({
			id: `grid-${Date.now()}-${i}`,
			type: i % 2 === 0 ? "rectangle" : "ellipse",
			x: startX + col * spacing,
			y: startY + row * spacing,
			width,
			height,
			fillColor: colors[i % colors.length] || "#FF6B6B",
			strokeColor: "#333333",
			strokeWidth: 1,
			rotation: 0,
			opacity: 1,
		});
	}

	return shapes;
}

// 重なり合うシェイプを生成
function generateOverlappingShapes(options: DebugShapeOptions): any[] {
	const { count = 4, startX = 200, startY = 200 } = options;

	const shapes: Shape[] = [];
	const baseSize = 120;
	const colors = ["#FF6B6B88", "#4ECDC488", "#45B7D188", "#96CEB488"];

	for (let i = 0; i < count; i++) {
		const offset = i * 30;
		shapes.push({
			id: `overlapping-${Date.now()}-${i}`,
			type: "rectangle",
			x: startX + offset,
			y: startY + offset,
			width: baseSize,
			height: baseSize,
			fillColor: colors[i % colors.length] || "#FF6B6B",
			strokeColor: "#00000088",
			strokeWidth: 2,
			rotation: 0,
			opacity: 1,
		});
	}

	return shapes;
}

// 様々な種類のシェイプをランダムに配置
function generateVarietyShapes(options: DebugShapeOptions): any[] {
	const shapes: any[] = [];
	const timestamp = Date.now();

	// Standard shapes
	// Rectangle
	shapes.push({
		id: `rect-${timestamp}-1`,
		type: "rectangle",
		x: 100,
		y: 100,
		width: 150,
		height: 100,
		fillColor: "#FF6B6B",
		strokeColor: "#000000",
		strokeWidth: 2,
		rotation: 0,
		opacity: 1,
	});

	// Ellipse
	shapes.push({
		id: `ellipse-${timestamp}-2`,
		type: "ellipse",
		x: 300,
		y: 100,
		width: 120,
		height: 120,
		fillColor: "#4ECDC4",
		strokeColor: "#000000",
		strokeWidth: 2,
		rotation: 0,
		opacity: 1,
	});

	// Text
	shapes.push({
		id: `text-${timestamp}-3`,
		type: "text",
		x: 500,
		y: 100,
		text: "Hello World",
		fontSize: 24,
		fontFamily: "Arial",
		fillColor: "#2D3436",
		strokeColor: "#2D3436",
		strokeWidth: 0,
		rotation: 0,
		opacity: 1,
	});

	// Custom shapes (will work with custom shape plugins)
	// Star
	shapes.push({
		id: `star-${timestamp}-4`,
		type: "star",
		x: 100,
		y: 250,
		width: 100,
		height: 100,
		rotation: 0,
		opacity: 1,
		strokeColor: "#FFB700",
		fillColor: "#FFD700",
		strokeWidth: 2,
		points: 5,
		innerRadius: 30,
		outerRadius: 50,
	});

	// Heart
	shapes.push({
		id: `heart-${timestamp}-5`,
		type: "heart",
		x: 250,
		y: 250,
		width: 100,
		height: 90,
		rotation: 0,
		opacity: 1,
		strokeColor: "#FF1493",
		fillColor: "#FF69B4",
		strokeWidth: 2,
	});

	// Triangle
	shapes.push({
		id: `triangle-${timestamp}-6`,
		type: "triangle",
		x: 400,
		y: 250,
		width: 100,
		height: 100,
		rotation: 0,
		opacity: 1,
		strokeColor: "#008B8B",
		fillColor: "#00CED1",
		strokeWidth: 2,
		direction: "up",
	});

	// Color Picker (larger size, adjusted position)
	shapes.push({
		id: `color-picker-${timestamp}-7`,
		type: "color-picker",
		x: 600,
		y: 100,
		width: 250,
		height: 200,
		rotation: 0,
		opacity: 1,
		selectedColor: "#FF6B6B",
		label: "Color Picker",
	});

	// Chart
	shapes.push({
		id: `chart-${timestamp}-8`,
		type: "chart-hybrid",
		x: 100,
		y: 400,
		width: 250,
		height: 150,
		rotation: 0,
		opacity: 1,
		data: [65, 45, 80, 30, 55, 75],
		title: "Sample Chart",
		color: "#4ECDC4",
	});

	// Animated Logo
	shapes.push({
		id: `animated-logo-${timestamp}-9`,
		type: "animated-logo",
		x: 400,
		y: 400,
		width: 150,
		height: 150,
		rotation: 0,
		opacity: 1,
		primaryColor: "#FF6B6B",
		secondaryColor: "#4ECDC4",
		animationSpeed: 1,
	});

	// Video Player (larger size, adjusted position)
	shapes.push({
		id: `video-player-${timestamp}-10`,
		type: "video-player",
		x: 600,
		y: 350,
		width: 320,
		height: 240,
		rotation: 0,
		opacity: 1,
		videoUrl: "",
		title: "Video Player",
		autoplay: false,
	});

	// HTML Counter
	shapes.push({
		id: `html-counter-${timestamp}-11`,
		type: "html-counter",
		x: 100,
		y: 600,
		width: 120,
		height: 80,
		rotation: 0,
		opacity: 1,
		fillColor: "#FFFFFF",
		strokeColor: "#333333",
		strokeWidth: 2,
		count: 0,
	});

	return shapes;
}

// すべてのシェイプをクリア
export function clearAllShapes(): void {
	// この関数は呼び出し側でストアを使用してクリアする
	// ここではインターフェースのみ定義
}

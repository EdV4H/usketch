import { computeMinimap, minimapToSvg, type ShapeData } from "@edv4h/usketch-shared";

/**
 * サムネイル SVG を生成して返す。
 * Y.Doc の shapesMap からシェイプを読み取り、minimap SVG に変換する。
 */
export async function handleThumbnail(
	url: URL,
	getOrCreateDoc: () => Promise<{ doc: import("yjs").Doc }>,
): Promise<Response> {
	try {
		const width = Math.min(Math.max(Number(url.searchParams.get("w")) || 240, 16), 1024);
		const height = Math.min(Math.max(Number(url.searchParams.get("h")) || 160, 16), 1024);

		const { doc } = await getOrCreateDoc();
		const shapesMap = doc.getMap<Record<string, unknown>>("shapes");

		const shapes: ShapeData[] = [];
		for (const [, value] of shapesMap) {
			const s = value as Record<string, unknown>;
			if (
				typeof s.id === "string" &&
				typeof s.x === "number" &&
				typeof s.y === "number" &&
				typeof s.width === "number" &&
				typeof s.height === "number"
			) {
				shapes.push({
					id: s.id,
					type: (s.type as string) ?? "unknown",
					x: s.x,
					y: s.y,
					width: s.width,
					height: s.height,
					style: {
						fill: ((s.style as Record<string, unknown>)?.fill as string) ?? "#ffffff",
						stroke: ((s.style as Record<string, unknown>)?.stroke as string) ?? "#1e1e1e",
						strokeWidth: ((s.style as Record<string, unknown>)?.strokeWidth as number) ?? 2,
						opacity: ((s.style as Record<string, unknown>)?.opacity as number) ?? 1,
					},
				});
			}
		}

		const result = computeMinimap({
			shapes,
			mapWidth: width,
			mapHeight: height,
			padding: 20,
			minSize: 2,
		});

		const svg = minimapToSvg(result, width, height, {
			background: "#f8f9fa",
			strokeColor: "#e2e8f0",
		});

		return new Response(svg, {
			status: 200,
			headers: {
				"Content-Type": "image/svg+xml",
				"Cache-Control": "public, max-age=30",
			},
		});
	} catch {
		return new Response(
			`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#f8f9fa" rx="4"/></svg>`,
			{
				status: 200,
				headers: { "Content-Type": "image/svg+xml" },
			},
		);
	}
}

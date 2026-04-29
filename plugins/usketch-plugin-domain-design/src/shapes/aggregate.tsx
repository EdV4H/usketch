import type { ShapeData } from "@edv4h/usketch-shared";
import { TitleEditor } from "../editor/editors.js";
import { type AggregateMeta, readMeta } from "../types.js";

export function renderAggregate(shape: ShapeData) {
	const meta = readMeta<AggregateMeta>(shape);
	const isEditing = shape["x-domain-editing"] === true;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: shape.style.fill,
				border: `${shape.style.strokeWidth}px solid ${shape.style.stroke}`,
				borderRadius: "50%",
				boxSizing: "border-box",
				padding: 16,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 4,
				overflow: "hidden",
				opacity: shape.style.opacity,
			}}
		>
			<span
				style={{
					fontSize: 9,
					fontWeight: 500,
					letterSpacing: 1,
					color: "#a16207",
					textTransform: "uppercase",
				}}
			>
				«Aggregate»
			</span>
			{isEditing ? (
				<TitleEditor shapeId={shape.id} initial={meta.rootName ?? ""} field="rootName" />
			) : (
				<span
					style={{
						fontSize: 16,
						fontWeight: 600,
						color: "#1e1e1e",
						textAlign: "center",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						maxWidth: "100%",
					}}
				>
					{meta.rootName || "(no name)"}
				</span>
			)}
			{meta.invariants && meta.invariants.length > 0 && (
				<ul
					style={{
						margin: "4px 0 0",
						padding: "0 0 0 16px",
						fontSize: 10,
						color: "#475569",
						maxHeight: "40%",
						overflow: "hidden",
					}}
				>
					{meta.invariants.slice(0, 3).map((inv, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: invariant order is stable per shape
						<li key={i}>{inv}</li>
					))}
				</ul>
			)}
		</div>
	);
}

import type { ShapeData } from "@edv4h/usketch-shared";
import { TitleEditor } from "../editor/editors.js";
import { type BoundedContextMeta, readMeta } from "../types.js";

const CORE_DOMAIN_LABEL: Record<NonNullable<BoundedContextMeta["coreDomain"]>, string> = {
	core: "Core",
	supporting: "Supporting",
	generic: "Generic",
};

const CORE_DOMAIN_ACCENT: Record<NonNullable<BoundedContextMeta["coreDomain"]>, string> = {
	core: "#dc2626",
	supporting: "#f97316",
	generic: "#64748b",
};

export function renderBoundedContext(shape: ShapeData) {
	const meta = readMeta<BoundedContextMeta>(shape);
	const isEditing = shape["x-domain-editing"] === true;
	const accent = meta.coreDomain != null ? CORE_DOMAIN_ACCENT[meta.coreDomain] : shape.style.stroke;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: shape.style.fill,
				border: `${shape.style.strokeWidth}px dashed ${shape.style.stroke}`,
				borderRadius: 6,
				boxSizing: "border-box",
				padding: 12,
				display: "flex",
				flexDirection: "column",
				gap: 6,
				overflow: "hidden",
				opacity: shape.style.opacity,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<span
					style={{
						width: 8,
						height: 8,
						borderRadius: 999,
						background: accent,
						flexShrink: 0,
					}}
				/>
				{isEditing ? (
					<TitleEditor shapeId={shape.id} initial={meta.contextName ?? ""} />
				) : (
					<span
						style={{
							fontSize: 16,
							fontWeight: 600,
							color: "#1e1e1e",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{meta.contextName || "(no name)"}
					</span>
				)}
				{meta.coreDomain != null && (
					<span
						style={{
							marginLeft: "auto",
							fontSize: 10,
							fontWeight: 500,
							color: accent,
							border: `1px solid ${accent}`,
							borderRadius: 4,
							padding: "2px 6px",
							flexShrink: 0,
						}}
					>
						{CORE_DOMAIN_LABEL[meta.coreDomain]}
					</span>
				)}
			</div>
			{meta.team && <div style={{ fontSize: 11, color: "#475569" }}>Team: {meta.team}</div>}
			{meta.description && (
				<div
					style={{
						fontSize: 12,
						color: "#475569",
						whiteSpace: "pre-wrap",
						overflow: "hidden",
					}}
				>
					{meta.description}
				</div>
			)}
		</div>
	);
}

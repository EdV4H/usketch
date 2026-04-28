import type { ShapeData } from "@edv4h/usketch-shared";
import { ClassBoxEditor } from "../editor/editors.js";
import { type ClassBoxMeta, type ClassStereotype, readMeta } from "../types.js";

const STEREOTYPE_ACCENT: Record<ClassStereotype, string> = {
	Entity: "#2563eb",
	ValueObject: "#0891b2",
	Service: "#7c3aed",
	Repository: "#16a34a",
	DomainEvent: "#ea580c",
	Factory: "#db2777",
};

export function renderClassBox(shape: ShapeData) {
	const partial = readMeta<ClassBoxMeta>(shape);
	const meta: ClassBoxMeta = {
		className: partial.className ?? "",
		stereotype: partial.stereotype ?? "Entity",
		attributes: partial.attributes ?? [],
		methods: partial.methods ?? [],
	};
	const isEditing = shape["x-domain-editing"] === true;
	const accent = STEREOTYPE_ACCENT[meta.stereotype];

	if (isEditing) {
		return <ClassBoxEditor shapeId={shape.id} meta={meta} accent={accent} style={shape.style} />;
	}

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: shape.style.fill,
				border: `${shape.style.strokeWidth}px solid ${shape.style.stroke}`,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				opacity: shape.style.opacity,
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			}}
		>
			<div
				style={{
					padding: "6px 8px",
					borderBottom: `1px solid ${shape.style.stroke}`,
					textAlign: "center",
					background: `${accent}10`,
				}}
			>
				<div style={{ fontSize: 10, color: accent, fontWeight: 500 }}>«{meta.stereotype}»</div>
				<div
					style={{
						fontSize: 14,
						fontWeight: 600,
						color: "#1e1e1e",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{meta.className || "(no name)"}
				</div>
			</div>
			<div
				style={{
					padding: "4px 8px",
					borderBottom: `1px solid ${shape.style.stroke}`,
					fontSize: 11,
					color: "#1e1e1e",
					flex: 1,
					overflow: "hidden",
					whiteSpace: "pre-wrap",
				}}
			>
				{(meta.attributes ?? []).join("\n")}
			</div>
			<div
				style={{
					padding: "4px 8px",
					fontSize: 11,
					color: "#1e1e1e",
					flex: 1,
					overflow: "hidden",
					whiteSpace: "pre-wrap",
				}}
			>
				{(meta.methods ?? []).join("\n")}
			</div>
		</div>
	);
}

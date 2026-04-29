import { useApp } from "@edv4h/usketch-canvas-engine";
import { DOMAIN_SUBTYPES } from "@edv4h/usketch-plugin-domain-design";
import { BASIC_SHAPE_SUBTYPES } from "@edv4h/usketch-plugin-shape-basic";
import {
	DEFAULT_STICKY_COLOR,
	STICKY_COLOR_KEYS,
	STICKY_COLORS,
} from "@edv4h/usketch-plugin-shape-sticky";
import { WIREFRAME_SUBTYPES } from "@edv4h/usketch-plugin-shape-wireframe";
import { useState } from "react";

export function ToolButton({
	id,
	definition,
	isActive,
	onSelect,
}: {
	id: string;
	definition: { icon: () => React.ReactElement; shortcut?: string };
	isActive: boolean;
	onSelect: () => void;
}) {
	const app = useApp();
	const [showPicker, setShowPicker] = useState(false);
	const [wireframeSubtype, setWireframeSubtype] = useState(WIREFRAME_SUBTYPES[0].type);
	const [stickyColor, setStickyColor] = useState(DEFAULT_STICKY_COLOR);
	const [domainSubtype, setDomainSubtype] = useState(DOMAIN_SUBTYPES[0]?.type ?? "");
	const isWireframe = id === "wireframe-draw";
	const isBasicShape = id === "basic-shape-draw";
	const isSticky = id === "sticky-draw";
	const isDomainDraw = id === "domain-draw";
	const hasPicker = isWireframe || isBasicShape || isSticky || isDomainDraw;

	return (
		<div style={{ position: "relative" }}>
			<button
				type="button"
				onClick={() => {
					onSelect();
					if (hasPicker) setShowPicker((v) => !v || !isActive);
				}}
				title={`${id}${definition.shortcut ? ` (${definition.shortcut})` : ""}`}
				style={{
					width: 36,
					height: 36,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					border: "none",
					borderRadius: 6,
					background: isActive ? "var(--bg-active)" : "transparent",
					color: isActive ? "var(--brand-violet)" : "var(--fg-secondary)",
					cursor: "pointer",
				}}
			>
				{definition.icon()}
			</button>
			{isBasicShape && isActive && showPicker && (
				<BasicShapePicker
					onSelect={(type) => {
						app.events.emit("basic-shape:select-subtype", { type });
					}}
				/>
			)}
			{isSticky && isActive && showPicker && (
				<StickyColorPicker
					currentColor={stickyColor}
					onSelect={(color) => {
						setStickyColor(color);
						app.events.emit("sticky:select-color", { color });
					}}
				/>
			)}
			{isWireframe && isActive && showPicker && (
				<WireframePicker
					currentType={wireframeSubtype}
					onSelect={(type) => {
						setWireframeSubtype(type);
						app.events.emit("wireframe:select-subtype", { type });
					}}
				/>
			)}
			{isDomainDraw && isActive && showPicker && (
				<DomainDrawPicker
					currentType={domainSubtype}
					onSelect={(type) => {
						setDomainSubtype(type);
						app.events.emit("domain-design:select-subtype", { type });
					}}
				/>
			)}
		</div>
	);
}

function DomainDrawPicker({
	currentType,
	onSelect,
}: {
	currentType: string;
	onSelect: (type: string) => void;
}) {
	return (
		<div
			style={{
				position: "absolute",
				bottom: 44,
				left: "50%",
				transform: "translateX(-50%)",
				background: "var(--bg-surface-raised)",
				border: "1px solid var(--border-default)",
				borderRadius: 10,
				padding: 8,
				display: "grid",
				gridTemplateColumns: `repeat(${DOMAIN_SUBTYPES.length}, 1fr)`,
				gap: 4,
				boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
				zIndex: 150,
				fontFamily: "system-ui, sans-serif",
				whiteSpace: "nowrap",
			}}
		>
			{DOMAIN_SUBTYPES.map((sub) => {
				const Icon = sub.icon;
				const isActive = sub.type === currentType;
				return (
					<button
						key={sub.type}
						type="button"
						onClick={() => onSelect(sub.type)}
						title={sub.label}
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 2,
							padding: "6px 8px",
							border: "none",
							borderRadius: 6,
							background: isActive ? "#eff6ff" : "transparent",
							color: isActive ? "#3b82f6" : "#555",
							cursor: "pointer",
							fontSize: 10,
							fontWeight: isActive ? 600 : 400,
							minWidth: 64,
						}}
					>
						<Icon />
						{sub.label}
					</button>
				);
			})}
		</div>
	);
}

function BasicShapePicker({ onSelect }: { onSelect: (type: string) => void }) {
	const [currentType, setCurrentType] = useState(BASIC_SHAPE_SUBTYPES[0].type);

	return (
		<div
			style={{
				position: "absolute",
				bottom: 44,
				left: "50%",
				transform: "translateX(-50%)",
				background: "var(--bg-surface-raised)",
				border: "1px solid var(--border-default)",
				borderRadius: 10,
				padding: 8,
				display: "grid",
				gridTemplateColumns: "repeat(4, 1fr)",
				gap: 4,
				boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
				zIndex: 150,
				fontFamily: "system-ui, sans-serif",
				whiteSpace: "nowrap",
			}}
		>
			{BASIC_SHAPE_SUBTYPES.map((sub) => {
				const Icon = sub.icon;
				const isActive = sub.type === currentType;
				return (
					<button
						key={sub.type}
						type="button"
						onClick={() => {
							setCurrentType(sub.type);
							onSelect(sub.type);
						}}
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 2,
							padding: "6px 8px",
							border: "none",
							borderRadius: 6,
							background: isActive ? "#eff6ff" : "transparent",
							color: isActive ? "#3b82f6" : "#555",
							cursor: "pointer",
							fontSize: 10,
							fontWeight: isActive ? 600 : 400,
							minWidth: 56,
						}}
					>
						<Icon />
						{sub.label}
					</button>
				);
			})}
		</div>
	);
}

function StickyColorPicker({
	currentColor,
	onSelect,
}: {
	currentColor: string;
	onSelect: (color: string) => void;
}) {
	return (
		<div
			style={{
				position: "absolute",
				bottom: 44,
				left: "50%",
				transform: "translateX(-50%)",
				background: "var(--bg-surface-raised)",
				border: "1px solid var(--border-default)",
				borderRadius: 10,
				padding: 8,
				display: "flex",
				gap: 6,
				boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
				zIndex: 150,
			}}
		>
			{STICKY_COLOR_KEYS.map((key) => {
				const isActive = key === currentColor;
				return (
					<button
						key={key}
						type="button"
						onClick={() => onSelect(key)}
						title={key}
						style={{
							width: 28,
							height: 28,
							borderRadius: "50%",
							border: isActive ? "2px solid #333" : "2px solid transparent",
							background: STICKY_COLORS[key],
							cursor: "pointer",
							outline: isActive ? "2px solid #93b5fd" : "none",
							outlineOffset: 1,
						}}
					/>
				);
			})}
		</div>
	);
}

function WireframePicker({
	currentType,
	onSelect,
}: {
	currentType: string;
	onSelect: (type: string) => void;
}) {
	const categories = ["Form", "Nav", "Content", "Feedback", "Layout"];
	const grouped = categories.map((cat) => ({
		label: cat,
		items: WIREFRAME_SUBTYPES.filter((s) => s.category === cat),
	}));

	return (
		<div
			style={{
				position: "absolute",
				bottom: 44,
				left: "50%",
				transform: "translateX(-50%)",
				background: "var(--bg-surface-raised)",
				border: "1px solid var(--border-default)",
				borderRadius: 10,
				padding: 8,
				boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
				zIndex: 150,
				fontFamily: "system-ui, sans-serif",
				whiteSpace: "nowrap",
				maxHeight: 400,
				overflowY: "auto",
				width: 260,
			}}
		>
			{grouped.map((group) => (
				<div key={group.label}>
					<div
						style={{
							fontSize: 10,
							fontWeight: 600,
							color: "#999",
							textTransform: "uppercase",
							letterSpacing: "0.05em",
							padding: "6px 8px 2px",
						}}
					>
						{group.label}
					</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
						{group.items.map((sub) => {
							const Icon = sub.icon;
							const isActive = sub.type === currentType;
							return (
								<button
									key={sub.type}
									type="button"
									onClick={() => onSelect(sub.type)}
									style={{
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										gap: 2,
										padding: "5px 4px",
										border: "none",
										borderRadius: 6,
										background: isActive ? "#eff6ff" : "transparent",
										color: isActive ? "#3b82f6" : "#555",
										cursor: "pointer",
										fontSize: 10,
										fontWeight: isActive ? 600 : 400,
										minWidth: 0,
									}}
								>
									<Icon />
									{sub.label}
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

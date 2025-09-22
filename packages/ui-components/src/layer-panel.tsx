import type { LayerActions, LayerState } from "@usketch/shared-types";
import { useCallback, useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon, UnlockIcon } from "./icons";

export interface LayerPanelProps {
	layerState: LayerState;
	layerActions: LayerActions;
	className?: string;
}

export function LayerPanel({ layerState, layerActions, className = "" }: LayerPanelProps) {
	const { layers, layerOrder, activeLayerId } = layerState;
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");

	// Start editing a layer name
	const startEditing = useCallback((layerId: string, currentName: string) => {
		setEditingLayerId(layerId);
		setEditingName(currentName);
	}, []);

	// Save edited name
	const saveEdit = useCallback(() => {
		if (editingLayerId && editingName.trim()) {
			layerActions.renameLayer(editingLayerId, editingName.trim());
		}
		setEditingLayerId(null);
		setEditingName("");
	}, [editingLayerId, editingName, layerActions]);

	// Cancel editing
	const cancelEdit = useCallback(() => {
		setEditingLayerId(null);
		setEditingName("");
	}, []);

	// Handle key press in edit mode
	const handleKeyPress = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				saveEdit();
			} else if (e.key === "Escape") {
				cancelEdit();
			}
		},
		[saveEdit, cancelEdit],
	);

	// Handle drag start
	const handleDragStart = useCallback((e: React.DragEvent, layerId: string) => {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("layerId", layerId);
	}, []);

	// Handle drag over
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}, []);

	// Handle drop
	const handleDrop = useCallback(
		(e: React.DragEvent, targetIndex: number) => {
			e.preventDefault();
			const draggedLayerId = e.dataTransfer.getData("layerId");
			if (!draggedLayerId) return;

			const draggedIndex = layerOrder.indexOf(draggedLayerId);
			if (draggedIndex === -1) return;

			// Reorder layers
			const newOrder = [...layerOrder];
			newOrder.splice(draggedIndex, 1);
			newOrder.splice(targetIndex, 0, draggedLayerId);
			layerActions.reorderLayers(newOrder);
		},
		[layerOrder, layerActions],
	);

	return (
		<div
			className={`layer-panel ${className}`}
			data-testid="layer-panel"
			style={{
				width: "280px",
				height: "100%",
				backgroundColor: "#f5f5f5",
				borderLeft: "1px solid #ddd",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: "12px 16px",
					borderBottom: "1px solid #ddd",
					backgroundColor: "white",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Layers</h3>
				<button
					type="button"
					onClick={() => layerActions.addLayer()}
					style={{
						padding: "4px 12px",
						border: "1px solid #ddd",
						borderRadius: "4px",
						backgroundColor: "white",
						cursor: "pointer",
						fontSize: "12px",
					}}
					data-testid="add-layer-button"
				>
					+ Add Layer
				</button>
			</div>

			{/* Layer List */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					padding: "8px",
				}}
			>
				{layerOrder.map((layerId, index) => {
					const layer = layers.get(layerId);
					if (!layer) return null;

					const isActive = layerId === activeLayerId;
					const isEditing = layerId === editingLayerId;
					const isDefaultLayer = layerId === "default-layer";

					return (
						<div
							role="button"
							tabIndex={0}
							key={layerId}
							draggable={!isDefaultLayer && !isEditing}
							onDragStart={(e) => handleDragStart(e, layerId)}
							onDragOver={handleDragOver}
							onDrop={(e) => handleDrop(e, index)}
							onClick={() => layerActions.selectLayer(layerId)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									layerActions.selectLayer(layerId);
								}
							}}
							data-testid={`layer-item-${layerId}`}
							style={{
								padding: "8px 12px",
								marginBottom: "4px",
								borderRadius: "4px",
								backgroundColor: isActive ? "#e3f2fd" : "white",
								border: `1px solid ${isActive ? "#2196f3" : "#ddd"}`,
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								opacity: layer.visible ? 1 : 0.5,
							}}
						>
							{/* Layer Name */}
							<div style={{ flex: 1, minWidth: 0 }}>
								{isEditing ? (
									<input
										type="text"
										value={editingName}
										onChange={(e) => setEditingName(e.target.value)}
										onKeyDown={handleKeyPress}
										onBlur={saveEdit}
										data-testid="layer-name-input"
										style={{
											width: "100%",
											padding: "2px 4px",
											border: "1px solid #2196f3",
											borderRadius: "2px",
											fontSize: "13px",
											outline: "none",
										}}
										onClick={(e) => e.stopPropagation()}
									/>
								) : (
									<span
										role="button"
										tabIndex={0}
										onDoubleClick={() => !isDefaultLayer && startEditing(layerId, layer.name)}
										data-testid="layer-name"
										style={{
											fontSize: "13px",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{layer.name}
										{layer.shapeIds.length > 0 && (
											<span style={{ color: "#666", marginLeft: "4px" }}>
												({layer.shapeIds.length})
											</span>
										)}
									</span>
								)}
							</div>

							{/* Action Buttons */}
							<div style={{ display: "flex", gap: "4px" }}>
								{/* Visibility Toggle */}
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										layerActions.toggleLayerVisibility(layerId);
									}}
									data-testid={`visibility-toggle-${layerId}`}
									style={{
										padding: "4px",
										border: "none",
										background: "none",
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
									}}
								>
									{layer.visible ? <EyeIcon /> : <EyeOffIcon />}
								</button>

								{/* Lock Toggle */}
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										layerActions.toggleLayerLock(layerId);
									}}
									data-testid={`lock-toggle-${layerId}`}
									style={{
										padding: "4px",
										border: "none",
										background: "none",
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
									}}
								>
									{layer.locked ? <LockIcon /> : <UnlockIcon />}
								</button>

								{/* Delete Button (not for default layer) */}
								{!isDefaultLayer && (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											layerActions.deleteLayer(layerId);
										}}
										data-testid={`delete-layer-${layerId}`}
										style={{
											padding: "4px 8px",
											border: "none",
											background: "none",
											cursor: "pointer",
											color: "#f44336",
											fontSize: "16px",
										}}
									>
										×
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Footer with additional controls */}
			<div
				style={{
					padding: "12px 16px",
					borderTop: "1px solid #ddd",
					backgroundColor: "white",
					display: "flex",
					gap: "8px",
				}}
			>
				<button
					type="button"
					onClick={() => {
						if (activeLayerId) {
							layerActions.duplicateLayer(activeLayerId);
						}
					}}
					disabled={!activeLayerId || activeLayerId === "default-layer"}
					data-testid="duplicate-layer-button"
					style={{
						flex: 1,
						padding: "6px",
						border: "1px solid #ddd",
						borderRadius: "4px",
						backgroundColor: "white",
						cursor: activeLayerId && activeLayerId !== "default-layer" ? "pointer" : "not-allowed",
						fontSize: "12px",
						opacity: activeLayerId && activeLayerId !== "default-layer" ? 1 : 0.5,
					}}
				>
					Duplicate
				</button>
				<button
					type="button"
					onClick={() => {
						if (activeLayerId) {
							layerActions.mergeLayersDown(activeLayerId);
						}
					}}
					disabled={!activeLayerId || layerOrder.indexOf(activeLayerId) === layerOrder.length - 1}
					data-testid="merge-down-button"
					style={{
						flex: 1,
						padding: "6px",
						border: "1px solid #ddd",
						borderRadius: "4px",
						backgroundColor: "white",
						cursor:
							activeLayerId && layerOrder.indexOf(activeLayerId) !== layerOrder.length - 1
								? "pointer"
								: "not-allowed",
						fontSize: "12px",
						opacity:
							activeLayerId && layerOrder.indexOf(activeLayerId) !== layerOrder.length - 1
								? 1
								: 0.5,
					}}
				>
					Merge Down
				</button>
			</div>
		</div>
	);
}

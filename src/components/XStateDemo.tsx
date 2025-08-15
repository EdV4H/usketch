import { XStateToolbar, XStateWhiteboardCanvas } from "@usketch/drawing-tools";
import type React from "react";
import "./XStateDemo.css";

export const XStateDemo: React.FC = () => {
	return (
		<div className="xstate-demo">
			<header className="demo-header">
				<h1>XState Tool System Demo</h1>
				<p>StateMachine-based drawing tools with XState</p>
			</header>

			<div className="demo-content">
				<XStateToolbar className="demo-toolbar" />

				<div className="demo-canvas-container">
					<XStateWhiteboardCanvas className="demo-canvas" width={1000} height={600} />
				</div>

				<div className="demo-instructions">
					<h3>Instructions:</h3>
					<ul>
						<li>
							<strong>Select Tool:</strong> Click and drag to select shapes, double-click to crop
						</li>
						<li>
							<strong>Drawing Tool:</strong> Click and drag to draw freehand paths
						</li>
						<li>
							<strong>Rectangle Tool:</strong> Click and drag to create rectangles
						</li>
						<li>
							<strong>Keyboard Shortcuts:</strong>
							<ul>
								<li>Escape - Cancel current operation</li>
								<li>Delete - Delete selected shapes</li>
								<li>Enter - Confirm operation</li>
							</ul>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default XStateDemo;

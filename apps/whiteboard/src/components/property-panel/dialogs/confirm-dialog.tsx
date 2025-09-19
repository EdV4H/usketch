import type React from "react";
import { useId } from "react";
import "./confirm-dialog.css";

interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: "default" | "danger";
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
	isOpen,
	title,
	message,
	confirmText = "OK",
	cancelText = "キャンセル",
	variant = "default",
	onConfirm,
	onCancel,
}) => {
	const titleId = useId();

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			onCancel();
		}
	};

	if (!isOpen) return null;

	return (
		<div
			className="confirm-dialog-overlay"
			role="button"
			tabIndex={0}
			onClick={onCancel}
			onKeyDown={handleKeyDown}
			aria-label="Close dialog"
		>
			<div
				className="confirm-dialog-container"
				role="dialog"
				aria-labelledby={titleId}
				aria-modal="true"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="confirm-dialog-header">
					<h3 id={titleId} className="confirm-dialog-title">
						{title}
					</h3>
				</div>
				<div className="confirm-dialog-body">
					<p className="confirm-dialog-message">{message}</p>
				</div>
				<div className="confirm-dialog-footer">
					<button
						type="button"
						className="confirm-dialog-button confirm-dialog-button--cancel"
						onClick={onCancel}
					>
						{cancelText}
					</button>
					<button
						type="button"
						className={`confirm-dialog-button confirm-dialog-button--confirm ${
							variant === "danger" ? "confirm-dialog-button--danger" : ""
						}`}
						onClick={onConfirm}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
};

import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import "./input-dialog.css";

// Constants
const FOCUS_DELAY_MS = 100;

interface InputDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	defaultValue?: string;
	placeholder?: string;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}

export const InputDialog: React.FC<InputDialogProps> = ({
	isOpen,
	title,
	message,
	defaultValue = "",
	placeholder = "",
	onConfirm,
	onCancel,
}) => {
	const [inputValue, setInputValue] = useState(defaultValue);
	const inputRef = useRef<HTMLInputElement>(null);
	const titleId = useId();

	useEffect(() => {
		if (isOpen) {
			setInputValue(defaultValue);
			// Focus input when dialog opens
			setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
		}
	}, [isOpen, defaultValue]);

	const handleConfirm = () => {
		if (inputValue.trim()) {
			onConfirm(inputValue.trim());
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleConfirm();
		} else if (e.key === "Escape") {
			onCancel();
		}
	};

	if (!isOpen) return null;

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Overlay is meant to be clickable to close dialog */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled on dialog container */}
			<div className="dialog-overlay" onClick={onCancel}>
				<div
					className="dialog-container"
					role="dialog"
					aria-labelledby={titleId}
					aria-modal="true"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.key === "Escape") onCancel();
						e.stopPropagation();
					}}
				>
					<div className="dialog-header">
						<h3 id={titleId} className="dialog-title">
							{title}
						</h3>
					</div>
					<div className="dialog-body">
						<p className="dialog-message">{message}</p>
						<input
							ref={inputRef}
							type="text"
							className="dialog-input"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
						/>
					</div>
					<div className="dialog-footer">
						<button
							type="button"
							className="dialog-button dialog-button--cancel"
							onClick={onCancel}
						>
							キャンセル
						</button>
						<button
							type="button"
							className="dialog-button dialog-button--confirm"
							onClick={handleConfirm}
							disabled={!inputValue.trim()}
						>
							OK
						</button>
					</div>
				</div>
			</div>
		</>
	);
};

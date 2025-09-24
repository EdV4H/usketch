import { useEffect, useRef } from "react";
import { useToast } from "../contexts/toast-context";

interface Toast {
	id: string;
	message: string;
	type?: "success" | "error" | "info";
}

interface ToastProps {
	toast: Toast;
	onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onRemove }) => {
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		// Clear any existing timer
		if (timerRef.current) {
			clearTimeout(timerRef.current);
		}

		// Set new timer
		timerRef.current = setTimeout(() => {
			onRemove(toast.id);
			timerRef.current = null;
		}, 3000);

		// Cleanup on unmount
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [toast.id, onRemove]);

	return <div className={`toast toast-${toast.type || "info"}`}>{toast.message}</div>;
};

export const ToastContainer: React.FC = () => {
	const { toasts, removeToast } = useToast();

	return (
		<div className="toast-container">
			<style>
				{`
					.toast-container {
						position: fixed;
						bottom: 24px;
						right: 24px;
						z-index: 1000;
						display: flex;
						flex-direction: column;
						gap: 12px;
						pointer-events: none;
					}
					
					.toast {
						padding: 12px 20px;
						border-radius: 8px;
						background: white;
						box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
						font-size: 14px;
						animation: slideIn 0.3s ease-out;
						pointer-events: auto;
						max-width: 320px;
					}
					
					.toast-success {
						background: #10b981;
						color: white;
					}
					
					.toast-error {
						background: #ef4444;
						color: white;
					}
					
					.toast-info {
						background: #3b82f6;
						color: white;
					}
					
					@keyframes slideIn {
						from {
							transform: translateX(100%);
							opacity: 0;
						}
						to {
							transform: translateX(0);
							opacity: 1;
						}
					}
				`}
			</style>
			{toasts.map((toast) => (
				<ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
			))}
		</div>
	);
};

import { useEffect, useState } from "react";

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
	useEffect(() => {
		const timer = setTimeout(() => {
			onRemove(toast.id);
		}, 3000);
		return () => clearTimeout(timer);
	}, [toast.id, onRemove]);

	return <div className={`toast toast-${toast.type || "info"}`}>{toast.message}</div>;
};

// Global toast state
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toastList: Toast[] = [];

export const showToast = (message: string, type?: "success" | "error" | "info") => {
	const id = Math.random().toString(36).slice(2);
	const newToast: Toast = { id, message, type };
	toastList = [...toastList, newToast];
	for (const listener of toastListeners) {
		listener(toastList);
	}

	// Auto-remove after 3 seconds
	setTimeout(() => {
		toastList = toastList.filter((t) => t.id !== id);
		for (const listener of toastListeners) {
			listener(toastList);
		}
	}, 3000);
};

export const ToastContainer: React.FC = () => {
	const [toasts, setToasts] = useState<Toast[]>([]);

	useEffect(() => {
		const listener = (newToasts: Toast[]) => setToasts(newToasts);
		toastListeners.push(listener);
		return () => {
			toastListeners = toastListeners.filter((l) => l !== listener);
		};
	}, []);

	const removeToast = (id: string) => {
		toastList = toastList.filter((t) => t.id !== id);
		setToasts(toastList);
	};

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

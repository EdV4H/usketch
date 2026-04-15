import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../lib/use-auth.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

type Status = "idle" | "approving" | "approved" | "denied" | "error";

export function DevicePage() {
	const { user, isPending } = useAuth();
	const [searchParams] = useSearchParams();
	const userCode = searchParams.get("user_code");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);

	// Redirect to login if not authenticated
	useEffect(() => {
		if (isPending) return;
		if (!user) {
			const redirect = `/device${userCode ? `?user_code=${encodeURIComponent(userCode)}` : ""}`;
			window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
		}
	}, [user, isPending, userCode]);

	const handleApprove = useCallback(async () => {
		if (!userCode) return;
		setStatus("approving");
		try {
			const res = await fetch(`${API_URL}/api/auth/device/approve`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ userCode }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(data?.error_description ?? `HTTP ${res.status}`);
			}
			setStatus("approved");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unknown error");
			setStatus("error");
		}
	}, [userCode]);

	const handleDeny = useCallback(async () => {
		if (!userCode) return;
		try {
			await fetch(`${API_URL}/api/auth/device/deny`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ userCode }),
			});
		} catch {
			// ignore
		}
		setStatus("denied");
	}, [userCode]);

	if (isPending || !user) {
		return <CenterLayout>Loading...</CenterLayout>;
	}

	if (!userCode) {
		return (
			<CenterLayout>
				<h2 style={{ margin: 0 }}>Invalid Request</h2>
				<p style={{ color: "#666" }}>No user code provided.</p>
			</CenterLayout>
		);
	}

	if (status === "approved") {
		return (
			<CenterLayout>
				<div style={{ fontSize: "48px" }}>✓</div>
				<h2 style={{ margin: 0, color: "#16a34a" }}>Approved</h2>
				<p style={{ color: "#666" }}>Device has been authorized. You can close this tab.</p>
			</CenterLayout>
		);
	}

	if (status === "denied") {
		return (
			<CenterLayout>
				<h2 style={{ margin: 0, color: "#dc2626" }}>Denied</h2>
				<p style={{ color: "#666" }}>Device authorization was denied. You can close this tab.</p>
			</CenterLayout>
		);
	}

	return (
		<CenterLayout>
			<h1 style={{ fontSize: "1.5rem", margin: 0 }}>uSketch</h1>
			<h2 style={{ margin: 0 }}>Authorize Device</h2>
			<p style={{ color: "#666" }}>A device is requesting access to your account.</p>

			<div
				style={{
					background: "#f5f5f5",
					padding: "16px 32px",
					borderRadius: "8px",
					fontFamily: "monospace",
					fontSize: "1.5rem",
					letterSpacing: "0.2em",
					userSelect: "all",
				}}
			>
				{userCode}
			</div>

			{error && <p style={{ color: "#dc2626", fontSize: "14px" }}>{error}</p>}

			<div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
				<button
					type="button"
					onClick={handleApprove}
					disabled={status === "approving"}
					style={{
						padding: "12px 32px",
						fontSize: "14px",
						cursor: status === "approving" ? "wait" : "pointer",
						border: "none",
						borderRadius: "6px",
						background: "#16a34a",
						color: "#fff",
						opacity: status === "approving" ? 0.7 : 1,
					}}
				>
					{status === "approving" ? "Authorizing..." : "Approve"}
				</button>
				<button
					type="button"
					onClick={handleDeny}
					disabled={status === "approving"}
					style={{
						padding: "12px 32px",
						fontSize: "14px",
						cursor: "pointer",
						border: "1px solid #ddd",
						borderRadius: "6px",
						background: "#fff",
						color: "#333",
					}}
				>
					Deny
				</button>
			</div>
		</CenterLayout>
	);
}

function CenterLayout({ children }: { children: React.ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
				gap: "16px",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			{children}
		</div>
	);
}

import { signIn } from "../lib/auth-client.js";

const btnStyle = {
	padding: "12px 24px",
	fontSize: "14px",
	cursor: "pointer",
	border: "1px solid #ddd",
	borderRadius: "6px",
	background: "#fff",
	width: "100%",
};

export function LoginPage() {
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
			<h1 style={{ fontSize: "2rem", margin: 0 }}>uSketch</h1>
			<p style={{ color: "#666", margin: 0 }}>Collaborative Whiteboard</p>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "8px",
					width: "280px",
					marginTop: "24px",
				}}
			>
				<button
					type="button"
					onClick={() => signIn.social({ provider: "github", callbackURL: window.location.origin })}
					style={{ ...btnStyle, background: "#24292e", color: "#fff", border: "none" }}
				>
					Continue with GitHub
				</button>
			</div>
		</div>
	);
}

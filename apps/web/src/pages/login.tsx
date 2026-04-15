import { useNavigate, useSearchParams } from "react-router";
import { signIn } from "../lib/auth-client.js";
import { devLogin } from "../lib/dev-auth.js";

const btnStyle: React.CSSProperties = {
	padding: "12px 24px",
	fontSize: "14px",
	cursor: "pointer",
	border: "1px solid #ddd",
	borderRadius: "6px",
	background: "#fff",
	width: "100%",
};

const isDev = import.meta.env.DEV;

export function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const redirectParam = searchParams.get("redirect");
	const redirectTo =
		redirectParam?.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : "/";

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
					onClick={() =>
						signIn.social({
							provider: "github",
							callbackURL: new URL(redirectTo, window.location.origin).toString(),
						})
					}
					style={{ ...btnStyle, background: "#24292e", color: "#fff", border: "none" }}
				>
					Continue with GitHub
				</button>

				{isDev && (
					<>
						<div
							style={{
								textAlign: "center",
								fontSize: 12,
								color: "#999",
								margin: "8px 0 0",
							}}
						>
							Development Mode
						</div>
						<button
							type="button"
							onClick={() => {
								devLogin("dev-user-1", "Dev User 1");
								navigate(redirectTo);
							}}
							style={{ ...btnStyle, background: "#f0f0f0", color: "#333" }}
						>
							Dev Login (User 1)
						</button>
						<button
							type="button"
							onClick={() => {
								devLogin("dev-user-2", "Dev User 2");
								navigate(redirectTo);
							}}
							style={{ ...btnStyle, background: "#f0f0f0", color: "#333" }}
						>
							Dev Login (User 2)
						</button>
					</>
				)}
			</div>
		</div>
	);
}

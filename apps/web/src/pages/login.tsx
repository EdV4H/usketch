import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { signIn, signUp } from "../lib/auth-client.js";

const inputStyle = {
	padding: "10px 12px",
	fontSize: "14px",
	border: "1px solid #ddd",
	borderRadius: "6px",
	width: "100%",
	boxSizing: "border-box" as const,
};

const btnStyle = {
	padding: "10px 24px",
	fontSize: "14px",
	cursor: "pointer",
	border: "1px solid #ddd",
	borderRadius: "6px",
	background: "#fff",
	width: "100%",
};

export function LoginPage() {
	const [isSignUp, setIsSignUp] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const navigate = useNavigate();
	const [error, setError] = useState("");

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError("");

		if (isSignUp) {
			const result = await signUp.email({
				email,
				password,
				name,
				fetchOptions: {
					onError: (ctx) => setError(ctx.error.message),
					onSuccess: () => {
						navigate("/");
					},
				},
			});
			if (result.error) setError(result.error.message ?? "Sign up failed");
		} else {
			const result = await signIn.email({
				email,
				password,
				fetchOptions: {
					onError: (ctx) => setError(ctx.error.message),
					onSuccess: () => {
						navigate("/");
					},
				},
			});
			if (result.error) setError(result.error.message ?? "Sign in failed");
		}
	};

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

			<form
				onSubmit={handleSubmit}
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "8px",
					marginTop: "24px",
					width: "280px",
				}}
			>
				{isSignUp && (
					<input
						type="text"
						placeholder="Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						style={inputStyle}
					/>
				)}
				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					style={inputStyle}
				/>
				<input
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					minLength={8}
					style={inputStyle}
				/>
				{error && <p style={{ color: "#c33", fontSize: "13px", margin: 0 }}>{error}</p>}
				<button
					type="submit"
					style={{ ...btnStyle, background: "#0066ff", color: "#fff", border: "none" }}
				>
					{isSignUp ? "Sign Up" : "Sign In"}
				</button>
				<button
					type="button"
					onClick={() => {
						setIsSignUp(!isSignUp);
						setError("");
					}}
					style={{ ...btnStyle, fontSize: "12px", border: "none", color: "#666" }}
				>
					{isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
				</button>
			</form>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "8px",
					width: "280px",
					marginTop: "8px",
					paddingTop: "16px",
					borderTop: "1px solid #eee",
				}}
			>
				<button
					type="button"
					onClick={() => signIn.social({ provider: "google", callbackURL: window.location.origin })}
					style={btnStyle}
				>
					Continue with Google
				</button>
				<button
					type="button"
					onClick={() => signIn.social({ provider: "github", callbackURL: window.location.origin })}
					style={btnStyle}
				>
					Continue with GitHub
				</button>
			</div>
		</div>
	);
}

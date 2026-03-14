import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("uSketch API"));

export default app;

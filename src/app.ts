import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ name: "SalonBook API", status: "running" });
});

export default app;

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import adminAppointments from "./routes/adminAppointments";
import adminServices from "./routes/adminServices";
import appointments from "./routes/appointments";
import services from "./routes/services";
import { errorHandler, notFound } from "./utils/http";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ name: "SalonBook API", status: "running" });
});

// Every API route needs the database, so wait for the shared connection first
app.use("/api", async (_req, _res, next) => {
  await connectDB();
  next();
});

app.use("/api/services", services);
app.use("/api/admin/services", adminServices);
app.use("/api/appointments", appointments);
app.use("/api/admin/appointments", adminAppointments);

app.use(notFound);
app.use(errorHandler);

export default app;

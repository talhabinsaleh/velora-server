import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import adminAppointments from "./routes/adminAppointments";
import adminServices from "./routes/adminServices";
import adminReviews from "./routes/adminReviews";
import adminStats from "./routes/adminStats";
import adminTransactions from "./routes/adminTransactions";
import adminUsers from "./routes/adminUsers";
import appointments from "./routes/appointments";
import payments, { webhook } from "./routes/payments";
import profile from "./routes/profile";
import upload from "./routes/upload";
import services from "./routes/services";
import { errorHandler, notFound } from "./utils/http";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

// Stripe calls this directly and signs the raw body, so it must run before express.json()
app.post("/api/payments/webhook", ...webhook);

app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ name: "Velora API", status: "running" });
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
app.use("/api/admin/users", adminUsers);
app.use("/api/admin/stats", adminStats);
app.use("/api/admin/reviews", adminReviews);
app.use("/api/admin/transactions", adminTransactions);
app.use("/api/payments", payments);
app.use("/api/profile", profile);
app.use("/api/upload", upload);

app.use(notFound);
app.use(errorHandler);

export default app;

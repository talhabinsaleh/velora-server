import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: "API route not found." });
}

// Express 5 passes errors from async handlers here, so routes can simply throw
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    res.status(400).json({ message: first?.message ?? "Some fields are not valid." });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: `Invalid ${err.path}.` });
    return;
  }
  const status = (err as { status?: number; type?: string })?.status;
  if (status === 400 || (err as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json({ message: "The request body is not valid JSON." });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong on our side. Please try again." });
}

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value);
}

export function requireObjectId(value: unknown, label = "ID") {
  if (!isObjectId(value)) throw new HttpError(400, `Invalid ${label}.`);
  return value;
}

export function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pageParams(query: Request["query"], defaultLimit = 12, maxLimit = 50) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query.limit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

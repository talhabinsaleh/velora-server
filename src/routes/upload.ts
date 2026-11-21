import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { HttpError } from "../utils/http";

const router = Router();
const MAX_SIZE = 4 * 1024 * 1024; // Vercel functions accept request bodies up to 4.5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, done) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) done(null, true);
    else done(new HttpError(400, "Please choose a JPG, PNG, WebP, GIF or AVIF image."));
  },
});

// Sign-up needs uploads before an account exists, so this route is open but rate limited per IP
const hits = new Map<string, { count: number; reset: number }>();
function rateLimit(req: Request, _res: Response, next: NextFunction) {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + 10 * 60_000 });
  } else if (++entry.count > 20) {
    throw new HttpError(429, "Too many uploads. Please wait a few minutes and try again.");
  }
  next();
}

function receive(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(new HttpError(400, err.code === "LIMIT_FILE_SIZE" ? "Image must be 4 MB or smaller." : "Upload failed."));
      return;
    }
    next(err);
  });
}

// Sends the image to ImgBB from the server, so the API key never reaches the browser
router.post("/", rateLimit, receive, async (req, res) => {
  if (!env.imgbbKey) throw new HttpError(503, "Image upload is not set up on the server.");
  if (!req.file) throw new HttpError(400, "Please choose an image to upload.");

  const body = new FormData();
  body.append("image", req.file.buffer.toString("base64"));
  body.append("name", req.file.originalname.replace(/\.[^.]+$/, "").slice(0, 60) || "salonbook");

  let data: { data?: { url?: string; display_url?: string }; error?: { message?: string } } | null = null;
  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${env.imgbbKey}`, { method: "POST", body });
    data = await response.json().catch(() => null);
    if (!response.ok) data = null;
  } catch {
    data = null;
  }
  const url = data?.data?.display_url ?? data?.data?.url;
  if (!url) throw new HttpError(502, "The image host did not accept this image. Please try another one.");
  res.status(201).json({ url });
});

export default router;

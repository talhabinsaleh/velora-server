import dotenv from "dotenv";

// Local runs read .env.local first, then .env. On Vercel the values come from the project settings.
dotenv.config({ path: [".env.local", ".env"], quiet: true });

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to your environment variables.`);
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: () => required("MONGODB_URI"),
  dbName: process.env.DB_NAME || "velora",
  jwtSecret: () => required("JWT_SECRET"),
  clientUrls: (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter(Boolean),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  currency: (process.env.STRIPE_CURRENCY || "usd").toLowerCase(),
  imgbbKey: process.env.IMGBB_API_KEY,
};

// The first CLIENT_URL is the public website. Stripe sends customers back there.
export const siteUrl = () => env.clientUrls[0];

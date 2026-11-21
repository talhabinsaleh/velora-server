import Stripe from "stripe";
import { env } from "./env";

let stripe: Stripe | null = null;

// Created on first use so the API still starts (and shows a clear error) if the key is missing
export function getStripe() {
  stripe ??= new Stripe(env.stripeSecretKey());
  return stripe;
}

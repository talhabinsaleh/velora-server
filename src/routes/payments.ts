import express, { Request, Response, Router } from "express";
import { Types } from "mongoose";
import type Stripe from "stripe";
import { connectDB } from "../config/db";
import { env, siteUrl } from "../config/env";
import { getStripe } from "../config/stripe";
import { verifyCustomer, verifyJWT } from "../middleware/auth";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { Transaction } from "../models/Transaction";
import { HttpError, pageParams, requireObjectId } from "../utils/http";

const router = Router();

// ---------------------------------------------------------------------------------------------
// Stripe webhook. Needs the raw request body to check the signature, so it is mounted in app.ts
// before express.json(). This is the ONLY place that marks an appointment as paid.
// ---------------------------------------------------------------------------------------------
export const webhook = [
  express.raw({ type: "*/*", limit: "1mb" }),
  async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || !Buffer.isBuffer(req.body)) {
      res.status(400).json({ message: "Missing Stripe signature." });
      return;
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret());
    } catch (err) {
      console.warn("Rejected Stripe webhook:", (err as Error).message);
      res.status(400).json({ message: "Invalid Stripe signature." });
      return;
    }

    await connectDB();
    const session = event.data.object as Stripe.Checkout.Session;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (session.payment_status === "paid") await recordPayment(session, "paid");
        break;
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await recordPayment(session, "failed");
        break;
      default:
        break;
    }
    res.json({ received: true });
  },
];

async function recordPayment(session: Stripe.Checkout.Session, status: "paid" | "failed") {
  const appointmentId = session.metadata?.appointmentId;
  const customerId = session.metadata?.customerId;
  if (!appointmentId || !customerId || !Types.ObjectId.isValid(appointmentId)) return;

  // A paid record is never turned back into a failed one (Stripe can send events out of order)
  const existing = await Transaction.findOne({ stripeSessionId: session.id }).select("status").lean();
  if (existing?.status === "paid") return;

  await Transaction.updateOne(
    { stripeSessionId: session.id },
    {
      $set: {
        appointmentId,
        customerId,
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? env.currency,
        status,
      },
    },
    { upsert: true },
  );

  if (status === "paid") {
    await Appointment.updateOne({ _id: appointmentId }, { $set: { paymentStatus: "paid" } });
  }
}

// ---------------------------------------------------------------------------------------------
// Customer routes
// ---------------------------------------------------------------------------------------------
router.use(verifyJWT, verifyCustomer);

// Starts Stripe Checkout for one of the customer's confirmed, unpaid appointments
router.post("/checkout", async (req, res) => {
  const id = requireObjectId(req.body?.appointmentId, "appointment ID");
  const appointment = await Appointment.findOne({ _id: id, customerId: req.user!.id }).lean();
  if (!appointment) throw new HttpError(404, "Appointment not found.");
  if (appointment.status === "cancelled") throw new HttpError(409, "Cancelled appointments cannot be paid.");
  if (appointment.status !== "confirmed") {
    throw new HttpError(409, "You can pay once the salon confirms this appointment.");
  }
  if (appointment.paymentStatus === "paid") throw new HttpError(409, "This appointment is already paid.");

  const service = await Service.findById(appointment.serviceId).select("serviceName image category").lean();
  const name = service?.serviceName ?? "Salon appointment";
  const date = appointment.appointmentDate.toISOString().slice(0, 10);

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: req.user!.email,
    client_reference_id: String(appointment._id),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.currency,
          unit_amount: Math.round(appointment.servicePrice * 100),
          product_data: {
            name,
            description: `${service?.category ?? "Salon service"} · ${date} at ${appointment.timeSlot}`,
            images: service?.image ? [service.image] : undefined,
          },
        },
      },
    ],
    metadata: { appointmentId: String(appointment._id), customerId: req.user!.id },
    payment_intent_data: { metadata: { appointmentId: String(appointment._id), customerId: req.user!.id } },
    // Unpaid checkout pages expire after 30 minutes (the shortest Stripe allows)
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${siteUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/payment/cancel?appointment=${appointment._id}`,
  });

  if (!session.url) throw new HttpError(502, "Stripe did not return a checkout page. Please try again.");
  res.json({ url: session.url });
});

// Used by the success page. Reads Stripe and our records but changes nothing: the payment is
// only marked as paid once the verified webhook has arrived.
router.get("/session/:sessionId", async (req, res) => {
  const sessionId = String(req.params.sessionId);
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new HttpError(400, "Invalid payment session.");

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    throw new HttpError(404, "Payment session not found.");
  }
  if (session.metadata?.customerId !== req.user!.id) throw new HttpError(404, "Payment session not found.");

  const [transaction, appointment] = await Promise.all([
    Transaction.findOne({ stripeSessionId: sessionId }).lean(),
    Appointment.findById(session.metadata?.appointmentId)
      .populate("serviceId", "serviceName image category duration")
      .select("-slotKey")
      .lean(),
  ]);

  res.json({
    stripeStatus: session.payment_status,
    recorded: transaction?.status === "paid" && appointment?.paymentStatus === "paid",
    amount: (session.amount_total ?? 0) / 100,
    currency: session.currency,
    transaction,
    appointment,
  });
});

// The customer's own payment history
router.get("/history", async (req, res) => {
  const filter = { customerId: new Types.ObjectId(req.user!.id) };
  const { page, limit, skip } = pageParams(req.query, 10, 50);
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "appointmentId",
        select: "appointmentDate timeSlot serviceId",
        populate: { path: "serviceId", select: "serviceName category image" },
      })
      .lean(),
    Transaction.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export default router;

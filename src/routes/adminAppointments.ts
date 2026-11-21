import { Router } from "express";
import { verifyAdmin, verifyJWT } from "../middleware/auth";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { User } from "../models/User";
import { escapeRegex, HttpError, pageParams, requireObjectId } from "../utils/http";
import { salonToday } from "../utils/validate";

const router = Router();
router.use(verifyJWT, verifyAdmin);

const SERVICE_FIELDS = "serviceName category image duration price status";
const CUSTOMER_FIELDS = "name email image phone isBlocked";

// All appointment requests, newest first, with status / payment filters and a search box
// that matches the customer's name or email or the service name
router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  const status = String(req.query.status ?? "");
  if (["pending", "confirmed", "cancelled"].includes(status)) filter.status = status;
  if (req.query.payment === "paid" || req.query.payment === "unpaid") filter.paymentStatus = req.query.payment;

  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 60) : "";
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    const [customers, services] = await Promise.all([
      User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").limit(200).lean(),
      Service.find({ serviceName: pattern }).select("_id").limit(200).lean(),
    ]);
    filter.$or = [
      { customerId: { $in: customers.map((c) => c._id) } },
      { serviceId: { $in: services.map((s) => s._id) } },
    ];
  }

  const { page, limit, skip } = pageParams(req.query, 10, 50);
  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("serviceId", SERVICE_FIELDS)
      .populate("customerId", CUSTOMER_FIELDS)
      .select("-slotKey")
      .lean(),
    Appointment.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get("/:id", async (req, res) => {
  const appointment = await Appointment.findById(requireObjectId(req.params.id, "appointment ID"))
    .populate("serviceId", SERVICE_FIELDS)
    .populate("customerId", CUSTOMER_FIELDS)
    .select("-slotKey")
    .lean();
  if (!appointment) throw new HttpError(404, "Appointment not found.");
  res.json(appointment);
});

// Only pending appointments can be confirmed
router.patch("/:id/confirm", async (req, res) => {
  const id = requireObjectId(req.params.id, "appointment ID");
  const existing = await Appointment.findById(id).select("status appointmentDate").lean();
  if (!existing) throw new HttpError(404, "Appointment not found.");
  if (existing.status !== "pending") {
    throw new HttpError(409, `Only pending appointments can be confirmed. This one is ${existing.status}.`);
  }
  if (existing.appointmentDate < salonToday()) {
    throw new HttpError(409, "This appointment date has already passed, so it cannot be confirmed.");
  }
  const updated = await Appointment.findOneAndUpdate({ _id: id, status: "pending" }, { status: "confirmed" }, { new: true });
  if (!updated) throw new HttpError(409, "This appointment changed a moment ago. Please refresh and try again.");
  res.json({ message: "Appointment confirmed. The customer can now pay for it." });
});

// Pending or confirmed appointments can be cancelled, as long as they have not been paid
router.patch("/:id/cancel", async (req, res) => {
  const id = requireObjectId(req.params.id, "appointment ID");
  const existing = await Appointment.findById(id).select("status paymentStatus").lean();
  if (!existing) throw new HttpError(404, "Appointment not found.");
  if (existing.status === "cancelled") throw new HttpError(409, "This appointment is already cancelled.");
  if (existing.paymentStatus === "paid") {
    throw new HttpError(409, "This appointment is already paid. Refund it in Stripe before cancelling.");
  }
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, status: { $in: ["pending", "confirmed"] }, paymentStatus: "unpaid" },
    { $set: { status: "cancelled" }, $unset: { slotKey: 1 } },
    { new: true },
  );
  if (!updated) throw new HttpError(409, "This appointment changed a moment ago. Please refresh and try again.");
  res.json({ message: "Appointment cancelled." });
});

export default router;

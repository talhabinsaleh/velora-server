import { Router } from "express";
import { Types } from "mongoose";
import { verifyCustomer, verifyJWT } from "../middleware/auth";
import { Appointment, slotKeyFor } from "../models/Appointment";
import { Service } from "../models/Service";
import { HttpError, pageParams, requireObjectId } from "../utils/http";
import { parseAppointmentDate, salonMinutesNow, salonToday, slotStartMinutes, TIME_SLOTS } from "../utils/validate";

const router = Router();
router.use(verifyJWT);

const SERVICE_FIELDS = "serviceName category image duration price status";

// Slots that cannot be booked for a service on a date: already taken, or already past today
router.get("/availability", async (req, res) => {
  const serviceId = requireObjectId(req.query.serviceId, "service ID");
  const date = parseAppointmentDate(req.query.date);

  const taken = await Appointment.find({
    serviceId,
    appointmentDate: date,
    status: { $in: ["pending", "confirmed"] },
  })
    .select("timeSlot")
    .lean();

  const isToday = date.getTime() === salonToday().getTime();
  const now = salonMinutesNow();
  const past = isToday ? TIME_SLOTS.filter((slot) => slotStartMinutes(slot) <= now + 30) : [];

  res.json({ date: date.toISOString().slice(0, 10), taken: taken.map((a) => a.timeSlot), past, slots: TIME_SLOTS });
});

// Customers only from here on
router.use(verifyCustomer);

router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const serviceId = requireObjectId(body.serviceId, "service ID");
  const date = parseAppointmentDate(body.appointmentDate);
  const timeSlot = String(body.timeSlot ?? "");
  if (!TIME_SLOTS.includes(timeSlot as (typeof TIME_SLOTS)[number])) {
    throw new HttpError(400, "Please choose one of the available time slots.");
  }
  if (date.getTime() === salonToday().getTime() && slotStartMinutes(timeSlot) <= salonMinutesNow() + 30) {
    throw new HttpError(400, "That time has already passed today. Please choose a later slot.");
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length > 500) throw new HttpError(400, "Message must be 500 characters or fewer.");

  const service = await Service.findById(serviceId).lean();
  if (!service) throw new HttpError(404, "This service does not exist.");
  if (service.status !== "active") throw new HttpError(400, "This service is not available for booking right now.");

  const customerId = new Types.ObjectId(req.user!.id);
  const clash = await Appointment.exists({
    customerId,
    appointmentDate: date,
    timeSlot,
    status: { $in: ["pending", "confirmed"] },
  });
  if (clash) {
    throw new HttpError(409, "You already have an appointment at this date and time. Please choose another slot.");
  }

  try {
    const appointment = await Appointment.create({
      serviceId,
      customerId,
      appointmentDate: date,
      timeSlot,
      message,
      servicePrice: service.price,
      slotKey: slotKeyFor(serviceId, date, timeSlot),
    });
    res.status(201).json({ message: "Appointment request sent! We'll confirm it soon.", appointment });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new HttpError(409, "Sorry, this time slot was just booked by someone else. Please choose another.");
    }
    throw err;
  }
});

// The logged-in customer's own appointments only
router.get("/mine", async (req, res) => {
  const filter: Record<string, unknown> = { customerId: req.user!.id };
  const status = String(req.query.status ?? "");
  if (["pending", "confirmed", "cancelled"].includes(status)) filter.status = status;
  if (req.query.payment === "paid" || req.query.payment === "unpaid") filter.paymentStatus = req.query.payment;
  const { page, limit, skip } = pageParams(req.query, 10, 50);

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("serviceId", SERVICE_FIELDS)
      .select("-slotKey")
      .lean(),
    Appointment.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get("/stats", async (req, res) => {
  const customerId = new Types.ObjectId(req.user!.id);
  const [counts, spent, upcoming] = await Promise.all([
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { customerId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Appointment.aggregate<{ total: number }>([
      { $match: { customerId, paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$servicePrice" } } },
    ]),
    Appointment.find({ customerId, status: { $in: ["pending", "confirmed"] }, appointmentDate: { $gte: salonToday() } })
      .sort({ appointmentDate: 1 })
      .limit(3)
      .populate("serviceId", SERVICE_FIELDS)
      .select("-slotKey")
      .lean(),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  const [awaitingPayment, awaitingReview, reviewsGiven, openRequests] = await Promise.all([
    Appointment.countDocuments({ customerId, status: "confirmed", paymentStatus: "unpaid" }),
    Appointment.countDocuments({ customerId, paymentStatus: "paid", "review.rating": { $exists: false } }),
    Appointment.countDocuments({ customerId, "review.rating": { $gte: 1 } }),
    Appointment.countDocuments({ customerId, "cancelRequest.status": "open" }),
  ]);
  res.json({
    total: counts.reduce((sum, c) => sum + c.count, 0),
    pending: by.pending ?? 0,
    confirmed: by.confirmed ?? 0,
    cancelled: by.cancelled ?? 0,
    awaitingPayment,
    awaitingReview,
    reviewsGiven,
    openRequests,
    totalSpent: spent[0]?.total ?? 0,
    upcoming,
  });
});

router.get("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "appointment ID");
  const appointment = await Appointment.findOne({ _id: id, customerId: req.user!.id })
    .populate("serviceId", SERVICE_FIELDS)
    .select("-slotKey")
    .lean();
  if (!appointment) throw new HttpError(404, "Appointment not found.");
  res.json(appointment);
});

// A customer may cancel only their own appointment, and only while it is still pending
router.patch("/:id/cancel", async (req, res) => {
  const id = requireObjectId(req.params.id, "appointment ID");
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, customerId: req.user!.id, status: "pending" },
    { $set: { status: "cancelled" }, $unset: { slotKey: 1 } },
    { new: true },
  ).lean();
  if (updated) {
    res.json({ message: "Appointment request cancelled." });
    return;
  }
  const existing = await Appointment.findOne({ _id: id, customerId: req.user!.id }).select("status").lean();
  if (!existing) throw new HttpError(404, "Appointment not found.");
  throw new HttpError(
    409,
    existing.status === "confirmed"
      ? "This appointment is already confirmed and can no longer be cancelled online. Please call the salon."
      : "This appointment is already cancelled.",
  );
});

// Rate a visit: only your own, only once, and only after it has been paid
router.post("/:id/review", async (req, res) => {
  const id = requireObjectId(req.params.id, "appointment ID");
  const rating = Number(req.body?.rating);
  const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "Please choose a rating from 1 to 5 stars.");
  if (comment.length > 600) throw new HttpError(400, "Review must be 600 characters or fewer.");

  const appointment = await Appointment.findOne({ _id: id, customerId: req.user!.id }).select("paymentStatus status review").lean();
  if (!appointment) throw new HttpError(404, "Appointment not found.");
  if (appointment.paymentStatus !== "paid") throw new HttpError(409, "You can review a visit once it has been paid.");
  if (appointment.review?.rating) throw new HttpError(409, "You have already reviewed this visit.");

  await Appointment.updateOne(
    { _id: id, customerId: req.user!.id, "review.rating": { $exists: false } },
    { $set: { review: { rating, comment, hidden: false, createdAt: new Date() } } },
  );
  res.status(201).json({ message: "Thank you! Your review has been published." });
});

// Ask the salon to cancel a confirmed appointment (customers can't cancel confirmed ones directly)
router.post("/:id/cancel-request", async (req, res) => {
  const id = requireObjectId(req.params.id, "appointment ID");
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (reason.length < 5) throw new HttpError(400, "Please tell the salon briefly why you need to cancel.");
  if (reason.length > 300) throw new HttpError(400, "Reason must be 300 characters or fewer.");

  const appointment = await Appointment.findOne({ _id: id, customerId: req.user!.id }).select("status paymentStatus cancelRequest").lean();
  if (!appointment) throw new HttpError(404, "Appointment not found.");
  if (appointment.status === "pending") throw new HttpError(409, "This request is still pending, so you can cancel it directly.");
  if (appointment.status === "cancelled") throw new HttpError(409, "This appointment is already cancelled.");
  if (appointment.paymentStatus === "paid") {
    throw new HttpError(409, "This appointment is already paid. Please call the salon to arrange a change or refund.");
  }
  if (appointment.cancelRequest?.status === "open") throw new HttpError(409, "You have already asked to cancel this appointment.");

  await Appointment.updateOne(
    { _id: id, customerId: req.user!.id, status: "confirmed" },
    { $set: { cancelRequest: { reason, status: "open", requestedAt: new Date(), adminNote: "" } } },
  );
  res.status(201).json({ message: "Cancellation request sent. The salon will review it shortly." });
});

export default router;

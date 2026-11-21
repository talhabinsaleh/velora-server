import { Router } from "express";
import { verifyAdmin, verifyJWT } from "../middleware/auth";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { User } from "../models/User";
import { escapeRegex, HttpError, pageParams, requireObjectId } from "../utils/http";

const router = Router();
router.use(verifyJWT, verifyAdmin);

// All customer reviews with filters for rating, visibility and a search box
router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = { "review.rating": { $gte: 1 } };
  const rating = Number(req.query.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) filter["review.rating"] = rating;
  if (req.query.visibility === "hidden") filter["review.hidden"] = true;
  if (req.query.visibility === "visible") filter["review.hidden"] = { $ne: true };

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
      { "review.comment": pattern },
    ];
  }

  const { page, limit, skip } = pageParams(req.query, 10, 50);
  const [items, total, summary] = await Promise.all([
    Appointment.find(filter)
      .sort({ "review.createdAt": -1 })
      .skip(skip)
      .limit(limit)
      .populate("serviceId", "serviceName category image")
      .populate("customerId", "name email image")
      .select("serviceId customerId appointmentDate timeSlot review")
      .lean(),
    Appointment.countDocuments(filter),
    Appointment.aggregate<{ _id: number; count: number }>([
      { $match: { "review.rating": { $gte: 1 } } },
      { $group: { _id: "$review.rating", count: { $sum: 1 } } },
    ]),
  ]);
  const totalReviews = summary.reduce((n, s) => n + s.count, 0);
  const average = totalReviews ? summary.reduce((n, s) => n + s._id * s.count, 0) / totalReviews : 0;
  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      average: Math.round(average * 10) / 10,
      count: totalReviews,
      breakdown: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: summary.find((s) => s._id === stars)?.count ?? 0 })),
    },
  });
});

// Hide a review from the website, or show it again
router.patch("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "review ID");
  if (typeof req.body?.hidden !== "boolean") throw new HttpError(400, "Send hidden: true or false.");
  const updated = await Appointment.findOneAndUpdate(
    { _id: id, "review.rating": { $gte: 1 } },
    { $set: { "review.hidden": req.body.hidden } },
    { new: true },
  ).lean();
  if (!updated) throw new HttpError(404, "Review not found.");
  res.json({ message: req.body.hidden ? "Review hidden from the website." : "Review is visible on the website again." });
});

export default router;

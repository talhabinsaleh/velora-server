import { Router } from "express";
import { verifyAdmin, verifyJWT } from "../middleware/auth";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { escapeRegex, pageParams } from "../utils/http";

const router = Router();
router.use(verifyJWT, verifyAdmin);

// Read only on purpose: payment records are written by the Stripe webhook and nothing else
router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status === "paid" || req.query.status === "failed") filter.status = req.query.status;

  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    const customers = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").limit(200).lean();
    filter.$or = [{ customerId: { $in: customers.map((c) => c._id) } }, { stripeSessionId: pattern }];
  }

  const { page, limit, skip } = pageParams(req.query, 10, 50);
  const [items, total, totals] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "name email image")
      .populate({
        path: "appointmentId",
        select: "appointmentDate timeSlot serviceId status",
        populate: { path: "serviceId", select: "serviceName category image" },
      })
      .lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate<{ _id: string; amount: number; count: number }>([
      { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  const summary = Object.fromEntries(totals.map((t) => [t._id, { amount: t.amount, count: t.count }]));
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary });
});

export default router;

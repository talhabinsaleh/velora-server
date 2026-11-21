import { Router } from "express";
import mongoose, { Types } from "mongoose";
import { verifyAdmin, verifyJWT } from "../middleware/auth";
import { Appointment } from "../models/Appointment";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { escapeRegex, HttpError, pageParams, requireObjectId } from "../utils/http";

const router = Router();
router.use(verifyJWT, verifyAdmin);

const PUBLIC_FIELDS = "name email image phone role isBlocked createdAt";

// Registered customers with how many appointments each has made
router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = { role: { $ne: "admin" } };
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 60) : "";
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  if (req.query.status === "blocked") filter.isBlocked = true;
  if (req.query.status === "active") filter.isBlocked = { $ne: true };

  const { page, limit, skip } = pageParams(req.query, 10, 50);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select(PUBLIC_FIELDS).lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Appointment.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { customerId: { $in: users.map((u) => u._id) } } },
    { $group: { _id: "$customerId", count: { $sum: 1 } } },
  ]);
  const byUser = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({
    items: users.map((u) => ({ ...u, appointmentCount: byUser.get(String(u._id)) ?? 0 })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

router.get("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "user ID");
  const user = await User.findById(id).select(PUBLIC_FIELDS).lean();
  if (!user) throw new HttpError(404, "User not found.");
  const customerId = new Types.ObjectId(id);
  const [counts, paid, recent] = await Promise.all([
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { customerId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Transaction.aggregate<{ total: number; count: number }>([
      { $match: { customerId, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Appointment.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("serviceId", "serviceName image category")
      .select("-slotKey")
      .lean(),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({
    ...user,
    stats: {
      total: counts.reduce((sum, c) => sum + c.count, 0),
      pending: by.pending ?? 0,
      confirmed: by.confirmed ?? 0,
      cancelled: by.cancelled ?? 0,
      payments: paid[0]?.count ?? 0,
      totalPaid: paid[0]?.total ?? 0,
    },
    recent,
  });
});

async function setBlocked(id: string, adminId: string, blocked: boolean) {
  if (id === adminId) throw new HttpError(400, "You cannot block your own account.");
  const user = await User.findById(id).select("role isBlocked name").lean();
  if (!user) throw new HttpError(404, "User not found.");
  if (user.role === "admin") throw new HttpError(403, "Admin accounts cannot be blocked.");
  await User.updateOne({ _id: id }, { $set: { isBlocked: blocked, updatedAt: new Date() } });
  if (blocked) {
    // Sign the customer out everywhere by removing their Better Auth sessions
    await mongoose.connection
      .collection("session")
      .deleteMany({ userId: { $in: [new Types.ObjectId(id), id] } });
  }
  return user.name;
}

router.patch("/:id/block", async (req, res) => {
  const name = await setBlocked(requireObjectId(req.params.id, "user ID"), req.user!.id, true);
  res.json({ message: `${name} has been blocked and signed out.` });
});

router.patch("/:id/unblock", async (req, res) => {
  const name = await setBlocked(requireObjectId(req.params.id, "user ID"), req.user!.id, false);
  res.json({ message: `${name} has been unblocked.` });
});

export default router;

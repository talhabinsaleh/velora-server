import { Router } from "express";
import { verifyAdmin, verifyJWT } from "../middleware/auth";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { salonToday } from "../utils/validate";

const router = Router();
router.use(verifyJWT, verifyAdmin);

// Numbers and small charts for the admin overview page
router.get("/", async (_req, res) => {
  const today = salonToday();
  const since = new Date(today.getTime() - 13 * 86_400_000);

  const [customers, activeServices, statusCounts, payments, perCategory, perDay, recent] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    Service.countDocuments({ status: "active" }),
    Appointment.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Transaction.aggregate<{ count: number; revenue: number }>([
      { $match: { status: "paid" } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$amount" } } },
    ]),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { status: { $ne: "cancelled" } } },
      { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "service" } },
      { $unwind: "$service" },
      { $group: { _id: "$service.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+06:00" } }, count: { $sum: 1 } } },
    ]),
    Appointment.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("serviceId", "serviceName image category")
      .populate("customerId", "name email image")
      .select("-slotKey")
      .lean(),
  ]);

  const by = Object.fromEntries(statusCounts.map((c) => [c._id, c.count]));
  const dayMap = new Map(perDay.map((d) => [d._id, d.count]));
  const requestsByDay = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { date: day, count: dayMap.get(day) ?? 0 };
  });

  res.json({
    totalCustomers: customers,
    activeServices,
    totalAppointments: statusCounts.reduce((sum, c) => sum + c.count, 0),
    pending: by.pending ?? 0,
    confirmed: by.confirmed ?? 0,
    cancelled: by.cancelled ?? 0,
    successfulPayments: payments[0]?.count ?? 0,
    revenue: payments[0]?.revenue ?? 0,
    byCategory: perCategory.map((c) => ({ category: c._id, count: c.count })),
    requestsByDay,
    recent,
  });
});

export default router;

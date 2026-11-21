import { Router } from "express";
import { verifyAdmin, verifyJWT } from "../middleware/auth";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { salonToday } from "../utils/validate";

const router = Router();
router.use(verifyJWT, verifyAdmin);

const TZ = "+06:00";
const RANGES: Record<string, number> = { "7": 7, "30": 30, "90": 90, "365": 365 };

const DAY = 86_400_000;
const SALON_OFFSET = 6 * 3_600_000; // Bangladesh time, UTC+6

// Every day (or month) in the chosen range, so the charts have no gaps
function bucketKeys(today: Date, days: number, monthly: boolean) {
  if (monthly) {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - i), 1));
      return d.toISOString().slice(0, 7);
    });
  }
  return Array.from({ length: days }, (_, i) => new Date(today.getTime() - (days - 1 - i) * DAY).toISOString().slice(0, 10));
}

// Overview numbers plus earnings and bookings by date for the chosen range (?days=7|30|90|365)
router.get("/", async (req, res) => {
  const days = RANGES[String(req.query.days)] ?? 30;
  const monthly = days === 365;
  const today = salonToday(); // the salon's calendar day, as midnight UTC
  const now = new Date();
  // first salon day in the range, converted to the real instant of salon midnight
  const firstDay = monthly
    ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1))
    : new Date(today.getTime() - (days - 1) * DAY);
  const start = new Date(firstDay.getTime() - SALON_OFFSET);
  const prevStart = new Date(start.getTime() - (now.getTime() - start.getTime()));
  const format = monthly ? "%Y-%m" : "%Y-%m-%d";

  const [
    customers,
    newCustomers,
    activeServices,
    statusCounts,
    paidAll,
    paidRange,
    paidPrev,
    revenueRows,
    bookingRows,
    bookingsPrev,
    topServices,
    perCategory,
    todays,
    openRequests,
    ratingRows,
    recent,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    User.countDocuments({ role: { $ne: "admin" }, createdAt: { $gte: start } }),
    Service.countDocuments({ status: "active" }),
    Appointment.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Transaction.aggregate<{ count: number; revenue: number }>([
      { $match: { status: "paid" } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate<{ count: number; revenue: number }>([
      { $match: { status: "paid", createdAt: { $gte: start, $lt: now } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate<{ revenue: number }>([
      { $match: { status: "paid", createdAt: { $gte: prevStart, $lt: start } } },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate<{ _id: string; revenue: number; count: number }>([
      { $match: { status: "paid", createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format, date: "$createdAt", timezone: TZ } }, revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format, date: "$createdAt", timezone: TZ } }, count: { $sum: 1 } } },
    ]),
    Appointment.countDocuments({ createdAt: { $gte: prevStart, $lt: start } }),
    Appointment.aggregate<{ _id: unknown; bookings: number; revenue: number; name: string; image: string; category: string }>([
      { $match: { createdAt: { $gte: start }, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: "$serviceId",
          bookings: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$servicePrice", 0] } },
        },
      },
      { $sort: { bookings: -1, revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "s" } },
      { $unwind: "$s" },
      { $project: { bookings: 1, revenue: 1, name: "$s.serviceName", image: "$s.image", category: "$s.category" } },
    ]),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: start } } },
      { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "service" } },
      { $unwind: "$service" },
      { $group: { _id: "$service.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Appointment.find({ appointmentDate: today, status: { $in: ["pending", "confirmed"] } })
      .sort({ timeSlot: 1 })
      .populate("serviceId", "serviceName image category duration")
      .populate("customerId", "name email image")
      .select("-slotKey")
      .lean(),
    Appointment.countDocuments({ "cancelRequest.status": "open" }),
    Appointment.aggregate<{ avg: number; count: number }>([
      { $match: { "review.rating": { $gte: 1 } } },
      { $group: { _id: null, avg: { $avg: "$review.rating" }, count: { $sum: 1 } } },
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
  const revenueMap = new Map(revenueRows.map((r) => [r._id, r]));
  const bookingMap = new Map(bookingRows.map((r) => [r._id, r.count]));
  const keys = bucketKeys(today, days, monthly);
  const series = keys.map((key) => ({
    key,
    revenue: Math.round((revenueMap.get(key)?.revenue ?? 0) * 100) / 100,
    payments: revenueMap.get(key)?.count ?? 0,
    bookings: bookingMap.get(key) ?? 0,
  }));
  const rangeRevenue = paidRange[0]?.revenue ?? 0;
  const prevRevenue = paidPrev[0]?.revenue ?? 0;
  const rangeBookings = series.reduce((n, s) => n + s.bookings, 0);
  const change = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));

  res.json({
    // the six numbers the brief asks for
    totalCustomers: customers,
    activeServices,
    totalAppointments: statusCounts.reduce((sum, c) => sum + c.count, 0),
    pending: by.pending ?? 0,
    confirmed: by.confirmed ?? 0,
    cancelled: by.cancelled ?? 0,
    successfulPayments: paidAll[0]?.count ?? 0,
    revenue: paidAll[0]?.revenue ?? 0,
    // range analytics
    range: { days, monthly, revenue: rangeRevenue, revenueChange: change(rangeRevenue, prevRevenue), bookings: rangeBookings, bookingsChange: change(rangeBookings, bookingsPrev), payments: paidRange[0]?.count ?? 0, newCustomers },
    series,
    topServices,
    byCategory: perCategory.map((c) => ({ category: c._id, count: c.count })),
    today: todays,
    openCancelRequests: openRequests,
    rating: { average: ratingRows[0] ? Math.round(ratingRows[0].avg * 10) / 10 : 0, count: ratingRows[0]?.count ?? 0 },
    recent,
  });
});

export default router;

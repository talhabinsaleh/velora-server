import { Router } from "express";
import type { QueryFilter, SortOrder } from "mongoose";
import { CATEGORIES, Service, ServiceDoc } from "../models/Service";
import { escapeRegex, HttpError, isObjectId, pageParams } from "../utils/http";
import { TIME_SLOTS } from "../utils/validate";

const router = Router();

export const SORTS: Record<string, Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  duration_asc: { duration: 1, createdAt: -1 },
  name_asc: { serviceName: 1 },
};

// Builds the search / category part of a query. Shared with the admin list.
export function serviceFilter(query: Record<string, unknown>): QueryFilter<ServiceDoc> {
  const filter: QueryFilter<ServiceDoc> = {};
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 60) : "";
  if (search) filter.serviceName = { $regex: escapeRegex(search), $options: "i" };
  const category = typeof query.category === "string" ? query.category : "";
  if (category && category !== "all") {
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      throw new HttpError(400, "Unknown service category.");
    }
    filter.category = category;
  }
  return filter;
}

// Static lists the website needs: categories and the bookable time slots
router.get("/meta", (_req, res) => {
  res.json({ categories: CATEGORIES, timeSlots: TIME_SLOTS });
});

// GET /api/services?search=&category=&sort=price_asc&page=1&limit=12  (active services only)
router.get("/", async (req, res) => {
  const filter = { ...serviceFilter(req.query), status: "active" };
  const sort = SORTS[String(req.query.sort)] ?? SORTS.newest;
  const { page, limit, skip } = pageParams(req.query, 12, 48);

  const [items, total] = await Promise.all([
    Service.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Service.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// Six newest active services for the home page
router.get("/featured", async (_req, res) => {
  const items = await Service.find({ status: "active" }).sort({ createdAt: -1 }).limit(6).lean();
  res.json(items);
});

// Every category with how many active services it has and the lowest price
router.get("/categories", async (_req, res) => {
  const rows = await Service.aggregate<{ _id: string; count: number; minPrice: number }>([
    { $match: { status: "active" } },
    { $group: { _id: "$category", count: { $sum: 1 }, minPrice: { $min: "$price" } } },
  ]);
  const byName = new Map(rows.map((row) => [row._id, row]));
  res.json(
    CATEGORIES.map((name) => ({
      name,
      count: byName.get(name)?.count ?? 0,
      minPrice: byName.get(name)?.minPrice ?? null,
    })),
  );
});

// Details of one active service. Inactive or missing services return 404.
router.get("/:id", async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(400, "This service link is not valid.");
  const service = await Service.findOne({ _id: req.params.id, status: "active" }).lean();
  if (!service) throw new HttpError(404, "This service does not exist or is no longer available.");

  const related = await Service.find({ status: "active", category: service.category, _id: { $ne: service._id } })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  res.json({ ...service, related });
});

export default router;

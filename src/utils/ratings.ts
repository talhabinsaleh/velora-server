import { Types } from "mongoose";
import { Appointment } from "../models/Appointment";

export interface RatingSummary {
  rating: number;
  reviewCount: number;
}

// Average rating and number of visible reviews for each service id
export async function ratingsFor(ids: (string | Types.ObjectId)[]) {
  if (ids.length === 0) return new Map<string, RatingSummary>();
  const rows = await Appointment.aggregate<{ _id: Types.ObjectId; avg: number; count: number }>([
    { $match: { serviceId: { $in: ids.map((id) => new Types.ObjectId(String(id))) }, "review.rating": { $gte: 1 }, "review.hidden": { $ne: true } } },
    { $group: { _id: "$serviceId", avg: { $avg: "$review.rating" }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { rating: Math.round(r.avg * 10) / 10, reviewCount: r.count }]));
}

// Adds rating and reviewCount to a list of services
export async function withRatings<T extends { _id: Types.ObjectId | string }>(services: T[]) {
  const map = await ratingsFor(services.map((s) => s._id));
  return services.map((s) => ({ ...s, ...(map.get(String(s._id)) ?? { rating: 0, reviewCount: 0 }) }));
}

// Public review cards: first name only, so customers' full names and emails are never exposed
export function publicReview(a: {
  _id: unknown;
  review?: { rating: number; comment?: string | null; createdAt?: Date | null } | null;
  customerId?: unknown;
  serviceId?: unknown;
  appointmentDate?: Date;
}) {
  const customer = (a.customerId ?? {}) as { name?: string; image?: string | null };
  const service = (a.serviceId ?? {}) as { _id?: unknown; serviceName?: string; category?: string };
  return {
    _id: String(a._id),
    rating: a.review?.rating ?? 0,
    comment: a.review?.comment ?? "",
    createdAt: a.review?.createdAt ?? null,
    customer: { name: (customer.name ?? "Guest").split(" ")[0], image: customer.image ?? null },
    service: service.serviceName ? { _id: String(service._id), serviceName: service.serviceName, category: service.category } : null,
  };
}

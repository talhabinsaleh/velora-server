import { CATEGORIES, Category, SERVICE_STATUSES } from "../models/Service";
import { HttpError } from "./http";

export const TIME_SLOTS = [
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
] as const;

// The salon works on Bangladesh time (UTC+6, no daylight saving)
export const SALON_UTC_OFFSET_MINUTES = 6 * 60;
export const BOOKING_WINDOW_DAYS = 60;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export interface ServiceInput {
  serviceName: string;
  category: Category;
  description: string;
  price: number;
  duration: number;
  image: string;
  status: "active" | "inactive";
}

// partial = true for updates, where only the fields that were sent are checked
export function parseServiceInput(body: Record<string, unknown>, partial = false): Partial<ServiceInput> {
  const out: Partial<ServiceInput> = {};
  const has = (key: string) => body[key] !== undefined;

  if (!partial || has("serviceName")) {
    const name = text(body.serviceName);
    if (name.length < 3) throw new HttpError(400, "Service name must be at least 3 characters.");
    if (name.length > 80) throw new HttpError(400, "Service name must be 80 characters or fewer.");
    out.serviceName = name;
  }
  if (!partial || has("category")) {
    const category = text(body.category);
    if (!CATEGORIES.includes(category as Category)) throw new HttpError(400, "Please choose a valid category.");
    out.category = category as Category;
  }
  if (!partial || has("description")) {
    const description = text(body.description);
    if (description.length < 20) throw new HttpError(400, "Description must be at least 20 characters.");
    if (description.length > 2000) throw new HttpError(400, "Description must be 2000 characters or fewer.");
    out.description = description;
  }
  if (!partial || has("price")) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, "Price must be a positive number.");
    if (price > 100000) throw new HttpError(400, "Price looks too high. Please check it.");
    out.price = Math.round(price * 100) / 100;
  }
  if (!partial || has("duration")) {
    const duration = Number(body.duration);
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new HttpError(400, "Duration must be a positive whole number of minutes.");
    }
    if (duration > 600) throw new HttpError(400, "Duration must be 600 minutes or less.");
    out.duration = duration;
  }
  if (!partial || has("image")) {
    const image = text(body.image);
    if (!isHttpUrl(image)) throw new HttpError(400, "Please upload a service image.");
    out.image = image;
  }
  if (has("status") || !partial) {
    const status = text(body.status) || "active";
    if (!SERVICE_STATUSES.includes(status as "active")) throw new HttpError(400, "Status must be active or inactive.");
    out.status = status as "active" | "inactive";
  }
  return out;
}

export interface ProfileInput {
  name?: string;
  image?: string | null;
  phone?: string;
}

// Only these three fields can ever be changed from a profile form. Role and blocked status are ignored.
export function parseProfileInput(body: Record<string, unknown>): ProfileInput {
  const out: ProfileInput = {};
  if (body.name !== undefined) {
    const name = text(body.name);
    if (name.length < 2) throw new HttpError(400, "Name must be at least 2 characters.");
    if (name.length > 60) throw new HttpError(400, "Name must be 60 characters or fewer.");
    out.name = name;
  }
  if (body.image !== undefined) {
    const image = text(body.image);
    if (image && !isHttpUrl(image)) throw new HttpError(400, "Profile image must be a valid image URL.");
    out.image = image || null;
  }
  if (body.phone !== undefined) {
    const phone = text(body.phone);
    if (phone && !/^\+?[0-9\s-]{7,20}$/.test(phone)) {
      throw new HttpError(400, "Phone number can only contain digits, spaces, dashes and a leading +.");
    }
    out.phone = phone;
  }
  if (Object.keys(out).length === 0) throw new HttpError(400, "Nothing to update.");
  return out;
}

// Today's date in the salon's time zone, as midnight UTC (the way appointment dates are stored)
export function salonToday() {
  const now = new Date(Date.now() + SALON_UTC_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function slotStartMinutes(slot: string) {
  const match = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(slot);
  if (!match) return -1;
  let hours = Number(match[1]) % 12;
  if (match[3] === "PM") hours += 12;
  return hours * 60 + Number(match[2]);
}

// Minutes since midnight right now, on salon time
export function salonMinutesNow() {
  const now = new Date(Date.now() + SALON_UTC_OFFSET_MINUTES * 60_000);
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

export function parseAppointmentDate(value: unknown) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new HttpError(400, "Please choose an appointment date.");
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new HttpError(400, "Please choose a valid appointment date.");
  }
  const today = salonToday();
  if (date < today) throw new HttpError(400, "Appointment date cannot be in the past.");
  const last = new Date(today.getTime() + BOOKING_WINDOW_DAYS * 86_400_000);
  if (date > last) throw new HttpError(400, `Appointments can be booked up to ${BOOKING_WINDOW_DAYS} days ahead.`);
  return date;
}

/**
 * Fills the database with demo services, demo accounts and a few sample appointment requests.
 *
 *   npm run seed            add services only if there are none yet
 *   npm run seed -- --reset replace all services and appointments (transactions are never touched)
 *
 * Accounts are created through the website's own Better Auth sign-up endpoint, so the client
 * (CLIENT_URL) must be running. Passwords come from SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD,
 * never from this file.
 */
import mongoose, { Types } from "mongoose";
import { connectDB } from "../src/config/db";
import { siteUrl } from "../src/config/env";
import { Appointment, slotKeyFor } from "../src/models/Appointment";
import { Service } from "../src/models/Service";
import { User } from "../src/models/User";
import { salonToday } from "../src/utils/validate";
import { SERVICES } from "./data";

const reset = process.argv.includes("--reset");

const ADMIN = { name: "Salon Admin", email: process.env.SEED_ADMIN_EMAIL || "admin@salonbook.demo" };
const CUSTOMERS = [
  { name: "Nadia Rahman", email: process.env.SEED_CUSTOMER_EMAIL || "customer@salonbook.demo" },
  { name: "Ayesha Siddiqua", email: "ayesha@salonbook.demo" },
  { name: "Tanvir Hasan", email: "tanvir@salonbook.demo" },
  { name: "Maliha Chowdhury", email: "maliha@salonbook.demo" },
];

async function ensureAccount(name: string, email: string, password: string) {
  const existing = await User.findOne({ email }).lean();
  if (existing) return existing;
  const res = await fetch(`${siteUrl()}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: siteUrl() },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error(`Could not create ${email}: ${res.status} ${await res.text()}`);
  const user = await User.findOne({ email }).lean();
  if (!user) throw new Error(`Account ${email} was not saved`);
  console.log(`Created account ${email}`);
  return user;
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD;
  if (!adminPassword || !customerPassword) {
    throw new Error("Set SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD before seeding.");
  }

  await connectDB();

  // Admin access is never given through sign-up. The seed promotes this one account directly.
  const admin = await ensureAccount(ADMIN.name, ADMIN.email, adminPassword);
  await User.updateOne({ _id: admin._id }, { $set: { role: "admin", isBlocked: false } });
  const customers: { _id: unknown }[] = [];
  for (const c of CUSTOMERS) customers.push(await ensureAccount(c.name, c.email, customerPassword));

  if (reset) {
    await Appointment.deleteMany({});
    await Service.deleteMany({});
    console.log("Removed old services and appointments");
  }

  if ((await Service.estimatedDocumentCount()) === 0) {
    // Spread creation times so "newest" ordering looks natural
    const now = Date.now();
    const docs = SERVICES.map((s, i) => ({
      ...s,
      status: s.status ?? "active",
      createdAt: new Date(now - (SERVICES.length - i) * 3_600_000 * 7),
    }));
    await Service.insertMany(docs);
    console.log(`Added ${docs.length} services`);
  }

  if ((await Appointment.estimatedDocumentCount()) === 0) {
    const services = await Service.find({ status: "active" }).lean();
    const today = salonToday().getTime();
    const day = (n: number) => new Date(today + n * 86_400_000);
    const plan: { customer: number; service: number; inDays: number; slot: string; status: "pending" | "confirmed" | "cancelled"; message?: string; ageHours: number }[] = [
      { customer: 0, service: 0, inDays: 2, slot: "11:00 AM", status: "confirmed", message: "Please keep the length, just a fresh shape.", ageHours: 30 },
      { customer: 0, service: 11, inDays: 4, slot: "03:00 PM", status: "pending", ageHours: 5 },
      { customer: 0, service: 18, inDays: 6, slot: "05:00 PM", status: "pending", message: "Nude or soft pink shade please.", ageHours: 2 },
      { customer: 0, service: 21, inDays: 1, slot: "02:00 PM", status: "cancelled", ageHours: 70 },
      { customer: 1, service: 4, inDays: 3, slot: "10:00 AM", status: "confirmed", message: "First time doing balayage!", ageHours: 48 },
      { customer: 1, service: 15, inDays: 8, slot: "04:00 PM", status: "pending", ageHours: 20 },
      { customer: 2, service: 1, inDays: 1, slot: "06:00 PM", status: "pending", ageHours: 9 },
      { customer: 2, service: 20, inDays: 5, slot: "07:00 PM", status: "cancelled", ageHours: 100 },
      { customer: 3, service: 16, inDays: 12, slot: "12:00 PM", status: "pending", message: "Wedding on the 14th, can we do a trial?", ageHours: 14 },
      { customer: 3, service: 12, inDays: 3, slot: "01:00 PM", status: "confirmed", ageHours: 60 },
    ];
    const docs = plan
      .filter((p) => services[p.service])
      .map((p) => {
        const service = services[p.service];
        const date = day(p.inDays);
        return {
          serviceId: service._id,
          customerId: new Types.ObjectId(String(customers[p.customer]._id)),
          appointmentDate: date,
          timeSlot: p.slot,
          message: p.message ?? "",
          servicePrice: service.price,
          status: p.status,
          paymentStatus: "unpaid",
          slotKey: p.status === "cancelled" ? undefined : slotKeyFor(String(service._id), date, p.slot),
          createdAt: new Date(Date.now() - p.ageHours * 3_600_000),
        };
      });
    await Appointment.insertMany(docs);
    console.log(`Added ${docs.length} sample appointment requests`);
  }

  await Promise.all([Service.syncIndexes(), Appointment.syncIndexes()]);
  console.log("Seed finished.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

import { Router } from "express";
import { verifyAdmin, verifyJWT } from "../middleware/auth";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { HttpError, pageParams, requireObjectId } from "../utils/http";
import { parseServiceInput } from "../utils/validate";
import { serviceFilter, SORTS } from "./services";

const router = Router();
router.use(verifyJWT, verifyAdmin);

// All services, active and inactive, with search, filters and paging
router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = serviceFilter(req.query);
  if (req.query.status === "active" || req.query.status === "inactive") filter.status = req.query.status;
  const sort = SORTS[String(req.query.sort)] ?? SORTS.newest;
  const { page, limit, skip } = pageParams(req.query, 10, 50);

  const [items, total] = await Promise.all([
    Service.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Service.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get("/:id", async (req, res) => {
  const service = await Service.findById(requireObjectId(req.params.id, "service ID")).lean();
  if (!service) throw new HttpError(404, "Service not found.");
  res.json(service);
});

router.post("/", async (req, res) => {
  const input = parseServiceInput(req.body ?? {});
  const service = await Service.create(input);
  res.status(201).json({ message: "Service added successfully.", service });
});

router.patch("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "service ID");
  const input = parseServiceInput(req.body ?? {}, true);
  const service = await Service.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean();
  if (!service) throw new HttpError(404, "Service not found.");
  res.json({ message: "Service updated successfully.", service });
});

// Quick switch used by the Active / Inactive toggle in the services table
router.patch("/:id/status", async (req, res) => {
  const id = requireObjectId(req.params.id, "service ID");
  const status = req.body?.status;
  if (status !== "active" && status !== "inactive") throw new HttpError(400, "Status must be active or inactive.");
  const service = await Service.findByIdAndUpdate(id, { status }, { new: true }).lean();
  if (!service) throw new HttpError(404, "Service not found.");
  res.json({
    message: status === "active" ? "Service is now visible to customers." : "Service hidden from customers.",
    service,
  });
});

router.delete("/:id", async (req, res) => {
  const id = requireObjectId(req.params.id, "service ID");
  const upcoming = await Appointment.countDocuments({ serviceId: id, status: { $in: ["pending", "confirmed"] } });
  if (upcoming > 0) {
    throw new HttpError(
      409,
      `This service has ${upcoming} pending or confirmed appointment${upcoming > 1 ? "s" : ""}. Deactivate it instead, or cancel those appointments first.`,
    );
  }
  const service = await Service.findByIdAndDelete(id).lean();
  if (!service) throw new HttpError(404, "Service not found.");
  res.json({ message: "Service deleted." });
});

export default router;

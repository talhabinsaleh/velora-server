import { Router } from "express";
import { verifyJWT } from "../middleware/auth";
import { User } from "../models/User";
import { HttpError } from "../utils/http";
import { parseProfileInput } from "../utils/validate";

const router = Router();
router.use(verifyJWT);

const FIELDS = "name email image phone role createdAt";

// The profile of whoever is signed in. There is no :id, so nobody can read or edit another profile.
router.get("/", async (req, res) => {
  const user = await User.findById(req.user!.id).select(FIELDS).lean();
  if (!user) throw new HttpError(404, "Profile not found.");
  res.json(user);
});

// Only name, image and phone are accepted. Role, email and blocked status are never read from the body.
router.patch("/", async (req, res) => {
  const input = parseProfileInput(req.body ?? {});
  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: { ...input, updatedAt: new Date() } },
    { new: true },
  )
    .select(FIELDS)
    .lean();
  if (!user) throw new HttpError(404, "Profile not found.");
  res.json({ message: "Profile updated successfully.", user });
});

export default router;

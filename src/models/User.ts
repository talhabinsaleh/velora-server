import { InferSchemaType, Schema, model } from "mongoose";

export const ROLES = ["customer", "admin"] as const;
export type Role = (typeof ROLES)[number];

// Accounts are created by Better Auth on the client, in this same "users" collection.
// The API reads them for role checks and lets admins block or unblock customers.
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, enum: ROLES, default: "customer" },
    isBlocked: { type: Boolean, default: false },
    phone: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "users", versionKey: false, strict: false },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);

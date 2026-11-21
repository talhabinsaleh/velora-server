import { InferSchemaType, Schema, model } from "mongoose";

export const CATEGORIES = [
  "Haircut & Styling",
  "Hair Coloring",
  "Hair Treatment",
  "Facial & Skincare",
  "Makeup",
  "Manicure & Pedicure",
  "Spa & Massage",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SERVICE_STATUSES = ["active", "inactive"] as const;

const serviceSchema = new Schema(
  {
    serviceName: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true, enum: CATEGORIES },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0.01 },
    duration: { type: Number, required: true, min: 1 },
    image: { type: String, required: true },
    status: { type: String, enum: SERVICE_STATUSES, default: "active" },
  },
  { collection: "services", versionKey: false, timestamps: true },
);

serviceSchema.index({ status: 1, category: 1, price: 1 });
serviceSchema.index({ serviceName: "text" });

export type ServiceDoc = InferSchemaType<typeof serviceSchema>;
export const Service = model("Service", serviceSchema);

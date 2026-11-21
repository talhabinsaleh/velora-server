import { InferSchemaType, Schema, model } from "mongoose";

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export const CANCEL_REQUEST_STATUSES = ["open", "approved", "declined"] as const;

// A customer's rating of a paid visit. Kept on the appointment itself (no extra collection):
// one appointment can have at most one review, and it always points at the right service.
const reviewSchema = new Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 600, default: "" },
    hidden: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Customers cannot cancel a confirmed appointment themselves, but they can ask the salon to
const cancelRequestSchema = new Schema(
  {
    reason: { type: String, trim: true, maxlength: 300, required: true },
    status: { type: String, enum: CANCEL_REQUEST_STATUSES, default: "open" },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    adminNote: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { _id: false },
);

const appointmentSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Stored as midnight UTC of the chosen calendar day
    appointmentDate: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    servicePrice: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: "pending" },
    // Set only while the appointment is pending or confirmed. The unique index below stops two
    // active appointments from taking the same service, date and time slot, even under load.
    slotKey: { type: String },
    review: { type: reviewSchema, default: undefined },
    cancelRequest: { type: cancelRequestSchema, default: undefined },
  },
  { collection: "appointments", versionKey: false, timestamps: true },
);

appointmentSchema.index({ slotKey: 1 }, { unique: true, partialFilterExpression: { slotKey: { $type: "string" } } });
appointmentSchema.index({ customerId: 1, createdAt: -1 });
appointmentSchema.index({ status: 1, createdAt: -1 });
appointmentSchema.index({ serviceId: 1, "review.rating": 1 });
appointmentSchema.index({ "cancelRequest.status": 1 });

export function slotKeyFor(serviceId: string, date: Date, timeSlot: string) {
  return `${serviceId}|${date.toISOString().slice(0, 10)}|${timeSlot}`;
}

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema>;
export const Appointment = model("Appointment", appointmentSchema);

import { InferSchemaType, Schema, model } from "mongoose";

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;

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
  },
  { collection: "appointments", versionKey: false, timestamps: true },
);

appointmentSchema.index({ slotKey: 1 }, { unique: true, partialFilterExpression: { slotKey: { $type: "string" } } });
appointmentSchema.index({ customerId: 1, createdAt: -1 });
appointmentSchema.index({ status: 1, createdAt: -1 });

export function slotKeyFor(serviceId: string, date: Date, timeSlot: string) {
  return `${serviceId}|${date.toISOString().slice(0, 10)}|${timeSlot}`;
}

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema>;
export const Appointment = model("Appointment", appointmentSchema);

import { InferSchemaType, Schema, model } from "mongoose";

export const TRANSACTION_STATUSES = ["paid", "failed"] as const;

// Written only by the verified Stripe webhook. No route lets anyone edit these records.
const transactionSchema = new Schema(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true },
    stripeSessionId: { type: String, required: true, unique: true },
    status: { type: String, enum: TRANSACTION_STATUSES, required: true },
  },
  { collection: "transactions", versionKey: false, timestamps: true },
);

transactionSchema.index({ customerId: 1, createdAt: -1 });
transactionSchema.index({ appointmentId: 1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction = model("Transaction", transactionSchema);

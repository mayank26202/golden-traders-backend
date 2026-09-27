import mongoose from "mongoose";

const customerPaymentSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["cash", "upi", "bank", "SK", "golden_traders_bank"],
      required: true,
      index: true,
    },
    paymentDate: { type: Date, required: true, index: true },
    paymentTime: { type: String, required: true },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

customerPaymentSchema.index({ customerName: "text" });
export const CustomerPayment = mongoose.model("CustomerPayment", customerPaymentSchema);

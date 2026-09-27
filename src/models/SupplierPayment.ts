import mongoose from "mongoose";

const supplierPaymentSchema = new mongoose.Schema({
  supplierName: { type: String, required: true, trim: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ["cash", "upi", "bank", "SK", "golden_traders_bank"], required: true },
  paymentDate: { type: Date, required: true, index: true },
  paymentTime: { type: String, required: true },
  note: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });

supplierPaymentSchema.index({ supplierName: 1, paymentDate: -1 });
export const SupplierPayment = mongoose.model("SupplierPayment", supplierPaymentSchema);

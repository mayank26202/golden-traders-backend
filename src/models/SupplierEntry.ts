import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["pending", "done"], default: "pending" },
    method: { type: String, enum: ["cash", "upi", "bank_to_bank", "SK", "company_account", "none"], default: "none" },
    paidAt: Date,
  },
  { _id: false }
);

const supplierEntrySchema = new mongoose.Schema(
  {
    supplierName: { type: String, required: true, trim: true, index: true },
    kgWeight: { type: Number, required: true, min: 0 },
    ratePerKg: { type: Number, default: 0, min: 0 },
    supplyDate: { type: Date, required: true, index: true },
    payment: { type: paymentSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

supplierEntrySchema.index({ supplierName: "text" });
supplierEntrySchema.virtual("totalAmount").get(function () {
  return (this.kgWeight || 0) * (this.ratePerKg || 0);
});
supplierEntrySchema.set("toJSON", { virtuals: true });
supplierEntrySchema.set("toObject", { virtuals: true });
export const SupplierEntry = mongoose.model("SupplierEntry", supplierEntrySchema);

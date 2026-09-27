import mongoose from "mongoose";

const saleEntrySchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, index: true },
    totalKg: { type: Number, required: true, min: 0 },
    rateOfSale: { type: Number, default: 0, min: 0 },
    saleDate: { type: Date, required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierEntry", index: true },
    supplierName: { type: String, trim: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

saleEntrySchema.index({ customerName: "text" });
saleEntrySchema.virtual("totalAmount").get(function () {
  return (this.totalKg || 0) * (this.rateOfSale || 0);
});
saleEntrySchema.set("toJSON", { virtuals: true });
saleEntrySchema.set("toObject", { virtuals: true });
export const SaleEntry = mongoose.model("SaleEntry", saleEntrySchema);

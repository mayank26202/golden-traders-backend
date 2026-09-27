import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["vehicle", "emi", "salary"], required: true, index: true },
    driverName: { type: String, trim: true },
    vehicleNumber: { type: String, trim: true },
    employeeName: { type: String, trim: true },
    fuelType: { type: String, enum: ["diesel", "petrol", "cng"] },
    foodCost: { type: Number, default: 0 },
    petrolCost: { type: Number, default: 0 },
    miscellaneousCost: { type: Number, default: 0 },
    salaryAmount: { type: Number, default: 0 },
    bonusAmount: { type: Number, default: 0 },
    title: { type: String, trim: true },
    fixedAmount: { type: Number, default: 0 },
    recurrence: { type: String, enum: ["none", "daily", "monthly", "yearly"], default: "none" },
    expenseDate: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

expenseSchema.virtual("totalAmount").get(function () {
  return (this.foodCost || 0) + (this.petrolCost || 0) + (this.miscellaneousCost || 0) + (this.fixedAmount || 0) + (this.salaryAmount || 0) + (this.bonusAmount || 0);
});
expenseSchema.set("toJSON", { virtuals: true });

export const Expense = mongoose.model("Expense", expenseSchema);

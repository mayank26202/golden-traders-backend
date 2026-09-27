import mongoose from "mongoose";

const cashDepositSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    bankAccount: {
      type: String,
      enum: ["SK", "golden_traders_bank"],
      required: true,
      index: true,
    },
    depositDate: { type: Date, required: true, index: true },
    depositTime: { type: String, required: true },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

export const CashDeposit = mongoose.model("CashDeposit", cashDepositSchema);

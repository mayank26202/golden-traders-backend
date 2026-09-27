import mongoose from "mongoose";

const partyNameSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, trim: true },
  type: { type: String, enum: ["customer", "supplier"], required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, versionKey: false });

partyNameSchema.index({ type: 1, normalizedName: 1 }, { unique: true });
export const PartyName = mongoose.model("PartyName", partyNameSchema);

import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, required: true, trim: true, unique: true, index: true },
    model: { type: String, default: "", trim: true },
    driverName: { type: String, default: "", trim: true },
    driverPhone: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);

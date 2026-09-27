import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, required: true, trim: true, unique: true, index: true },
    model: { type: String, required: true, trim: true },
    driverName: { type: String, required: true, trim: true },
    driverPhone: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);

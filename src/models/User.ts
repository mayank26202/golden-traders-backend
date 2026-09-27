import mongoose from "mongoose";

export type Permission =
  | "dashboard:view"
  | "suppliers:create"
  | "suppliers:edit"
  | "suppliers:delete"
  | "sales:create"
  | "sales:edit"
  | "sales:delete"
  | "expenses:create"
  | "expenses:edit"
  | "expenses:delete"
  | "payments:view"
  | "reports:export"
  | "users:manage";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    permissions: { type: [String], default: [] },
    lastLoginAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const User = mongoose.model("User", userSchema);

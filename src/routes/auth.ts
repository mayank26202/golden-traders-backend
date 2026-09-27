import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { auth } from "../middleware/auth.js";
import { User } from "../models/User.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: body.email, active: true }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) return res.status(401).json({ message: "Invalid credentials" });
  user.lastLoginAt = new Date();
  await user.save();
  const token = jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions, lastLoginAt: user.lastLoginAt } });
});

authRouter.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user!.id).lean();
  res.json({ user });
});

authRouter.post("/change-password", auth, async (req, res) => {
  const body = z.object({ oldPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
  const user = await User.findById(req.user!.id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(body.oldPassword, user.passwordHash))) return res.status(400).json({ message: "Old password is wrong" });
  user.passwordHash = await bcrypt.hash(body.newPassword, 10);
  await user.save();
  res.json({ message: "Password changed" });
});

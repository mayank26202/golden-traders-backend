import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { auth, permit } from "../middleware/auth.js";
import { User } from "../models/User.js";

export const usersRouter = Router();
usersRouter.use(auth, permit("users:manage"));

usersRouter.get("/", async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json({ data: users });
});

usersRouter.post("/", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    permissions: z.array(z.string()).default([]),
    active: z.boolean().default(true),
  }).parse(req.body);
  const user = await User.create({ ...body, passwordHash: await bcrypt.hash(body.password, 10), role: "user" });
  res.status(201).json({ data: user });
});

usersRouter.patch("/:id", async (req, res) => {
  const body = z.object({ name: z.string().optional(), permissions: z.array(z.string()).optional(), active: z.boolean().optional() }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ data: user });
});

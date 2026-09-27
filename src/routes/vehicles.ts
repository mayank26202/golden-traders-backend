import { Router } from "express";
import { z } from "zod";
import { auth, permit } from "../middleware/auth.js";
import { Vehicle } from "../models/Vehicle.js";

export const vehiclesRouter = Router();
vehiclesRouter.use(auth, permit("users:manage"));

vehiclesRouter.get("/", async (_req, res) => {
  const data = await Vehicle.find().sort({ createdAt: -1 }).lean();
  res.json({ data });
});

vehiclesRouter.post("/", async (req, res) => {
  const body = z.object({
    vehicleNumber: z.string().min(1),
    model: z.string().min(1),
    driverName: z.string().min(1),
    driverPhone: z.string().min(1),
  }).parse(req.body);
  const data = await Vehicle.create({ ...body, createdBy: req.user!.id });
  res.status(201).json({ data });
});

vehiclesRouter.patch("/:id", async (req, res) => {
  const body = z.object({
    vehicleNumber: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    driverName: z.string().min(1).optional(),
    driverPhone: z.string().min(1).optional(),
    active: z.boolean().optional(),
  }).parse(req.body);
  const data = await Vehicle.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ data });
});

vehiclesRouter.delete("/:id", async (req, res) => {
  await Vehicle.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

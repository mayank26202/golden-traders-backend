import { Router } from "express";
import { z } from "zod";
import { auth, permit } from "../middleware/auth.js";
import { PartyName } from "../models/PartyName.js";

export const partyNamesRouter = Router();
partyNamesRouter.use(auth);

partyNamesRouter.get("/", async (req, res) => {
  const type = z.enum(["customer", "supplier"]).optional().parse(req.query.type);
  const search = String(req.query.search || "").trim();
  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;
  if (search) filter.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const data = await PartyName.find(filter).sort({ name: 1 }).limit(500).lean();
  res.json({ data });
});

partyNamesRouter.post("/", permit("sales:create"), async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1), type: z.enum(["customer", "supplier"]) }).parse(req.body);
  const data = await PartyName.findOneAndUpdate(
    { type: body.type, normalizedName: body.name.toLowerCase() },
    { $setOnInsert: { ...body, normalizedName: body.name.toLowerCase(), createdBy: req.user!.id } },
    { upsert: true, new: true }
  ).lean();
  res.status(201).json({ data });
});

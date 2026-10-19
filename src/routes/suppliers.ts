import { Router } from "express";
import { z } from "zod";
import { auth, permit } from "../middleware/auth.js";
import { SupplierEntry } from "../models/SupplierEntry.js";
import { dateFilter, listQuery } from "../utils/query.js";
import { SaleEntry } from "../models/SaleEntry.js";
import { SupplierPayment } from "../models/SupplierPayment.js";
import { allocateSupplierPaid } from "../utils/supplierPaid.js";

export const suppliersRouter = Router();
suppliersRouter.use(auth);

suppliersRouter.get("/", async (req, res) => {
  const { limit, skip, search, from, to } = listQuery(req);
  const filter = { ...dateFilter("supplyDate", from, to), ...(search ? { supplierName: new RegExp(search, "i") } : {}) };
  const [rows, total] = await Promise.all([SupplierEntry.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(), SupplierEntry.countDocuments(filter)]);
  const out = await SaleEntry.aggregate([{ $match: { supplierId: { $in: rows.map((r) => r._id) } } }, { $group: { _id: "$supplierId", totalOut: { $sum: "$totalKg" } } }]);
  const outMap = new Map(out.map((x) => [String(x._id), x.totalOut]));
  const supplierNames = [...new Set(rows.map(row => row.supplierName))];
  const [supplies, payments] = await Promise.all([
    SupplierEntry.find({ supplierName: { $in: supplierNames } }).sort({ supplyDate: 1, createdAt: 1, _id: 1 }).lean(),
    SupplierPayment.aggregate([{ $match: { supplierName: { $in: supplierNames } } }, { $group: { _id: "$supplierName", paidAmount: { $sum: "$amount" } } }]),
  ]);
  const paid = allocateSupplierPaid(supplies, payments);
  const data = rows.map((row) => ({ ...row, ...paid.get(String(row._id)), totalAmount: row.kgWeight * row.ratePerKg, totalIn: row.kgWeight, totalOut: outMap.get(String(row._id)) || 0, stockBalance: row.kgWeight - (outMap.get(String(row._id)) || 0) }));
  res.json({ data, total });
});

suppliersRouter.get("/history", async (_req, res) => {
  const [data, payments] = await Promise.all([SupplierEntry.aggregate([
    { $addFields: { totalAmount: { $multiply: ["$kgWeight", "$ratePerKg"] }, paidAmount: { $cond: [{ $eq: ["$payment.status", "done"] }, { $multiply: ["$kgWeight", "$ratePerKg"] }, 0] } } },
    { $group: { _id: "$supplierName", totalKg: { $sum: "$kgWeight" }, totalAmount: { $sum: "$totalAmount" }, paidAmount: { $sum: "$paidAmount" }, entryCount: { $sum: 1 } } },
    { $addFields: { pendingAmount: { $subtract: ["$totalAmount", "$paidAmount"] } } },
    { $sort: { totalAmount: -1 } },
  ]), SupplierPayment.aggregate([{ $group: { _id: "$supplierName", paidAmount: { $sum: "$amount" } } }])]);
  const paidMap = new Map(payments.map(payment => [payment._id, payment.paidAmount]));
  res.json({ data: data.map(supplier => {
    const paidAmount = supplier.paidAmount + (paidMap.get(supplier._id) || 0);
    return { ...supplier, paidAmount, pendingAmount: supplier.totalAmount - paidAmount };
  }) });
});


suppliersRouter.post("/bulk", permit("suppliers:create"), async (req, res) => {
  //bulk supply
  const entries = req.body.entries;
  if (!Array.isArray(entries) || entries.length === 0) return res.status(400).json({ message: "No entries provided" });
  
  const createdBy = req.user!.id;
  const docs = entries.map(body => ({
    supplierName: body.supplierName,
    kgWeight: body.kgWeight,
    ratePerKg: body.ratePerKg || 0,
    supplyDate: new Date(body.supplyDate || new Date()),
    createdBy
  }));
  
  const data = await SupplierEntry.insertMany(docs);
  res.status(201).json({ data });
});

suppliersRouter.post("/", permit("suppliers:create"), async (req, res) => {
  const body = z.object({ supplierName: z.string().min(1), kgWeight: z.number(), ratePerKg: z.number().default(0), supplyDate: z.coerce.date().default(new Date()) }).parse(req.body);
  const data = await SupplierEntry.create({ ...body, createdBy: req.user!.id });
  res.status(201).json({ data });
});

suppliersRouter.patch("/:id/payment", permit("suppliers:edit"), async (req, res) => {
  const body = z.object({ status: z.enum(["pending", "done"]), method: z.enum(["cash", "upi", "bank_to_bank", "SK", "company_account", "none"]) }).parse(req.body);
  const data = await SupplierEntry.findByIdAndUpdate(req.params.id, { payment: { ...body, paidAt: body.status === "done" ? new Date() : undefined } }, { new: true });
  res.json({ data });
});

suppliersRouter.patch("/:id", permit("suppliers:edit"), async (req, res) => {
  const body = z.object({ supplierName: z.string().min(1).optional(), kgWeight: z.number().optional(), ratePerKg: z.number().optional(), supplyDate: z.coerce.date().optional() }).parse(req.body);
  const data = await SupplierEntry.findByIdAndUpdate(req.params.id, body, { new: true }).lean();
  res.json({ data: data ? { ...data, totalAmount: data.kgWeight * data.ratePerKg } : null });
});

suppliersRouter.delete("/:id", permit("suppliers:delete"), async (req, res) => {
  await SupplierEntry.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

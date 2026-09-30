import { Router } from "express";
import { z } from "zod";
import { auth, permit } from "../middleware/auth.js";
import { CashDeposit } from "../models/CashDeposit.js";
import { CustomerPayment } from "../models/CustomerPayment.js";
import { SaleEntry } from "../models/SaleEntry.js";
import { SupplierPayment } from "../models/SupplierPayment.js";
import { SupplierEntry } from "../models/SupplierEntry.js";
import { dateFilter, listQuery } from "../utils/query.js";

export const paymentsRouter = Router();
paymentsRouter.use(auth);

const paymentMethods = ["cash", "upi", "bank", "SK", "golden_traders_bank"] as const;
const bankAccounts = ["SK", "golden_traders_bank"] as const;

paymentsRouter.get("/", async (req, res) => {
  const { from, to, search } = listQuery(req);
  const filter = { ...dateFilter("paymentDate", from, to), ...(search ? { customerName: new RegExp(search, "i") } : {}) };
  const data = await CustomerPayment.find(filter).sort({ createdAt: -1 }).lean();
  const cards = data.reduce<Record<string, { count: number; total: number }>>((acc, row) => {
    acc[row.method] = { count: (acc[row.method]?.count || 0) + 1, total: (acc[row.method]?.total || 0) + row.amount };
    return acc;
  }, {});
  res.json({ data, cards });
});

paymentsRouter.post("/", permit("sales:create"), async (req, res) => {
  const body = z.object({
    customerName: z.string().min(1),
    amount: z.number().positive(),
    method: z.enum(paymentMethods),
    paymentDate: z.coerce.date(),
    paymentTime: z.string().min(1),
    note: z.string().optional(),
  }).parse(req.body);
  const data = await CustomerPayment.create({ ...body, createdBy: req.user!.id });
  res.status(201).json({ data });
});

paymentsRouter.patch("/:id", permit("sales:edit"), async (req, res) => {
  const body = z.object({
    customerName: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    method: z.enum(paymentMethods).optional(),
    paymentDate: z.coerce.date().optional(),
    paymentTime: z.string().min(1).optional(),
    note: z.string().optional(),
  }).parse(req.body);
  const data = await CustomerPayment.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ data });
});

paymentsRouter.delete("/:id", permit("sales:delete"), async (req, res) => {
  await CustomerPayment.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

paymentsRouter.get("/outstanding", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const saleMatch = search ? { customerName: new RegExp(search, "i") } : {};
  const paymentMatch = search ? { customerName: new RegExp(search, "i") } : {};
  const [sales, payments] = await Promise.all([
    SaleEntry.aggregate([
      { $match: saleMatch },
      { $group: { _id: "$customerName", totalSales: { $sum: { $multiply: ["$totalKg", "$rateOfSale"] } }, totalKg: { $sum: "$totalKg" } } },
    ]),
    CustomerPayment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: "$customerName", totalPaid: { $sum: "$amount" } } },
    ]),
  ]);
  const paidMap = new Map(payments.map((item) => [item._id, item.totalPaid]));
  const data = sales.map((sale) => {
    const totalPaid = paidMap.get(sale._id) || 0;
    return { customerName: sale._id, totalKg: sale.totalKg, totalSales: sale.totalSales, totalPaid, outstanding: sale.totalSales - totalPaid };
  }).sort((a, b) => b.outstanding - a.outstanding);
  res.json({ data });
});

paymentsRouter.get("/cash-deposits", async (req, res) => {
  const { from, to } = listQuery(req);
  const data = await CashDeposit.find(dateFilter("depositDate", from, to)).sort({ createdAt: -1 }).lean();
  const cards = data.reduce<Record<string, { count: number; total: number }>>((acc, row) => {
    acc[row.bankAccount] = { count: (acc[row.bankAccount]?.count || 0) + 1, total: (acc[row.bankAccount]?.total || 0) + row.amount };
    return acc;
  }, {});
  res.json({ data, cards });
});

paymentsRouter.get("/suppliers", async (req, res) => {
  const { from, to, search } = listQuery(req);
  const filter = { ...dateFilter("paymentDate", from, to), ...(search ? { supplierName: new RegExp(search, "i") } : {}) };
  const data = await SupplierPayment.find(filter).sort({ createdAt: -1 }).lean();
  const cards = data.reduce<Record<string, { count: number; total: number }>>((acc, row) => {
    acc[row.method] = { count: (acc[row.method]?.count || 0) + 1, total: (acc[row.method]?.total || 0) + row.amount };
    return acc;
  }, {});
  res.json({ data, cards });
});

paymentsRouter.post("/suppliers", permit("suppliers:create"), async (req, res) => {
  const body = z.object({ supplierName: z.string().min(1), amount: z.number().positive(), method: z.enum(paymentMethods), paymentDate: z.coerce.date(), paymentTime: z.string().min(1), note: z.string().optional() }).parse(req.body);
  const data = await SupplierPayment.create({ ...body, createdBy: req.user!.id });
  res.status(201).json({ data });
});

paymentsRouter.patch("/suppliers/:id", permit("suppliers:edit"), async (req, res) => {
  const body = z.object({ supplierName: z.string().min(1).optional(), amount: z.number().positive().optional(), method: z.enum(paymentMethods).optional(), paymentDate: z.coerce.date().optional(), paymentTime: z.string().min(1).optional(), note: z.string().optional() }).parse(req.body);
  const data = await SupplierPayment.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ data });
});

paymentsRouter.delete("/suppliers/:id", permit("suppliers:delete"), async (req, res) => {
  await SupplierPayment.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

paymentsRouter.get("/supplier-outstanding", async (_req, res) => {
  const [supplies, payments] = await Promise.all([
    SupplierEntry.aggregate([{ $group: { _id: "$supplierName", totalPurchase: { $sum: { $multiply: ["$kgWeight", "$ratePerKg"] } }, totalKg: { $sum: "$kgWeight" } } }]),
    SupplierPayment.aggregate([{ $group: { _id: "$supplierName", totalPaid: { $sum: "$amount" } } }]),
  ]);
  const paidMap = new Map(payments.map((x) => [x._id, x.totalPaid]));
  res.json({ data: supplies.map((x) => ({ supplierName: x._id, totalKg: x.totalKg, totalPurchase: x.totalPurchase, totalPaid: paidMap.get(x._id) || 0, outstanding: x.totalPurchase - (paidMap.get(x._id) || 0) })) });
});

paymentsRouter.post("/cash-deposits", permit("sales:create"), async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    bankAccount: z.enum(bankAccounts),
    depositDate: z.coerce.date(),
    depositTime: z.string().min(1),
    note: z.string().optional(),
  }).parse(req.body);
  const data = await CashDeposit.create({ ...body, createdBy: req.user!.id });
  res.status(201).json({ data });
});

paymentsRouter.patch("/cash-deposits/:id", permit("sales:edit"), async (req, res) => {
  const body = z.object({
    amount: z.number().positive().optional(),
    bankAccount: z.enum(bankAccounts).optional(),
    depositDate: z.coerce.date().optional(),
    depositTime: z.string().min(1).optional(),
    note: z.string().optional(),
  }).parse(req.body);
  const data = await CashDeposit.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ data });
});

paymentsRouter.delete("/cash-deposits/:id", permit("sales:delete"), async (req, res) => {
  await CashDeposit.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

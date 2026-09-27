import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { auth, permit } from "../middleware/auth.js";
import { SaleEntry } from "../models/SaleEntry.js";
import { dateFilter, listQuery } from "../utils/query.js";
import { SupplierEntry } from "../models/SupplierEntry.js";

export const salesRouter = Router();
salesRouter.use(auth);

salesRouter.get("/", async (req, res) => {
  const { limit, skip, search, from, to } = listQuery(req);
  const filter = { ...dateFilter("saleDate", from, to), ...(search ? { customerName: new RegExp(search, "i") } : {}) };
  const [rows, total] = await Promise.all([SaleEntry.find(filter).sort({ saleDate: -1 }).skip(skip).limit(limit).lean(), SaleEntry.countDocuments(filter)]);
  const data = rows.map((row) => ({ ...row, totalAmount: row.totalKg * row.rateOfSale }));
  res.json({ data, total });
});

salesRouter.get("/available-suppliers", async (req, res) => {
  const date = z.coerce.date().parse(req.query.date);
  const from = new Date(date); from.setHours(0, 0, 0, 0);
  const to = new Date(date); to.setHours(23, 59, 59, 999);
  const data = await SupplierEntry.aggregate([
    { $match: { supplyDate: { $gte: from, $lte: to } } },
    { $group: { _id: "$supplierName", supplierId: { $first: "$_id" }, totalIn: { $sum: "$kgWeight" } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ data: data.map((x) => ({ supplierId: x.supplierId, supplierName: x._id, totalIn: x.totalIn })) });
});

salesRouter.post("/", permit("sales:create"), async (req, res) => {
  const body = z.object({ customerName: z.string().min(1), totalKg: z.number().positive(), rateOfSale: z.number().default(0), saleDate: z.coerce.date().default(new Date()), supplierId: z.string().min(1), supplierName: z.string().min(1) }).parse(req.body);
  const dayStart = new Date(body.saleDate); dayStart.setHours(0, 0, 0, 0); const dayEnd = new Date(body.saleDate); dayEnd.setHours(23, 59, 59, 999);
  const supply = await SupplierEntry.findOne({ _id: body.supplierId, supplierName: body.supplierName, supplyDate: { $gte: dayStart, $lte: dayEnd } }).lean();
  if (!supply) return res.status(400).json({ message: "Is date ke liye selected supplier ki supply nahi mili" });
  const used = await SaleEntry.aggregate([{ $match: { supplierId: supply._id, saleDate: { $gte: dayStart, $lte: dayEnd } } }, { $group: { _id: null, kg: { $sum: "$totalKg" } } }]);
  if ((used[0]?.kg || 0) + body.totalKg > supply.kgWeight) return res.status(400).json({ message: `Available stock sirf ${Math.max(0, supply.kgWeight - (used[0]?.kg || 0))} kg hai` });
  const data = await SaleEntry.create({ ...body, createdBy: req.user!.id });
  res.status(201).json({ data });
});

salesRouter.patch("/:id", permit("sales:edit"), async (req, res) => {
  const body = z.object({ customerName: z.string().min(1).optional(), totalKg: z.number().positive().optional(), rateOfSale: z.number().optional(), saleDate: z.coerce.date().optional(), supplierId: z.string().min(1).optional(), supplierName: z.string().min(1).optional() }).parse(req.body);
  const data = await SaleEntry.findByIdAndUpdate(req.params.id, body, { new: true }).lean();
  res.json({ data: data ? { ...data, totalAmount: data.totalKg * data.rateOfSale } : null });
});

salesRouter.delete("/:id", permit("sales:delete"), async (req, res) => {
  await SaleEntry.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

salesRouter.get("/:id/invoice", async (req, res) => {
  const sale = await SaleEntry.findById(req.params.id).lean({ virtuals: true });
  if (!sale) return res.status(404).json({ message: "Invoice entry not found" });
  const file = path.join(os.tmpdir(), `invoice-${sale._id}.pdf`);
  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(fs.createWriteStream(file));
  doc.fontSize(20).text("Chicken Supply Invoice");
  doc.moveDown().fontSize(11).text(`Invoice No: ${sale._id}`).text(`Customer: ${sale.customerName}`).text(`Sale Date: ${new Date(sale.saleDate).toLocaleDateString()}`);
  doc.moveDown().fontSize(13).text(`KG: ${sale.totalKg}`).text(`Rate: ${sale.rateOfSale}`).text(`Total Amount: Rs. ${sale.totalKg * sale.rateOfSale}`);
  doc.moveDown().fontSize(10).text("Payment is tracked separately in customer payment ledger.");
  doc.end();
  doc.on("end", () => res.download(file, `invoice-${sale._id}.pdf`, () => fs.rm(file, { force: true }, () => undefined)));
});

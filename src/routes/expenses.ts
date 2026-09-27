import { Router } from "express";
import { z } from "zod";
import { auth, permit } from "../middleware/auth.js";
import { Expense } from "../models/Expense.js";
import { dateFilter, listQuery } from "../utils/query.js";

export const expensesRouter = Router();
expensesRouter.use(auth);

expensesRouter.get("/", async (req, res) => {
  const { limit, skip, search, from, to } = listQuery(req);
  const filter = { ...dateFilter("expenseDate", from, to), ...(search ? { $or: [{ driverName: new RegExp(search, "i") }, { employeeName: new RegExp(search, "i") }, { vehicleNumber: new RegExp(search, "i") }, { title: new RegExp(search, "i") }] } : {}) };
  const [data, total] = await Promise.all([Expense.find(filter).sort({ expenseDate: -1 }).skip(skip).limit(limit).lean({ virtuals: true }), Expense.countDocuments(filter)]);
  const cards = data.reduce((acc, row) => {
    if (row.type === "salary") {
      acc["Salary"] = { total: (acc["Salary"]?.total || 0) + row.salaryAmount };
      acc["Bonus"] = { total: (acc["Bonus"]?.total || 0) + row.bonusAmount };
    } else if (row.type === "emi") {
      acc["EMI Paid"] = { total: (acc["EMI Paid"]?.total || 0) + row.fixedAmount };
    } else {
      acc["Fuel & Food"] = { total: (acc["Fuel & Food"]?.total || 0) + row.foodCost + row.petrolCost };
      acc["Other Costs"] = { total: (acc["Other Costs"]?.total || 0) + row.miscellaneousCost };
    }
    return acc;
  }, {});
  res.json({ data, total, cards });
});

expensesRouter.post("/", permit("expenses:create"), async (req, res) => {
  const body = z.object({
    type: z.enum(["vehicle", "emi", "salary"]),
    driverName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    employeeName: z.string().optional(),
    fuelType: z.enum(["diesel", "petrol", "cng"]).optional(),
    foodCost: z.number().default(0),
    petrolCost: z.number().default(0),
    miscellaneousCost: z.number().default(0),
    salaryAmount: z.number().default(0),
    bonusAmount: z.number().default(0),
    title: z.string().optional(),
    fixedAmount: z.number().default(0),
    recurrence: z.enum(["none", "daily", "monthly", "yearly"]).default("none"),
    expenseDate: z.coerce.date().default(new Date()),
  }).parse(req.body);
  const data = await Expense.create({ ...body, createdBy: req.user!.id });
  res.status(201).json({ data });
});

expensesRouter.get("/history", async (req, res) => {
  const { from, to, search } = listQuery(req);
  const matchFilter = { ...dateFilter("expenseDate", from, to), ...(search ? { $or: [{ driverName: new RegExp(search, "i") }, { employeeName: new RegExp(search, "i") }, { vehicleNumber: new RegExp(search, "i") }, { title: new RegExp(search, "i") }] } : {}) };
  const data = await Expense.aggregate([
    { $match: matchFilter },
    { $addFields: { person: { $cond: [{ $and: [{ $ne: ["$driverName", ""] }, { $ne: [{ $type: "$driverName" }, "missing"] }] }, "$driverName", "$employeeName"] }, total: { $add: ["$foodCost", "$petrolCost", "$miscellaneousCost", "$fixedAmount", "$salaryAmount", "$bonusAmount"] } } },
    { $group: { _id: { type: "$type", person: "$person", vehicleNumber: "$vehicleNumber" }, totalAmount: { $sum: "$total" }, entries: { $sum: 1 } } },
    { $sort: { totalAmount: -1 } },
  ]);
  res.json({ data });
});

expensesRouter.patch("/:id", permit("expenses:edit"), async (req, res) => {
  const body = z.object({
    type: z.enum(["vehicle", "emi", "salary"]).optional(),
    driverName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    employeeName: z.string().optional(),
    fuelType: z.enum(["diesel", "petrol", "cng"]).optional(),
    foodCost: z.number().optional(),
    petrolCost: z.number().optional(),
    miscellaneousCost: z.number().optional(),
    salaryAmount: z.number().optional(),
    bonusAmount: z.number().optional(),
    title: z.string().optional(),
    fixedAmount: z.number().optional(),
    recurrence: z.enum(["none", "daily", "monthly", "yearly"]).optional(),
    expenseDate: z.coerce.date().optional(),
  }).parse(req.body);
  const data = await Expense.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ data });
});

expensesRouter.delete("/:id", permit("expenses:delete"), async (req, res) => {
  await Expense.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { Expense } from "../models/Expense.js";
import { SaleEntry } from "../models/SaleEntry.js";
import { SupplierEntry } from "../models/SupplierEntry.js";
import { User } from "../models/User.js";
import { CustomerPayment } from "../models/CustomerPayment.js";
import { SupplierPayment } from "../models/SupplierPayment.js";
import { dateFilter, listQuery } from "../utils/query.js";

export const reportsRouter = Router();
reportsRouter.use(auth);

reportsRouter.get("/dashboard", async (req, res) => {
  const query = listQuery(req);
  const overall = req.query.period === "overall";
  const today = new Date();
  const from = overall ? undefined : query.from || new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const to = overall ? undefined : query.to || today;
  const saleFilter = dateFilter("saleDate", from, to);
  const supplyFilter = dateFilter("supplyDate", from, to);
  const expenseFilter = dateFilter("expenseDate", from, to);
  const paymentFilter = dateFilter("paymentDate", from, to);
  const [sales, supplies, expenses, payments, users] = await Promise.all([
    SaleEntry.find(saleFilter).lean({ virtuals: true }),
    SupplierEntry.find(supplyFilter).lean({ virtuals: true }),
    Expense.find(expenseFilter).lean(),
    CustomerPayment.find(paymentFilter).lean(),
    req.user!.role === "admin" ? User.find().select("name email role lastLoginAt active permissions").lean() : Promise.resolve([]),
  ]);
  const saleKg = sales.reduce((sum, item) => sum + item.totalKg, 0);
  const supplyKg = supplies.reduce((sum, item) => sum + item.kgWeight, 0);
  const revenue = sales.reduce((sum, item) => sum + item.totalKg * item.rateOfSale, 0);
  const supplyCost = supplies.reduce((sum, item) => sum + item.kgWeight * item.ratePerKg, 0);
  const expenseCost = expenses.reduce((sum, item: any) => sum + (item.foodCost || 0) + (item.petrolCost || 0) + (item.miscellaneousCost || 0) + (item.fixedAmount || 0) + (item.salaryAmount || 0) + (item.bonusAmount || 0), 0);
  const receivedPayments = payments.reduce((sum, item) => sum + item.amount, 0);
  const recievedPaymentsCount = payments.length;
  const pendingSales = Math.max(revenue - receivedPayments, 0);
  const pendingSupplies = supplies.filter((item) => item.payment?.status !== "done").reduce((sum, item) => sum + item.kgWeight * item.ratePerKg, 0);
  const paidSales = receivedPayments;
  const avgBuyRate = supplyKg ? supplyCost / supplyKg : 0;
  const avgSaleRate = saleKg ? revenue / saleKg : 0;
  const profit = revenue - supplyCost - expenseCost;
  const paymentMix = payments.reduce<Record<string, { count: number; total: number }>>((acc, row) => {
    const key = row.method || "cash";
    acc[key] = { count: (acc[key]?.count || 0) + 1, total: (acc[key]?.total || 0) + row.amount };
    return acc;
  }, {});
  const dayMap = new Map<string, { revenue: number; cost: number }>();
  sales.forEach((s) => {
    const key = new Date(s.saleDate).toISOString().slice(0, 10);
    dayMap.set(key, { revenue: (dayMap.get(key)?.revenue || 0) + s.totalKg * s.rateOfSale, cost: dayMap.get(key)?.cost || 0 });
  });
  supplies.forEach((s) => {
    const key = new Date(s.supplyDate).toISOString().slice(0, 10);
    dayMap.set(key, { revenue: dayMap.get(key)?.revenue || 0, cost: (dayMap.get(key)?.cost || 0) + s.kgWeight * s.ratePerKg });
  });
  res.json({
    cards: {
      supplyKg,
      saleKg,
      deadOrMissingKg: supplyKg - saleKg,
      revenue,
      supplyCost,
      expenseCost,
      profit,
      turnover: revenue,
      pendingSales,
      pendingSupplies,
      paidSales,
      avgBuyRate,
      avgSaleRate,
      marginPercent: revenue ? (profit / revenue) * 100 : 0,
      saleCount: sales.length,
      supplyCount: supplies.length,
      expenseCount: expenses.length,
      receivedPayments,
      recievedPaymentsCount,
    },
    trend: [...dayMap.entries()].sort().map(([date, value]) => ({ date, ...value, profit: value.revenue - value.cost })),
    recent: {
      sales: sales.sort((a, b) => +new Date(b.saleDate) - +new Date(a.saleDate)).slice(0, 5),
      supplies: supplies.sort((a, b) => +new Date(b.supplyDate) - +new Date(a.supplyDate)).slice(0, 5),
    },
    paymentMix,
    users,
  });
});

reportsRouter.get("/customer-history", async (req, res) => {
  const { search, from, to } = listQuery(req);
  const filter = { ...dateFilter("saleDate", from, to), ...(search ? { customerName: new RegExp(search, "i") } : {}) };
  const data = await SaleEntry.aggregate([
    { $match: filter },
    { $addFields: { totalAmount: { $multiply: ["$totalKg", "$rateOfSale"] } } },
    { $group: { _id: "$customerName", totalKg: { $sum: "$totalKg" }, totalAmount: { $sum: "$totalAmount" }, entries: { $push: "$$ROOT" } } },
    { $sort: { totalAmount: -1 } },
  ]);
  res.json({ data });
});

reportsRouter.get("/party-ledger", async (req, res) => {
  const type = String(req.query.type || "customer");
  const name = String(req.query.name || "").trim();
  if (!name) {
    const { from, to } = listQuery(req);
    if (type === "supplier") {
      const [p, pay] = await Promise.all([SupplierEntry.find(dateFilter("supplyDate", from, to)).lean(), SupplierPayment.find(dateFilter("paymentDate", from, to)).lean()]);
      return res.json({ data: [...p.map((x) => ({ party: x.supplierName, date: x.supplyDate, type: "Purchase", kg: x.kgWeight, amount: x.kgWeight * x.ratePerKg })), ...pay.map((x) => ({ party: x.supplierName, date: x.paymentDate, type: "Payment", kg: 0, amount: x.amount, method: x.method }))] });
    }
    const [s, pay] = await Promise.all([SaleEntry.find(dateFilter("saleDate", from, to)).lean(), CustomerPayment.find(dateFilter("paymentDate", from, to)).lean()]);
    return res.json({ data: [...s.map((x) => ({ party: x.customerName, date: x.saleDate, type: "Sale", kg: x.totalKg, amount: x.totalKg * x.rateOfSale })), ...pay.map((x) => ({ party: x.customerName, date: x.paymentDate, type: "Payment", kg: 0, amount: x.amount, method: x.method }))] });
  }
  const { from, to } = listQuery(req);
  if (type === "supplier") {
    const [purchases, payments] = await Promise.all([
      SupplierEntry.find({ supplierName: name, ...dateFilter("supplyDate", from, to) }).lean(),
      SupplierPayment.find({ supplierName: name, ...dateFilter("paymentDate", from, to) }).lean(),
    ]);
    
    const totalKg = purchases.reduce((sum, x) => sum + x.kgWeight, 0);
    const totalPurchase = purchases.reduce((sum, x) => sum + x.kgWeight * x.ratePerKg, 0);
    const totalPaid = payments.reduce((sum, x) => sum + x.amount, 0);
    const allPurchases = await SupplierEntry.find({ supplierName: name }).lean();
    const allPayments = await SupplierPayment.find({ supplierName: name }).lean();
    const overallPurchase = allPurchases.reduce((sum, x) => sum + x.kgWeight * x.ratePerKg, 0);
    const overallPaid = allPayments.reduce((sum, x) => sum + x.amount, 0);
    return res.json({ cards: { totalKg, totalPurchase, totalPaid, overallPurchase, overallPaid }, data: [...purchases.map((x) => ({ date: x.supplyDate, type: "Purchase", kg: x.kgWeight, amount: x.kgWeight * x.ratePerKg })), ...payments.map((x) => ({ date: x.paymentDate, type: "Payment", kg: 0, amount: x.amount, method: x.method }))].sort((a, b) => +new Date(b.date) - +new Date(a.date)) });
  
  }
  const [sales, payments] = await Promise.all([
    SaleEntry.find({ customerName: name, ...dateFilter("saleDate", from, to) }).lean(),
    CustomerPayment.find({ customerName: name, ...dateFilter("paymentDate", from, to) }).lean(),
  ]);
  
  const totalKg = sales.reduce((sum, x) => sum + x.totalKg, 0);
  const totalSales = sales.reduce((sum, x) => sum + x.totalKg * x.rateOfSale, 0);
  const totalPaid = payments.reduce((sum, x) => sum + x.amount, 0);
  const allSales = await SaleEntry.find({ customerName: name }).lean();
  const allPayments = await CustomerPayment.find({ customerName: name }).lean();
  const overallSales = allSales.reduce((sum, x) => sum + x.totalKg * x.rateOfSale, 0);
  const overallPaid = allPayments.reduce((sum, x) => sum + x.amount, 0);
  res.json({ cards: { totalKg, totalSales, totalPaid, overallSales, overallPaid }, data: [...sales.map((x) => ({ date: x.saleDate, type: "Sale", kg: x.totalKg, amount: x.totalKg * x.rateOfSale })), ...payments.map((x) => ({ date: x.paymentDate, type: "Payment", kg: 0, amount: x.amount, method: x.method }))].sort((a, b) => +new Date(b.date) - +new Date(a.date)) });
  
});

reportsRouter.get("/payments", async (req, res) => {
  const { from, to, search } = listQuery(req);
  const saleFilter = { ...dateFilter("saleDate", from, to), "payment.status": "done", ...(search ? { customerName: new RegExp(search, "i") } : {}) };
  const supplyFilter = { ...dateFilter("supplyDate", from, to), "payment.status": "done", ...(search ? { supplierName: new RegExp(search, "i") } : {}) };
  const [sales, supplies] = await Promise.all([SaleEntry.find(saleFilter).lean({ virtuals: true }), SupplierEntry.find(supplyFilter).lean({ virtuals: true })]);
  const rows = [...sales.map((x) => ({ ...x, totalAmount: x.totalKg * x.rateOfSale, kind: "sale", party: x.customerName })), ...supplies.map((x) => ({ ...x, totalAmount: x.kgWeight * x.ratePerKg, kind: "supply", party: x.supplierName }))];
  const cards = rows.reduce<Record<string, { count: number; total: number }>>((acc, row: any) => {
    const key = row.payment.method || "none";
    acc[key] = { count: (acc[key]?.count || 0) + 1, total: (acc[key]?.total || 0) + row.totalAmount };
    return acc;
  }, {});
  res.json({ data: rows, cards });
});

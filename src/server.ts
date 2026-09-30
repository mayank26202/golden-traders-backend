import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { expensesRouter } from "./routes/expenses.js";
import { reportsRouter } from "./routes/reports.js";
import { salesRouter } from "./routes/sales.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { usersRouter } from "./routes/users.js";
import { paymentsRouter } from "./routes/payments.js";
import { vehiclesRouter } from "./routes/vehicles.js";
import { partyNamesRouter } from "./routes/partyNames.js";
import { User } from "./models/User.js";
import { PartyName } from "./models/PartyName.js";
import { CustomerPayment } from "./models/CustomerPayment.js";
import { SupplierEntry } from "./models/SupplierEntry.js";
import { SaleEntry } from "./models/SaleEntry.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/sales", salesRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/users", usersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/party-names", partyNamesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Server error";
  res.status(400).json({ message });
});

async function seedAdmin() {
  const exists = await User.findOne({ email: config.admin.email });
  if (!exists) {
    await User.create({
      name: config.admin.name,
      email: config.admin.email,
      passwordHash: await bcrypt.hash(config.admin.password, 10),
      role: "admin",
      permissions: [],
    });
  }
}

async function seedPartyNames() {
  const [customers, suppliers] = await Promise.all([SaleEntry.distinct("customerName"), SupplierEntry.distinct("supplierName")]);
  await Promise.all([
    ...customers.filter(Boolean).map((name) => PartyName.updateOne({ type: "customer", normalizedName: String(name).toLowerCase() }, { $setOnInsert: { name, normalizedName: String(name).toLowerCase(), type: "customer" } }, { upsert: true })),
    ...suppliers.filter(Boolean).map((name) => PartyName.updateOne({ type: "supplier", normalizedName: String(name).toLowerCase() }, { $setOnInsert: { name, normalizedName: String(name).toLowerCase(), type: "supplier" } }, { upsert: true })),
  ]);
}

function startKeepAlive() {
  const url = config.keepAliveUrl || `http://localhost:${config.port}/health`;
  const interval = Math.max(config.keepAliveMinutes, 5) * 60 * 1000;
  setInterval(async () => {
    try {
      await fetch(url);
      console.log(`Keep-alive ping sent to ${url}`);
    } catch (error) {
      console.warn("Keep-alive ping failed", error);
    }
  }, interval).unref();
}

mongoose.connect(config.mongoUri).then(async () => {
  await seedAdmin();
  await seedPartyNames();
  app.listen(config.port, () => {
    startKeepAlive();
    console.log(`API running on http://localhost:${config.port}`);
  });
});

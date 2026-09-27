import type { Request } from "express";

export function listQuery(req: Request) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const skip = (page - 1) * limit;
  const search = String(req.query.search || "").trim();
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if (to) to.setHours(23, 59, 59, 999);
  return { page, limit, skip, search, from, to };
}

export function dateFilter(field: string, from?: Date, to?: Date) {
  if (!from && !to) return {};
  return { [field]: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } };
}

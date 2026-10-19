// Supplier payments are unassigned ledger amounts. Apply them to the oldest
// unpaid supplies so pagination and date filters do not change paid balances.
export function allocateSupplierPaid(
  supplies: { _id: unknown; supplierName: string; kgWeight: number; ratePerKg: number; payment?: { status?: string } | null }[],
  payments: { _id: string; paidAmount: number }[],
) {
  const remaining = new Map(payments.map(payment => [payment._id, Math.round(payment.paidAmount * 100)]));
  const result = new Map<string, { paidAmount: number; pendingAmount: number }>();
  for (const supply of supplies) {
    const total = Math.round(supply.kgWeight * supply.ratePerKg * 100);
    const balance = remaining.get(supply.supplierName) || 0;
    const paid = supply.payment?.status === "done" ? total : Math.min(total, Math.max(0, balance));
    if (supply.payment?.status !== "done") remaining.set(supply.supplierName, balance - paid);
    result.set(String(supply._id), { paidAmount: paid / 100, pendingAmount: (total - paid) / 100 });
  }
  return result;
}

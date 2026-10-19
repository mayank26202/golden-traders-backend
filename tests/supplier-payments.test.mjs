import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateSupplierPaid } from '../dist/utils/supplierPaid.js';
import { suppliersRouter } from '../dist/routes/suppliers.js';
import { paymentsRouter } from '../dist/routes/payments.js';
import { SupplierEntry } from '../dist/models/SupplierEntry.js';
import { SupplierPayment } from '../dist/models/SupplierPayment.js';

test('ledger payments cover oldest unpaid supplies and preserve legacy paid entries', () => {
  const supplies = [
    { _id: '1', supplierName: 'A', kgWeight: 10, ratePerKg: 10, payment: { status: 'done' } },
    { _id: '2', supplierName: 'A', kgWeight: 10, ratePerKg: 10 },
    { _id: '3', supplierName: 'A', kgWeight: 10, ratePerKg: 10 },
    { _id: '4', supplierName: 'B', kgWeight: 10, ratePerKg: 10 },
  ];
  const paid = allocateSupplierPaid(supplies, [{ _id: 'A', paidAmount: 150 }]);
  assert.deepEqual([...paid.values()], [
    { paidAmount: 100, pendingAmount: 0 }, { paidAmount: 100, pendingAmount: 0 },
    { paidAmount: 50, pendingAmount: 50 }, { paidAmount: 0, pendingAmount: 100 },
  ]);
  assert.equal(allocateSupplierPaid(supplies, [{ _id: 'A', paidAmount: 75 }]).get('2').paidAmount, 75);
  assert.equal(allocateSupplierPaid(supplies, []).get('2').paidAmount, 0);
});

test('bulk supplier payment appears in supply history paid and pending totals', async () => {
  const originals = [SupplierEntry.aggregate, SupplierPayment.aggregate, SupplierPayment.insertMany];
  const payments = [];
  const invoke = async (router, path, method, body = {}) => {
    let result;
    const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
    await handler({ body, user: { id: 'user' } }, { status() { return this; }, json(value) { result = value; } });
    return result;
  };
  try {
    SupplierEntry.aggregate = async () => [{ _id: 'A', totalAmount: 1000, paidAmount: 0, totalKg: 100, entryCount: 1 }];
    SupplierPayment.aggregate = async () => [{ _id: 'A', paidAmount: payments.reduce((sum, payment) => sum + payment.amount, 0) }];
    SupplierPayment.insertMany = async docs => { payments.push(...docs); return docs; };
    for (const amount of [200, 300]) await invoke(paymentsRouter, '/suppliers/bulk', 'post', { entries: [{ supplierName: 'A', amount, method: 'cash', paymentDate: '2026-10-19', paymentTime: '10:00' }] });
    const result = await invoke(suppliersRouter, '/history', 'get');
    assert.equal(result.data[0].paidAmount, 500);
    assert.equal(result.data[0].pendingAmount, 500);
    await assert.rejects(invoke(paymentsRouter, '/suppliers/bulk', 'post', { entries: [] }));
  } finally {
    [SupplierEntry.aggregate, SupplierPayment.aggregate, SupplierPayment.insertMany] = originals;
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { salesRouter } from '../dist/routes/sales.js';
import { SaleEntry } from '../dist/models/SaleEntry.js';
import { SupplierEntry } from '../dist/models/SupplierEntry.js';
import { weightResult } from '../../frontend/src/lib/weight.ts';

test('weight differences show loss below supply and profit above supply', () => {
  assert.equal(weightResult(100 - 97), '3 kg loss');
  assert.equal(weightResult(100 - 103), '3 kg profit');
  assert.equal(weightResult(0), '0 kg loss / profit');
});

test('every bulk save reduces available stock, including sales above supplied weight', async () => {
  const sales = [];
  const original = [SupplierEntry.aggregate, SaleEntry.aggregate, SaleEntry.insertMany];
  const handler = (path, method) => salesRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
  const call = async (path, method, body = {}) => {
    let result;
    const res = { status() { return this; }, json(value) { result = value; } };
    await handler(path, method)({ query: { date: '2026-10-16' }, body, user: { id: 'user' } }, res);
    return result;
  };
  try {
    SupplierEntry.aggregate = async () => [{ _id: 'Supplier A', supplierId: 'supply-1', totalIn: 100 }];
    SaleEntry.aggregate = async pipeline => {
      assert.equal(pipeline[1].$group._id, '$supplierName');
      return [{ _id: 'Supplier A', totalOut: sales.reduce((sum, row) => sum + row.totalKg, 0) }];
    };
    SaleEntry.insertMany = async docs => { sales.push(...docs); return docs; };
    assert.equal((await call('/available-suppliers', 'get')).data[0].stockBalance, 100);
    for (const [kg, balance] of [[40, 60], [57, 3], [6, -3]]) {
      await call('/bulk', 'post', { entries: [{ customerName: 'Customer', supplierName: 'Supplier A', supplierId: 'supply-1', totalKg: kg, saleDate: '2026-10-16' }] });
      assert.equal((await call('/available-suppliers', 'get')).data[0].stockBalance, balance);
    }
  } finally {
    [SupplierEntry.aggregate, SaleEntry.aggregate, SaleEntry.insertMany] = original;
  }
});

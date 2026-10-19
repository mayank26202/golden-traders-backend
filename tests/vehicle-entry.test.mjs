import assert from 'node:assert/strict';
import test from 'node:test';
import { expensesRouter } from '../dist/routes/expenses.js';
import { Expense } from '../dist/models/Expense.js';
import { Vehicle } from '../dist/models/Vehicle.js';

test('vehicle details are recorded from an entered expense without default vehicle values', async () => {
  const originals = [Expense.create, Vehicle.updateOne];
  const vehicles = [];
  try {
    Expense.create = async body => body;
    Vehicle.updateOne = async (...args) => { vehicles.push(args); };
    const handler = expensesRouter.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route.stack.at(-1).handle;
    const res = { status() { return this; }, json() {} };
    await handler({ body: { type: 'vehicle', vehicleNumber: ' ab 12 cd 3456 ', driverName: 'Entered driver', petrolCost: 500 }, user: { id: 'user' } }, res);
    assert.equal(vehicles.length, 1);
    assert.deepEqual(vehicles[0][0], { vehicleNumber: 'AB 12 CD 3456' });
    assert.equal(vehicles[0][1].$set.driverName, 'Entered driver');
    assert.equal(vehicles[0][2].upsert, true);
    await handler({ body: { type: 'salary', employeeName: 'Employee', salaryAmount: 100 }, user: { id: 'user' } }, res);
    assert.equal(vehicles.length, 1);
  } finally {
    [Expense.create, Vehicle.updateOne] = originals;
  }
});

import { itemMetrics, projectMetrics } from './calc.js';

const item = { id:'i1', plannedQty:1000, plannedUnitPrice:1200 };
const tx = [
  { itemId:'i1', qty:400, actualUnitPrice:1100 },
  { itemId:'i1', qty:300, actualUnitPrice:1300 }
];
const m = itemMetrics(item, tx);
if (m.plannedSubtotal !== 1200000) throw new Error('planned subtotal salah');
if (m.realizedQty !== 700) throw new Error('realized qty salah');
if (m.realizedNominal !== 830000) throw new Error('realized nominal salah');
if (m.remainingQty !== 300) throw new Error('remaining qty salah');
if (m.remainingNominal !== 370000) throw new Error('remaining nominal salah');
if (Math.round(m.avgActualPrice) !== 1186) throw new Error('average actual price salah');
if (m.isOverBudget) throw new Error('overbudget salah');

const over = itemMetrics(item, [...tx, { itemId:'i1', qty:400, actualUnitPrice:1400 }]);
if (!over.isOverBudget) throw new Error('overbudget tidak terdeteksi');

const p = projectMetrics([item], tx);
if (p.budget !== 1200000 || p.realized !== 830000 || p.remaining !== 370000) throw new Error('project metrics salah');
console.log('calculation smoke test: ok');

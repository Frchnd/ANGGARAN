export function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(num(value));
}

export function number(value, max = 2) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: max }).format(num(value));
}

export function itemMetrics(item, realizations = []) {
  const plannedQty = num(item.plannedQty);
  const plannedUnitPrice = num(item.plannedUnitPrice);
  const plannedSubtotal = plannedQty * plannedUnitPrice;
  const realizedQty = realizations.reduce((sum, r) => sum + num(r.qty), 0);
  const realizedNominal = realizations.reduce((sum, r) => sum + num(r.qty) * num(r.actualUnitPrice), 0);
  const avgActualPrice = realizedQty > 0 ? realizedNominal / realizedQty : 0;
  const remainingQty = plannedQty - realizedQty;
  // "remainingNominal" = uang budget yang belum terpakai.
  const remainingNominal = plannedSubtotal - realizedNominal;
  // "remainingNeedAtPlan" = estimasi kebutuhan yang belum dibeli memakai harga rencana.
  const remainingNeedAtPlan = Math.max(remainingQty, 0) * plannedUnitPrice;
  const estimatedFinalAtPlan = realizedNominal + remainingNeedAtPlan;
  const estimatedFinalVariance = plannedSubtotal - estimatedFinalAtPlan;
  const avgPriceVariance = realizedQty > 0 ? avgActualPrice - plannedUnitPrice : 0;
  const isOverBudget = realizedNominal > plannedSubtotal || realizedQty > plannedQty;
  const progress = plannedSubtotal > 0 ? Math.max(0, realizedNominal / plannedSubtotal) : 0;
  return {
    plannedQty, plannedUnitPrice, plannedSubtotal, realizedQty, realizedNominal,
    avgActualPrice, remainingQty, remainingNominal, remainingNeedAtPlan,
    estimatedFinalAtPlan, estimatedFinalVariance, avgPriceVariance, isOverBudget, progress
  };
}

export function projectMetrics(items = [], realizations = []) {
  const byItem = new Map();
  for (const r of realizations) {
    if (!byItem.has(r.itemId)) byItem.set(r.itemId, []);
    byItem.get(r.itemId).push(r);
  }
  let budget = 0;
  let realized = 0;
  let overBudgetCount = 0;
  let remainingNeedAtPlan = 0;
  const category = {
    Bahan: { budget: 0, realized: 0 },
    Upah: { budget: 0, realized: 0 }
  };
  const metrics = new Map();
  for (const item of items) {
    const m = itemMetrics(item, byItem.get(item.id) || []);
    metrics.set(item.id, m);
    budget += m.plannedSubtotal;
    realized += m.realizedNominal;
    remainingNeedAtPlan += m.remainingNeedAtPlan;
    if (category[item.category]) {
      category[item.category].budget += m.plannedSubtotal;
      category[item.category].realized += m.realizedNominal;
    }
    if (m.isOverBudget) overBudgetCount += 1;
  }
  return {
    budget,
    realized,
    remaining: budget - realized,
    remainingNeedAtPlan,
    progress: budget > 0 ? realized / budget : 0,
    overBudgetCount,
    category,
    itemMetrics: metrics
  };
}

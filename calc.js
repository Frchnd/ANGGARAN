export function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num(value));
}

export function number(value, max = 2) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: max }).format(num(value));
}

export function projectFinanceMetrics(transactions = []) {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const transaction of transactions) {
    const amount = Math.max(0, num(transaction.amount));
    if (transaction.type === 'income') {
      income += amount;
      incomeCount += 1;
    } else if (transaction.type === 'expense') {
      expense += amount;
      expenseCount += 1;
    }
  }

  return {
    omzet: income,
    expense,
    profitLoss: income - expense,
    incomeCount,
    expenseCount,
    transactionCount: incomeCount + expenseCount
  };
}

export function categoryTotals(transactions = [], type = null) {
  const totals = new Map();
  for (const transaction of transactions) {
    if (type && transaction.type !== type) continue;
    const key = String(transaction.category || 'Lainnya').trim() || 'Lainnya';
    totals.set(key, (totals.get(key) || 0) + Math.max(0, num(transaction.amount)));
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'id'));
}

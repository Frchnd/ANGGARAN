import {
  getAll, put, remove, getSetting, setSetting,
  deleteProjectCascade, exportDataSnapshot, restoreDataSnapshot
} from './db.js';
import { money, num, projectFinanceMetrics, categoryTotals } from './calc.js';

const state = {
  projects: [],
  transactions: [],
  currentProjectId: null,
  view: 'dashboard',
  layoutMode: 'auto',
  effectiveLayout: 'mobile',
  search: '',
  flowFilter: 'all',
  categoryFilter: 'all',
  dateFrom: '',
  dateTo: '',
  sortOrder: 'newest'
};

const els = {
  app: document.getElementById('app'),
  view: document.getElementById('view'),
  bottomNav: document.getElementById('bottomNav'),
  projectSwitcher: document.getElementById('projectSwitcher'),
  projectNameHeader: document.getElementById('projectNameHeader'),
  settingsButton: document.getElementById('settingsButton'),
  overlayRoot: document.getElementById('overlayRoot'),
  toastRoot: document.getElementById('toastRoot')
};

const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
  transactions: '<svg viewBox="0 0 24 24"><path d="M5 7h14M15 3l4 4-4 4M19 17H5M9 13l-4 4 4 4"/></svg>',
  projects: '<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v10H3V7Z"/><path d="M3 7V5h7l2 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.5 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.5-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.5-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.5 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  income: '<svg viewBox="0 0 24 24"><path d="M12 3v14M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>',
  expense: '<svg viewBox="0 0 24 24"><path d="M12 21V7M7 16l5 5 5-5"/><path d="M5 3h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M15 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  sort: '<svg viewBox="0 0 24 24"><path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3"/></svg>'
};

const navItems = [
  ['dashboard', 'Ringkasan', icons.dashboard],
  ['transactions', 'Transaksi', icons.transactions],
  ['projects', 'Proyek', icons.projects]
];

const INCOME_CATEGORIES = ['Pembayaran', 'DP', 'Termin', 'Tambahan', 'Lainnya'];
const EXPENSE_CATEGORIES = ['Material', 'Upah', 'Transport', 'Operasional', 'Sewa / Alat', 'Lainnya'];

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));
}

function isoToday() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(y, m - 1, d));
}

function currentProject() {
  return state.projects.find(project => project.id === state.currentProjectId) || null;
}

function projectTransactions(projectId = state.currentProjectId) {
  return state.transactions.filter(transaction => transaction.projectId === projectId);
}

function projectMetrics(projectId = state.currentProjectId) {
  return projectFinanceMetrics(projectTransactions(projectId));
}

async function reloadData() {
  [state.projects, state.transactions] = await Promise.all([
    getAll('projects'),
    getAll('transactions')
  ]);

  state.projects.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  state.transactions.sort((a, b) =>
    `${b.date || ''}${b.createdAt || ''}`.localeCompare(`${a.date || ''}${a.createdAt || ''}`)
  );

  if (!state.projects.some(project => project.id === state.currentProjectId)) {
    state.currentProjectId = state.projects[0]?.id || null;
    await setSetting('currentProjectId', state.currentProjectId);
  }
}

function resolveLayout() {
  let layout = state.layoutMode;
  if (layout === 'auto') {
    const tabletOrLarger = window.matchMedia('(min-width: 700px)').matches;
    layout = tabletOrLarger ? 'desktop' : 'mobile';
  }
  state.effectiveLayout = layout;
  els.app.dataset.layout = layout;
}

function renderNav() {
  const html = navItems.map(([id, label, icon]) => `
    <button type="button" class="nav-button ${state.view === id ? 'active' : ''}" data-nav="${id}">
      <span class="nav-icon">${icon}</span><span>${label}</span>
    </button>`).join('');
  els.bottomNav.innerHTML = html;
}

function renderHeader() {
  els.projectNameHeader.textContent = currentProject()?.name || 'Belum ada proyek';
  els.settingsButton?.classList.toggle('active', state.view === 'settings');
}

function render() {
  resolveLayout();
  els.app.dataset.view = state.view;
  renderNav();
  renderHeader();

  if (!currentProject() && !['projects', 'settings'].includes(state.view)) {
    els.view.innerHTML = renderNoProject();
    bindViewEvents();
    return;
  }

  if (state.view === 'dashboard') els.view.innerHTML = renderDashboard();
  if (state.view === 'transactions') els.view.innerHTML = renderTransactions();
  if (state.view === 'projects') els.view.innerHTML = renderProjects();
  if (state.view === 'settings') els.view.innerHTML = renderSettings();
  bindViewEvents();
}

function renderNoProject() {
  return `
    <div class="page-head">
      <div><p class="eyebrow">Keuangan per proyek</p><h1>Mulai dari project</h1></div>
    </div>
    <div class="empty-state finance-empty">
      <div class="empty-icon">${icons.projects}</div>
      <h2>Belum ada project</h2>
      <p>Buat project dulu. Setelah itu catat setiap uang masuk dan uang keluar. Omzet dan untung/rugi dihitung otomatis.</p>
      <button class="primary-button accent" type="button" data-action="new-project">Buat project</button>
    </div>`;
}

function desktopDropdown(kind, label, options) {
  return `<div class="desktop-dropdown" data-desktop-dropdown="${kind}">
    <button class="desktop-dropdown-trigger" type="button" data-dropdown-toggle="${kind}">
      <span>${esc(label)}</span>${icons.chevron}
    </button>
    <div class="desktop-dropdown-menu" data-dropdown-menu="${kind}" hidden>
      ${options.map(option => `<button type="button" class="${option.active ? 'active' : ''}" data-desktop-filter-kind="${kind}" data-desktop-filter-value="${esc(option.value)}">${esc(option.label)}</button>`).join('')}
    </div>
  </div>`;
}

function runningBalances(rows) {
  const chronological = [...projectTransactions()].sort((a,b) => `${a.date}${a.createdAt || ''}`.localeCompare(`${b.date}${b.createdAt || ''}`));
  let balance = 0;
  const map = new Map();
  for (const transaction of chronological) {
    balance += transaction.type === 'income' ? Number(transaction.amount || 0) : -Number(transaction.amount || 0);
    map.set(transaction.id, balance);
  }
  return map;
}

function renderDashboard() {
  return state.effectiveLayout === 'desktop' ? renderDesktopDashboard() : renderMobileDashboard();
}

function renderMobileDashboard() {
  const metrics = projectMetrics();
  const transactions = projectTransactions();
  const recent = transactions.slice(0, 5);
  const spending = categoryTotals(transactions, 'expense').slice(0, 5);
  const resultClass = metrics.profitLoss > 0 ? 'profit' : metrics.profitLoss < 0 ? 'loss' : 'neutral';
  const resultLabel = metrics.profitLoss > 0 ? 'UNTUNG SEMENTARA' : metrics.profitLoss < 0 ? 'RUGI SEMENTARA' : 'UNTUNG / RUGI';

  return `
    <div class="dashboard-screen">
      <div class="page-head finance-page-head">
        <div><p class="eyebrow">Keuangan project</p><h1>Ringkasan</h1></div>
      </div>

      <section class="finance-hero ${resultClass}">
        <div class="finance-hero-top">
          <span>${resultLabel}</span>
          <span class="finance-hero-count">${metrics.transactionCount} transaksi</span>
        </div>
        <div class="finance-hero-value">${money(metrics.profitLoss)}</div>
        <div class="finance-hero-foot">
          <div><span>OMZET</span><strong>${money(metrics.omzet)}</strong></div>
          <div><span>PENGELUARAN</span><strong>${money(metrics.expense)}</strong></div>
        </div>
      </section>

      <div class="finance-kpi-grid">
        <article class="finance-kpi income">
          <span class="finance-kpi-icon">${icons.income}</span>
          <div><span>Omzet</span><strong>${money(metrics.omzet)}</strong><small>${metrics.incomeCount} uang masuk</small></div>
        </article>
        <article class="finance-kpi expense">
          <span class="finance-kpi-icon">${icons.expense}</span>
          <div><span>Pengeluaran</span><strong>${money(metrics.expense)}</strong><small>${metrics.expenseCount} uang keluar</small></div>
        </article>
      </div>

      <div class="cash-action-grid">
        <button class="cash-action income" type="button" data-action="new-income">
          <span class="cash-action-icon">${icons.income}</span>
          <span><strong>Uang Masuk</strong><small>Catat pembayaran project</small></span>
        </button>
        <button class="cash-action expense" type="button" data-action="new-expense">
          <span class="cash-action-icon">${icons.expense}</span>
          <span><strong>Uang Keluar</strong><small>Catat biaya project</small></span>
        </button>
      </div>

      <div class="dashboard-columns finance-columns">
        <section class="section">
          <div class="section-head">
            <h2>Transaksi terbaru</h2>
            ${recent.length ? '<button class="text-button" data-nav="transactions" type="button">Lihat semua</button>' : ''}
          </div>
          ${recent.length
            ? `<div class="card-list finance-transaction-list">${recent.map(renderTransactionCard).join('')}</div>`
            : `<div class="empty-state compact-empty"><div class="empty-icon">${icons.wallet}</div><h2>Belum ada transaksi</h2><p>Mulai dari Uang Masuk atau Uang Keluar di atas.</p></div>`
          }
        </section>
        <section class="section">
          <div class="section-head"><h2>Pengeluaran terbesar</h2></div>
          ${renderSpendingList(spending, metrics.expense)}
        </section>
      </div>
    </div>`;
}

function renderDesktopDashboard() {
  const metrics = projectMetrics();
  const transactions = projectTransactions();
  const recent = transactions.slice(0, 4);
  const spending = categoryTotals(transactions, 'expense').slice(0, 4);
  const resultClass = metrics.profitLoss > 0 ? 'profit' : metrics.profitLoss < 0 ? 'loss' : 'neutral';
  const resultLabel = metrics.profitLoss > 0 ? 'UNTUNG SEMENTARA' : metrics.profitLoss < 0 ? 'RUGI SEMENTARA' : 'UNTUNG / RUGI';
  const filtered = filteredProjectTransactions();

  return `
    <div class="desktop-reference dashboard-reference">
      <div class="desktop-page-title"><p>KEUANGAN PROJECT</p><h1>Ringkasan</h1></div>

      <div class="desktop-summary-grid">
        <section class="finance-hero desktop-hero ${resultClass}">
          <div class="finance-hero-top"><span>${resultLabel}</span><span class="finance-hero-count">${metrics.transactionCount} transaksi</span></div>
          <div class="finance-hero-value">${money(metrics.profitLoss)}</div>
          <div class="finance-hero-foot">
            <div><span>OMZET</span><strong>${money(metrics.omzet)}</strong></div>
            <div><span>PENGELUARAN</span><strong>${money(metrics.expense)}</strong></div>
          </div>
        </section>

        <div class="desktop-kpi-actions">
          <article class="finance-kpi income"><span class="finance-kpi-icon">${icons.income}</span><div><span>OMZET</span><strong>${money(metrics.omzet)}</strong><small>${metrics.incomeCount} uang masuk</small></div></article>
          <article class="finance-kpi expense"><span class="finance-kpi-icon">${icons.expense}</span><div><span>PENGELUARAN</span><strong>${money(metrics.expense)}</strong><small>${metrics.expenseCount} uang keluar</small></div></article>
          <div class="desktop-action-pair">
            <button class="cash-action income" type="button" data-action="new-income"><span class="cash-action-icon">${icons.income}</span><strong>Uang Masuk</strong></button>
            <button class="cash-action expense" type="button" data-action="new-expense"><span class="cash-action-icon">${icons.expense}</span><strong>Uang Keluar</strong></button>
          </div>
        </div>
      </div>

      <div class="desktop-secondary-grid">
        <section class="desktop-panel">
          <div class="section-head"><h2>Transaksi terbaru</h2><button class="text-button" data-nav="transactions" type="button">Lihat semua →</button></div>
          ${recent.length
            ? `<div class="desktop-recent-list">${recent.map(renderCompactTransaction).join('')}</div>`
            : `<div class="desktop-empty"><div class="empty-icon">${icons.wallet}</div><strong>Belum ada transaksi</strong><span>Mulai dari Uang Masuk atau Uang Keluar di atas</span></div>`
          }
        </section>
        <section class="desktop-panel">
          <div class="section-head"><h2>Pengeluaran terbesar</h2></div>
          ${spending.length
            ? renderSpendingList(spending, metrics.expense)
            : `<div class="desktop-empty"><div class="empty-icon muted-icon">${icons.sort}</div><strong>Belum ada pengeluaran</strong><span>Belum ada uang keluar di project ini.</span></div>`
          }
        </section>
      </div>

      <section class="desktop-all-transactions">
        <div class="desktop-all-head">
          <h2>Semua Transaksi</h2>
          <div class="desktop-inline-tools">
            <div class="search-field desktop-search">${icons.search}<input id="transactionSearch" type="search" autocomplete="off" placeholder="Cari keterangan atau kategori..." value="${esc(state.search)}"></div>
            <div class="segmented desktop-type-filter">
              <button class="${state.flowFilter === 'all' ? 'active' : ''}" data-flow-filter="all" type="button">Semua</button>
              <button class="${state.flowFilter === 'income' ? 'active income' : ''}" data-flow-filter="income" type="button">Masuk</button>
              <button class="${state.flowFilter === 'expense' ? 'active expense' : ''}" data-flow-filter="expense" type="button">Keluar</button>
            </div>
            ${desktopDropdown('category', state.categoryFilter === 'all' ? 'Filter' : state.categoryFilter, [
              {value:'all',label:'Semua Kategori',active:state.categoryFilter==='all'},
              ...[...new Set(transactions.map(t => t.category || 'Lainnya'))].sort((a,b)=>a.localeCompare(b,'id')).map(category => ({value:category,label:category,active:state.categoryFilter===category}))
            ])}
          </div>
        </div>
        ${renderDesktopTransactionTable(filtered, { showBalance: true })}
      </section>
    </div>`;
}

function renderSpendingList(spending, totalExpense) {
  if (!spending.length) return `<div class="empty-state compact-empty"><p>Belum ada uang keluar di project ini.</p></div>`;
  return `<div class="category-spend-list">${spending.map(item => {
    const pct = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
    return `<div class="category-spend"><div><strong>${esc(item.category)}</strong><span>${pct}% dari pengeluaran</span></div><strong>${money(item.amount)}</strong><div class="category-spend-track"><i style="width:${Math.min(pct,100)}%"></i></div></div>`;
  }).join('')}</div>`;
}

function renderCompactTransaction(transaction) {
  const incoming = transaction.type === 'income';
  return `<button class="compact-transaction" type="button" data-action="transaction-menu" data-id="${transaction.id}">
    <span class="compact-flow-icon ${incoming ? 'income' : 'expense'}">${incoming ? icons.income : icons.expense}</span>
    <span><strong>${esc(transaction.description)}</strong><small>${formatDate(transaction.date)} · ${esc(transaction.category || 'Lainnya')}</small></span>
    <strong class="${incoming ? 'income-text' : 'expense-text'}">${incoming ? '+' : '−'}${money(transaction.amount)}</strong>
  </button>`;
}

function filteredProjectTransactions() {
  const query = state.search.trim().toLocaleLowerCase('id');
  const from = state.dateFrom || '';
  const to = state.dateTo || '';
  let rows = projectTransactions().filter(transaction => {
    const matchesType = state.flowFilter === 'all' || transaction.type === state.flowFilter;
    const matchesCategory = state.categoryFilter === 'all' || transaction.category === state.categoryFilter;
    const haystack = `${transaction.description || ''} ${transaction.category || ''}`.toLocaleLowerCase('id');
    const matchesSearch = !query || haystack.includes(query);
    const matchesFrom = !from || transaction.date >= from;
    const matchesTo = !to || transaction.date <= to;
    return matchesType && matchesCategory && matchesSearch && matchesFrom && matchesTo;
  });
  if (state.sortOrder === 'oldest') rows = [...rows].sort((a,b) => `${a.date}${a.createdAt || ''}`.localeCompare(`${b.date}${b.createdAt || ''}`));
  return rows;
}

function renderDesktopTransactionTable(rows, options = {}) {
  const showProjectColumn = Boolean(options.showProjectColumn);
  const showBalance = Boolean(options.showBalance);
  const balances = showBalance ? runningBalances(rows) : new Map();
  const colsClass = [showProjectColumn ? 'with-project' : '', showBalance ? 'with-balance' : ''].filter(Boolean).join(' ');

  if (!rows.length) {
    return `<div class="desktop-table-shell">
      <div class="desktop-table-head ${colsClass}">
        <span>Tanggal</span><span>Keterangan</span><span>Kategori</span>${showProjectColumn ? '<span>Project</span>' : ''}<span>Jenis</span><span>Jumlah</span>${showBalance ? '<span>Saldo</span>' : ''}<span>Aksi</span>
      </div>
      <div class="desktop-table-empty"><div class="empty-icon muted-icon">${icons.transactions}</div><strong>Belum ada transaksi</strong><span>Transaksi yang kamu buat akan muncul di sini.</span></div>
    </div>`;
  }

  return `<div class="desktop-table-shell">
    <div class="desktop-table-head ${colsClass}">
      <span>Tanggal</span><span>Keterangan</span><span>Kategori</span>${showProjectColumn ? '<span>Project</span>' : ''}<span>Jenis</span><span>Jumlah</span>${showBalance ? '<span>Saldo</span>' : ''}<span>Aksi</span>
    </div>
    <div class="desktop-table-body">
      ${rows.map(transaction => {
        const incoming = transaction.type === 'income';
        return `<div class="desktop-table-row ${colsClass}">
          <span>${formatDate(transaction.date)}</span>
          <strong>${esc(transaction.description)}</strong>
          <span>${esc(transaction.category || 'Lainnya')}</span>
          ${showProjectColumn ? `<span>${esc(currentProject()?.name || '—')}</span>` : ''}
          <span><i class="table-type ${incoming ? 'income' : 'expense'}">${incoming ? 'Masuk' : 'Keluar'}</i></span>
          <strong class="${incoming ? 'income-text' : 'expense-text'}">${incoming ? '+' : '−'}${money(transaction.amount)}</strong>
          ${showBalance ? `<strong>${money(balances.get(transaction.id) || 0)}</strong>` : ''}
          <button class="menu-button table-menu" type="button" data-action="transaction-menu" data-id="${transaction.id}" aria-label="Aksi transaksi">${icons.more}</button>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderTransactions() {
  return state.effectiveLayout === 'desktop' ? renderDesktopTransactions() : renderMobileTransactions();
}

function renderMobileTransactions() {
  const all = projectTransactions();
  const filtered = filteredProjectTransactions();
  const metrics = projectMetrics();
  return `
    <div class="page-head"><div><p class="eyebrow">Keluar masuk duit</p><h1>Transaksi</h1></div></div>
    <div class="transaction-mini-summary">
      <div class="mini-summary income"><span>Masuk</span><strong>${money(metrics.omzet)}</strong></div>
      <div class="mini-summary expense"><span>Keluar</span><strong>${money(metrics.expense)}</strong></div>
      <div class="mini-summary result ${metrics.profitLoss < 0 ? 'loss' : ''}"><span>Selisih</span><strong>${money(metrics.profitLoss)}</strong></div>
    </div>
    <div class="toolbar finance-toolbar">
      <div class="search-field">${icons.search}<input id="transactionSearch" type="search" autocomplete="off" placeholder="Cari keterangan atau kategori" value="${esc(state.search)}"></div>
      <div class="segmented finance-filter">
        <button class="${state.flowFilter === 'all' ? 'active' : ''}" data-flow-filter="all" type="button">Semua</button>
        <button class="${state.flowFilter === 'income' ? 'active income' : ''}" data-flow-filter="income" type="button">Masuk</button>
        <button class="${state.flowFilter === 'expense' ? 'active expense' : ''}" data-flow-filter="expense" type="button">Keluar</button>
      </div>
    </div>
    ${filtered.length
      ? `<div class="card-list finance-transaction-list">${filtered.map(renderTransactionCard).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">${icons.transactions}</div><h2>${all.length ? 'Transaksi nggak ditemukan' : 'Belum ada transaksi'}</h2><p>${all.length ? 'Coba kata pencarian atau filter lain.' : 'Catat uang masuk dan uang keluar supaya kondisi keuangan project langsung terlihat.'}</p></div>`
    }
    <div class="mobile-cash-actions">
      <button class="primary-button income-button" type="button" data-action="new-income">+ Uang Masuk</button>
      <button class="primary-button expense-button" type="button" data-action="new-expense">− Uang Keluar</button>
    </div>`;
}

function renderDesktopTransactions() {
  const metrics = projectMetrics();
  const rows = filteredProjectTransactions();
  const categories = [...new Set(projectTransactions().map(t => t.category || 'Lainnya'))].sort((a,b)=>a.localeCompare(b,'id'));

  const typeLabel = state.flowFilter === 'income' ? 'Masuk' : state.flowFilter === 'expense' ? 'Keluar' : 'Semua';
  const categoryLabel = state.categoryFilter === 'all' ? 'Semua Kategori' : state.categoryFilter;
  const sortLabel = state.sortOrder === 'oldest' ? 'Terlama' : 'Terbaru';

  return `
    <div class="desktop-reference transactions-reference">
      <div class="desktop-transactions-top">
        <div class="desktop-page-title"><p>KELUAR MASUK DUIT</p><h1>Transaksi</h1></div>
        <div class="desktop-search-filters">
          <div class="search-field desktop-search">${icons.search}<input id="transactionSearch" type="search" autocomplete="off" placeholder="Cari keterangan atau kategori" value="${esc(state.search)}"></div>
          ${desktopDropdown('type', typeLabel, [
            {value:'all',label:'Semua',active:state.flowFilter==='all'},
            {value:'income',label:'Masuk',active:state.flowFilter==='income'},
            {value:'expense',label:'Keluar',active:state.flowFilter==='expense'}
          ])}
          <div class="desktop-date-stack">
            <input type="hidden" id="dateFrom" value="${esc(state.dateFrom)}">
            <button class="desktop-date-button" type="button" data-date-picker data-target="dateFrom">${icons.calendar}<span data-picker-value>${state.dateFrom ? formatDate(state.dateFrom) : 'Dari tanggal'}</span></button>
            <input type="hidden" id="dateTo" value="${esc(state.dateTo)}">
            <button class="desktop-date-button" type="button" data-date-picker data-target="dateTo">${icons.calendar}<span data-picker-value>${state.dateTo ? formatDate(state.dateTo) : 'Sampai tanggal'}</span></button>
          </div>
        </div>
      </div>

      <div class="desktop-metrics-row">
        <article class="desktop-metric income"><span>MASUK</span><strong>${money(metrics.omzet)}</strong></article>
        <article class="desktop-metric expense"><span>KELUAR</span><strong>${money(metrics.expense)}</strong></article>
        <article class="desktop-metric"><span>SELISIH</span><strong>${money(metrics.profitLoss)}</strong></article>
      </div>

      <div class="desktop-transaction-controls">
        <div class="segmented desktop-three-filter">
          <button class="${state.flowFilter==='all'?'active':''}" data-flow-filter="all" type="button">Semua</button>
          <button class="${state.flowFilter==='income'?'active income':''}" data-flow-filter="income" type="button">Masuk</button>
          <button class="${state.flowFilter==='expense'?'active expense':''}" data-flow-filter="expense" type="button">Keluar</button>
        </div>
        ${desktopDropdown('category', categoryLabel, [
          {value:'all',label:'Semua Kategori',active:state.categoryFilter==='all'},
          ...categories.map(category => ({value:category,label:category,active:state.categoryFilter===category}))
        ])}
        ${desktopDropdown('sort', sortLabel, [
          {value:'newest',label:'Terbaru',active:state.sortOrder==='newest'},
          {value:'oldest',label:'Terlama',active:state.sortOrder==='oldest'}
        ])}
        <div class="desktop-action-buttons">
          <button class="desktop-income-button" type="button" data-action="new-income">＋ Uang Masuk</button>
          <button class="desktop-expense-button" type="button" data-action="new-expense">− Uang Keluar</button>
        </div>
      </div>

      ${renderDesktopTransactionTable(rows)}
    </div>`;
}

function renderTransactionCard(transaction) {
  const incoming = transaction.type === 'income';
  return `
    <article class="finance-transaction-card ${incoming ? 'income' : 'expense'}">
      <div class="finance-transaction-sign">${incoming ? icons.income : icons.expense}</div>
      <div class="finance-transaction-main">
        <div class="finance-transaction-top">
          <div>
            <span class="flow-badge ${incoming ? 'income' : 'expense'}">${incoming ? 'Uang Masuk' : 'Uang Keluar'}</span>
            <strong>${esc(transaction.description)}</strong>
          </div>
          <strong class="finance-amount ${incoming ? 'income' : 'expense'}">${incoming ? '+' : '−'}${money(transaction.amount)}</strong>
        </div>
        <div class="finance-transaction-meta">
          <span>${esc(transaction.category || 'Lainnya')}</span>
          <span>•</span>
          <span>${formatDate(transaction.date)}</span>
        </div>
      </div>
      <button class="menu-button" type="button" data-action="transaction-menu" data-id="${transaction.id}" aria-label="Aksi transaksi">${icons.more}</button>
    </article>
  `;
}

function renderProjects() {
  return `
    <div class="page-head">
      <div><p class="eyebrow">Semua project</p><h1>Proyek</h1></div>
    </div>

    ${state.projects.length
      ? `<div class="project-finance-list">${state.projects.map(project => {
          const metrics = projectMetrics(project.id);
          const active = project.id === state.currentProjectId;
          return `<article class="project-finance-card ${active ? 'active' : ''}">
            <button class="project-finance-select" type="button" data-project-select="${project.id}">
              <div class="project-finance-head">
                <div>
                  <span class="project-status ${project.status === 'done' ? 'done' : ''}">${project.status === 'done' ? 'Selesai' : 'Aktif'}</span>
                  <strong>${esc(project.name)}</strong>
                  <small>Mulai ${formatDate(project.startDate)}</small>
                </div>
                <span class="project-open">${active ? 'Dipakai' : 'Buka'} ${icons.chevron}</span>
              </div>
              <div class="project-finance-metrics">
                <div><span>Omzet</span><strong>${money(metrics.omzet)}</strong></div>
                <div><span>Keluar</span><strong>${money(metrics.expense)}</strong></div>
                <div class="${metrics.profitLoss < 0 ? 'loss' : 'profit'}"><span>${metrics.profitLoss < 0 ? 'Rugi' : 'Untung'}</span><strong>${money(Math.abs(metrics.profitLoss))}</strong></div>
              </div>
            </button>
            <button class="project-menu-button" type="button" data-action="project-menu" data-id="${project.id}" aria-label="Aksi project">${icons.more}</button>
          </article>`;
        }).join('')}</div>`
      : `<div class="empty-state finance-empty">
          <div class="empty-icon">${icons.projects}</div>
          <h2>Belum ada project</h2>
          <p>Buat project untuk mulai memisahkan data keuangan satu pekerjaan dengan pekerjaan lainnya.</p>
        </div>`
    }

    <div class="page-bottom-action project-new-action">
      <button class="primary-button accent" data-action="new-project" type="button">+ Project baru</button>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="page-head"><div><p class="eyebrow">Aplikasi</p><h1>Pengaturan</h1></div></div>

    <section class="setting-card">
      <h3>Mode tampilan</h3>
      <p class="caption">Otomatis menyesuaikan tampilan dengan perangkat yang digunakan.</p>
      <div class="segmented" data-layout-control>
        <button class="${state.layoutMode === 'auto' ? 'active' : ''}" data-layout-mode="auto" type="button">Otomatis</button>
        <button class="${state.layoutMode === 'mobile' ? 'active' : ''}" data-layout-mode="mobile" type="button">Mobile</button>
        <button class="${state.layoutMode === 'desktop' ? 'active' : ''}" data-layout-mode="desktop" type="button">PC</button>
      </div>
    </section>

    <section class="setting-card">
      <h3>Backup data</h3>
      <p class="caption">Backup menyimpan project dan seluruh transaksi ke satu file. Data RAB lama dari versi sebelumnya juga ikut diamankan sebagai arsip.</p>
      <div class="data-actions">
        <button class="primary-button" data-action="backup-data" type="button">Buat backup</button>
        <button class="secondary-button" data-action="restore-data" type="button">Pulihkan backup</button>
      </div>
    </section>

    ${currentProject() ? `
      <section class="setting-card">
        <h3>Project aktif</h3>
        <div class="info-row"><span>Nama</span><strong>${esc(currentProject().name)}</strong></div>
        <div class="info-row"><span>Mulai</span><strong>${formatDate(currentProject().startDate)}</strong></div>
        <button class="secondary-button" style="margin-top:12px" data-action="edit-project" type="button">Ubah project</button>
      </section>` : ''}

    <p class="caption app-version">ANGGARAN v0.8 · Keuangan Project · Offline-first</p>
  `;
}

function bindViewEvents() {
  els.view.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleAction));
  bindPickerButtons(els.view);
  els.view.querySelectorAll('[data-nav]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.nav)));

  els.view.querySelectorAll('[data-flow-filter]').forEach(button => button.addEventListener('click', () => {
    state.flowFilter = button.dataset.flowFilter;
    render();
  }));

  els.view.querySelectorAll('[data-layout-mode]').forEach(button => button.addEventListener('click', async () => {
    state.layoutMode = button.dataset.layoutMode;
    await setSetting('layoutMode', state.layoutMode);
    render();
    toast(`Mode tampilan: ${state.layoutMode === 'auto' ? 'Otomatis' : state.layoutMode === 'desktop' ? 'PC' : 'Mobile'}`);
  }));

  els.view.querySelectorAll('[data-project-select]').forEach(button => button.addEventListener('click', async () => {
    state.currentProjectId = button.dataset.projectSelect;
    await setSetting('currentProjectId', state.currentProjectId);
    state.view = 'dashboard';
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }));

  els.view.querySelectorAll('[data-dropdown-toggle]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const kind = button.dataset.dropdownToggle;
    const menu = els.view.querySelector(`[data-dropdown-menu="${kind}"]`);
    els.view.querySelectorAll('[data-dropdown-menu]').forEach(other => {
      if (other !== menu) other.hidden = true;
    });
    if (menu) menu.hidden = !menu.hidden;
  }));

  els.view.querySelectorAll('[data-desktop-filter-kind]').forEach(button => button.addEventListener('click', () => {
    const kind = button.dataset.desktopFilterKind;
    const value = button.dataset.desktopFilterValue;
    if (kind === 'type') state.flowFilter = value;
    if (kind === 'category') state.categoryFilter = value;
    if (kind === 'sort') state.sortOrder = value;
    render();
  }));

  const dateFrom = document.getElementById('dateFrom');
  if (dateFrom) dateFrom.addEventListener('change', () => {
    state.dateFrom = dateFrom.value;
    render();
  });
  const dateTo = document.getElementById('dateTo');
  if (dateTo) dateTo.addEventListener('change', () => {
    state.dateTo = dateTo.value;
    render();
  });

  const search = document.getElementById('transactionSearch');
  if (search) {
    search.addEventListener('input', event => {
      const start = event.target.selectionStart;
      state.search = event.target.value;
      render();
      requestAnimationFrame(() => {
        const next = document.getElementById('transactionSearch');
        if (next) {
          next.focus({ preventScroll: true });
          next.setSelectionRange(start, start);
        }
      });
    });
  }
}

function navigate(view) {
  state.view = view;
  state.search = '';
  if (view !== 'transactions') state.flowFilter = 'all';
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

async function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;

  if (action === 'new-project') openProjectForm();
  if (action === 'edit-project') openProjectForm(currentProject());
  if (action === 'project-menu') openProjectMenu(id);
  if (action === 'new-income') openTransactionForm('income');
  if (action === 'new-expense') openTransactionForm('expense');
  if (action === 'transaction-chooser') openTransactionChooser();
  if (action === 'transaction-menu') openTransactionMenu(id);
  if (action === 'backup-data') createBackupFile();
  if (action === 'restore-data') chooseBackupFile();
}

let lockedScrollY = 0;

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const offsetTop = viewport?.offsetTop || 0;
  document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(height)}px`);
  document.documentElement.style.setProperty('--app-viewport-top', `${Math.round(offsetTop)}px`);
}

function lockDocumentScroll() {
  if (document.body.classList.contains('modal-open')) return;
  lockedScrollY = window.scrollY || 0;
  document.body.classList.add('modal-open');
  document.body.style.top = `-${lockedScrollY}px`;
  syncVisualViewport();
}

function unlockDocumentScroll() {
  if (!document.body.classList.contains('modal-open')) return;
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo(0, lockedScrollY);
}

function overlayHistoryDepth() {
  return Number(history.state?.anggaranOverlayDepth) || 0;
}

function pushOverlayHistory(depth) {
  if (overlayHistoryDepth() >= depth) return;
  history.pushState({ ...(history.state || {}), anggaranOverlayDepth: depth }, '');
}

function closeSubOverlay({ fromHistory = false } = {}) {
  const sub = els.overlayRoot.querySelector('[data-sub-overlay]');
  if (!sub) return;
  if (!fromHistory && overlayHistoryDepth() >= 2) {
    history.back();
    return;
  }
  sub.remove();
}

function openSheet(title, content) {
  const hadMainOverlay = Boolean(els.overlayRoot.querySelector('[data-overlay]'));
  els.overlayRoot.innerHTML = `
    <div class="overlay" data-overlay>
      <section class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-head">
          <div class="sheet-title">${esc(title)}</div>
          <button class="sheet-close" type="button" data-close aria-label="Tutup">${icons.close}</button>
        </div>
        <div class="sheet-body">${content}</div>
      </section>
    </div>`;

  if (!hadMainOverlay) pushOverlayHistory(1);
  lockDocumentScroll();

  const overlay = els.overlayRoot.querySelector('[data-overlay]');
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeOverlay();
  });
  els.overlayRoot.querySelector('[data-close]').addEventListener('click', () => closeOverlay());

  bindNumberInputs(els.overlayRoot);
  bindPickerButtons(els.overlayRoot);
  bindFormUX(els.overlayRoot);
}

function openSubSheet(title, content) {
  els.overlayRoot.querySelector('[data-sub-overlay]')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'overlay sub-overlay';
  overlay.dataset.subOverlay = '';
  overlay.innerHTML = `
    <section class="sheet sub-sheet" role="dialog" aria-modal="true">
      <div class="sheet-head">
        <div class="sheet-title">${esc(title)}</div>
        <button class="sheet-close" type="button" data-sub-close aria-label="Tutup">${icons.close}</button>
      </div>
      <div class="sheet-body">${content}</div>
    </section>`;

  els.overlayRoot.appendChild(overlay);
  pushOverlayHistory(2);

  const close = () => closeSubOverlay();
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-sub-close]').addEventListener('click', close);
  bindFormUX(overlay);
  return { overlay, close };
}

function openConfirm(title, message, confirmLabel, onConfirm) {
  const hadMainOverlay = Boolean(els.overlayRoot.querySelector('[data-overlay]'));
  els.overlayRoot.innerHTML = `
    <div class="overlay" data-overlay>
      <section class="confirm-panel" role="alertdialog" aria-modal="true">
        <h2>${esc(title)}</h2>
        <p>${esc(message)}</p>
        <div class="confirm-actions">
          <button class="secondary-button" type="button" data-cancel>Batal</button>
          <button class="danger-button" type="button" data-confirm>${esc(confirmLabel)}</button>
        </div>
      </section>
    </div>`;

  if (!hadMainOverlay) pushOverlayHistory(1);
  lockDocumentScroll();

  els.overlayRoot.querySelector('[data-cancel]').addEventListener('click', () => closeOverlay());
  els.overlayRoot.querySelector('[data-confirm]').addEventListener('click', onConfirm);
}

function onEsc(event) {
  if (event.key !== 'Escape') return;
  if (els.overlayRoot.querySelector('[data-sub-overlay]')) closeSubOverlay();
  else if (els.overlayRoot.querySelector('[data-overlay]')) closeOverlay();
}

function closeOverlay({ fromHistory = false } = {}) {
  if (!els.overlayRoot.querySelector('[data-overlay]')) return;
  if (!fromHistory && overlayHistoryDepth() >= 1) {
    history.back();
    return;
  }
  els.overlayRoot.innerHTML = '';
  unlockDocumentScroll();
}

function showFormError(form, message, target = null) {
  form.querySelector('[data-form-error]')?.remove();
  form.querySelectorAll('[aria-invalid="true"]').forEach(element => element.removeAttribute('aria-invalid'));

  const panel = document.createElement('div');
  panel.className = 'form-error';
  panel.dataset.formError = '';
  panel.setAttribute('role', 'alert');
  panel.textContent = message;
  form.prepend(panel);

  if (target) {
    target.setAttribute('aria-invalid', 'true');
    requestAnimationFrame(() => target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }));
  }
}

function clearFormError(form) {
  form.querySelector('[data-form-error]')?.remove();
  form.querySelectorAll('[aria-invalid="true"]').forEach(element => element.removeAttribute('aria-invalid'));
}

function bindFormUX(root) {
  root.querySelectorAll('form').forEach(form => {
    form.addEventListener('input', () => clearFormError(form));
    form.addEventListener('change', () => clearFormError(form));
  });
}

function openProjectChooser() {
  const rows = state.projects.map(project => {
    const metrics = projectMetrics(project.id);
    return `
      <button class="project-row ${project.id === state.currentProjectId ? 'active' : ''}" data-project-id="${project.id}" type="button">
        <div class="project-row-main">
          <strong>${esc(project.name)}</strong>
          <span>${money(metrics.omzet)} omzet · ${money(metrics.profitLoss)} selisih</span>
        </div>
        ${project.id === state.currentProjectId ? '<span class="dot-active"></span>' : ''}
      </button>`;
  }).join('');

  openSheet('Pilih project', `
    <div class="project-list">${rows || '<p class="caption">Belum ada project.</p>'}</div>
    <button class="primary-button accent" data-new-project type="button">+ Project baru</button>
  `);

  els.overlayRoot.querySelectorAll('[data-project-id]').forEach(button => button.addEventListener('click', async () => {
    state.currentProjectId = button.dataset.projectId;
    await setSetting('currentProjectId', state.currentProjectId);
    closeOverlay();
    render();
  }));

  els.overlayRoot.querySelector('[data-new-project]').addEventListener('click', () => openProjectForm());
}

function openProjectForm(project = null) {
  openSheet(project ? 'Ubah project' : 'Project baru', `
    <form id="projectForm" class="form-grid" novalidate>
      <div class="field">
        <label for="projectName">Nama project</label>
        <input class="input" id="projectName" name="name" maxlength="80" autocomplete="off" placeholder="Contoh: Renovasi Rumah" value="${project ? esc(project.name) : ''}">
      </div>

      <div class="field">
        <label>Tanggal mulai</label>
        <input type="hidden" id="projectDate" name="startDate" value="${project?.startDate || isoToday()}">
        <button class="picker-button" type="button" data-date-picker data-target="projectDate">
          <span class="picker-icon">${icons.calendar}</span>
          <span data-picker-value>${formatDate(project?.startDate || isoToday())}</span>
          <span class="picker-chevron">${icons.chevron}</span>
        </button>
      </div>

      <div class="field">
        <label>Status</label>
        <div class="segmented" id="projectStatus">
          <button type="button" data-status="active" class="${!project || project.status === 'active' ? 'active' : ''}">Aktif</button>
          <button type="button" data-status="done" class="${project?.status === 'done' ? 'active' : ''}">Selesai</button>
        </div>
      </div>

      <div class="sheet-actions">
        <button class="primary-button" type="submit">${project ? 'Simpan perubahan' : 'Buat project'}</button>
      </div>
    </form>
  `);

  let status = project?.status || 'active';
  els.overlayRoot.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
    status = button.dataset.status;
    els.overlayRoot.querySelectorAll('[data-status]').forEach(item => item.classList.toggle('active', item === button));
  }));

  document.getElementById('projectForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();

    if (!name) return showFormError(form, 'Nama project wajib diisi.', document.getElementById('projectName'));

    const now = new Date().toISOString();
    const value = {
      id: project?.id || uid('prj'),
      name,
      startDate: String(fd.get('startDate') || isoToday()),
      status,
      createdAt: project?.createdAt || now,
      updatedAt: now
    };

    await put('projects', value);
    state.currentProjectId = value.id;
    await setSetting('currentProjectId', value.id);
    await reloadData();
    closeOverlay();
    state.view = 'dashboard';
    render();
    toast(project ? 'Project diperbarui.' : 'Project dibuat.');
  });
}

function openProjectMenu(id) {
  const project = state.projects.find(item => item.id === id);
  if (!project) return;

  openSheet(project.name, `
    <div class="option-list">
      <button class="option-row" type="button" data-open>
        <div><strong>Buka project</strong><span>Lihat ringkasan keuangan project ini</span></div>
        <span class="option-check"></span>
      </button>
      <button class="option-row" type="button" data-edit>
        <div><strong>Ubah project</strong><span>Nama, tanggal mulai, atau status</span></div>
      </button>
      <button class="option-row" type="button" data-delete>
        <div><strong class="danger-text">Hapus project</strong><span>Seluruh transaksi project ini ikut terhapus</span></div>
      </button>
    </div>
  `);

  els.overlayRoot.querySelector('[data-open]').addEventListener('click', async () => {
    state.currentProjectId = project.id;
    await setSetting('currentProjectId', project.id);
    closeOverlay();
    state.view = 'dashboard';
    render();
  });

  els.overlayRoot.querySelector('[data-edit]').addEventListener('click', () => openProjectForm(project));

  els.overlayRoot.querySelector('[data-delete]').addEventListener('click', () => {
    openConfirm(
      'Hapus project?',
      `${project.name} dan seluruh transaksi keuangannya akan dihapus. Data RAB lama yang terkait juga ikut dihapus.`,
      'Hapus',
      async () => {
        await deleteProjectCascade(project.id);
        await reloadData();
        closeOverlay();
        state.view = state.projects.length ? 'dashboard' : 'projects';
        render();
        toast('Project dihapus.');
      }
    );
  });
}

function openTransactionChooser() {
  if (!currentProject()) return openProjectForm();

  openSheet('Catat transaksi', `
    <div class="cash-choice-grid">
      <button class="cash-choice income" type="button" data-income>
        <span class="cash-choice-icon">${icons.income}</span>
        <strong>Uang Masuk</strong>
        <span>Pembayaran, DP, termin, atau pemasukan project</span>
      </button>
      <button class="cash-choice expense" type="button" data-expense>
        <span class="cash-choice-icon">${icons.expense}</span>
        <strong>Uang Keluar</strong>
        <span>Material, upah, transport, dan biaya project</span>
      </button>
    </div>
  `);

  els.overlayRoot.querySelector('[data-income]').addEventListener('click', () => openTransactionForm('income'));
  els.overlayRoot.querySelector('[data-expense]').addEventListener('click', () => openTransactionForm('expense'));
}

function categoryChoices(type, selected) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.map(category => `
    <button type="button" class="category-choice ${category === selected ? 'active' : ''}" data-category="${esc(category)}">
      ${esc(category)}
    </button>`).join('');
}

function openTransactionForm(initialType = 'income', transaction = null) {
  if (!currentProject()) return openProjectForm();

  let type = transaction?.type || initialType;
  let category = transaction?.category || (type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);

  openSheet(transaction ? 'Ubah transaksi' : type === 'income' ? 'Catat uang masuk' : 'Catat uang keluar', `
    <form id="transactionForm" class="form-grid finance-form" novalidate>
      <div class="field">
        <label>Jenis transaksi</label>
        <div class="segmented transaction-type-control">
          <button type="button" data-transaction-type="income" class="${type === 'income' ? 'active income' : ''}">Uang Masuk</button>
          <button type="button" data-transaction-type="expense" class="${type === 'expense' ? 'active expense' : ''}">Uang Keluar</button>
        </div>
      </div>

      <div class="field amount-field">
        <label for="transactionAmount">Nominal</label>
        <div class="input-prefix amount-input">
          <span>Rp</span>
          <input class="input" id="transactionAmount" name="amount" inputmode="numeric" data-number-mode="integer" autocomplete="off" placeholder="0" value="${formatNumberInputValue(transaction?.amount)}">
        </div>
      </div>

      <div class="field">
        <label for="transactionDescription">Keterangan</label>
        <input class="input" id="transactionDescription" name="description" maxlength="100" autocomplete="off" placeholder="${type === 'income' ? 'Contoh: Termin 1 dari klien' : 'Contoh: Beli semen'}" value="${transaction ? esc(transaction.description) : ''}">
      </div>

      <div class="field">
        <label>Kategori</label>
        <div class="category-choice-grid" data-category-choices>${categoryChoices(type, category)}</div>
      </div>

      <div class="field">
        <label>Tanggal</label>
        <input type="hidden" id="transactionDate" name="date" value="${transaction?.date || isoToday()}">
        <button class="picker-button" type="button" data-date-picker data-target="transactionDate">
          <span class="picker-icon">${icons.calendar}</span>
          <span data-picker-value>${formatDate(transaction?.date || isoToday())}</span>
          <span class="picker-chevron">${icons.chevron}</span>
        </button>
      </div>

      <div class="transaction-preview ${type}" data-transaction-preview>
        <span>${type === 'income' ? 'Uang masuk project' : 'Uang keluar project'}</span>
        <strong>${money(transaction?.amount || 0)}</strong>
      </div>

      <div class="sheet-actions">
        <button class="primary-button ${type === 'income' ? 'income-button' : 'expense-button'}" type="submit" data-submit-transaction>
          ${transaction ? 'Simpan perubahan' : type === 'income' ? 'Simpan uang masuk' : 'Simpan uang keluar'}
        </button>
      </div>
    </form>
  `);

  const form = document.getElementById('transactionForm');
  const amountInput = document.getElementById('transactionAmount');
  const descriptionInput = document.getElementById('transactionDescription');
  const categoryRoot = form.querySelector('[data-category-choices]');
  const preview = form.querySelector('[data-transaction-preview]');
  const submit = form.querySelector('[data-submit-transaction]');

  const renderCategoryChoices = () => {
    categoryRoot.innerHTML = categoryChoices(type, category);
    categoryRoot.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
      category = button.dataset.category;
      categoryRoot.querySelectorAll('[data-category]').forEach(item => item.classList.toggle('active', item === button));
    }));
  };

  const refreshTypeUI = () => {
    form.querySelectorAll('[data-transaction-type]').forEach(button => {
      button.classList.toggle('active', button.dataset.transactionType === type);
      button.classList.toggle('income', button.dataset.transactionType === 'income' && button.classList.contains('active'));
      button.classList.toggle('expense', button.dataset.transactionType === 'expense' && button.classList.contains('active'));
    });

    const allowed = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!allowed.includes(category)) category = allowed[0];
    renderCategoryChoices();

    descriptionInput.placeholder = type === 'income' ? 'Contoh: Termin 1 dari klien' : 'Contoh: Beli semen';
    preview.className = `transaction-preview ${type}`;
    preview.querySelector('span').textContent = type === 'income' ? 'Uang masuk project' : 'Uang keluar project';
    submit.className = `primary-button ${type === 'income' ? 'income-button' : 'expense-button'}`;
    submit.textContent = transaction ? 'Simpan perubahan' : type === 'income' ? 'Simpan uang masuk' : 'Simpan uang keluar';
  };

  form.querySelectorAll('[data-transaction-type]').forEach(button => button.addEventListener('click', () => {
    type = button.dataset.transactionType;
    refreshTypeUI();
  }));

  renderCategoryChoices();

  amountInput.addEventListener('input', () => {
    preview.querySelector('strong').textContent = money(parseInputNumber(amountInput.value));
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const fd = new FormData(form);
    const rawAmount = String(fd.get('amount') || '').trim();
    const amount = parseInputNumber(rawAmount);
    const description = String(fd.get('description') || '').trim();

    if (!rawAmount || amount <= 0) {
      return showFormError(form, 'Nominal harus lebih dari Rp0.', amountInput);
    }
    if (!description) {
      return showFormError(form, 'Keterangan transaksi wajib diisi.', descriptionInput);
    }

    const now = new Date().toISOString();
    const value = {
      id: transaction?.id || uid('trx'),
      projectId: currentProject().id,
      type,
      amount,
      description,
      category,
      date: String(fd.get('date') || isoToday()),
      createdAt: transaction?.createdAt || now,
      updatedAt: now
    };

    await put('transactions', value);
    await touchCurrentProject(now);
    await reloadData();
    closeOverlay();
    render();
    toast(transaction ? 'Transaksi diperbarui.' : type === 'income' ? 'Uang masuk tersimpan.' : 'Uang keluar tersimpan.');
  });
}

async function touchCurrentProject(now = new Date().toISOString()) {
  const project = currentProject();
  if (!project) return;
  await put('projects', { ...project, updatedAt: now });
}

function openTransactionMenu(id) {
  const transaction = state.transactions.find(item => item.id === id);
  if (!transaction) return;

  openSheet(transaction.description, `
    <div class="option-list">
      <button class="option-row" type="button" data-edit>
        <div><strong>Ubah transaksi</strong><span>Koreksi nominal, kategori, tanggal, atau keterangan</span></div>
      </button>
      <button class="option-row" type="button" data-delete>
        <div><strong class="danger-text">Hapus transaksi</strong><span>Ringkasan project akan dihitung ulang otomatis</span></div>
      </button>
    </div>
  `);

  els.overlayRoot.querySelector('[data-edit]').addEventListener('click', () => openTransactionForm(transaction.type, transaction));
  els.overlayRoot.querySelector('[data-delete]').addEventListener('click', () => {
    openConfirm(
      'Hapus transaksi?',
      `${transaction.description} sebesar ${money(transaction.amount)} akan dihapus dari project ini.`,
      'Hapus',
      async () => {
        await remove('transactions', transaction.id);
        await touchCurrentProject();
        await reloadData();
        closeOverlay();
        render();
        toast('Transaksi dihapus.');
      }
    );
  });
}

function bindPickerButtons(root) {
  root.querySelectorAll('[data-date-picker]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    if (input) openDatePicker(input, button);
  }));
}

function parseISODate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function openDatePicker(input, trigger) {
  const selected = parseISODate(input.value) || new Date();
  let visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);

  const { overlay, close } = openSubSheet('Pilih tanggal', `
    <div class="calendar" data-calendar>
      <div class="calendar-head">
        <button class="calendar-nav" type="button" data-month="-1" aria-label="Bulan sebelumnya">‹</button>
        <strong data-calendar-title></strong>
        <button class="calendar-nav" type="button" data-month="1" aria-label="Bulan berikutnya">›</button>
      </div>
      <div class="calendar-week"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div>
      <div class="calendar-grid" data-calendar-grid></div>
      <button class="secondary-button calendar-today" type="button" data-today>Hari ini</button>
    </div>
  `);

  const title = overlay.querySelector('[data-calendar-title]');
  const grid = overlay.querySelector('[data-calendar-grid]');

  const choose = date => {
    const iso = dateToISO(date);
    input.value = iso;
    trigger.querySelector('[data-picker-value]').textContent = formatDate(iso);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };

  const draw = () => {
    title.textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(visibleMonth);
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const todayIso = isoToday();
    const selectedIso = input.value;

    let html = '';
    for (let i = 0; i < offset; i++) html += '<span class="calendar-blank"></span>';
    for (let day = 1; day <= total; day++) {
      const date = new Date(year, month, day);
      const iso = dateToISO(date);
      html += `<button class="calendar-day ${iso === selectedIso ? 'selected' : ''} ${iso === todayIso ? 'today' : ''}" type="button" data-date="${iso}">${day}</button>`;
    }

    grid.innerHTML = html;
    grid.querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => choose(parseISODate(button.dataset.date))));
  };

  overlay.querySelectorAll('[data-month]').forEach(button => button.addEventListener('click', () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + Number(button.dataset.month), 1);
    draw();
  }));

  overlay.querySelector('[data-today]').addEventListener('click', () => choose(parseISODate(isoToday())));
  draw();
}

function groupIntegerDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatNumberInputValue(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return new Intl.NumberFormat('id-ID', { useGrouping: true, maximumFractionDigits: 0 }).format(numeric);
}

function formatLiveNumberInput(input) {
  const raw = String(input.value ?? '').replace(/\s/g, '').replace(/[^\d]/g, '');
  input.value = groupIntegerDigits(raw);
  try {
    input.setSelectionRange(input.value.length, input.value.length);
  } catch {}
}

function bindNumberInputs(root) {
  root.querySelectorAll('[data-number-mode]').forEach(input => {
    input.addEventListener('input', () => formatLiveNumberInput(input));
  });
}

function parseInputNumber(value) {
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return 0;
  return Number(raw.replace(/\./g, '')) || 0;
}

const BACKUP_SCHEMA_VERSION = 2;

function validateBackupPayload(payload) {
  if (!payload || payload.app !== 'ANGGARAN' || !payload.data) {
    throw new Error('File ini bukan backup ANGGARAN yang didukung.');
  }

  if (payload.schemaVersion === 1) {
    const projects = Array.isArray(payload.data.projects) ? payload.data.projects : [];
    const items = Array.isArray(payload.data.items) ? payload.data.items : [];
    const realizations = Array.isArray(payload.data.realizations) ? payload.data.realizations : [];
    return {
      projects,
      transactions: [],
      legacy: { items, realizations }
    };
  }

  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('Versi backup belum didukung aplikasi ini.');
  }

  const projects = payload.data.projects;
  const transactions = payload.data.transactions;
  const legacy = payload.data.legacy || { items: [], realizations: [] };

  if (!Array.isArray(projects) || !Array.isArray(transactions)) {
    throw new Error('Struktur backup tidak lengkap.');
  }

  const projectIds = new Set();
  for (const project of projects) {
    if (!project?.id || typeof project.name !== 'string' || projectIds.has(project.id)) {
      throw new Error('Data project di backup rusak.');
    }
    projectIds.add(project.id);
  }

  const transactionIds = new Set();
  for (const transaction of transactions) {
    const amount = Number(transaction?.amount);
    if (
      !transaction?.id ||
      transactionIds.has(transaction.id) ||
      !projectIds.has(transaction.projectId) ||
      !['income', 'expense'].includes(transaction.type) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      typeof transaction.description !== 'string'
    ) {
      throw new Error('Data transaksi di backup rusak.');
    }
    transactionIds.add(transaction.id);
  }

  return {
    projects,
    transactions,
    legacy: {
      items: Array.isArray(legacy.items) ? legacy.items : [],
      realizations: Array.isArray(legacy.realizations) ? legacy.realizations : []
    }
  };
}

async function createBackupFile() {
  try {
    const data = await exportDataSnapshot();
    const payload = {
      app: 'ANGGARAN',
      version: '0.8',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const local = new Date();
    const stamp = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}_${String(local.getHours()).padStart(2, '0')}-${String(local.getMinutes()).padStart(2, '0')}`;

    const link = document.createElement('a');
    link.href = url;
    link.download = `ANGGARAN-keuangan-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast(`Backup dibuat: ${data.projects.length} project, ${data.transactions.length} transaksi.`);
  } catch (error) {
    console.error(error);
    toast('Backup gagal dibuat.');
  }
}

function chooseBackupFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      const data = validateBackupPayload(payload);

      openConfirm(
        'Pulihkan backup?',
        `Data saat ini akan diganti dengan ${data.projects.length} project dan ${data.transactions.length} transaksi dari file backup.`,
        'Pulihkan',
        async () => {
          try {
            await restoreDataSnapshot(data);
            state.currentProjectId = null;
            await reloadData();
            closeOverlay();
            state.view = state.projects.length ? 'dashboard' : 'projects';
            render();
            toast('Backup berhasil dipulihkan.');
          } catch (error) {
            console.error(error);
            closeOverlay();
            toast('Restore gagal. Data lama tetap dipertahankan jika transaksi dibatalkan.');
          }
        }
      );
    } catch (error) {
      console.error(error);
      toast(error?.message || 'File backup tidak bisa dibaca.');
    }
  }, { once: true });

  input.click();
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  els.toastRoot.innerHTML = `<div class="toast">${esc(message)}</div>`;
  toastTimer = setTimeout(() => {
    els.toastRoot.innerHTML = '';
  }, 2400);
}

function bindGlobalEvents() {
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-nav]');
    if (nav && !els.view.contains(nav)) navigate(nav.dataset.nav);
    if (!event.target.closest('[data-desktop-dropdown]')) {
      els.view.querySelectorAll('[data-dropdown-menu]').forEach(menu => { menu.hidden = true; });
    }
  });

  document.addEventListener('keydown', onEsc);

  document.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', event => event.preventDefault(), { passive: false });
  document.addEventListener('wheel', event => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
    }
  });

  window.addEventListener('popstate', event => {
    const depth = Number(event.state?.anggaranOverlayDepth) || 0;
    if (depth < 2) closeSubOverlay({ fromHistory: true });
    if (depth < 1) closeOverlay({ fromHistory: true });
  });

  document.addEventListener('focusin', event => {
    const target = event.target;
    if (!els.overlayRoot.contains(target) || !target.matches?.('input:not([type="hidden"]), textarea')) return;
    window.setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  });

  window.visualViewport?.addEventListener('resize', syncVisualViewport);
  window.visualViewport?.addEventListener('scroll', syncVisualViewport);
  window.addEventListener('resize', syncVisualViewport);

  els.projectSwitcher.addEventListener('click', openProjectChooser);
  els.settingsButton?.addEventListener('click', () => navigate('settings'));

  const mqTablet = window.matchMedia('(min-width: 700px)');
  const updateAuto = () => {
    if (state.layoutMode === 'auto') render();
  };
  mqTablet.addEventListener?.('change', updateAuto);
}

async function init() {
  history.replaceState({ ...(history.state || {}), anggaranOverlayDepth: 0 }, '');
  syncVisualViewport();
  state.layoutMode = await getSetting('layoutMode', 'auto');
  state.currentProjectId = await getSetting('currentProjectId', null);
  await reloadData();
  bindGlobalEvents();
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init().catch(error => {
  console.error(error);
  els.view.innerHTML = `
    <div class="empty-state">
      <h2>Aplikasi gagal dibuka</h2>
      <p>${esc(error?.message || 'Terjadi kesalahan penyimpanan lokal.')}</p>
    </div>`;
});

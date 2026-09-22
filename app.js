import { getAll, getByIndex, put, remove, getSetting, setSetting, deleteProjectCascade, deleteItemCascade, exportDataSnapshot, restoreDataSnapshot } from './db.js';
import { money, number, num, itemMetrics, projectMetrics } from './calc.js';

const state = {
  projects: [], items: [], realizations: [], currentProjectId: null,
  view: 'dashboard', layoutMode: 'auto', effectiveLayout: 'mobile',
  search: '', category: 'all'
};

const els = {
  app: document.getElementById('app'),
  view: document.getElementById('view'),
  bottomNav: document.getElementById('bottomNav'),
  desktopNav: document.getElementById('desktopNav'),
  projectSwitcher: document.getElementById('projectSwitcher'),
  projectNameHeader: document.getElementById('projectNameHeader'),
  quickAddButton: document.getElementById('quickAddButton'),
  overlayRoot: document.getElementById('overlayRoot'),
  toastRoot: document.getElementById('toastRoot')
};

const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
  budget: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h3"/></svg>',
  activity: '<svg viewBox="0 0 24 24"><path d="M4 17 9 12l4 3 7-8M18 7h2v2"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7L10.5 2h-3l-.7 2a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7l-2 .7v3l2 .7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2h3l.7-2a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7l2-.7Z" transform="translate(1.5 0) scale(.88)"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M4 5h2l2 10h9l2-7H7M10 19h.01M17 19h.01"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="m4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8M12 12v8"/></svg>'
};

const navItems = [
  ['dashboard', 'Ringkas', icons.dashboard],
  ['budget', 'Anggaran', icons.budget],
  ['activity', 'Realisasi', icons.activity],
  ['settings', 'Pengaturan', icons.settings]
];

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function isoToday() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  const [y,m,d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day:'numeric', month:'short', year:'numeric' }).format(new Date(y, m - 1, d));
}

function currentProject() { return state.projects.find(p => p.id === state.currentProjectId) || null; }
function projectItems() { return state.items.filter(i => i.projectId === state.currentProjectId); }
function projectRealizations() {
  const ids = new Set(projectItems().map(i => i.id));
  return state.realizations.filter(r => ids.has(r.itemId));
}
function realizationsFor(itemId) { return state.realizations.filter(r => r.itemId === itemId); }
function itemById(id) { return state.items.find(i => i.id === id); }

async function reloadData() {
  [state.projects, state.items, state.realizations] = await Promise.all([
    getAll('projects'), getAll('items'), getAll('realizations')
  ]);
  state.projects.sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (!state.projects.some(p => p.id === state.currentProjectId)) {
    state.currentProjectId = state.projects[0]?.id || null;
    if (state.currentProjectId) await setSetting('currentProjectId', state.currentProjectId);
  }
}

function resolveLayout() {
  let layout = state.layoutMode;
  if (layout === 'auto') {
    const wide = window.matchMedia('(min-width: 900px)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    layout = wide && finePointer ? 'desktop' : 'mobile';
  }
  state.effectiveLayout = layout;
  els.app.dataset.layout = layout;
}

function renderNav() {
  const html = navItems.map(([id, label, icon]) => `
    <button type="button" class="nav-button ${state.view === id ? 'active' : ''}" data-nav="${id}">
      ${icon}<span>${label}</span>
    </button>`).join('');
  els.bottomNav.innerHTML = html;
  els.desktopNav.innerHTML = html;
}

function renderHeader() {
  els.projectNameHeader.textContent = currentProject()?.name || 'Belum ada proyek';
  els.quickAddButton.style.visibility = currentProject() && projectItems().length ? 'visible' : 'hidden';
}

function render() {
  resolveLayout();
  renderNav();
  renderHeader();
  if (!currentProject() && state.view !== 'settings') {
    els.view.innerHTML = renderNoProject();
    bindViewEvents();
    return;
  }
  if (state.view === 'dashboard') els.view.innerHTML = renderDashboard();
  if (state.view === 'budget') els.view.innerHTML = renderBudget();
  if (state.view === 'activity') els.view.innerHTML = renderActivity();
  if (state.view === 'settings') els.view.innerHTML = renderSettings();
  bindViewEvents();
}

function renderNoProject() {
  return `
    <div class="page-head"><div><p class="eyebrow">Mulai dari sini</p><h1>Proyek pertama</h1></div></div>
    <div class="empty-state">
      <div class="empty-icon">${icons.box}</div>
      <h2>Belum ada proyek</h2>
      <p>Buat proyek dulu. Setelah itu lo bisa masukin item RAB dan mencatat realisasi pembelian tanpa spreadsheet.</p>
      <button class="primary-button" type="button" data-action="new-project">Buat proyek</button>
    </div>`;
}

function renderDashboard() {
  const items = projectItems();
  const realizations = projectRealizations();
  const m = projectMetrics(items, realizations);
  const pct = Math.round(m.progress * 100);
  const attention = items.map(item => ({item, m: m.itemMetrics.get(item.id)})).filter(x => x.m.isOverBudget);
  const recent = [...realizations].sort((a,b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0,4);
  return `
    <div class="page-head">
      <div><p class="eyebrow">Kondisi proyek</p><h1>Ringkasan</h1></div>
    </div>
    <div class="hero">
      <div class="hero-label">SISA ANGGARAN</div>
      <div class="hero-value ${m.remaining < 0 ? 'danger-text' : ''}">${money(m.remaining)}</div>
      <div class="hero-row">
        <div><span class="hero-label">ANGGARAN</span><strong>${money(m.budget)}</strong></div>
        <div style="text-align:right"><span class="hero-label">TERPAKAI</span><strong>${pct}%</strong></div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total Rencana</div><div class="value">${money(m.budget)}</div></div>
      <div class="stat-card"><div class="label">Realisasi</div><div class="value">${money(m.realized)}</div></div>
      <div class="stat-card ${m.remaining < 0 ? 'danger' : 'success'}"><div class="label">Sisa</div><div class="value">${money(m.remaining)}</div></div>
      <div class="stat-card ${m.overBudgetCount ? 'danger' : ''}"><div class="label">Lewat Batas</div><div class="value">${m.overBudgetCount} item</div></div>
    </div>
    <div class="action-row">
      <button class="action-card" data-action="new-realization" type="button">${icons.cart}<span>Catat realisasi</span></button>
      <button class="action-card secondary" data-action="new-item" type="button">${icons.plus}<span>Tambah item</span></button>
    </div>
    <div class="dashboard-columns">
      <section class="section">
        <div class="section-head"><h2>Posisi anggaran</h2><span class="caption">${pct}% terpakai</span></div>
        <div class="progress-track"><div class="progress-bar ${m.progress > 1 ? 'over' : ''}" style="width:${Math.min(m.progress * 100,100)}%"></div></div>
        <div class="progress-labels"><span>${money(m.realized)}</span><span>${money(m.budget)}</span></div>
        ${attention.length ? `
          <div class="section">
            <div class="section-head"><h2>Perlu perhatian</h2><span class="badge danger">${attention.length} item</span></div>
            <div class="card-list">${attention.slice(0,4).map(({item,m}) => renderCompactItem(item,m)).join('')}</div>
          </div>` : `
          <div class="section"><div class="empty-state"><h2>Belum ada yang lewat batas</h2><p>Item yang realisasinya melebihi rencana akan muncul di sini.</p></div></div>`}
      </section>
      <section class="section">
        <div class="section-head"><h2>Realisasi terbaru</h2>${recent.length ? '<button class="text-button" data-nav="activity">Lihat semua</button>' : ''}</div>
        ${recent.length ? `<div class="card-list">${recent.map(renderTransactionCard).join('')}</div>` : `<div class="empty-state"><p>Belum ada realisasi yang dicatat.</p></div>`}
      </section>
    </div>`;
}

function renderCompactItem(item, m) {
  return `<div class="item-card">
    <div class="item-top"><div class="item-main"><div class="item-name">${esc(item.name)}</div><div class="item-meta"><span>${esc(item.category)}</span><span>•</span><span>${number(m.realizedQty)} / ${number(m.plannedQty)} ${esc(item.unit)}</span></div></div><span class="badge danger">Lewat</span></div>
    <div class="item-numbers"><div class="number-block"><span>Rencana</span><strong>${money(m.plannedSubtotal)}</strong></div><div class="number-block"><span>Realisasi</span><strong class="negative">${money(m.realizedNominal)}</strong></div></div>
  </div>`;
}

function renderBudget() {
  const items = projectItems();
  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(state.search.toLowerCase());
    const matchCategory = state.category === 'all' || item.category === state.category;
    return matchSearch && matchCategory;
  });
  const m = projectMetrics(items, projectRealizations());
  return `
    <div class="page-head">
      <div><p class="eyebrow">RAB proyek</p><h1>Anggaran</h1></div>
      <button class="icon-button desktop-only" type="button" data-action="new-item" aria-label="Tambah item">${icons.plus}</button>
    </div>
    <div class="toolbar">
      <div class="search-field">${icons.search}<input id="budgetSearch" type="search" autocomplete="off" placeholder="Cari item anggaran" value="${esc(state.search)}" /></div>
      <div class="segmented" data-category-control>
        <button class="${state.category === 'all' ? 'active' : ''}" data-category="all" type="button">Semua</button>
        <button class="${state.category === 'Bahan' ? 'active' : ''}" data-category="Bahan" type="button">Bahan</button>
        <button class="${state.category === 'Upah' ? 'active' : ''}" data-category="Upah" type="button">Upah</button>
      </div>
    </div>
    ${items.length ? `
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Item</div><div class="value">${items.length}</div></div>
        <div class="stat-card"><div class="label">Total RAB</div><div class="value">${money(m.budget)}</div></div>
      </div>` : ''}
    ${filtered.length ? `<div class="card-list budget-list">${filtered.map(item => renderItemCard(item)).join('')}</div>` : `
      <div class="empty-state">
        <div class="empty-icon">${icons.budget}</div>
        <h2>${items.length ? 'Item nggak ditemukan' : 'RAB masih kosong'}</h2>
        <p>${items.length ? 'Coba kata pencarian atau kategori lain.' : 'Masukkan bahan atau upah yang sudah direncanakan supaya sistem bisa mulai menghitung.'}</p>
        ${items.length ? '' : '<button class="primary-button" type="button" data-action="new-item">Tambah item pertama</button>'}
      </div>`}
    <div style="height:18px"></div>
    ${state.effectiveLayout === 'mobile' ? '<button class="primary-button accent" type="button" data-action="new-item">+ Tambah item anggaran</button>' : ''}`;
}

function renderItemCard(item) {
  const m = itemMetrics(item, realizationsFor(item.id));
  const pct = Math.round(m.progress * 100);
  const varianceClass = m.avgPriceVariance > 0 ? 'negative' : m.avgPriceVariance < 0 ? 'positive-text' : '';
  const varianceText = m.realizedQty ? `${m.avgPriceVariance > 0 ? '+' : ''}${money(m.avgPriceVariance)}/unit` : 'Belum ada';
  return `<article class="item-card">
    <div class="item-top">
      <div class="item-main"><div class="item-name">${esc(item.name)}</div><div class="item-meta"><span class="badge">${esc(item.category)}</span><span>${number(item.plannedQty)} ${esc(item.unit)} × ${money(item.plannedUnitPrice)}</span></div></div>
      <button class="menu-button" type="button" data-action="item-menu" data-id="${item.id}" aria-label="Aksi item">${icons.more}</button>
    </div>
    <div class="item-numbers">
      <div class="number-block"><span>Rencana</span><strong>${money(m.plannedSubtotal)}</strong></div>
      <div class="number-block"><span>Realisasi</span><strong class="${m.isOverBudget ? 'negative' : ''}">${money(m.realizedNominal)}</strong></div>
      <div class="number-block"><span>Sisa qty</span><strong class="${m.remainingQty < 0 ? 'negative' : ''}">${number(m.remainingQty)} ${esc(item.unit)}</strong></div>
      <div class="number-block"><span>Selisih harga rata²</span><strong class="${varianceClass}">${varianceText}</strong></div>
    </div>
    <div class="progress-track"><div class="progress-bar ${m.isOverBudget ? 'over' : ''}" style="width:${Math.min(m.progress*100,100)}%"></div></div>
    <div class="progress-labels"><span>${pct}% nominal terpakai</span><span class="${m.remainingNominal < 0 ? 'danger-text' : ''}">${money(m.remainingNominal)} sisa</span></div>
    <div class="card-actions"><button class="small-action" type="button" data-action="new-realization" data-item-id="${item.id}">Catat realisasi</button></div>
  </article>`;
}

function renderActivity() {
  const tx = [...projectRealizations()].sort((a,b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  return `
    <div class="page-head">
      <div><p class="eyebrow">Pembelian & pengeluaran</p><h1>Realisasi</h1></div>
      <button class="icon-button desktop-only" type="button" data-action="new-realization">${icons.plus}</button>
    </div>
    ${tx.length ? `<div class="card-list">${tx.map(renderTransactionCard).join('')}</div>` : `
      <div class="empty-state"><div class="empty-icon">${icons.cart}</div><h2>Belum ada realisasi</h2><p>Setiap pembelian bisa dicatat bertahap. Riwayatnya tetap disimpan dan tidak saling menimpa.</p>${projectItems().length ? '<button class="primary-button" data-action="new-realization" type="button">Catat realisasi</button>' : '<button class="primary-button" data-action="new-item" type="button">Buat item anggaran dulu</button>'}</div>`}
    ${tx.length && state.effectiveLayout === 'mobile' ? '<div style="height:18px"></div><button class="primary-button accent" type="button" data-action="new-realization">+ Catat realisasi</button>' : ''}`;
}

function renderTransactionCard(r) {
  const item = itemById(r.itemId);
  if (!item) return '';
  const total = num(r.qty) * num(r.actualUnitPrice);
  return `<article class="transaction-card">
    <div class="transaction-top">
      <div class="transaction-main"><div class="transaction-name">${esc(item.name)}</div><div class="item-meta"><span>${formatDate(r.date)}</span><span>•</span><span>${number(r.qty)} ${esc(item.unit)} × ${money(r.actualUnitPrice)}</span></div></div>
      <button class="menu-button" type="button" data-action="realization-menu" data-id="${r.id}" aria-label="Aksi realisasi">${icons.more}</button>
    </div>
    <div class="item-numbers"><div class="number-block"><span>Total</span><strong>${money(total)}</strong></div><div class="number-block"><span>Catatan</span><strong>${r.note ? esc(r.note) : '—'}</strong></div></div>
  </article>`;
}

function renderSettings() {
  return `
    <div class="page-head"><div><p class="eyebrow">Aplikasi</p><h1>Pengaturan</h1></div></div>
    <section class="setting-card">
      <h3>Mode tampilan</h3>
      <p class="caption">Otomatis menyesuaikan layar dan jenis input. Pilihan manual selalu menang sampai lo ubah lagi.</p>
      <div class="segmented" data-layout-control>
        <button class="${state.layoutMode==='auto'?'active':''}" data-layout-mode="auto" type="button">Otomatis</button>
        <button class="${state.layoutMode==='mobile'?'active':''}" data-layout-mode="mobile" type="button">Mobile</button>
        <button class="${state.layoutMode==='desktop'?'active':''}" data-layout-mode="desktop" type="button">PC</button>
      </div>
    </section>
    <section class="setting-card">
      <h3>Penyimpanan</h3>
      <div class="info-row"><span>Lokasi data</span><strong>Perangkat ini</strong></div>
      <div class="info-row"><span>Database</span><strong>IndexedDB</strong></div>
      <div class="info-row"><span>Server wajib</span><strong>Tidak</strong></div>
    </section>
    <section class="setting-card">
      <h3>Backup data</h3>
      <p class="caption">Simpan salinan seluruh proyek ke satu file backup. Pemulihan akan mengganti data proyek di perangkat ini, tapi tidak mengubah pilihan tampilan Mobile/PC.</p>
      <div class="data-actions">
        <button class="primary-button" data-action="backup-data" type="button">Buat backup</button>
        <button class="secondary-button" data-action="restore-data" type="button">Pulihkan backup</button>
      </div>
    </section>
    ${currentProject() ? `<section class="setting-card"><h3>Proyek aktif</h3><div class="info-row"><span>Nama</span><strong>${esc(currentProject().name)}</strong></div><div class="info-row"><span>Mulai</span><strong>${formatDate(currentProject().startDate)}</strong></div><button class="secondary-button" style="margin-top:12px" data-action="edit-project" type="button">Ubah proyek</button><button class="text-button danger" style="width:100%;margin-top:8px" data-action="delete-project" type="button">Hapus proyek ini</button></section>` : ''}
    <p class="caption" style="text-align:center;margin-top:18px">ANGGARAN v0.2 · Offline-first · Tanpa akun</p>`;
}

function bindViewEvents() {
  els.view.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', handleAction));
  els.view.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
  els.view.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => { state.category = btn.dataset.category; render(); }));
  els.view.querySelectorAll('[data-layout-mode]').forEach(btn => btn.addEventListener('click', async () => {
    state.layoutMode = btn.dataset.layoutMode;
    await setSetting('layoutMode', state.layoutMode);
    render();
    toast(`Mode tampilan: ${state.layoutMode === 'auto' ? 'Otomatis' : state.layoutMode === 'desktop' ? 'PC' : 'Mobile'}`);
  }));
  const search = document.getElementById('budgetSearch');
  if (search) search.addEventListener('input', e => { state.search = e.target.value; render(); requestAnimationFrame(() => { const s=document.getElementById('budgetSearch'); if(s){s.focus(); s.setSelectionRange(s.value.length,s.value.length);} }); });
}

function navigate(view) {
  state.view = view;
  state.search = '';
  render();
  window.scrollTo({top:0, behavior:'instant'});
}

async function handleAction(e) {
  const action = e.currentTarget.dataset.action;
  const id = e.currentTarget.dataset.id;
  if (action === 'new-project') openProjectForm();
  if (action === 'edit-project') openProjectForm(currentProject());
  if (action === 'delete-project') confirmDeleteProject();
  if (action === 'new-item') openItemForm();
  if (action === 'item-menu') openItemMenu(id);
  if (action === 'new-realization') openRealizationForm(e.currentTarget.dataset.itemId || null);
  if (action === 'realization-menu') openRealizationMenu(id);
  if (action === 'backup-data') createBackupFile();
  if (action === 'restore-data') chooseBackupFile();
}

function openSheet(title, content) {
  els.overlayRoot.innerHTML = `<div class="overlay" data-overlay><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><div class="sheet-title">${esc(title)}</div><button class="sheet-close" type="button" data-close>${icons.close}</button></div><div class="sheet-body">${content}</div></section></div>`;
  const overlay = els.overlayRoot.querySelector('[data-overlay]');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
  els.overlayRoot.querySelector('[data-close]').addEventListener('click', closeOverlay);
  document.addEventListener('keydown', onEsc, { once: true });
  bindNumberInputs(els.overlayRoot);
  requestAnimationFrame(() => els.overlayRoot.querySelector('input, textarea, button')?.focus({preventScroll:true}));
}

function openConfirm(title, message, confirmLabel, onConfirm) {
  els.overlayRoot.innerHTML = `<div class="overlay" data-overlay><section class="confirm-panel" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(message)}</p><div class="confirm-actions"><button class="secondary-button" type="button" data-cancel>Batal</button><button class="danger-button" type="button" data-confirm>${esc(confirmLabel)}</button></div></section></div>`;
  els.overlayRoot.querySelector('[data-cancel]').addEventListener('click', closeOverlay);
  els.overlayRoot.querySelector('[data-confirm]').addEventListener('click', onConfirm);
  document.addEventListener('keydown', onEsc, { once:true });
}

function onEsc(e) { if (e.key === 'Escape') closeOverlay(); }
function closeOverlay() { els.overlayRoot.innerHTML = ''; document.removeEventListener('keydown', onEsc); }

function openProjectChooser() {
  const rows = state.projects.map(p => `<button class="project-row ${p.id===state.currentProjectId?'active':''}" data-project-id="${p.id}" type="button"><div class="project-row-main"><strong>${esc(p.name)}</strong><span>${formatDate(p.startDate)} · ${p.status === 'active' ? 'Aktif' : 'Selesai'}</span></div>${p.id===state.currentProjectId?'<span class="dot-active"></span>':''}</button>`).join('');
  openSheet('Pilih proyek', `<div class="project-list">${rows || '<p class="caption">Belum ada proyek.</p>'}</div><button class="primary-button accent" data-new-project type="button">+ Proyek baru</button>`);
  els.overlayRoot.querySelectorAll('[data-project-id]').forEach(btn => btn.addEventListener('click', async () => {
    state.currentProjectId = btn.dataset.projectId;
    await setSetting('currentProjectId', state.currentProjectId);
    closeOverlay(); render();
  }));
  els.overlayRoot.querySelector('[data-new-project]').addEventListener('click', () => openProjectForm());
}

function openProjectForm(project = null) {
  openSheet(project ? 'Ubah proyek' : 'Proyek baru', `
    <form id="projectForm" class="form-grid">
      <div class="field"><label for="projectName">Nama proyek</label><input class="input" id="projectName" name="name" maxlength="80" required autocomplete="off" placeholder="Contoh: Renovasi Rumah" value="${project ? esc(project.name) : ''}"></div>
      <div class="field"><label for="projectDate">Tanggal mulai</label><input class="input" id="projectDate" name="startDate" type="date" required value="${project?.startDate || isoToday()}"></div>
      <div class="field"><label>Status</label><div class="segmented" id="projectStatus"><button type="button" data-status="active" class="${!project || project.status==='active'?'active':''}">Aktif</button><button type="button" data-status="done" class="${project?.status==='done'?'active':''}">Selesai</button></div></div>
      <div class="sheet-actions"><button class="primary-button" type="submit">${project ? 'Simpan perubahan' : 'Buat proyek'}</button></div>
    </form>`);
  let status = project?.status || 'active';
  els.overlayRoot.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', () => {
    status = btn.dataset.status;
    els.overlayRoot.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b === btn));
  }));
  document.getElementById('projectForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name')).trim();
    if (!name) return toast('Nama proyek wajib diisi.');
    const now = new Date().toISOString();
    const value = { id: project?.id || uid('prj'), name, startDate: String(fd.get('startDate')), status, createdAt: project?.createdAt || now, updatedAt: now };
    await put('projects', value);
    state.currentProjectId = value.id;
    await setSetting('currentProjectId', value.id);
    await reloadData(); closeOverlay(); render(); toast(project ? 'Proyek diperbarui.' : 'Proyek dibuat.');
  });
}

function openItemForm(item = null) {
  if (!currentProject()) return openProjectForm();
  openSheet(item ? 'Ubah item anggaran' : 'Tambah item anggaran', `
    <form id="itemForm" class="form-grid">
      <div class="field"><label>Jenis</label><div class="segmented" id="itemCategory"><button type="button" data-item-category="Bahan" class="${!item || item.category==='Bahan'?'active':''}">Bahan</button><button type="button" data-item-category="Upah" class="${item?.category==='Upah'?'active':''}">Upah</button></div></div>
      <div class="field"><label for="itemName">Nama item</label><input class="input" id="itemName" name="name" maxlength="100" required autocomplete="off" placeholder="Contoh: Batu bata" value="${item ? esc(item.name) : ''}"></div>
      <div class="field"><label for="itemUnit">Satuan</label><input class="input" id="itemUnit" name="unit" maxlength="20" required autocomplete="off" placeholder="pcs, sak, m², hari..." value="${item ? esc(item.unit) : ''}"></div>
      <div class="inline-fields">
        <div class="field"><label for="plannedQty">Qty rencana</label><input class="input" id="plannedQty" name="plannedQty" inputmode="decimal" data-number-mode="decimal" required placeholder="0" value="${formatNumberInputValue(item?.plannedQty, 'decimal')}"></div>
        <div class="field"><label for="plannedPrice">Harga / satuan</label><div class="input-prefix"><span>Rp</span><input class="input" id="plannedPrice" name="plannedUnitPrice" inputmode="numeric" data-number-mode="integer" required placeholder="0" value="${formatNumberInputValue(item?.plannedUnitPrice, 'integer')}"></div></div>
      </div>
      <div class="field-note">Subtotal rencana dihitung otomatis dari qty × harga satuan.</div>
      <div class="sheet-actions"><button class="primary-button" type="submit">${item ? 'Simpan perubahan' : 'Tambah ke anggaran'}</button></div>
    </form>`);
  let category = item?.category || 'Bahan';
  els.overlayRoot.querySelectorAll('[data-item-category]').forEach(btn => btn.addEventListener('click', () => {
    category = btn.dataset.itemCategory;
    els.overlayRoot.querySelectorAll('[data-item-category]').forEach(b => b.classList.toggle('active', b === btn));
  }));
  document.getElementById('itemForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name')).trim();
    const unit = String(fd.get('unit')).trim();
    const plannedQty = parseInputNumber(fd.get('plannedQty'));
    const plannedUnitPrice = parseInputNumber(fd.get('plannedUnitPrice'));
    if (!name || !unit || plannedQty <= 0 || plannedUnitPrice < 0) return toast('Cek lagi nama, satuan, qty, dan harga.');
    const now = new Date().toISOString();
    await put('items', { id:item?.id||uid('itm'), projectId:currentProject().id, name, category, unit, plannedQty, plannedUnitPrice, createdAt:item?.createdAt||now, updatedAt:now });
    await reloadData(); closeOverlay(); render(); toast(item ? 'Item diperbarui.' : 'Item ditambahkan.');
  });
}

function openItemMenu(id) {
  const item = itemById(id); if (!item) return;
  openSheet(item.name, `<div class="option-list"><button class="option-row" type="button" data-edit><div><strong>Ubah item</strong><span>Nama, jenis, satuan, qty, atau harga rencana</span></div></button><button class="option-row" type="button" data-realize><div><strong>Catat realisasi</strong><span>Tambahkan pembelian/pengeluaran untuk item ini</span></div></button><button class="option-row" type="button" data-delete><div><strong class="danger-text">Hapus item</strong><span>Riwayat realisasi item ini ikut terhapus</span></div></button></div>`);
  els.overlayRoot.querySelector('[data-edit]').addEventListener('click', () => openItemForm(item));
  els.overlayRoot.querySelector('[data-realize]').addEventListener('click', () => openRealizationForm(item.id));
  els.overlayRoot.querySelector('[data-delete]').addEventListener('click', () => {
    openConfirm('Hapus item?', `${item.name} dan seluruh realisasinya akan dihapus dari proyek ini.`, 'Hapus', async () => {
      await deleteItemCascade(item.id); await reloadData(); closeOverlay(); render(); toast('Item dihapus.');
    });
  });
}

function openRealizationForm(initialItemId = null, realization = null) {
  const items = projectItems();
  if (!items.length) return openItemForm();
  let selectedId = realization?.itemId || initialItemId || (items.length === 1 ? items[0].id : null);
  const optionsHtml = items.map(item => `<button class="option-row ${item.id===selectedId?'active':''}" data-pick-item="${item.id}" type="button"><div><strong>${esc(item.name)}</strong><span>${esc(item.category)} · ${number(item.plannedQty)} ${esc(item.unit)}</span></div><span class="option-check"></span></button>`).join('');
  openSheet(realization ? 'Ubah realisasi' : 'Catat realisasi', `
    <form id="realizationForm" class="form-grid">
      <div class="field"><label>Item anggaran</label><div class="search-field" style="margin-bottom:8px">${icons.search}<input id="itemPickerSearch" type="search" autocomplete="off" placeholder="Cari item"></div><div class="option-list" id="itemPickerList">${optionsHtml}</div></div>
      <div class="field"><label for="realizationDate">Tanggal</label><input class="input" id="realizationDate" name="date" type="date" required value="${realization?.date || isoToday()}"></div>
      <div class="inline-fields"><div class="field"><label for="realizationQty">Qty dibeli</label><input class="input" id="realizationQty" name="qty" inputmode="decimal" data-number-mode="decimal" required placeholder="0" value="${formatNumberInputValue(realization?.qty, 'decimal')}"></div><div class="field"><label for="actualPrice">Harga aktual / satuan</label><div class="input-prefix"><span>Rp</span><input class="input" id="actualPrice" name="actualUnitPrice" inputmode="numeric" data-number-mode="integer" required placeholder="0" value="${formatNumberInputValue(realization?.actualUnitPrice, 'integer')}"></div></div></div>
      <div class="field"><label for="realizationNote">Catatan <span style="font-weight:500">(opsional)</span></label><textarea class="textarea" id="realizationNote" name="note" maxlength="180" placeholder="Toko, kualitas barang, atau keterangan lain">${realization ? esc(realization.note || '') : ''}</textarea></div>
      <div class="sheet-actions"><button class="primary-button" type="submit">${realization ? 'Simpan perubahan' : 'Simpan realisasi'}</button></div>
    </form>`);

  const picker = document.getElementById('itemPickerList');
  const bindPicker = () => picker.querySelectorAll('[data-pick-item]').forEach(btn => btn.addEventListener('click', () => {
    selectedId = btn.dataset.pickItem;
    picker.querySelectorAll('[data-pick-item]').forEach(b => b.classList.toggle('active', b === btn));
  }));
  bindPicker();
  document.getElementById('itemPickerSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    picker.querySelectorAll('[data-pick-item]').forEach(btn => {
      const item = itemById(btn.dataset.pickItem);
      btn.style.display = item.name.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  document.getElementById('realizationForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!selectedId) return toast('Pilih item anggaran dulu.');
    const fd = new FormData(e.currentTarget);
    const qty = parseInputNumber(fd.get('qty'));
    const actualUnitPrice = parseInputNumber(fd.get('actualUnitPrice'));
    if (qty <= 0 || actualUnitPrice < 0) return toast('Qty harus lebih dari 0 dan harga tidak boleh minus.');
    const now = new Date().toISOString();
    await put('realizations', { id:realization?.id||uid('rlz'), itemId:selectedId, date:String(fd.get('date')), qty, actualUnitPrice, note:String(fd.get('note')).trim(), createdAt:realization?.createdAt||now, updatedAt:now });
    await reloadData(); closeOverlay(); render(); toast(realization ? 'Realisasi diperbarui.' : 'Realisasi tersimpan.');
  });
}

function openRealizationMenu(id) {
  const r = state.realizations.find(x => x.id === id); if (!r) return;
  const item = itemById(r.itemId);
  openSheet(item?.name || 'Realisasi', `<div class="option-list"><button class="option-row" type="button" data-edit><div><strong>Ubah realisasi</strong><span>Koreksi tanggal, qty, harga, atau catatan</span></div></button><button class="option-row" type="button" data-delete><div><strong class="danger-text">Hapus realisasi</strong><span>Angka proyek akan dihitung ulang otomatis</span></div></button></div>`);
  els.overlayRoot.querySelector('[data-edit]').addEventListener('click', () => openRealizationForm(r.itemId, r));
  els.overlayRoot.querySelector('[data-delete]').addEventListener('click', () => openConfirm('Hapus realisasi?', 'Transaksi ini akan dihapus dan seluruh perhitungan proyek akan diperbarui.', 'Hapus', async () => {
    await remove('realizations', r.id); await reloadData(); closeOverlay(); render(); toast('Realisasi dihapus.');
  }));
}

function confirmDeleteProject() {
  const p = currentProject(); if (!p) return;
  openConfirm('Hapus proyek?', `${p.name}, seluruh item, dan seluruh realisasinya akan dihapus dari perangkat ini.`, 'Hapus proyek', async () => {
    await deleteProjectCascade(p.id); state.currentProjectId = null; await reloadData(); closeOverlay(); render(); toast('Proyek dihapus.');
  });
}

const BACKUP_SCHEMA_VERSION = 1;

function groupIntegerDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatNumberInputValue(value, mode = 'integer') {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return new Intl.NumberFormat('id-ID', {
    useGrouping: true,
    maximumFractionDigits: mode === 'decimal' ? 8 : 0
  }).format(numeric);
}

function formatLiveNumberInput(input, event = null) {
  const mode = input.dataset.numberMode || 'integer';
  let raw = String(input.value ?? '').replace(/\s/g, '').replace(/[^\d.,]/g, '');

  if (!raw) {
    input.value = '';
    return;
  }

  if (mode === 'integer') {
    input.value = groupIntegerDigits(raw);
  } else {
    // For pasted decimal values like 1.5, accept the dot as decimal.
    if (event?.inputType === 'insertFromPaste' && !raw.includes(',') && /^\d+\.\d+$/.test(raw) && !/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
      const idx = raw.lastIndexOf('.');
      raw = `${raw.slice(0, idx)},${raw.slice(idx + 1)}`;
    }

    const hasDecimal = raw.includes(',');
    const [wholeRaw, ...fractionParts] = raw.split(',');
    const whole = groupIntegerDigits(wholeRaw.replace(/\./g, '')) || '0';
    const fraction = fractionParts.join('').replace(/\D/g, '');
    input.value = hasDecimal ? `${whole},${fraction}` : whole;
  }

  try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
}

function bindNumberInputs(root) {
  root.querySelectorAll('[data-number-mode]').forEach(input => {
    input.addEventListener('beforeinput', event => {
      if (input.dataset.numberMode !== 'decimal' || event.data !== '.') return;
      event.preventDefault();
      const value = input.value;
      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? start;
      input.value = `${value.slice(0, start)},${value.slice(end)}`;
      formatLiveNumberInput(input);
    });
    input.addEventListener('input', event => formatLiveNumberInput(input, event));
  });
}

function validateBackupPayload(payload) {
  if (!payload || payload.app !== 'ANGGARAN' || payload.schemaVersion !== BACKUP_SCHEMA_VERSION || !payload.data) {
    throw new Error('File ini bukan backup ANGGARAN yang didukung.');
  }

  const { projects, items, realizations } = payload.data;
  if (![projects, items, realizations].every(Array.isArray)) {
    throw new Error('Struktur backup tidak lengkap.');
  }

  const projectIds = new Set();
  for (const project of projects) {
    if (!project?.id || typeof project.name !== 'string' || projectIds.has(project.id)) {
      throw new Error('Data proyek di backup rusak.');
    }
    projectIds.add(project.id);
  }

  const itemIds = new Set();
  for (const item of items) {
    const qty = Number(item?.plannedQty);
    const price = Number(item?.plannedUnitPrice);
    if (!item?.id || itemIds.has(item.id) || !projectIds.has(item.projectId) || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      throw new Error('Data item anggaran di backup rusak.');
    }
    itemIds.add(item.id);
  }

  const realizationIds = new Set();
  for (const realization of realizations) {
    const qty = Number(realization?.qty);
    const price = Number(realization?.actualUnitPrice);
    if (!realization?.id || realizationIds.has(realization.id) || !itemIds.has(realization.itemId) || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      throw new Error('Data realisasi di backup rusak.');
    }
    realizationIds.add(realization.id);
  }

  return { projects, items, realizations };
}

async function createBackupFile() {
  try {
    const data = await exportDataSnapshot();
    const payload = {
      app: 'ANGGARAN',
      version: '0.2',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const local = new Date();
    const stamp = `${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}_${String(local.getHours()).padStart(2,'0')}-${String(local.getMinutes()).padStart(2,'0')}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `ANGGARAN-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Backup dibuat: ${data.projects.length} proyek.`);
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
        `Data saat ini akan diganti dengan ${data.projects.length} proyek, ${data.items.length} item, dan ${data.realizations.length} realisasi dari file backup.`,
        'Pulihkan',
        async () => {
          try {
            await restoreDataSnapshot(data);
            state.currentProjectId = null;
            await reloadData();
            closeOverlay();
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

function parseInputNumber(value) {
  const raw = String(value ?? '').trim().replace(/\s/g,'');
  if (!raw) return 0;
  if (raw.includes(',') && raw.includes('.')) return Number(raw.replace(/\./g,'').replace(',','.')) || 0;
  if (raw.includes(',')) return Number(raw.replace(',','.')) || 0;
  // Indonesian users commonly type dots as thousand separators (75.000).
  // Keep ordinary decimal-dot input working too (1.5).
  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g,'')) || 0;
  return Number(raw) || 0;
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  els.toastRoot.innerHTML = `<div class="toast">${esc(message)}</div>`;
  toastTimer = setTimeout(() => { els.toastRoot.innerHTML=''; }, 2300);
}

function bindGlobalEvents() {
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav && !els.view.contains(nav)) navigate(nav.dataset.nav);
  });
  els.projectSwitcher.addEventListener('click', openProjectChooser);
  els.quickAddButton.addEventListener('click', () => openRealizationForm());
  const mqWide = window.matchMedia('(min-width: 900px)');
  const mqPointer = window.matchMedia('(pointer: fine)');
  const updateAuto = () => { if (state.layoutMode === 'auto') render(); };
  mqWide.addEventListener?.('change', updateAuto);
  mqPointer.addEventListener?.('change', updateAuto);
}

async function init() {
  state.layoutMode = await getSetting('layoutMode', 'auto');
  state.currentProjectId = await getSetting('currentProjectId', null);
  await reloadData();
  bindGlobalEvents();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init().catch(err => {
  console.error(err);
  els.view.innerHTML = `<div class="empty-state"><h2>Aplikasi gagal dibuka</h2><p>${esc(err?.message || 'Terjadi kesalahan penyimpanan lokal.')}</p></div>`;
});

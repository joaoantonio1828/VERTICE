// ============================================================
// VÉRTICE — Página de Lançamentos
// src/lancamentos/lancamentos.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState, setState } from '../../assets/js/store.js';
import { formatCurrency, formatDate, currentMonth, monthRange, prevMonth, nextMonth, monthLabel, statusLabel, statusClass, typeColor } from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';
import { openTransactionModal } from './modal.js';

let filters = {
  month:    currentMonth(),
  type:     'all',
  status:   'all',
  cardId:   '',
  accountId:'',
  search:   '',
  categoryId: '',
};

export async function renderLancamentos(container) {
  filters.month = getState('selectedMonth') || currentMonth();

  container.innerHTML = renderPageShell();
  await loadTransactions(container);
  bindPageEvents(container);
}

// ─── Shell da página ──────────────────────────────────────────
function renderPageShell() {
  return `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Lançamentos</h2>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px" id="tx-count-label">Carregando...</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary btn-sm" id="export-btn">${icon('download', 14)} Exportar</button>
        <button class="btn btn-primary btn-sm" id="new-tx-btn">${icon('plus', 14)} Novo lançamento</button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card card-sm mb-4">
      <div class="filter-bar">
        <!-- Mês -->
        <div class="flex items-center gap-1">
          <button class="btn btn-secondary btn-sm btn-icon" id="tx-prev-month">${icon('chevron-left', 14)}</button>
          <span style="font-size:0.875rem;font-weight:500;min-width:120px;text-align:center" id="tx-month-label">${monthLabel(filters.month)}</span>
          <button class="btn btn-secondary btn-sm btn-icon" id="tx-next-month">${icon('chevron-right', 14)}</button>
        </div>

        <div style="width:1px;height:24px;background:var(--border)"></div>

        <!-- Tipo -->
        ${['all','expense','income','transfer'].map(t => {
          const labels = { all: 'Todos', expense: 'Despesas', income: 'Receitas', transfer: 'Transferências' };
          return `<button class="filter-chip ${filters.type === t ? 'active' : ''}" data-filter-type="${t}">${labels[t]}</button>`;
        }).join('')}

        <div style="width:1px;height:24px;background:var(--border)"></div>

        <!-- Status -->
        ${['all','pending','paid','overdue'].map(s => {
          const labels = { all: 'Todos status', pending: 'Pendentes', paid: 'Pagos', overdue: 'Atrasados' };
          return `<button class="filter-chip ${filters.status === s ? 'active' : ''}" data-filter-status="${s}">${labels[s]}</button>`;
        }).join('')}

        <div class="topbar-search" style="width:200px;margin-left:auto">
          ${icon('search', 14)}
          <input type="text" placeholder="Buscar..." id="tx-search" value="${filters.search}" style="font-size:0.8125rem">
        </div>
      </div>
    </div>

    <!-- Totais rápidos -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px" id="tx-totals">
      <div class="skeleton" style="height:72px;border-radius:12px"></div>
      <div class="skeleton" style="height:72px;border-radius:12px"></div>
      <div class="skeleton" style="height:72px;border-radius:12px"></div>
    </div>

    <!-- Tabela de transações -->
    <div class="card" style="padding:0">
      <div id="tx-table-container">
        <div style="padding:24px;text-align:center">
          <div class="spinner" style="margin:0 auto"></div>
        </div>
      </div>
    </div>
  `;
}

// ─── Carregar transações ──────────────────────────────────────
async function loadTransactions(container) {
  const userId = getState('user')?.id;
  if (!userId) return;

  const { start, end } = monthRange(filters.month);

  let query = db
    .from('transactions')
    .select('*, category:categories(name,color,icon), card:credit_cards(name,color,brand), account:accounts(name), place:places(name)')
    .eq('user_id', userId)
    .gte('purchase_date', start)
    .lte('purchase_date', end)
    .eq('is_archived', false)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.type     !== 'all') query = query.eq('type',   filters.type);
  if (filters.status   !== 'all') query = query.eq('status', filters.status);
  if (filters.cardId)             query = query.eq('card_id', filters.cardId);
  if (filters.accountId)          query = query.eq('account_id', filters.accountId);
  if (filters.search)             query = query.ilike('description', `%${filters.search}%`);

  const { data: transactions, error } = await query;
  if (error) { console.error(error); return; }

  // Calcular totais
  const income  = transactions.filter(t => t.type === 'income'  && t.status !== 'cancelled').reduce((s, t) => s + +t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense' && t.status !== 'cancelled').reduce((s, t) => s + +t.amount, 0);
  const pending = transactions.filter(t => t.status === 'pending' || t.status === 'overdue').reduce((s, t) => s + +t.amount, 0);

  // Atualizar totais
  const totalsEl = container.querySelector('#tx-totals');
  if (totalsEl) {
    totalsEl.innerHTML = `
      <div class="stat-card" style="padding:14px 18px">
        <div class="stat-icon income" style="width:36px;height:36px">${icon('trending-up', 16)}</div>
        <div class="stat-body">
          <div class="stat-label" style="font-size:0.6875rem">Receitas</div>
          <div class="stat-value text-income" style="font-size:1.125rem">${formatCurrency(income)}</div>
        </div>
      </div>
      <div class="stat-card" style="padding:14px 18px">
        <div class="stat-icon expense" style="width:36px;height:36px">${icon('trending-down', 16)}</div>
        <div class="stat-body">
          <div class="stat-label" style="font-size:0.6875rem">Despesas</div>
          <div class="stat-value text-expense" style="font-size:1.125rem">${formatCurrency(expense)}</div>
        </div>
      </div>
      <div class="stat-card" style="padding:14px 18px">
        <div class="stat-icon pending" style="width:36px;height:36px">${icon('alert-triangle', 16)}</div>
        <div class="stat-body">
          <div class="stat-label" style="font-size:0.6875rem">Pendentes</div>
          <div class="stat-value text-pending" style="font-size:1.125rem">${formatCurrency(pending)}</div>
        </div>
      </div>
    `;
  }

  // Label de contagem
  const countLabel = container.querySelector('#tx-count-label');
  if (countLabel) {
    countLabel.textContent = `${transactions.length} lançamento${transactions.length !== 1 ? 's' : ''} — ${monthLabel(filters.month)}`;
  }

  // Tabela
  const tableEl = container.querySelector('#tx-table-container');
  if (!tableEl) return;

  if (transactions.length === 0) {
    tableEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('layers', 24)}</div>
        <p class="empty-state-title">Nenhum lançamento encontrado</p>
        <p class="empty-state-desc">Ajuste os filtros ou adicione um novo lançamento</p>
        <button class="btn btn-primary btn-sm new-tx-btn-inner" style="margin-top:8px">${icon('plus', 14)} Novo lançamento</button>
      </div>
    `;
    return;
  }

  // Agrupar por data
  const grouped = {};
  transactions.forEach(t => {
    const key = t.purchase_date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  tableEl.innerHTML = `
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th style="width:36px"></th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Conta/Cartão</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th style="text-align:right">Valor</th>
            <th style="width:40px"></th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, txs]) => `
            <!-- Linha de data -->
            <tr>
              <td colspan="8" style="background:var(--bg-surface);padding:8px 20px;border-bottom:1px solid var(--border)">
                <span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">
                  ${formatDate(date, 'long')}
                </span>
                <span style="margin-left:12px;font-size:0.75rem;color:var(--text-muted)">
                  ${formatCurrency(txs.filter(t => t.type === 'expense').reduce((s, t) => s + +t.amount, 0))} em despesas
                </span>
              </td>
            </tr>
            ${txs.map(t => `
              <tr class="tx-row" data-id="${t.id}" style="cursor:pointer">
                <td>
                  <div style="width:8px;height:8px;border-radius:50%;background:var(--${typeColor(t.type)});margin:0 auto"></div>
                </td>
                <td>
                  <div style="font-weight:500;font-size:0.875rem">${t.description}</div>
                  ${t.place ? `<div style="font-size:0.75rem;color:var(--text-muted)">${icon('map-pin', 11)} ${t.place.name}</div>` : ''}
                  ${t.total_installments ? `<div style="font-size:0.75rem;color:var(--transfer)">${icon('layers', 11)} ${t.installment_number}/${t.total_installments}x</div>` : ''}
                </td>
                <td>
                  ${t.category ? `
                    <div class="flex items-center gap-2">
                      <div style="width:24px;height:24px;border-radius:6px;background:${t.category.color}22;color:${t.category.color};display:flex;align-items:center;justify-content:center">
                        ${icon(t.category.icon || 'tag', 12)}
                      </div>
                      <span style="font-size:0.8125rem">${t.category.name}</span>
                    </div>
                  ` : '<span style="color:var(--text-muted);font-size:0.8125rem">—</span>'}
                </td>
                <td style="font-size:0.8125rem;color:var(--text-secondary)">
                  ${t.card?.name || t.account?.name || '—'}
                </td>
                <td style="font-size:0.8125rem;color:var(--text-secondary)">
                  ${t.due_date ? formatDate(t.due_date) : '—'}
                </td>
                <td><span class="badge ${statusClass(t.status)}">${statusLabel(t.status)}</span></td>
                <td style="text-align:right;font-weight:600;white-space:nowrap;color:var(--${typeColor(t.type)})">
                  ${t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}${formatCurrency(t.amount)}
                </td>
                <td>
                  <div style="display:flex;gap:4px;justify-content:flex-end">
                    <button class="btn btn-ghost btn-icon-sm edit-tx-btn" data-id="${t.id}" title="Editar">
                      ${icon('edit', 14)}
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Click em linha
  tableEl.querySelectorAll('.tx-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.edit-tx-btn')) return;
      openTransactionModal(row.dataset.id);
    });
  });

  tableEl.querySelectorAll('.edit-tx-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openTransactionModal(btn.dataset.id);
    });
  });

  tableEl.querySelector('.new-tx-btn-inner')?.addEventListener('click', () => openTransactionModal());
}

// ─── Bind eventos da página ───────────────────────────────────
function bindPageEvents(container) {
  container.querySelector('#new-tx-btn')?.addEventListener('click', () => openTransactionModal());

  // Navegação de mês
  container.querySelector('#tx-prev-month')?.addEventListener('click', () => {
    filters.month = prevMonth(filters.month);
    setState({ selectedMonth: filters.month });
    container.querySelector('#tx-month-label').textContent = monthLabel(filters.month);
    loadTransactions(container);
  });

  container.querySelector('#tx-next-month')?.addEventListener('click', () => {
    filters.month = nextMonth(filters.month);
    setState({ selectedMonth: filters.month });
    container.querySelector('#tx-month-label').textContent = monthLabel(filters.month);
    loadTransactions(container);
  });

  // Filtros de tipo
  container.querySelectorAll('[data-filter-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      filters.type = btn.dataset.filterType;
      container.querySelectorAll('[data-filter-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTransactions(container);
    });
  });

  // Filtros de status
  container.querySelectorAll('[data-filter-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      filters.status = btn.dataset.filterStatus;
      container.querySelectorAll('[data-filter-status]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTransactions(container);
    });
  });

  // Busca
  let searchTimer;
  container.querySelector('#tx-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.search = e.target.value.trim();
      loadTransactions(container);
    }, 350);
  });

  // Recarregar ao salvar
  window.addEventListener('vertice:transaction-saved', () => loadTransactions(container));
}

// ============================================================
// VÉRTICE — Dashboard Principal
// src/dashboard/dashboard.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState, setState } from '../../assets/js/store.js';
import {
  formatCurrency, formatDate, currentMonth,
  monthLabel, prevMonth, nextMonth, monthRange,
  typeColor, statusLabel, statusClass
} from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';
import { navigate } from '../../assets/js/router.js';

// Cache de dados
let dashData = null;
let selectedMonthLocal = currentMonth();

// ─── Entrada ──────────────────────────────────────────────────
export async function renderDashboard(container) {
  selectedMonthLocal = getState('selectedMonth') || currentMonth();
  container.innerHTML = renderSkeleton();
  await loadDashboard(container);
}

// ─── Carregar dados do dashboard ──────────────────────────────
async function loadDashboard(container) {
  try {
    const userId = getState('user')?.id;
    if (!userId) return;

    const { start, end } = monthRange(selectedMonthLocal);
    const prevM = prevMonth(selectedMonthLocal);
    const { start: ps, end: pe } = monthRange(prevM);

    // Buscar transações do mês atual e anterior em paralelo
    const [currRes, prevRes, cardsRes, pendingRes] = await Promise.all([
      db.from('transactions')
        .select('*, category:categories(name,color,icon), card:credit_cards(name,color), account:accounts(name)')
        .eq('user_id', userId)
        .gte('purchase_date', start)
        .lte('purchase_date', end)
        .eq('is_archived', false)
        .order('purchase_date', { ascending: false }),

      db.from('transactions')
        .select('type, amount, status')
        .eq('user_id', userId)
        .gte('purchase_date', ps)
        .lte('purchase_date', pe)
        .eq('is_archived', false),

      db.from('credit_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true),

      db.from('transactions')
        .select('id, description, amount, due_date, status, type')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true })
        .limit(5),
    ]);

    const transactions = currRes.data || [];
    const prevTx       = prevRes.data || [];
    const cards        = cardsRes.data || [];
    const pending      = pendingRes.data || [];

    // Calcular métricas
    const income  = transactions.filter(t => t.type === 'income' && t.status !== 'cancelled').reduce((s, t) => s + +t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense' && t.status !== 'cancelled').reduce((s, t) => s + +t.amount, 0);
    const balance = income - expense;

    const prevIncome  = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + +t.amount, 0);
    const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + +t.amount, 0);

    const incomeDelta  = prevIncome  > 0 ? ((income  - prevIncome)  / prevIncome  * 100) : 0;
    const expenseDelta = prevExpense > 0 ? ((expense - prevExpense) / prevExpense * 100) : 0;

    // Pendentes do mês
    const pendingTotal = transactions.filter(t => t.status === 'pending' || t.status === 'overdue').reduce((s, t) => s + +t.amount, 0);

    // Por categoria (top 6)
    const byCat = {};
    transactions.filter(t => t.type === 'expense' && t.status !== 'cancelled').forEach(t => {
      const key = t.category?.name || 'Sem categoria';
      if (!byCat[key]) byCat[key] = { name: key, color: t.category?.color || '#94a3b8', icon: t.category?.icon || 'tag', total: 0 };
      byCat[key].total += +t.amount;
    });
    const topCategories = Object.values(byCat).sort((a, b) => b.total - a.total).slice(0, 6);

    // Últimas 8 transações
    const recent = transactions.slice(0, 8);

    // Dias do mês para gráfico
    const dailyData = buildDailyData(transactions, start, end);

    dashData = { income, expense, balance, pendingTotal, incomeDelta, expenseDelta, cards, pending, topCategories, recent, dailyData, transactions };

    container.innerHTML = renderDashboardHTML(dashData);
    bindDashboardEvents(container, dashData);

    // Renderizar gráfico
    renderChart(dailyData);

  } catch (err) {
    console.error('Dashboard error:', err);
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('alert-triangle',24)}</div><p class="empty-state-title">Erro ao carregar dados</p><p class="empty-state-desc">${err.message}</p></div>`;
  }
}

// ─── Build dados diários para gráfico ─────────────────────────
function buildDailyData(transactions, start, end) {
  const days = {};
  const startD = new Date(start + 'T00:00:00');
  const endD   = new Date(end + 'T00:00:00');

  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    days[key] = { income: 0, expense: 0 };
  }

  transactions.forEach(t => {
    const key = t.purchase_date;
    if (days[key]) {
      if (t.type === 'income')  days[key].income  += +t.amount;
      if (t.type === 'expense') days[key].expense += +t.amount;
    }
  });

  return Object.entries(days).map(([date, v]) => ({ date, ...v }));
}

// ─── HTML do Dashboard ────────────────────────────────────────
function renderDashboardHTML(d) {
  const { income, expense, balance, pendingTotal, incomeDelta, expenseDelta, cards, pending, topCategories, recent } = d;

  const incomeUp  = incomeDelta  >= 0;
  const expenseUp = expenseDelta >= 0;

  return `
    <!-- Cabeçalho com seletor de mês -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-display" style="font-size:1.5rem;font-weight:600;color:var(--text-primary)">
          ${monthLabel(selectedMonthLocal)}
        </h2>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px">
          Visão geral das suas finanças
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary btn-sm btn-icon" id="dash-prev-month">${icon('chevron-left', 16)}</button>
        <button class="btn btn-secondary btn-sm" id="dash-today-btn" style="min-width:80px">Hoje</button>
        <button class="btn btn-secondary btn-sm btn-icon" id="dash-next-month">${icon('chevron-right', 16)}</button>
      </div>
    </div>

    <!-- Cards de estatísticas -->
    <div class="stats-grid">

      <div class="stat-card">
        <div class="stat-icon accent">${icon('dollar-sign', 20)}</div>
        <div class="stat-body">
          <div class="stat-label">Saldo do Mês</div>
          <div class="stat-value ${balance >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(balance)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">receitas − despesas</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon income">${icon('trending-up', 20)}</div>
        <div class="stat-body">
          <div class="stat-label">Receitas</div>
          <div class="stat-value text-income">${formatCurrency(income)}</div>
          <div class="card-delta ${incomeUp ? 'up' : 'down'}">
            ${icon(incomeUp ? 'arrow-up' : 'arrow-down', 12)}
            ${Math.abs(incomeDelta).toFixed(1)}% vs mês anterior
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon expense">${icon('trending-down', 20)}</div>
        <div class="stat-body">
          <div class="stat-label">Despesas</div>
          <div class="stat-value text-expense">${formatCurrency(expense)}</div>
          <div class="card-delta ${expenseUp ? 'down' : 'up'}">
            ${icon(expenseUp ? 'arrow-up' : 'arrow-down', 12)}
            ${Math.abs(expenseDelta).toFixed(1)}% vs mês anterior
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon pending">${icon('alert-triangle', 20)}</div>
        <div class="stat-body">
          <div class="stat-label">Pendente</div>
          <div class="stat-value text-pending">${formatCurrency(pendingTotal)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">a pagar no mês</div>
        </div>
      </div>

    </div>

    <!-- Gráfico + Categorias -->
    <div class="dashboard-grid">

      <!-- Gráfico mensal -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Fluxo do Mês</span>
          <div class="flex gap-2">
            <span style="font-size:0.75rem;display:flex;align-items:center;gap:5px;color:var(--income)">
              <span style="width:10px;height:10px;background:var(--income);border-radius:2px;display:inline-block"></span>Receitas
            </span>
            <span style="font-size:0.75rem;display:flex;align-items:center;gap:5px;color:var(--expense)">
              <span style="width:10px;height:10px;background:var(--expense);border-radius:2px;display:inline-block"></span>Despesas
            </span>
          </div>
        </div>
        <div class="chart-container" style="height:220px">
          <canvas id="monthly-chart"></canvas>
        </div>
      </div>

      <!-- Top Categorias -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Por Categoria</span>
          <button class="btn btn-ghost btn-sm" onclick="navigate('/relatorios')">Ver mais</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${topCategories.length === 0 ? `
            <div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:0.875rem">
              Nenhum gasto no período
            </div>
          ` : topCategories.map(cat => {
            const pct = expense > 0 ? (cat.total / expense * 100) : 0;
            return `
              <div>
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <div class="category-icon" style="background:${cat.color}22;color:${cat.color};width:28px;height:28px;border-radius:8px">
                      ${icon(cat.icon || 'tag', 14)}
                    </div>
                    <span style="font-size:0.8125rem;font-weight:500">${cat.name}</span>
                  </div>
                  <span style="font-size:0.8125rem;font-weight:600;color:var(--expense)">${formatCurrency(cat.total)}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill expense" style="width:${pct.toFixed(1)}%;background:${cat.color}"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

    </div>

    <!-- Cartões + Próximos vencimentos -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">

      <!-- Resumo de cartões -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Cartões de Crédito</span>
          <button class="btn btn-ghost btn-sm" data-nav="/cartoes">Gerenciar</button>
        </div>
        ${cards.length === 0 ? `
          <div class="empty-state" style="padding:28px 0">
            <div class="empty-state-icon" style="width:40px;height:40px">${icon('credit-card',20)}</div>
            <p class="empty-state-title" style="font-size:0.875rem">Nenhum cartão cadastrado</p>
            <button class="btn btn-secondary btn-sm" data-nav="/cartoes">Adicionar cartão</button>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:12px">
            ${cards.slice(0, 3).map(card => {
              const pct = card.credit_limit > 0 ? (card.used_limit / card.credit_limit * 100) : 0;
              const available = card.credit_limit - card.used_limit;
              return `
                <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border)">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-10">
                      <div style="width:10px;height:10px;border-radius:50%;background:${card.color || '#6366f1'}"></div>
                      <span style="font-size:0.875rem;font-weight:500">${card.name}</span>
                    </div>
                    <span style="font-size:0.75rem;color:var(--text-muted)">
                      ${formatCurrency(available)} disp.
                    </span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${pct > 80 ? 'var(--expense)' : pct > 60 ? 'var(--pending)' : card.color || '#6366f1'}"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.6875rem;color:var(--text-muted)">
                    <span>Usado: ${formatCurrency(card.used_limit)}</span>
                    <span>Limite: ${formatCurrency(card.credit_limit)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Próximos vencimentos -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Vencendo em breve</span>
          <button class="btn btn-ghost btn-sm" data-nav="/lancamentos">Ver todos</button>
        </div>
        ${pending.length === 0 ? `
          <div class="empty-state" style="padding:28px 0">
            <div class="empty-state-icon" style="width:40px;height:40px">${icon('check',20)}</div>
            <p class="empty-state-title" style="font-size:0.875rem">Nenhum vencimento em breve</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${pending.map(t => `
              <div class="flex items-center justify-between" style="padding:10px 12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <div style="flex:1;min-width:0">
                  <div style="font-size:0.8125rem;font-weight:500;truncate">${t.description}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">Vence ${formatDate(t.due_date)}</div>
                </div>
                <span style="font-weight:600;font-size:0.875rem;color:var(--expense);margin-left:12px;white-space:nowrap">${formatCurrency(t.amount)}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>

    </div>

    <!-- Últimos lançamentos -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Últimos lançamentos</span>
        <button class="btn btn-secondary btn-sm" data-nav="/lancamentos">Ver todos</button>
      </div>

      ${recent.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">${icon('layers', 24)}</div>
          <p class="empty-state-title">Nenhum lançamento no período</p>
          <p class="empty-state-desc">Clique no botão + para adicionar seu primeiro lançamento</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Data</th>
                <th>Status</th>
                <th style="text-align:right">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${recent.map(t => `
                <tr style="cursor:pointer" data-tx-id="${t.id}">
                  <td>
                    <div style="font-weight:500">${t.description}</div>
                    ${t.card ? `<div style="font-size:0.75rem;color:var(--text-muted)">${icon('credit-card',12)} ${t.card.name}</div>` : ''}
                    ${t.total_installments ? `<div style="font-size:0.75rem;color:var(--text-muted)">${t.installment_number}/${t.total_installments}x</div>` : ''}
                  </td>
                  <td>
                    ${t.category ? `
                      <div class="flex items-center gap-2">
                        <div class="category-icon" style="background:${t.category.color}22;color:${t.category.color};width:26px;height:26px;border-radius:7px">
                          ${icon(t.category.icon || 'tag', 13)}
                        </div>
                        <span style="font-size:0.8125rem">${t.category.name}</span>
                      </div>
                    ` : '<span style="color:var(--text-muted);font-size:0.8125rem">—</span>'}
                  </td>
                  <td style="color:var(--text-secondary);font-size:0.8125rem">${formatDate(t.purchase_date)}</td>
                  <td><span class="badge ${statusClass(t.status)}">${statusLabel(t.status)}</span></td>
                  <td style="text-align:right;font-weight:600;color:var(--${typeColor(t.type)});white-space:nowrap">
                    ${t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}${formatCurrency(t.amount)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// ─── Gráfico de barras com Canvas puro ────────────────────────
function renderChart(data) {
  const canvas = document.getElementById('monthly-chart');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const rect   = canvas.getBoundingClientRect();

  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const padL = 8, padR = 8, padT = 16, padB = 24;

  // Filtrar apenas dias com dados para não poluir visualmente
  // Mostramos agrupamento semanal se houver muitos dias
  const filtered = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 15)) === 0);

  if (filtered.length === 0) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
    ctx.font = '14px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados no período', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...filtered.flatMap(d => [d.income, d.expense]), 1);
  const chartH = H - padT - padB;
  const chartW = W - padL - padR;

  const barGroupW = chartW / filtered.length;
  const barW      = Math.max(4, barGroupW * 0.3);
  const gap       = barW * 0.3;

  // Estilos do tema
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const incomeColor  = '#34d399';
  const expenseColor = '#f87171';
  const gridColor    = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';

  // Grid horizontal
  ctx.strokeStyle = gridColor;
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
  }

  // Barras
  filtered.forEach((d, i) => {
    const x = padL + i * barGroupW + (barGroupW - barW * 2 - gap) / 2;

    // Receita
    const ih = (d.income / maxVal) * chartH;
    const iy = padT + chartH - ih;
    ctx.fillStyle = incomeColor;
    ctx.beginPath();
    ctx.roundRect(x, iy, barW, ih, [3, 3, 0, 0]);
    ctx.fill();

    // Despesa
    const eh = (d.expense / maxVal) * chartH;
    const ey = padT + chartH - eh;
    ctx.fillStyle = expenseColor;
    ctx.beginPath();
    ctx.roundRect(x + barW + gap, ey, barW, eh, [3, 3, 0, 0]);
    ctx.fill();

    // Label de dia
    if (i % Math.max(1, Math.floor(filtered.length / 8)) === 0) {
      const day = d.date.split('-')[2];
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)';
      ctx.font      = '10px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day, x + barW + gap / 2, H - 6);
    }
  });
}

// ─── Skeleton de loading ──────────────────────────────────────
function renderSkeleton() {
  return `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <div class="skeleton" style="width:200px;height:36px"></div>
      <div class="flex gap-2">
        <div class="skeleton" style="width:36px;height:36px;border-radius:8px"></div>
        <div class="skeleton" style="width:80px;height:36px;border-radius:8px"></div>
        <div class="skeleton" style="width:36px;height:36px;border-radius:8px"></div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:24px">
      ${[1,2,3,4].map(() => `<div class="skeleton" style="height:100px;border-radius:20px"></div>`).join('')}
    </div>
    <div class="dashboard-grid" style="margin-bottom:24px">
      <div class="skeleton" style="height:280px;border-radius:20px"></div>
      <div class="skeleton" style="height:280px;border-radius:20px"></div>
    </div>
    <div class="skeleton" style="height:320px;border-radius:20px"></div>
  `;
}

// ─── Bind de eventos do dashboard ─────────────────────────────
function bindDashboardEvents(container, data) {
  // Navegação de mês
  container.querySelector('#dash-prev-month')?.addEventListener('click', () => {
    selectedMonthLocal = prevMonth(selectedMonthLocal);
    setState({ selectedMonth: selectedMonthLocal });
    container.innerHTML = renderSkeleton();
    loadDashboard(container);
  });

  container.querySelector('#dash-next-month')?.addEventListener('click', () => {
    selectedMonthLocal = nextMonth(selectedMonthLocal);
    setState({ selectedMonth: selectedMonthLocal });
    container.innerHTML = renderSkeleton();
    loadDashboard(container);
  });

  container.querySelector('#dash-today-btn')?.addEventListener('click', () => {
    selectedMonthLocal = currentMonth();
    setState({ selectedMonth: selectedMonthLocal });
    container.innerHTML = renderSkeleton();
    loadDashboard(container);
  });

  // Botões de navegação nos cards
  container.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  // Linhas de transação
  container.querySelectorAll('[data-tx-id]').forEach(row => {
    row.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('vertice:open-transaction-modal', {
        detail: { id: row.dataset.txId }
      }));
    });
  });
}

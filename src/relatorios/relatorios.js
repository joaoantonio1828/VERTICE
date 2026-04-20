// ============================================================
// VÉRTICE — Relatórios
// src/relatorios/relatorios.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState } from '../../assets/js/store.js';
import { formatCurrency, currentMonth, monthRange, prevMonth, monthLabel } from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';

export async function renderRelatorios(container) {
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  await loadRelatorios(container, currentMonth());
}

async function loadRelatorios(container, month) {
  const userId = getState('user')?.id;
  const months = [];
  let m = month;
  for (let i = 0; i < 6; i++) { months.unshift(m); m = prevMonth(m); }

  // Buscar 6 meses de dados para comparativo
  const { start: s6 } = monthRange(months[0]);
  const { end: e6 }   = monthRange(months[months.length - 1]);

  const [txRes, catRes] = await Promise.all([
    db.from('transactions')
      .select('type, amount, purchase_date, category_id, card_id, status')
      .eq('user_id', userId)
      .gte('purchase_date', s6)
      .lte('purchase_date', e6)
      .neq('status', 'cancelled'),
    db.from('categories').select('*').eq('user_id', userId),
  ]);

  const txs  = txRes.data || [];
  const cats = catRes.data || [];

  // Agrupar por mês
  const byMonth = {};
  months.forEach(m => { byMonth[m] = { income: 0, expense: 0, balance: 0 }; });
  txs.forEach(t => {
    const k = t.purchase_date.substring(0, 7);
    if (byMonth[k]) {
      if (t.type === 'income')  byMonth[k].income  += +t.amount;
      if (t.type === 'expense') byMonth[k].expense += +t.amount;
    }
  });
  Object.values(byMonth).forEach(v => { v.balance = v.income - v.expense; });

  // Mês atual — por categoria
  const { start, end } = monthRange(month);
  const currTxs = txs.filter(t => t.purchase_date >= start && t.purchase_date <= end && t.type === 'expense');
  const byCat = {};
  currTxs.forEach(t => {
    const cat = cats.find(c => c.id === t.category_id);
    const key = cat?.name || 'Sem categoria';
    if (!byCat[key]) byCat[key] = { color: cat?.color || '#94a3b8', icon: cat?.icon || 'tag', total: 0 };
    byCat[key].total += +t.amount;
  });
  const topCats = Object.entries(byCat).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  const totalExpense = topCats.reduce((s, c) => s + c.total, 0);

  const avgIncome  = months.reduce((s, m) => s + byMonth[m].income, 0)  / months.length;
  const avgExpense = months.reduce((s, m) => s + byMonth[m].expense, 0) / months.length;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Relatórios</h2>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px">Análise financeira dos últimos 6 meses</p>
      </div>
      <button class="btn btn-secondary" id="export-csv-btn">${icon('download', 14)} Exportar CSV</button>
    </div>

    <!-- Médias -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-icon income">${icon('trending-up', 20)}</div>
        <div class="stat-body">
          <div class="stat-label">Média mensal receitas</div>
          <div class="stat-value text-income">${formatCurrency(avgIncome)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon expense">${icon('trending-down', 20)}</div>
        <div class="stat-body">
          <div class="stat-label">Média mensal despesas</div>
          <div class="stat-value text-expense">${formatCurrency(avgExpense)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon accent">${icon('activity', 20)}</div>
        <div class="stat-body">
          <div class="stat-label">Média saldo mensal</div>
          <div class="stat-value ${avgIncome - avgExpense >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(avgIncome - avgExpense)}</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:3fr 2fr;gap:20px;margin-bottom:24px">

      <!-- Comparativo mensal -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Comparativo 6 meses</span>
        </div>
        <div class="chart-container" style="height:240px">
          <canvas id="report-chart"></canvas>
        </div>
        <!-- Tabela mensal -->
        <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
          <table style="width:100%">
            <thead><tr>
              <th style="padding:8px 0">Mês</th>
              <th style="padding:8px 0;text-align:right">Receitas</th>
              <th style="padding:8px 0;text-align:right">Despesas</th>
              <th style="padding:8px 0;text-align:right">Saldo</th>
            </tr></thead>
            <tbody>
              ${months.map(m => {
                const v = byMonth[m];
                return `
                  <tr>
                    <td style="font-size:0.8125rem;padding:8px 0;text-transform:capitalize">${monthLabel(m).split(' de ')[0]}</td>
                    <td style="text-align:right;font-size:0.8125rem;color:var(--income);font-weight:500">${formatCurrency(v.income)}</td>
                    <td style="text-align:right;font-size:0.8125rem;color:var(--expense);font-weight:500">${formatCurrency(v.expense)}</td>
                    <td style="text-align:right;font-size:0.8125rem;font-weight:600;color:${v.balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${formatCurrency(v.balance)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Por categoria -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Despesas por categoria — ${monthLabel(month).split(' de ')[0]}</span>
        </div>
        ${topCats.length === 0 ? `
          <div class="empty-state" style="padding:28px 0">
            <div class="empty-state-icon">${icon('pie-chart', 24)}</div>
            <p class="empty-state-title" style="font-size:0.875rem">Sem dados no período</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:12px">
            ${topCats.map(cat => {
              const pct = totalExpense > 0 ? (cat.total / totalExpense * 100) : 0;
              return `
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                      <div style="width:26px;height:26px;border-radius:7px;background:${cat.color}22;color:${cat.color};display:flex;align-items:center;justify-content:center">
                        ${icon(cat.icon, 13)}
                      </div>
                      <span style="font-size:0.8125rem">${cat.name}</span>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:0.8125rem;font-weight:600">${formatCurrency(cat.total)}</div>
                      <div style="font-size:0.6875rem;color:var(--text-muted)">${pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${pct.toFixed(1)}%;background:${cat.color}"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

    </div>
  `;

  // Gráfico comparativo
  renderReportChart(months, byMonth);

  // Export CSV
  container.querySelector('#export-csv-btn')?.addEventListener('click', () => exportCSV(txs, cats));
}

function renderReportChart(months, byMonth) {
  const canvas = document.getElementById('report-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const padL = 8, padR = 8, padT = 16, padB = 40;
  const chartH = H - padT - padB;
  const chartW = W - padL - padR;
  const maxVal = Math.max(...months.flatMap(m => [byMonth[m].income, byMonth[m].expense]), 1);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const labelColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const groupW = chartW / months.length;
  const bW = Math.max(6, groupW * 0.28);

  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }

  months.forEach((m, i) => {
    const v = byMonth[m];
    const x = padL + i * groupW + (groupW - bW * 2 - 4) / 2;
    const ih = (v.income  / maxVal) * chartH;
    const eh = (v.expense / maxVal) * chartH;

    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.roundRect(x, padT + chartH - ih, bW, ih, [3, 3, 0, 0]); ctx.fill();

    ctx.fillStyle = '#f87171';
    ctx.beginPath(); ctx.roundRect(x + bW + 4, padT + chartH - eh, bW, eh, [3, 3, 0, 0]); ctx.fill();

    const label = monthLabel(m).split(' de ')[0].substring(0, 3);
    ctx.fillStyle = labelColor; ctx.font = '10px DM Sans, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x + bW + 2, H - 8);
  });
}

function exportCSV(txs, cats) {
  const catMap = {};
  cats.forEach(c => { catMap[c.id] = c.name; });
  const rows = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor', 'Status']];
  txs.forEach(t => {
    rows.push([t.purchase_date, t.description || '', t.type, catMap[t.category_id] || '', t.amount, t.status]);
  });
  const csv = rows.map(r => r.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'vertice-export.csv'; a.click();
  URL.revokeObjectURL(url);
}


// ============================================================
// VÉRTICE — Categorias
// src/categorias/categorias.js
// ============================================================

export async function renderCategorias(container) {
  const { db } = await import('../../assets/js/supabase.js');
  const { getState } = await import('../../assets/js/store.js');
  const { toast, setLoading } = await import('../../assets/js/utils.js');
  const { icon: ic } = await import('../../assets/js/icons.js');

  const userId = getState('user')?.id;

  async function load() {
    const { data: cats } = await db.from('categories').select('*').eq('user_id', userId).order('sort_order').order('name');

    const parents = cats?.filter(c => !c.parent_id) || [];
    const subs    = cats?.filter(c =>  c.parent_id) || [];

    const typeLabels = { expense: 'Despesas', income: 'Receitas', transfer: 'Transferências' };

    container.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Categorias</h2>
          <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px">${cats?.length || 0} categorias</p>
        </div>
        <button class="btn btn-primary" id="new-cat-btn">${ic('plus', 16)} Nova categoria</button>
      </div>

      ${['expense','income','transfer'].map(type => {
        const group = parents.filter(c => c.type === type);
        if (!group.length) return '';
        return `
          <div class="card mb-4">
            <div class="card-header">
              <span class="card-title">${typeLabels[type]}</span>
              <span style="font-size:0.75rem;color:var(--text-muted)">${group.length} categorias</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
              ${group.map(cat => {
                const children = subs.filter(s => s.parent_id === cat.id);
                return `
                  <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer" data-edit-cat="${cat.id}">
                    <div class="flex items-center gap-2 mb-2">
                      <div style="width:32px;height:32px;border-radius:10px;background:${cat.color}22;color:${cat.color};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        ${ic(cat.icon || 'tag', 16)}
                      </div>
                      <div style="flex:1;min-width:0">
                        <div style="font-weight:500;font-size:0.875rem;truncate">${cat.name}</div>
                        ${children.length ? `<div style="font-size:0.6875rem;color:var(--text-muted)">${children.length} subcategorias</div>` : ''}
                      </div>
                    </div>
                    ${children.length ? `
                      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
                        ${children.slice(0,3).map(s => `<span class="chip" style="font-size:0.6875rem;padding:2px 8px">${s.name}</span>`).join('')}
                        ${children.length > 3 ? `<span class="chip" style="font-size:0.6875rem;padding:2px 8px">+${children.length-3}</span>` : ''}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    `;

    container.querySelector('#new-cat-btn')?.addEventListener('click', () => openCatModal(null));
    container.querySelectorAll('[data-edit-cat]').forEach(el => {
      el.addEventListener('click', () => openCatModal(el.dataset.editCat));
    });
  }

  async function openCatModal(catId) {
    let cat = null;
    if (catId) {
      const { data } = await db.from('categories').select('*').eq('id', catId).single();
      cat = data;
    }

    let overlay = document.getElementById('cat-modal-overlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'cat-modal-overlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay); }

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${cat ? 'Editar categoria' : 'Nova categoria'}</h2>
          <button class="modal-close" id="cat-close">${ic('x', 18)}</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label">Nome *</label>
              <input type="text" id="cat-name" class="form-control" placeholder="Nome da categoria" value="${cat?.name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select id="cat-type" class="form-control">
                <option value="expense"  ${cat?.type === 'expense'  ? 'selected' : ''}>Despesa</option>
                <option value="income"   ${cat?.type === 'income'   ? 'selected' : ''}>Receita</option>
                <option value="transfer" ${cat?.type === 'transfer' ? 'selected' : ''}>Transferência</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Cor</label>
              <input type="color" id="cat-color" value="${cat?.color || '#6366f1'}" style="width:42px;height:42px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;padding:4px">
            </div>
          </div>
          <div id="cat-error" class="form-error" style="display:none"></div>
        </div>
        <div class="modal-footer">
          ${cat && !cat.is_default ? `<button class="btn btn-danger btn-sm" id="cat-delete-btn">${ic('trash', 14)} Excluir</button>` : ''}
          <button class="btn btn-ghost" id="cat-cancel">Cancelar</button>
          <button class="btn btn-primary" id="cat-save">${ic('check', 16)} ${cat ? 'Salvar' : 'Criar'}</button>
        </div>
      </div>
    `;

    overlay.classList.add('open');
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); }, { once: true });
    overlay.querySelector('#cat-close')?.addEventListener('click', closeModal);
    overlay.querySelector('#cat-cancel')?.addEventListener('click', closeModal);

    overlay.querySelector('#cat-save')?.addEventListener('click', async () => {
      const name = overlay.querySelector('#cat-name').value.trim();
      const errEl = overlay.querySelector('#cat-error');
      if (!name) { errEl.textContent = 'Informe o nome'; errEl.style.display = 'block'; return; }
      const payload = { user_id: userId, name, type: overlay.querySelector('#cat-type').value, color: overlay.querySelector('#cat-color').value, icon: 'tag' };
      const { error } = cat ? await db.from('categories').update(payload).eq('id', cat.id) : await db.from('categories').insert(payload);
      if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
      closeModal(); toast(cat ? 'Categoria atualizada!' : 'Categoria criada!', 'success'); load();
    });

    overlay.querySelector('#cat-delete-btn')?.addEventListener('click', async () => {
      if (!confirm('Excluir esta categoria?')) return;
      await db.from('categories').delete().eq('id', catId);
      closeModal(); toast('Categoria removida', 'success'); load();
    });

    function closeModal() {
      overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 350);
    }
  }

  await load();
}

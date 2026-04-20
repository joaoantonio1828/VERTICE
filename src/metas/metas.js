// ============================================================
// VÉRTICE — Metas & Orçamento
// src/metas/metas.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState } from '../../assets/js/store.js';
import { formatCurrency, currentMonth, monthRange, monthLabel, toast, setLoading } from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';

export async function renderMetas(container) {
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  await loadMetas(container);
}

async function loadMetas(container) {
  const userId = getState('user')?.id;
  const month  = getState('selectedMonth') || currentMonth();
  const { start, end } = monthRange(month);

  const [goalsRes, budgetsRes, catsRes, txRes] = await Promise.all([
    db.from('goals').select('*').eq('user_id', userId).order('created_at'),
    db.from('budgets').select('*, category:categories(name,color,icon)').eq('user_id', userId).eq('month', month),
    db.from('categories').select('*').eq('user_id', userId).eq('type', 'expense').is('parent_id', null),
    db.from('transactions').select('category_id, amount').eq('user_id', userId).eq('type', 'expense').neq('status', 'cancelled').gte('purchase_date', start).lte('purchase_date', end),
  ]);

  const goals   = goalsRes.data  || [];
  const budgets = budgetsRes.data || [];
  const cats    = catsRes.data   || [];
  const txs     = txRes.data     || [];

  // Calcular gasto por categoria no mês
  const spentByCat = {};
  txs.forEach(t => { spentByCat[t.category_id] = (spentByCat[t.category_id] || 0) + +t.amount; });

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Metas & Orçamento</h2>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px">${monthLabel(month)}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary" id="new-budget-btn">${icon('bar-chart-2', 14)} Definir orçamento</button>
        <button class="btn btn-primary" id="new-goal-btn">${icon('target', 14)} Nova meta</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

      <!-- Orçamentos por categoria -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Orçamento por categoria</span>
        </div>
        ${budgets.length === 0 && cats.length === 0 ? `
          <div class="empty-state" style="padding:28px 0">
            <div class="empty-state-icon">${icon('bar-chart-2', 24)}</div>
            <p class="empty-state-title" style="font-size:0.875rem">Nenhum orçamento definido</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:16px">
            ${cats.map(cat => {
              const budget = budgets.find(b => b.category_id === cat.id);
              const spent  = spentByCat[cat.id] || 0;
              const limit  = budget?.amount || 0;
              const pct    = limit > 0 ? (spent / limit * 100) : 0;
              const color  = pct >= 100 ? 'var(--expense)' : pct >= 80 ? 'var(--pending)' : cat.color || 'var(--income)';

              return `
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2">
                      <div style="width:28px;height:28px;border-radius:8px;background:${cat.color}22;color:${cat.color};display:flex;align-items:center;justify-content:center">
                        ${icon(cat.icon || 'tag', 14)}
                      </div>
                      <span style="font-size:0.8125rem;font-weight:500">${cat.name}</span>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:0.8125rem;font-weight:600;color:${color}">${formatCurrency(spent)}</div>
                      ${limit > 0 ? `<div style="font-size:0.6875rem;color:var(--text-muted)">de ${formatCurrency(limit)}</div>` : ''}
                    </div>
                  </div>
                  ${limit > 0 ? `
                    <div class="progress-bar">
                      <div class="progress-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${color};transition:width 0.6s var(--ease)"></div>
                    </div>
                    ${pct >= 100 ? `<div style="font-size:0.6875rem;color:var(--expense);margin-top:3px">${icon('alert-triangle',11)} Limite ultrapassado em ${formatCurrency(spent - limit)}</div>` : ''}
                    ${pct >= 80 && pct < 100 ? `<div style="font-size:0.6875rem;color:var(--pending);margin-top:3px">${icon('alert-triangle',11)} ${pct.toFixed(0)}% do orçamento utilizado</div>` : ''}
                  ` : `
                    <div style="height:1px;background:var(--border);margin-top:8px"></div>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Metas de economia -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Metas de economia</span>
        </div>
        ${goals.length === 0 ? `
          <div class="empty-state" style="padding:28px 0">
            <div class="empty-state-icon">${icon('target', 24)}</div>
            <p class="empty-state-title" style="font-size:0.875rem">Nenhuma meta criada</p>
            <p class="empty-state-desc" style="font-size:0.8125rem">Defina objetivos financeiros para se manter focado</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:16px">
            ${goals.map(g => {
              const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount * 100) : 0;
              return `
                <div style="padding:14px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border)" data-edit-goal="${g.id}">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <div style="width:32px;height:32px;border-radius:10px;background:${g.color || 'var(--accent)'}22;color:${g.color || 'var(--accent)'};display:flex;align-items:center;justify-content:center">
                        ${icon(g.icon || 'target', 16)}
                      </div>
                      <div>
                        <div style="font-weight:500;font-size:0.875rem">${g.name}</div>
                        ${g.deadline ? `<div style="font-size:0.75rem;color:var(--text-muted)">Até ${new Date(g.deadline+'T12:00:00').toLocaleDateString('pt-BR')}</div>` : ''}
                      </div>
                    </div>
                    ${g.is_completed ? `<span class="badge badge-paid">Concluída</span>` : `<span style="font-size:0.875rem;font-weight:600;color:${g.color || 'var(--accent)'}">${pct.toFixed(0)}%</span>`}
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${g.color || 'var(--accent)'}"></div>
                  </div>
                  <div class="flex items-center justify-between" style="margin-top:6px;font-size:0.75rem;color:var(--text-muted)">
                    <span>${formatCurrency(g.current_amount)} economizados</span>
                    <span>Meta: ${formatCurrency(g.target_amount)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

    </div>
  `;

  container.querySelector('#new-goal-btn')?.addEventListener('click', () => openGoalModal(null, container));
  container.querySelector('#new-budget-btn')?.addEventListener('click', () => openBudgetModal(cats, budgets, month, container));
  container.querySelectorAll('[data-edit-goal]').forEach(el => {
    el.addEventListener('click', () => openGoalModal(el.dataset.editGoal, container));
  });
}

async function openGoalModal(goalId, container) {
  let goal = null;
  if (goalId) {
    const { data } = await db.from('goals').select('*').eq('id', goalId).single();
    goal = data;
  }

  let overlay = document.getElementById('goal-modal-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'goal-modal-overlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay); }

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${goal ? 'Editar meta' : 'Nova meta'}</h2>
        <button class="modal-close" id="goal-modal-close">${icon('x', 18)}</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Nome da meta *</label>
            <input type="text" id="goal-name" class="form-control" placeholder="Ex: Viagem Europa, Reserva emergência..." value="${goal?.name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Valor alvo (R$) *</label>
            <input type="number" id="goal-target" class="form-control" placeholder="0,00" step="0.01" min="0" value="${goal?.target_amount || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Valor atual (R$)</label>
            <input type="number" id="goal-current" class="form-control" placeholder="0,00" step="0.01" min="0" value="${goal?.current_amount || '0'}">
          </div>
          <div class="form-group">
            <label class="form-label">Prazo (opcional)</label>
            <input type="date" id="goal-deadline" class="form-control" value="${goal?.deadline || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Cor</label>
            <input type="color" id="goal-color" value="${goal?.color || '#10b981'}" style="width:42px;height:42px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;padding:4px">
          </div>
        </div>
        <div id="goal-error" class="form-error" style="display:none"></div>
      </div>
      <div class="modal-footer">
        ${goal ? `<button class="btn btn-danger btn-sm" id="goal-delete-btn">${icon('trash', 14)} Excluir</button>` : ''}
        <button class="btn btn-ghost" id="goal-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="goal-save-btn">${icon('check', 16)} ${goal ? 'Salvar' : 'Criar meta'}</button>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeGoalModal(); }, { once: true });
  overlay.querySelector('#goal-modal-close')?.addEventListener('click', closeGoalModal);
  overlay.querySelector('#goal-cancel-btn')?.addEventListener('click', closeGoalModal);

  overlay.querySelector('#goal-save-btn')?.addEventListener('click', async () => {
    const btn    = overlay.querySelector('#goal-save-btn');
    const name   = overlay.querySelector('#goal-name').value.trim();
    const target = +overlay.querySelector('#goal-target').value;
    const errEl  = overlay.querySelector('#goal-error');
    if (!name || !target) { errEl.textContent = 'Preencha nome e valor'; errEl.style.display = 'block'; return; }

    setLoading(btn, true);
    const payload = {
      user_id:        getState('user').id,
      name,
      target_amount:  target,
      current_amount: +overlay.querySelector('#goal-current').value || 0,
      deadline:       overlay.querySelector('#goal-deadline').value || null,
      color:          overlay.querySelector('#goal-color').value,
      icon:           'target',
    };

    const { error } = goal
      ? await db.from('goals').update(payload).eq('id', goal.id)
      : await db.from('goals').insert(payload);

    setLoading(btn, false);
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
    closeGoalModal(); toast(goal ? 'Meta atualizada!' : 'Meta criada!', 'success'); loadMetas(container);
  });

  overlay.querySelector('#goal-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Excluir esta meta?')) return;
    await db.from('goals').delete().eq('id', goal.id);
    closeGoalModal(); toast('Meta removida', 'success'); loadMetas(container);
  });
}

function closeGoalModal() {
  const o = document.getElementById('goal-modal-overlay');
  if (o) { o.classList.remove('open'); setTimeout(() => o.remove(), 350); }
}

async function openBudgetModal(cats, budgets, month, container) {
  let overlay = document.getElementById('budget-modal-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'budget-modal-overlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay); }

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h2 class="modal-title">Orçamento — ${monthLabel(month)}</h2>
        <button class="modal-close" id="budget-modal-close">${icon('x', 18)}</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:16px">Defina limites de gastos por categoria para este mês.</p>
        <div style="display:flex;flex-direction:column;gap:12px" id="budget-fields">
          ${cats.map(cat => {
            const existing = budgets.find(b => b.category_id === cat.id);
            return `
              <div class="flex items-center gap-12">
                <div class="flex items-center gap-2" style="flex:1;min-width:0">
                  <div style="width:28px;height:28px;border-radius:8px;background:${cat.color}22;color:${cat.color};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    ${icon(cat.icon || 'tag', 13)}
                  </div>
                  <span style="font-size:0.8125rem;font-weight:500;truncate">${cat.name}</span>
                </div>
                <div class="input-group" style="width:140px">
                  <span class="input-prefix" style="font-size:0.8125rem">R$</span>
                  <input type="number" class="form-control budget-input" data-cat-id="${cat.id}" placeholder="0,00" min="0" step="0.01" value="${existing?.amount || ''}" style="padding-left:36px;height:36px;font-size:0.8125rem">
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="budget-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="budget-save-btn">${icon('check', 16)} Salvar orçamentos</button>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeBudgetModal(); }, { once: true });
  overlay.querySelector('#budget-modal-close')?.addEventListener('click', closeBudgetModal);
  overlay.querySelector('#budget-cancel-btn')?.addEventListener('click', closeBudgetModal);

  overlay.querySelector('#budget-save-btn')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#budget-save-btn');
    setLoading(btn, true);
    const userId = getState('user').id;
    const upserts = [];

    overlay.querySelectorAll('.budget-input').forEach(input => {
      const val = +input.value;
      if (val > 0) {
        upserts.push({ user_id: userId, category_id: input.dataset.catId, month, amount: val });
      }
    });

    if (upserts.length) {
      await db.from('budgets').upsert(upserts, { onConflict: 'user_id,category_id,month' });
    }

    setLoading(btn, false);
    closeBudgetModal(); toast('Orçamentos salvos!', 'success'); loadMetas(container);
  });
}

function closeBudgetModal() {
  const o = document.getElementById('budget-modal-overlay');
  if (o) { o.classList.remove('open'); setTimeout(() => o.remove(), 350); }
}

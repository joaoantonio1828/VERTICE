// ============================================================
// VÉRTICE — Contas / Carteiras
// src/contas/contas.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState } from '../../assets/js/store.js';
import { formatCurrency, toast, setLoading } from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';

export async function renderContas(container) {
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  await loadContas(container);
}

async function loadContas(container) {
  const userId = getState('user')?.id;
  const { data: accounts } = await db.from('accounts').select('*').eq('user_id', userId).order('created_at');

  const totalBalance = accounts?.filter(a => a.include_in_total).reduce((s, a) => s + +a.current_balance, 0) || 0;

  const typeLabels = { checking: 'Conta corrente', savings: 'Poupança', cash: 'Dinheiro/Carteira', investment: 'Investimento', credit: 'Crédito', other: 'Outra' };
  const typeIcons  = { checking: 'building', savings: 'trending-up', cash: 'wallet', investment: 'activity', credit: 'credit-card', other: 'more-horizontal' };

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Contas & Carteiras</h2>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px">Saldo total: <strong style="color:var(--income)">${formatCurrency(totalBalance)}</strong></p>
      </div>
      <button class="btn btn-primary" id="new-account-btn">${icon('plus', 16)} Nova conta</button>
    </div>

    ${!accounts?.length ? `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">${icon('wallet', 24)}</div>
          <p class="empty-state-title">Nenhuma conta cadastrada</p>
          <p class="empty-state-desc">Adicione suas contas bancárias e carteiras</p>
          <button class="btn btn-primary btn-sm" id="new-account-btn-empty">${icon('plus', 14)} Adicionar conta</button>
        </div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
        ${accounts.map(acc => `
          <div class="card" style="cursor:pointer" data-edit-account="${acc.id}">
            <div class="flex items-center gap-3 mb-4">
              <div class="stat-icon accent" style="background:${acc.color}22;color:${acc.color}">
                ${icon(typeIcons[acc.type] || 'wallet', 20)}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:0.9375rem">${acc.name}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${typeLabels[acc.type] || acc.type}${acc.bank ? ' · ' + acc.bank : ''}</div>
              </div>
              <span class="badge ${acc.is_active ? 'badge-paid' : 'badge-cancelled'}">${acc.is_active ? 'Ativa' : 'Inativa'}</span>
            </div>
            <div style="font-family:var(--font-display);font-size:1.75rem;font-weight:600;color:${+acc.current_balance >= 0 ? 'var(--income)' : 'var(--expense)'}">
              ${formatCurrency(acc.current_balance)}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
              ${acc.include_in_total ? 'Incluído no saldo total' : 'Excluído do saldo total'}
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;

  container.querySelector('#new-account-btn')?.addEventListener('click', () => openAccountModal(null, container));
  container.querySelector('#new-account-btn-empty')?.addEventListener('click', () => openAccountModal(null, container));
  container.querySelectorAll('[data-edit-account]').forEach(el => {
    el.addEventListener('click', () => openAccountModal(el.dataset.editAccount, container));
  });
}

async function openAccountModal(accountId, container) {
  let acc = null;
  if (accountId) {
    const { data } = await db.from('accounts').select('*').eq('id', accountId).single();
    acc = data;
  }

  let overlay = document.getElementById('account-modal-overlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'account-modal-overlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay); }

  const typeOptions = [
    { v: 'checking', l: 'Conta corrente' }, { v: 'savings', l: 'Poupança' },
    { v: 'cash', l: 'Dinheiro/Carteira' }, { v: 'investment', l: 'Investimento' },
    { v: 'credit', l: 'Crédito' }, { v: 'other', l: 'Outra' }
  ];

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${acc ? 'Editar conta' : 'Nova conta'}</h2>
        <button class="modal-close" id="acc-modal-close">${icon('x', 18)}</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Nome da conta *</label>
            <input type="text" id="acc-name" class="form-control" placeholder="Ex: Nubank, Carteira..." value="${acc?.name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Tipo</label>
            <select id="acc-type" class="form-control">
              ${typeOptions.map(o => `<option value="${o.v}" ${acc?.type === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Banco (opcional)</label>
            <input type="text" id="acc-bank" class="form-control" placeholder="Ex: Nubank, Bradesco..." value="${acc?.bank || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Saldo inicial (R$)</label>
            <input type="number" id="acc-initial" class="form-control" placeholder="0,00" step="0.01" value="${acc?.initial_balance || '0'}">
          </div>
          <div class="form-group">
            <label class="form-label">Cor</label>
            <input type="color" id="acc-color" value="${acc?.color || '#6366f1'}" style="width:42px;height:42px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;padding:4px">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem">
              <input type="checkbox" id="acc-include-total" ${!acc || acc.include_in_total ? 'checked' : ''}>
              Incluir no saldo total
            </label>
          </div>
        </div>
        <div id="acc-error" class="form-error" style="display:none"></div>
      </div>
      <div class="modal-footer">
        ${acc ? `<button class="btn btn-danger btn-sm" id="acc-delete-btn">${icon('trash', 14)} Excluir</button>` : ''}
        <button class="btn btn-ghost" id="acc-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="acc-save-btn">${icon('check', 16)} ${acc ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAccountModal(); }, { once: true });
  overlay.querySelector('#acc-modal-close')?.addEventListener('click', closeAccountModal);
  overlay.querySelector('#acc-cancel-btn')?.addEventListener('click', closeAccountModal);

  overlay.querySelector('#acc-save-btn')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#acc-save-btn');
    const name = overlay.querySelector('#acc-name').value.trim();
    const errEl = overlay.querySelector('#acc-error');
    if (!name) { errEl.textContent = 'Informe o nome'; errEl.style.display = 'block'; return; }

    setLoading(btn, true);
    const initial = +overlay.querySelector('#acc-initial').value || 0;
    const payload = {
      user_id:          getState('user').id,
      name,
      type:             overlay.querySelector('#acc-type').value,
      bank:             overlay.querySelector('#acc-bank').value || null,
      initial_balance:  initial,
      current_balance:  acc ? acc.current_balance : initial,
      color:            overlay.querySelector('#acc-color').value,
      include_in_total: overlay.querySelector('#acc-include-total').checked,
      is_active:        true,
    };

    const { error } = acc
      ? await db.from('accounts').update(payload).eq('id', acc.id)
      : await db.from('accounts').insert(payload);

    setLoading(btn, false);
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
    closeAccountModal(); toast(acc ? 'Conta atualizada!' : 'Conta adicionada!', 'success'); loadContas(container);
  });

  overlay.querySelector('#acc-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Excluir esta conta?')) return;
    await db.from('accounts').delete().eq('id', acc.id);
    closeAccountModal(); toast('Conta removida', 'success'); loadContas(container);
  });
}

function closeAccountModal() {
  const o = document.getElementById('account-modal-overlay');
  if (o) { o.classList.remove('open'); setTimeout(() => o.remove(), 350); }
}

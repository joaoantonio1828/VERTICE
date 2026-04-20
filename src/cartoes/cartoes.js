// ============================================================
// VÉRTICE — Cartões de Crédito
// src/cartoes/cartoes.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState } from '../../assets/js/store.js';
import { formatCurrency, formatDate, toast, setLoading } from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';

export async function renderCartoes(container) {
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  await loadCartoes(container);
}

async function loadCartoes(container) {
  const userId = getState('user')?.id;
  const { data: cards } = await db.from('credit_cards').select('*').eq('user_id', userId).order('created_at');

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Cartões de Crédito</h2>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px">${cards?.length || 0} cartão(ões) cadastrado(s)</p>
      </div>
      <button class="btn btn-primary" id="new-card-btn">${icon('plus', 16)} Novo cartão</button>
    </div>

    ${!cards?.length ? `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">${icon('credit-card', 24)}</div>
          <p class="empty-state-title">Nenhum cartão cadastrado</p>
          <p class="empty-state-desc">Adicione seus cartões para controlar faturas e limites</p>
          <button class="btn btn-primary btn-sm" id="new-card-btn-empty">${icon('plus', 14)} Adicionar cartão</button>
        </div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">
        ${cards.map(card => renderCardItem(card)).join('')}
      </div>
    `}
  `;

  container.querySelector('#new-card-btn')?.addEventListener('click', () => openCardModal(null, container));
  container.querySelector('#new-card-btn-empty')?.addEventListener('click', () => openCardModal(null, container));
  container.querySelectorAll('[data-edit-card]').forEach(btn => {
    btn.addEventListener('click', () => openCardModal(btn.dataset.editCard, container));
  });
}

function renderCardItem(card) {
  const pct       = card.credit_limit > 0 ? (card.used_limit / card.credit_limit * 100) : 0;
  const available = card.credit_limit - card.used_limit;
  const barColor  = pct > 80 ? 'var(--expense)' : pct > 60 ? 'var(--pending)' : card.color || '#6366f1';

  const brandIcons = { visa: 'VISA', mastercard: 'MC', elo: 'ELO', amex: 'AMEX', hipercard: 'HIPER', other: '●●●●' };

  return `
    <div class="card" style="padding:0;overflow:hidden">
      <!-- Visual do cartão -->
      <div class="credit-card-visual" style="background:linear-gradient(135deg, ${card.color || '#1a1a2e'}, ${adjustColor(card.color || '#1a1a2e', -30)});max-width:100%;border-radius:16px 16px 0 0">
        <div class="flex items-center justify-between">
          <span style="font-size:0.75rem;opacity:0.7;letter-spacing:0.1em;text-transform:uppercase">${card.name}</span>
          <span style="font-weight:700;font-size:0.875rem;opacity:0.9">${brandIcons[card.brand] || '●●●●'}</span>
        </div>
        <div>
          <div style="font-family:'SF Mono',monospace;letter-spacing:0.18em;font-size:1rem;margin-bottom:6px">
            •••• •••• •••• ${card.last_four || '0000'}
          </div>
          <div style="display:flex;gap:24px;font-size:0.75rem;opacity:0.7">
            <span>Fecha dia ${card.closing_day}</span>
            <span>Vence dia ${card.due_day}</span>
          </div>
        </div>
      </div>

      <!-- Dados do cartão -->
      <div style="padding:20px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <div style="font-size:0.6875rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Limite total</div>
            <div style="font-weight:600;font-size:1rem;font-family:var(--font-display)">${formatCurrency(card.credit_limit)}</div>
          </div>
          <div>
            <div style="font-size:0.6875rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Disponível</div>
            <div style="font-weight:600;font-size:1rem;font-family:var(--font-display);color:${available >= 0 ? 'var(--income)' : 'var(--expense)'}">${formatCurrency(available)}</div>
          </div>
        </div>

        <!-- Barra de uso -->
        <div style="margin-bottom:8px">
          <div class="flex items-center justify-between" style="margin-bottom:6px">
            <span style="font-size:0.75rem;color:var(--text-muted)">Uso do limite</span>
            <span style="font-size:0.75rem;font-weight:600;color:${barColor}">${pct.toFixed(1)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${barColor}"></div>
          </div>
        </div>

        <div class="flex items-center justify-between" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <span class="badge ${card.is_active ? 'badge-paid' : 'badge-cancelled'}">${card.is_active ? 'Ativo' : 'Inativo'}</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" data-edit-card="${card.id}">${icon('edit', 14)} Editar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Modal de cartão ──────────────────────────────────────────
async function openCardModal(cardId, container) {
  let card = null;
  if (cardId) {
    const { data } = await db.from('credit_cards').select('*').eq('id', cardId).single();
    card = data;
  }

  let overlay = document.getElementById('card-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'card-modal-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${card ? 'Editar cartão' : 'Novo cartão'}</h2>
        <button class="modal-close" id="card-modal-close">${icon('x', 18)}</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Nome do cartão *</label>
            <input type="text" id="card-name" class="form-control" placeholder="Ex: Nubank, Itaú..." value="${card?.name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Bandeira</label>
            <select id="card-brand" class="form-control">
              ${['visa','mastercard','elo','amex','hipercard','other'].map(b =>
                `<option value="${b}" ${card?.brand === b ? 'selected' : ''}>${b.charAt(0).toUpperCase()+b.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Últimos 4 dígitos</label>
            <input type="text" id="card-last-four" class="form-control" maxlength="4" placeholder="0000" value="${card?.last_four || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Limite total (R$)</label>
            <input type="number" id="card-limit" class="form-control" placeholder="0,00" min="0" step="0.01" value="${card?.credit_limit || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Cor do cartão</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="color" id="card-color" value="${card?.color || '#1a1a2e'}" style="width:42px;height:42px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;padding:4px">
              <span style="font-size:0.8125rem;color:var(--text-secondary)">Escolha a cor</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Dia de fechamento</label>
            <input type="number" id="card-closing" class="form-control" min="1" max="31" placeholder="1-31" value="${card?.closing_day || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Dia de vencimento</label>
            <input type="number" id="card-due" class="form-control" min="1" max="31" placeholder="1-31" value="${card?.due_day || ''}">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.875rem">
              <input type="checkbox" id="card-active" ${!card || card.is_active ? 'checked' : ''}>
              Cartão ativo
            </label>
          </div>
        </div>
        <div id="card-error" class="form-error" style="display:none"></div>
      </div>
      <div class="modal-footer">
        ${card ? `<button class="btn btn-danger btn-sm" id="card-delete-btn">${icon('trash', 14)} Excluir</button>` : ''}
        <button class="btn btn-ghost" id="card-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="card-save-btn">${icon('check', 16)} ${card ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCardModal(); }, { once: true });

  overlay.querySelector('#card-modal-close')?.addEventListener('click', closeCardModal);
  overlay.querySelector('#card-cancel-btn')?.addEventListener('click', closeCardModal);

  overlay.querySelector('#card-save-btn')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#card-save-btn');
    const errEl = overlay.querySelector('#card-error');
    const name  = overlay.querySelector('#card-name').value.trim();
    const limit = +overlay.querySelector('#card-limit').value;
    const closing = +overlay.querySelector('#card-closing').value;
    const due     = +overlay.querySelector('#card-due').value;

    if (!name)    { errEl.textContent = 'Informe o nome'; errEl.style.display='block'; return; }
    if (!closing || closing < 1 || closing > 31) { errEl.textContent = 'Dia de fechamento inválido'; errEl.style.display='block'; return; }
    if (!due || due < 1 || due > 31)             { errEl.textContent = 'Dia de vencimento inválido'; errEl.style.display='block'; return; }

    setLoading(btn, true);
    const payload = {
      user_id:      getState('user').id,
      name,
      brand:        overlay.querySelector('#card-brand').value,
      last_four:    overlay.querySelector('#card-last-four').value || null,
      credit_limit: limit || 0,
      color:        overlay.querySelector('#card-color').value,
      closing_day:  closing,
      due_day:      due,
      is_active:    overlay.querySelector('#card-active').checked,
    };

    const { error } = card
      ? await db.from('credit_cards').update(payload).eq('id', card.id)
      : await db.from('credit_cards').insert(payload);

    setLoading(btn, false);
    if (error) { errEl.textContent = error.message; errEl.style.display='block'; return; }

    closeCardModal();
    toast(card ? 'Cartão atualizado!' : 'Cartão adicionado!', 'success');
    loadCartoes(container);
  });

  overlay.querySelector('#card-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Excluir este cartão?')) return;
    await db.from('credit_cards').delete().eq('id', card.id);
    closeCardModal();
    toast('Cartão removido', 'success');
    loadCartoes(container);
  });
}

function closeCardModal() {
  const overlay = document.getElementById('card-modal-overlay');
  if (overlay) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 350); }
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}`;
}

// ============================================================
// VÉRTICE — Modal de Lançamento
// src/lancamentos/modal.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState } from '../../assets/js/store.js';
import { toast, setLoading, formatCurrency, calcInvoiceMonth, generateInstallments, currentMonth } from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';

let currentTxId = null;
let formData    = {};

// ─── Abrir modal ──────────────────────────────────────────────
export async function openTransactionModal(txId = null) {
  currentTxId = txId;
  formData    = {};

  // Criar overlay se não existe
  let overlay = document.getElementById('tx-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'tx-modal-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <span class="modal-handle"></span>
    <div class="modal" id="tx-modal">
      <div style="display:flex;align-items:center;justify-content:center;height:200px">
        <div class="spinner"></div>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); }, { once: true });

  // Carregar dados de suporte
  const userId = getState('user')?.id;
  const [catRes, accRes, cardRes] = await Promise.all([
    db.from('categories').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order'),
    db.from('accounts').select('*').eq('user_id', userId).eq('is_active', true),
    db.from('credit_cards').select('*').eq('user_id', userId).eq('is_active', true),
  ]);

  const categories = catRes.data || [];
  const accounts   = accRes.data || [];
  const cards      = cardRes.data || [];

  // Carregar transação existente se editando
  let tx = null;
  if (txId) {
    const { data } = await db.from('transactions').select('*').eq('id', txId).single();
    tx = data;
  }

  // Renderizar modal
  const modal = document.getElementById('tx-modal');
  modal.innerHTML = renderModalContent(tx, categories, accounts, cards);

  bindModalEvents(modal, categories, accounts, cards, tx);
}

// ─── Fechar modal ─────────────────────────────────────────────
export function closeModal() {
  const overlay = document.getElementById('tx-modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 350);
  }
}

// ─── Renderizar conteúdo do modal ─────────────────────────────
function renderModalContent(tx, categories, accounts, cards) {
  const isEdit  = !!tx;
  const type    = tx?.type || 'expense';
  const today   = new Date().toISOString().split('T')[0];

  const expenseCategories  = categories.filter(c => c.type === 'expense' && !c.parent_id);
  const incomeCategories   = categories.filter(c => c.type === 'income'  && !c.parent_id);
  const transferCategories = categories.filter(c => c.type === 'transfer');

  return `
    <div class="modal-header">
      <h2 class="modal-title">${isEdit ? 'Editar lançamento' : 'Novo lançamento'}</h2>
      <button class="modal-close" id="modal-close-btn">${icon('x', 18)}</button>
    </div>

    <div class="modal-body">

      <!-- Tipo -->
      <div class="form-group">
        <div class="type-toggle" id="type-toggle">
          <button type="button" class="type-btn ${type === 'expense'  ? 'active expense'  : ''}" data-type="expense">
            ${icon('trending-down', 14)} Despesa
          </button>
          <button type="button" class="type-btn ${type === 'income'   ? 'active income'   : ''}" data-type="income">
            ${icon('trending-up', 14)} Receita
          </button>
          <button type="button" class="type-btn ${type === 'transfer' ? 'active transfer' : ''}" data-type="transfer">
            ${icon('arrow-left-right', 14)} Transferência
          </button>
        </div>
      </div>

      <!-- Descrição + Valor -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:12px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Descrição *</label>
          <input type="text" id="tx-desc" class="form-control" placeholder="Ex: Mercado, Salário..." value="${tx?.description || ''}" autocomplete="off">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Valor *</label>
          <div class="input-group">
            <span class="input-prefix" style="font-weight:600;font-size:0.875rem">R$</span>
            <input type="number" id="tx-amount" class="form-control" placeholder="0,00" step="0.01" min="0" value="${tx?.amount || ''}" style="padding-left:36px;width:130px">
          </div>
        </div>
      </div>

      <!-- Categoria -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Categoria</label>
          <select id="tx-category" class="form-control">
            <option value="">Selecionar...</option>
            ${renderCategoryOptions(categories, tx?.type || 'expense', tx?.category_id)}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0" id="subcategory-group">
          <label class="form-label">Subcategoria</label>
          <select id="tx-subcategory" class="form-control">
            <option value="">Opcional</option>
          </select>
        </div>
      </div>

      <!-- Forma de pagamento -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px" id="payment-section">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Forma de pagamento</label>
          <select id="tx-payment-method" class="form-control">
            <option value="debit"  ${tx?.payment_method === 'debit'  ? 'selected' : ''}>Débito</option>
            <option value="credit" ${tx?.payment_method === 'credit' ? 'selected' : ''}>Crédito</option>
            <option value="pix"    ${tx?.payment_method === 'pix'    ? 'selected' : ''}>PIX</option>
            <option value="cash"   ${tx?.payment_method === 'cash'   ? 'selected' : ''}>Dinheiro</option>
            <option value="ted"    ${tx?.payment_method === 'ted'    ? 'selected' : ''}>TED</option>
            <option value="other"  ${tx?.payment_method === 'other'  ? 'selected' : ''}>Outro</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:0" id="account-group">
          <label class="form-label">Conta</label>
          <select id="tx-account" class="form-control">
            <option value="">Selecionar...</option>
            ${accounts.map(a => `<option value="${a.id}" ${tx?.account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Cartão (aparece só quando payment = credit) -->
      <div id="card-section" style="margin-top:16px;display:${tx?.payment_method === 'credit' || !tx ? 'none' : 'none'}">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Cartão de crédito</label>
          <select id="tx-card" class="form-control">
            <option value="">Selecionar cartão...</option>
            ${cards.map(c => `<option value="${c.id}" data-closing="${c.closing_day}" ${tx?.card_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Parcelamento (aparece com cartão) -->
      <div id="installment-section" style="margin-top:16px;display:none">
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px">
          <div class="flex items-center justify-between mb-3">
            <span style="font-size:0.8125rem;font-weight:500;color:var(--text-secondary)">Parcelamento</span>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.8125rem">
              <input type="checkbox" id="tx-installment-toggle" style="cursor:pointer">
              Parcelar compra
            </label>
          </div>

          <div id="installment-fields" style="display:none;gap:12px;display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Nº de parcelas</label>
                <input type="number" id="tx-installments" class="form-control" min="2" max="48" placeholder="Ex: 3" value="${tx?.total_installments || ''}">
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Valor informado é</label>
                <select id="tx-installment-type" class="form-control">
                  <option value="total">Valor total</option>
                  <option value="single">Valor da parcela</option>
                </select>
              </div>
            </div>
            <div id="installment-preview" style="margin-top:10px;display:none;font-size:0.8125rem;color:var(--text-muted);background:var(--bg-card);padding:10px;border-radius:6px;border:1px solid var(--border)">
            </div>
          </div>
        </div>
      </div>

      <!-- Datas -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:16px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Data da compra *</label>
          <input type="date" id="tx-date" class="form-control" value="${tx?.purchase_date || today}">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Vencimento</label>
          <input type="date" id="tx-due-date" class="form-control" value="${tx?.due_date || ''}">
        </div>
        <div class="form-group" style="margin-bottom:0" id="payment-date-group">
          <label class="form-label">Data do pagto.</label>
          <input type="date" id="tx-payment-date" class="form-control" value="${tx?.payment_date || ''}">
        </div>
      </div>

      <!-- Status -->
      <div style="margin-top:16px">
        <label class="form-label">Status</label>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px">
          ${['paid', 'pending', 'overdue', 'cancelled'].map(s => {
            const labels = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado' };
            const colors = { paid: 'income', pending: 'pending', overdue: 'expense', cancelled: '' };
            const selected = (tx?.status || 'pending') === s;
            return `
              <button type="button" class="btn btn-secondary btn-sm status-btn ${selected ? 'active-status-btn' : ''}" data-status="${s}"
                style="${selected ? `background:var(--${colors[s] || 'bg-elevated'}-bg,var(--bg-elevated));color:var(--${colors[s] || 'text-primary'});border-color:var(--${colors[s] || 'border'})` : ''}">
                ${labels[s]}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Local + Tags -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Local / Estabelecimento</label>
          <input type="text" id="tx-place" class="form-control" placeholder="Ex: iFood, Mercado..." value="" autocomplete="off">
          <div id="place-suggestions" style="display:none;position:absolute;z-index:100;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:160px;overflow-y:auto;box-shadow:var(--shadow-lg);width:100%"></div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Tags</label>
          <input type="text" id="tx-tags" class="form-control" placeholder="Separadas por vírgula" value="">
        </div>
      </div>

      <!-- Observações -->
      <div class="form-group" style="margin-top:16px">
        <label class="form-label">Observações</label>
        <textarea id="tx-notes" class="form-control" rows="2" placeholder="Anotações opcionais...">${tx?.notes || ''}</textarea>
      </div>

      <!-- Favorito -->
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:12px;font-size:0.875rem;color:var(--text-secondary)">
        <input type="checkbox" id="tx-favourite" ${tx?.is_favourite ? 'checked' : ''}>
        ${icon('star', 14)} Marcar como favorito / modelo rápido
      </label>

      <div id="tx-form-error" class="form-error" style="display:none;margin-top:12px"></div>
    </div>

    <div class="modal-footer">
      ${isEdit ? `
        <button class="btn btn-danger btn-sm" id="tx-delete-btn">
          ${icon('trash', 14)} Excluir
        </button>
        <button class="btn btn-secondary btn-sm" id="tx-duplicate-btn">
          ${icon('copy', 14)} Duplicar
        </button>
      ` : ''}
      <button class="btn btn-ghost" id="modal-cancel-btn">Cancelar</button>
      <button class="btn btn-primary" id="tx-save-btn">
        ${icon('check', 16)} ${isEdit ? 'Salvar alterações' : 'Adicionar lançamento'}
      </button>
    </div>
  `;
}

// ─── Render de opções de categoria ───────────────────────────
function renderCategoryOptions(categories, type, selectedId) {
  return categories
    .filter(c => c.type === type && !c.parent_id)
    .map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`)
    .join('');
}

// ─── Bind de eventos do modal ─────────────────────────────────
function bindModalEvents(modal, categories, accounts, cards, tx) {
  let selectedType   = tx?.type || 'expense';
  let selectedStatus = tx?.status || 'pending';

  // Fechar
  modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

  // Toggle de tipo
  modal.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type;
      modal.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active', 'expense', 'income', 'transfer'));
      btn.classList.add('active', selectedType);

      // Atualizar opções de categoria
      const catSel = modal.querySelector('#tx-category');
      catSel.innerHTML = `<option value="">Selecionar...</option>${renderCategoryOptions(categories, selectedType, null)}`;

      // Esconder campos irrelevantes
      const paySection = modal.querySelector('#payment-section');
      if (selectedType === 'transfer') {
        paySection.style.display = 'none';
      } else {
        paySection.style.display = 'grid';
      }
    });
  });

  // Mostrar/esconder cartão quando forma de pagamento muda
  modal.querySelector('#tx-payment-method')?.addEventListener('change', e => {
    const isCredit = e.target.value === 'credit';
    modal.querySelector('#card-section').style.display   = isCredit ? 'block' : 'none';
    modal.querySelector('#installment-section').style.display = isCredit ? 'block' : 'none';
    modal.querySelector('#account-group').style.display  = isCredit ? 'none' : 'block';
  });

  // Toggle parcelamento
  modal.querySelector('#tx-installment-toggle')?.addEventListener('change', e => {
    const fields = modal.querySelector('#installment-fields');
    fields.style.display = e.target.checked ? 'block' : 'none';
  });

  // Preview de parcelamento
  const updateInstallmentPreview = () => {
    const amount = +modal.querySelector('#tx-amount').value;
    const count  = +modal.querySelector('#tx-installments')?.value;
    const type   = modal.querySelector('#tx-installment-type')?.value;
    const preview = modal.querySelector('#installment-preview');
    const cardSel = modal.querySelector('#tx-card');
    const closingDay = cardSel?.options[cardSel.selectedIndex]?.dataset.closing || 1;
    const date   = modal.querySelector('#tx-date').value;

    if (amount > 0 && count >= 2) {
      const total  = type === 'total'  ? amount : amount * count;
      const single = type === 'single' ? amount : amount / count;
      preview.style.display = 'block';
      const installments = generateInstallments({
        description: modal.querySelector('#tx-desc').value || 'Compra',
        totalAmount: total,
        installmentAmount: +single.toFixed(2),
        count,
        purchaseDate: date,
        closingDay: +closingDay,
      });
      preview.innerHTML = installments.slice(0, 3).map(p => `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span>${p.installment_number}/${count} — fatura ${p.invoice_month}</span>
          <span style="font-weight:600;color:var(--text-primary)">${formatCurrency(p.amount)}</span>
        </div>
      `).join('') + (count > 3 ? `<div style="color:var(--text-muted)">+ ${count - 3} parcelas...</div>` : '');
    } else {
      preview.style.display = 'none';
    }
  };

  modal.querySelector('#tx-installments')?.addEventListener('input', updateInstallmentPreview);
  modal.querySelector('#tx-installment-type')?.addEventListener('change', updateInstallmentPreview);
  modal.querySelector('#tx-amount')?.addEventListener('input', updateInstallmentPreview);

  // Subcategoria: carregar ao mudar categoria
  modal.querySelector('#tx-category')?.addEventListener('change', e => {
    const parentId = e.target.value;
    const subs = categories.filter(c => c.parent_id === parentId);
    const sel  = modal.querySelector('#tx-subcategory');
    sel.innerHTML = `<option value="">Opcional</option>${subs.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}`;
  });

  // Status
  modal.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStatus = btn.dataset.status;
      modal.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active-status-btn'));
      btn.classList.add('active-status-btn');
    });
  });

  // Salvar
  modal.querySelector('#tx-save-btn')?.addEventListener('click', async () => {
    const btn = modal.querySelector('#tx-save-btn');
    const errEl = modal.querySelector('#tx-form-error');
    errEl.style.display = 'none';

    const desc   = modal.querySelector('#tx-desc').value.trim();
    const amount = +modal.querySelector('#tx-amount').value;
    const date   = modal.querySelector('#tx-date').value;

    if (!desc)     return showFormError(errEl, 'Informe a descrição');
    if (!amount || amount <= 0) return showFormError(errEl, 'Informe o valor');
    if (!date)     return showFormError(errEl, 'Informe a data');

    setLoading(btn, true);

    try {
      const paymentMethod = modal.querySelector('#tx-payment-method').value;
      const cardId        = modal.querySelector('#tx-card')?.value || null;
      const isInstallment = modal.querySelector('#tx-installment-toggle')?.checked && cardId;
      const installCount  = +modal.querySelector('#tx-installments')?.value || 0;

      // Calcular invoice_month se for cartão
      let invoiceMonth = null;
      if (cardId) {
        const card = cards.find(c => c.id === cardId);
        if (card) invoiceMonth = calcInvoiceMonth(date, card.closing_day);
      }

      const base = {
        user_id:         getState('user').id,
        description:     desc,
        amount,
        type:            selectedType,
        status:          selectedStatus,
        category_id:     modal.querySelector('#tx-category').value || null,
        subcategory_id:  modal.querySelector('#tx-subcategory').value || null,
        account_id:      modal.querySelector('#tx-account')?.value || null,
        card_id:         cardId,
        payment_method:  paymentMethod,
        purchase_date:   date,
        due_date:        modal.querySelector('#tx-due-date').value || null,
        payment_date:    modal.querySelector('#tx-payment-date').value || null,
        notes:           modal.querySelector('#tx-notes').value.trim() || null,
        is_favourite:    modal.querySelector('#tx-favourite').checked,
        invoice_month:   invoiceMonth,
      };

      if (isInstallment && installCount >= 2) {
        await saveInstallments(base, installCount, modal, cards);
      } else if (currentTxId) {
        await updateTransaction(currentTxId, base);
      } else {
        await createTransaction(base);
      }

      closeModal();
      toast(currentTxId ? 'Lançamento atualizado!' : 'Lançamento adicionado!', 'success');
      window.dispatchEvent(new CustomEvent('vertice:transaction-saved'));

    } catch (err) {
      showFormError(errEl, err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(btn, false);
    }
  });

  // Excluir
  modal.querySelector('#tx-delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;
    const { error } = await db.from('transactions').delete().eq('id', currentTxId);
    if (error) { toast('Erro ao excluir', 'error'); return; }
    closeModal();
    toast('Lançamento excluído', 'success');
    window.dispatchEvent(new CustomEvent('vertice:transaction-saved'));
  });

  // Duplicar
  modal.querySelector('#tx-duplicate-btn')?.addEventListener('click', async () => {
    const { data: orig } = await db.from('transactions').select('*').eq('id', currentTxId).single();
    if (!orig) return;
    const { id, created_at, updated_at, ...rest } = orig;
    const { error } = await db.from('transactions').insert({ ...rest, description: rest.description + ' (cópia)' });
    if (error) { toast('Erro ao duplicar', 'error'); return; }
    closeModal();
    toast('Lançamento duplicado!', 'success');
    window.dispatchEvent(new CustomEvent('vertice:transaction-saved'));
  });
}

// ─── Criar transação simples ──────────────────────────────────
async function createTransaction(data) {
  const { error } = await db.from('transactions').insert(data);
  if (error) throw error;
}

// ─── Atualizar transação ──────────────────────────────────────
async function updateTransaction(id, data) {
  const { error } = await db.from('transactions').update(data).eq('id', id);
  if (error) throw error;
}

// ─── Salvar compra parcelada ──────────────────────────────────
async function saveInstallments(base, count, modal, cards) {
  const amountVal   = +modal.querySelector('#tx-amount').value;
  const instType    = modal.querySelector('#tx-installment-type')?.value;
  const total       = instType === 'total' ? amountVal : amountVal * count;
  const single      = +(total / count).toFixed(2);
  const card        = cards.find(c => c.id === base.card_id);
  const closingDay  = card?.closing_day || 1;

  // Criar grupo
  const { data: group, error: gErr } = await db.from('installment_groups').insert({
    user_id:              base.user_id,
    description:          base.description,
    total_amount:         total,
    installment_amount:   single,
    total_installments:   count,
    card_id:              base.card_id,
    category_id:          base.category_id,
    place_id:             base.place_id || null,
    purchase_date:        base.purchase_date,
  }).select().single();

  if (gErr) throw gErr;

  // Gerar parcelas
  const parcelas = generateInstallments({
    description:        base.description,
    totalAmount:        total,
    installmentAmount:  single,
    count,
    purchaseDate:       base.purchase_date,
    closingDay,
  });

  const toInsert = parcelas.map(p => ({
    ...base,
    description:          p.description,
    amount:               p.amount,
    purchase_date:        p.purchase_date,
    invoice_month:        p.invoice_month,
    installment_group_id: group.id,
    installment_number:   p.installment_number,
    total_installments:   count,
    status:               'pending',
  }));

  const { error: txErr } = await db.from('transactions').insert(toInsert);
  if (txErr) throw txErr;
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

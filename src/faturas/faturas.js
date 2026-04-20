// ============================================================
// VÉRTICE — Faturas
// src/faturas/faturas.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { getState } from '../../assets/js/store.js';
import { formatCurrency, formatDate, currentMonth, prevMonth, nextMonth, monthLabel, statusLabel, statusClass, typeColor, toast } from '../../assets/js/utils.js';
import { icon } from '../../assets/js/icons.js';

let selectedCard  = null;
let selectedMonth = currentMonth();

export async function renderFaturas(container) {
  selectedMonth = getState('selectedMonth') || currentMonth();
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
  await loadFaturas(container);
}

async function loadFaturas(container) {
  const userId = getState('user')?.id;

  const { data: cards } = await db.from('credit_cards').select('*').eq('user_id', userId).eq('is_active', true);
  if (!selectedCard && cards?.length) selectedCard = cards[0].id;

  const card = cards?.find(c => c.id === selectedCard);

  // Transações da fatura selecionada
  let transactions = [];
  if (selectedCard) {
    const { data } = await db
      .from('transactions')
      .select('*, category:categories(name,color,icon)')
      .eq('user_id', userId)
      .eq('card_id', selectedCard)
      .eq('invoice_month', selectedMonth)
      .eq('is_archived', false)
      .order('purchase_date', { ascending: false });
    transactions = data || [];
  }

  const total   = transactions.filter(t => t.status !== 'cancelled').reduce((s, t) => s + +t.amount, 0);
  const paid    = transactions.filter(t => t.status === 'paid').reduce((s, t) => s + +t.amount, 0);
  const pending = total - paid;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Faturas</h2>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-top:2px">Gerencie as faturas dos seus cartões</p>
      </div>
    </div>

    ${!cards?.length ? `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">${icon('credit-card', 24)}</div>
          <p class="empty-state-title">Nenhum cartão cadastrado</p>
          <p class="empty-state-desc">Cadastre um cartão para visualizar as faturas</p>
        </div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:260px 1fr;gap:20px">

        <!-- Sidebar de cartões -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${cards.map(c => `
            <div class="card card-sm" style="cursor:pointer;border-color:${c.id === selectedCard ? 'var(--accent-border)' : 'var(--border)'};background:${c.id === selectedCard ? 'var(--bg-active)' : 'var(--bg-card)'}" data-select-card="${c.id}">
              <div class="flex items-center gap-10">
                <div style="width:12px;height:12px;border-radius:50%;background:${c.color || '#6366f1'};flex-shrink:0"></div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:500;font-size:0.875rem;truncate">${c.name}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">Fecha dia ${c.closing_day} | Vence dia ${c.due_day}</div>
                </div>
                ${c.id === selectedCard ? icon('chevron-right', 14) : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Conteúdo da fatura -->
        <div>
          <!-- Navegação de mês -->
          <div class="card card-sm mb-4">
            <div class="flex items-center justify-between">
              <button class="btn btn-secondary btn-sm btn-icon" id="fatura-prev-month">${icon('chevron-left', 14)}</button>
              <div style="text-align:center">
                <div style="font-weight:600;font-size:1rem">${monthLabel(selectedMonth)}</div>
                ${card ? `
                  <div style="font-size:0.75rem;color:var(--text-muted)">
                    Fecha: dia ${card.closing_day} | Vence: dia ${card.due_day}
                  </div>
                ` : ''}
              </div>
              <button class="btn btn-secondary btn-sm btn-icon" id="fatura-next-month">${icon('chevron-right', 14)}</button>
            </div>
          </div>

          <!-- Totais da fatura -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
            <div class="stat-card" style="padding:16px">
              <div class="stat-icon expense" style="width:36px;height:36px">${icon('file-text', 16)}</div>
              <div class="stat-body">
                <div class="stat-label" style="font-size:0.6875rem">Total da fatura</div>
                <div class="stat-value text-expense" style="font-size:1.125rem">${formatCurrency(total)}</div>
              </div>
            </div>
            <div class="stat-card" style="padding:16px">
              <div class="stat-icon income" style="width:36px;height:36px">${icon('check', 16)}</div>
              <div class="stat-body">
                <div class="stat-label" style="font-size:0.6875rem">Pago</div>
                <div class="stat-value text-income" style="font-size:1.125rem">${formatCurrency(paid)}</div>
              </div>
            </div>
            <div class="stat-card" style="padding:16px">
              <div class="stat-icon pending" style="width:36px;height:36px">${icon('alert-triangle', 16)}</div>
              <div class="stat-body">
                <div class="stat-label" style="font-size:0.6875rem">Pendente</div>
                <div class="stat-value text-pending" style="font-size:1.125rem">${formatCurrency(pending)}</div>
              </div>
            </div>
          </div>

          <!-- Barra de progresso -->
          ${total > 0 ? `
            <div class="card card-sm mb-4">
              <div class="flex items-center justify-between mb-2">
                <span style="font-size:0.8125rem;color:var(--text-secondary)">Pagamento da fatura</span>
                <span style="font-size:0.8125rem;font-weight:600">${total > 0 ? ((paid/total)*100).toFixed(0) : 0}%</span>
              </div>
              <div class="progress-bar" style="height:8px">
                <div class="progress-fill income" style="width:${total > 0 ? ((paid/total)*100).toFixed(1) : 0}%"></div>
              </div>
              ${pending > 0 ? `<div style="margin-top:10px;text-align:right"><button class="btn btn-primary btn-sm" id="pagar-fatura-btn">${icon('check', 14)} Marcar fatura como paga</button></div>` : ''}
            </div>
          ` : ''}

          <!-- Transações da fatura -->
          <div class="card" style="padding:0">
            ${transactions.length === 0 ? `
              <div class="empty-state">
                <div class="empty-state-icon">${icon('file-text', 24)}</div>
                <p class="empty-state-title">Fatura vazia</p>
                <p class="empty-state-desc">Nenhuma compra nesta fatura</p>
              </div>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Data da compra</th>
                    <th>Status</th>
                    <th style="text-align:right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${transactions.map(t => `
                    <tr>
                      <td>
                        <div style="font-weight:500;font-size:0.875rem">${t.description}</div>
                        ${t.total_installments ? `<div style="font-size:0.75rem;color:var(--transfer)">${t.installment_number}/${t.total_installments}x</div>` : ''}
                      </td>
                      <td>
                        ${t.category ? `
                          <div class="flex items-center gap-2">
                            <div style="width:22px;height:22px;border-radius:6px;background:${t.category.color}22;color:${t.category.color};display:flex;align-items:center;justify-content:center">
                              ${icon(t.category.icon || 'tag', 11)}
                            </div>
                            <span style="font-size:0.8125rem">${t.category.name}</span>
                          </div>
                        ` : '—'}
                      </td>
                      <td style="font-size:0.8125rem;color:var(--text-secondary)">${formatDate(t.purchase_date)}</td>
                      <td><span class="badge ${statusClass(t.status)}">${statusLabel(t.status)}</span></td>
                      <td style="text-align:right;font-weight:600;color:var(--expense)">${formatCurrency(t.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:var(--bg-elevated)">
                    <td colspan="4" style="font-weight:600;padding:14px 20px">Total</td>
                    <td style="text-align:right;font-weight:700;font-family:var(--font-display);font-size:1rem;padding:14px 20px;color:var(--expense)">${formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            `}
          </div>
        </div>

      </div>
    `}
  `;

  // Eventos
  container.querySelectorAll('[data-select-card]').forEach(el => {
    el.addEventListener('click', () => {
      selectedCard = el.dataset.selectCard;
      loadFaturas(container);
    });
  });

  container.querySelector('#fatura-prev-month')?.addEventListener('click', () => {
    selectedMonth = prevMonth(selectedMonth);
    loadFaturas(container);
  });

  container.querySelector('#fatura-next-month')?.addEventListener('click', () => {
    selectedMonth = nextMonth(selectedMonth);
    loadFaturas(container);
  });

  container.querySelector('#pagar-fatura-btn')?.addEventListener('click', async () => {
    if (!confirm('Marcar todas as transações pendentes desta fatura como pagas?')) return;
    const ids = transactions.filter(t => t.status === 'pending' || t.status === 'overdue').map(t => t.id);
    if (ids.length) {
      await db.from('transactions').update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] }).in('id', ids);
      toast('Fatura marcada como paga!', 'success');
      loadFaturas(container);
    }
  });
}

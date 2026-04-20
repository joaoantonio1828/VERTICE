// ============================================================
// VÉRTICE — Utilitários Globais
// assets/js/utils.js
// ============================================================

// ─── Formatação de moeda ─────────────────────────────────────
export function formatCurrency(value, currency = 'BRL') {
  if (value === null || value === undefined || isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
}

// ─── Formatação de data ──────────────────────────────────────
export function formatDate(dateStr, format = 'short') {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T12:00:00'); // evitar fuso
  if (format === 'short') {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  if (format === 'long') {
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (format === 'month') {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }
  if (format === 'monthShort') {
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }
  if (format === 'day') {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR');
}

// ─── Mês atual no formato YYYY-MM ────────────────────────────
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(yyyymm) {
  if (!yyyymm) return '';
  const [y, m] = yyyymm.split('-');
  const date = new Date(+y, +m - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function prevMonth(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nextMonth(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Calcular invoice_month ───────────────────────────────────
export function calcInvoiceMonth(purchaseDateStr, closingDay) {
  const date = new Date(purchaseDateStr + 'T12:00:00');
  const day  = date.getDate();
  if (day > closingDay) {
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Gerar parcelas ───────────────────────────────────────────
export function generateInstallments({ description, totalAmount, installmentAmount, count, purchaseDate, closingDay }) {
  const installments = [];
  const baseDate = new Date(purchaseDate + 'T12:00:00');

  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
    const dateStr = d.toISOString().split('T')[0];
    const invoiceMonth = calcInvoiceMonth(dateStr, closingDay);
    installments.push({
      description: `${description} (${i + 1}/${count})`,
      amount: i === count - 1
        ? +(totalAmount - installmentAmount * (count - 1)).toFixed(2) // última ajusta diferença de centavos
        : installmentAmount,
      purchase_date: dateStr,
      invoice_month: invoiceMonth,
      installment_number: i + 1,
      total_installments: count,
    });
  }
  return installments;
}

// ─── Debounce ─────────────────────────────────────────────────
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── Initials de nome ─────────────────────────────────────────
export function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Cor de tipo ──────────────────────────────────────────────
export function typeColor(type) {
  const map = { income: 'income', expense: 'expense', transfer: 'transfer' };
  return map[type] || '';
}

export function typeLabel(type) {
  const map = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' };
  return map[type] || type;
}

export function statusLabel(status) {
  const map = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado' };
  return map[status] || status;
}

export function statusClass(status) {
  const map = { paid: 'badge-paid', pending: 'badge-pending', overdue: 'badge-overdue', cancelled: 'badge-cancelled' };
  return map[status] || '';
}

// ─── Clonar objeto profundamente ─────────────────────────────
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Toast notification ───────────────────────────────────────
export function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  const colorMap = {
    success: 'var(--income)',
    error:   'var(--expense)',
    warning: 'var(--pending)',
    info:    'var(--transfer)',
  };

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.style.color = colorMap[type] || 'var(--text-secondary)';
  el.innerHTML = `${icons[type] || icons.info}<span style="color:var(--text-primary)">${message}</span>`;

  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toast-in 0.25s var(--ease) reverse forwards';
    setTimeout(() => el.remove(), 250);
  }, duration);
}

// ─── Confirmar ação ───────────────────────────────────────────
export function confirm(message) {
  return window.confirm(message);
}

// ─── Esconder/mostrar loading ─────────────────────────────────
export function setLoading(el, loading) {
  if (!el) return;
  if (loading) {
    el.dataset.originalText = el.innerHTML;
    el.disabled = true;
    el.innerHTML = `<span class="spinner"></span>`;
  } else {
    el.disabled = false;
    el.innerHTML = el.dataset.originalText || '';
  }
}

// ─── Obter primeiro e último dia do mês ───────────────────────
export function monthRange(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 0);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
}

// ─── Número → cor de porcentagem ─────────────────────────────
export function percentColor(pct) {
  if (pct >= 90) return 'var(--expense)';
  if (pct >= 70) return 'var(--pending)';
  return 'var(--income)';
}

// ─── Slugify ──────────────────────────────────────────────────
export function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

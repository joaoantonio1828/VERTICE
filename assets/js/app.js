// ============================================================
// VÉRTICE — App Principal (Entry Point)
// assets/js/app.js
// ============================================================

import { db } from './supabase.js';
import { initTheme, setState, getState } from './store.js';
import { route, navigate, startRouter } from './router.js';
import { renderAuth } from '../src/auth/auth.js';
import { renderLayout, updateActiveNav, setPageTitle } from '../src/layout.js';
import { renderDashboard } from '../src/dashboard/dashboard.js';
import { renderLancamentos } from '../src/lancamentos/lancamentos.js';
import { renderCartoes } from '../src/cartoes/cartoes.js';
import { renderFaturas } from '../src/faturas/faturas.js';
import { renderContas } from '../src/contas/contas.js';
import { renderRelatorios } from '../src/relatorios/relatorios.js';
import { renderMetas } from '../src/metas/metas.js';
import { openTransactionModal } from '../src/lancamentos/modal.js';

// ─── Inicialização ────────────────────────────────────────────
async function init() {
  initTheme();

  // Verificar sessão ativa
  const { data: { session } } = await db.auth.getSession();

  if (session?.user) {
    setState({ user: session.user });
    await loadUserProfile(session.user.id);
  }

  // Listener de mudança de auth
  window.addEventListener('auth:change', async ({ detail: { event, session } }) => {
    if (event === 'SIGNED_IN' && session) {
      setState({ user: session.user });
      await loadUserProfile(session.user.id);
    }
    if (event === 'SIGNED_OUT') {
      setState({ user: null, profile: null });
    }
  });

  // Definir rotas
  defineRoutes();

  // Iniciar router
  startRouter();

  // Listener global de evento FAB / modal
  window.addEventListener('vertice:open-transaction-modal', (e) => {
    openTransactionModal(e.detail?.id || null);
  });
}

// ─── Carregar perfil do usuário ───────────────────────────────
async function loadUserProfile(userId) {
  const { data } = await db.from('profiles').select('*').eq('id', userId).single();
  if (data) setState({ profile: data });
}

// ─── Definir rotas ────────────────────────────────────────────
function defineRoutes() {

  // Guard: verificar autenticação
  async function requireAuth(fn, pageTitle) {
    const user = getState('user');
    if (!user) {
      navigate('/auth', true);
      return;
    }
    renderLayout(pageTitle, fn);
    updateActiveNav();
  }

  // Auth
  route('/auth', () => {
    const params = new URLSearchParams(location.search);
    const mode   = params.get('mode') || 'login';
    renderAuth(mode);
  });

  // Dashboard
  route('/', () => requireAuth(container => renderDashboard(container), 'Dashboard'));

  // Lançamentos
  route('/lancamentos', () => requireAuth(container => renderLancamentos(container), 'Lançamentos'));

  // Cartões
  route('/cartoes', () => requireAuth(container => renderCartoes(container), 'Cartões de Crédito'));

  // Faturas
  route('/faturas', () => requireAuth(container => renderFaturas(container), 'Faturas'));

  // Contas
  route('/contas', () => requireAuth(container => renderContas(container), 'Contas & Carteiras'));

  // Relatórios
  route('/relatorios', () => requireAuth(container => renderRelatorios(container), 'Relatórios'));

  // Metas
  route('/metas', () => requireAuth(container => renderMetas(container), 'Metas & Orçamento'));

  // Categorias
  route('/categorias', () => requireAuth(async container => {
    const { renderCategorias } = await import('../src/relatorios/relatorios.js');
    renderCategorias(container);
  }, 'Categorias'));

  // Agenda
  route('/agenda', () => requireAuth(container => renderAgenda(container), 'Agenda Financeira'));

  // Configurações
  route('/configuracoes', () => requireAuth(container => renderConfiguracoes(container), 'Configurações'));

  // 404
  route('*', () => {
    const user = getState('user');
    if (user) navigate('/', true);
    else navigate('/auth', true);
  });
}

// ─── Agenda Financeira (simplificada) ─────────────────────────
async function renderAgenda(container) {
  const { db: supabase } = await import('./supabase.js');
  const userId = getState('user')?.id;
  const { formatDate, formatCurrency, statusClass, statusLabel } = await import('./utils.js');
  const { icon: ic } = await import('./icons.js');

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const end   = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().split('T')[0];

  const { data: events } = await supabase
    .from('transactions')
    .select('id, description, amount, due_date, purchase_date, type, status, card:credit_cards(name)')
    .eq('user_id', userId)
    .or(`due_date.gte.${start},purchase_date.gte.${start}`)
    .lte('purchase_date', end)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false });

  const upcomingDue = (events || []).filter(e => e.due_date && e.status === 'pending').slice(0, 20);

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Agenda Financeira</h2>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Vencimentos próximos</span></div>
      ${upcomingDue.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">${ic('calendar', 24)}</div>
          <p class="empty-state-title">Nenhum vencimento próximo</p>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${upcomingDue.map(e => {
            const dueDate = new Date(e.due_date + 'T12:00:00');
            const diffDays = Math.ceil((dueDate - new Date()) / 86400000);
            const urgency  = diffDays <= 3 ? 'var(--expense)' : diffDays <= 7 ? 'var(--pending)' : 'var(--text-secondary)';
            return `
              <div class="flex items-center justify-between" style="padding:12px 14px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:500;font-size:0.875rem">${e.description}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${e.card?.name ? e.card.name + ' · ' : ''}Vence ${formatDate(e.due_date)}</div>
                </div>
                <div style="text-align:right;margin-left:16px">
                  <div style="font-weight:600;color:var(--expense)">${formatCurrency(e.amount)}</div>
                  <div style="font-size:0.75rem;color:${urgency};font-weight:500">${diffDays === 0 ? 'Hoje!' : diffDays < 0 ? 'Atrasado' : `Em ${diffDays} dias`}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

// ─── Configurações ────────────────────────────────────────────
async function renderConfiguracoes(container) {
  const { icon: ic }       = await import('./icons.js');
  const { getState: gs }   = await import('./store.js');
  const { setTheme }       = await import('./store.js');
  const { toast: t }       = await import('./utils.js');
  const { db: supabase }   = await import('./supabase.js');
  const { initials }       = await import('./utils.js');

  const user    = gs('user');
  const profile = gs('profile');
  const name    = profile?.full_name || '';
  const theme   = gs('theme');

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-display" style="font-size:1.5rem;font-weight:600">Configurações</h2>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

      <!-- Perfil -->
      <div class="card">
        <div class="card-header"><span class="card-title">Meu perfil</span></div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--accent-dim);border:2px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:600;color:var(--accent)">
            ${initials(name)}
          </div>
          <div>
            <div style="font-weight:600;font-size:1rem">${name || 'Usuário'}</div>
            <div style="font-size:0.875rem;color:var(--text-muted)">${user?.email || ''}</div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nome completo</label>
          <input type="text" id="profile-name" class="form-control" value="${name}">
        </div>
        <button class="btn btn-primary w-full" id="save-profile-btn">${ic('check', 16)} Salvar perfil</button>
      </div>

      <!-- Aparência -->
      <div class="card">
        <div class="card-header"><span class="card-title">Aparência</span></div>
        <div class="form-group">
          <label class="form-label">Tema</label>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px">
            ${[['dark','Escuro','moon'],['light','Claro','sun'],['system','Sistema','settings']].map(([v, l, ico]) => `
              <button class="btn btn-secondary btn-sm theme-opt ${theme === v ? 'active' : ''}" data-theme-val="${v}"
                style="${theme === v ? 'border-color:var(--accent-border);color:var(--accent);background:var(--accent-dim)' : ''}">
                ${ic(ico, 14)} ${l}
              </button>
            `).join('')}
          </div>
        </div>
        <div style="margin-top:16px;padding:14px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border)">
          <div style="font-size:0.8125rem;font-weight:500;margin-bottom:4px">Vértice v1.0.0</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Sistema financeiro pessoal premium</div>
        </div>
      </div>

      <!-- Segurança -->
      <div class="card">
        <div class="card-header"><span class="card-title">Segurança</span></div>
        <div class="form-group">
          <label class="form-label">Nova senha</label>
          <input type="password" id="new-password" class="form-control" placeholder="Mínimo 8 caracteres">
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar senha</label>
          <input type="password" id="confirm-password" class="form-control" placeholder="Repita a senha">
        </div>
        <button class="btn btn-secondary w-full" id="change-password-btn">${ic('lock', 14)} Alterar senha</button>
      </div>

    </div>
  `;

  // Salvar perfil
  container.querySelector('#save-profile-btn')?.addEventListener('click', async () => {
    const newName = container.querySelector('#profile-name').value.trim();
    await supabase.from('profiles').update({ full_name: newName }).eq('id', user.id);
    const { setState: ss } = await import('./store.js');
    ss({ profile: { ...profile, full_name: newName } });
    t('Perfil atualizado!', 'success');
  });

  // Tema
  container.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeVal);
      container.querySelectorAll('.theme-opt').forEach(b => {
        b.classList.remove('active');
        b.style.cssText = '';
      });
      btn.classList.add('active');
      btn.style.cssText = 'border-color:var(--accent-border);color:var(--accent);background:var(--accent-dim)';
    });
  });

  // Senha
  container.querySelector('#change-password-btn')?.addEventListener('click', async () => {
    const np = container.querySelector('#new-password').value;
    const cp = container.querySelector('#confirm-password').value;
    if (!np || np.length < 8) { t('A senha deve ter pelo menos 8 caracteres', 'error'); return; }
    if (np !== cp)            { t('As senhas não coincidem', 'error'); return; }
    const { error } = await supabase.auth.updateUser({ password: np });
    if (error) { t('Erro ao alterar senha: ' + error.message, 'error'); return; }
    t('Senha alterada com sucesso!', 'success');
    container.querySelector('#new-password').value = '';
    container.querySelector('#confirm-password').value = '';
  });
}

// ─── Iniciar aplicação ────────────────────────────────────────
init();

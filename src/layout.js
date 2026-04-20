// ============================================================
// VÉRTICE — Layout Principal
// src/layout.js
// ============================================================

import { db } from '../assets/js/supabase.js';
import { getState, setState, subscribe } from '../assets/js/store.js';
import { initials, toast } from '../assets/js/utils.js';
import { icon } from '../assets/js/icons.js';
import { navigate, currentPath } from '../assets/js/router.js';
import { signOut } from './auth/auth.js';

const NAV_ITEMS = [
  { path: '/',              label: 'Dashboard',    iconName: 'home' },
  { path: '/lancamentos',   label: 'Lançamentos',  iconName: 'layers' },
  { path: '/cartoes',       label: 'Cartões',      iconName: 'credit-card' },
  { path: '/faturas',       label: 'Faturas',      iconName: 'file-text' },
  { path: '/contas',        label: 'Contas',       iconName: 'wallet' },
  { path: '/relatorios',    label: 'Relatórios',   iconName: 'bar-chart-2' },
  { path: '/metas',         label: 'Metas',        iconName: 'target' },
  { path: '/categorias',    label: 'Categorias',   iconName: 'tag' },
  { path: '/agenda',        label: 'Agenda',       iconName: 'calendar' },
  { path: '/configuracoes', label: 'Configurações',iconName: 'settings' },
];

// ─── Renderizar layout completo ───────────────────────────────
export function renderLayout(pageTitle, contentFn) {
  const app  = document.getElementById('app');
  const { profile, user } = getState();
  const name  = profile?.full_name || user?.email || '';
  const email = user?.email || '';

  app.innerHTML = `
    <div id="app-layout">

      <!-- Sidebar overlay mobile -->
      <div id="sidebar-overlay" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;backdrop-filter:blur(2px)"></div>

      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">
            ${icon('trending-up', 20)}
          </div>
          <span class="sidebar-logo-text">Vért<span>ice</span></span>
        </div>

        <nav class="sidebar-section" style="flex:1">
          <div class="sidebar-section-label">Menu</div>
          ${renderNavItems()}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user" id="sidebar-user-btn">
            <div class="sidebar-user-avatar">${initials(name)}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${name || 'Usuário'}</div>
              <div class="sidebar-user-email">${email}</div>
            </div>
            ${icon('more-vertical', 16)}
          </div>
        </div>
      </aside>

      <!-- Conteúdo -->
      <div class="main-content">
        <!-- Topbar -->
        <header class="topbar">
          <button class="topbar-menu-btn" id="topbar-menu-btn">
            ${icon('menu', 20)}
          </button>
          <h1 class="topbar-title" id="topbar-title">${pageTitle}</h1>
          <div class="topbar-spacer"></div>

          <div class="topbar-search">
            ${icon('search', 15)}
            <input type="text" placeholder="Buscar lançamentos..." id="global-search" autocomplete="off">
          </div>

          <button class="topbar-btn" id="theme-toggle-btn" title="Alternar tema">
            ${icon('sun', 18)}
          </button>

          <button class="topbar-btn" title="Notificações">
            ${icon('bell', 18)}
          </button>
        </header>

        <!-- Conteúdo da página -->
        <main class="page-content" id="page-content">
          <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>
        </main>

        <!-- FAB -->
        <button class="fab" id="fab-add" title="Novo lançamento">
          ${icon('plus', 24)}
        </button>
      </div>

    </div>

    <!-- Toast container -->
    <div id="toast-container"></div>
  `;

  bindLayoutEvents();
  updateActiveNav();

  // Renderizar conteúdo
  setTimeout(() => {
    const content = document.getElementById('page-content');
    if (content && typeof contentFn === 'function') {
      contentFn(content);
    }
  }, 50);
}

// ─── Items de navegação ───────────────────────────────────────
function renderNavItems() {
  return NAV_ITEMS.map(item => `
    <div class="nav-item" data-path="${item.path}" tabindex="0" role="button">
      <span class="nav-item-icon">${icon(item.iconName, 18)}</span>
      <span>${item.label}</span>
    </div>
  `).join('');
}

// ─── Atualizar item ativo ─────────────────────────────────────
export function updateActiveNav() {
  const path = currentPath();
  document.querySelectorAll('.nav-item').forEach(el => {
    const isActive = el.dataset.path === path ||
      (el.dataset.path !== '/' && path.startsWith(el.dataset.path));
    el.classList.toggle('active', isActive);
  });
}

// ─── Bind de eventos do layout ────────────────────────────────
function bindLayoutEvents() {
  // Navegação via sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      navigate(el.dataset.path);
      closeSidebar();
    });
  });

  // Menu mobile
  document.getElementById('topbar-menu-btn')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Tema
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

  // User menu
  document.getElementById('sidebar-user-btn')?.addEventListener('click', showUserMenu);

  // FAB
  document.getElementById('fab-add')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('vertice:open-transaction-modal'));
  });

  // Pesquisa global
  let searchTimer;
  document.getElementById('global-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = e.target.value.trim();
      if (q.length >= 2) {
        setState({ searchQuery: q });
        navigate('/lancamentos');
      }
    }, 400);
  });
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar?.classList.contains('open');

  if (isOpen) {
    closeSidebar();
  } else {
    sidebar?.classList.add('open');
    overlay?.classList.remove('hidden');
    setState({ sidebarOpen: true });
  }
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.add('hidden');
  setState({ sidebarOpen: false });
}

function toggleTheme() {
  const { theme } = getState();
  const next = theme === 'dark' ? 'light' : 'dark';
  import('../assets/js/store.js').then(({ setTheme }) => setTheme(next));

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = next === 'dark' ? icon('moon', 18) : icon('sun', 18);
  }
}

function showUserMenu() {
  // Menu popup simples
  const existing = document.getElementById('user-popup');
  if (existing) { existing.remove(); return; }

  const btn = document.getElementById('sidebar-user-btn');
  const rect = btn.getBoundingClientRect();

  const popup = document.createElement('div');
  popup.id = 'user-popup';
  popup.style.cssText = `
    position: fixed;
    bottom: ${window.innerHeight - rect.top + 8}px;
    left: ${rect.left}px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    min-width: 200px;
    z-index: 500;
    overflow: hidden;
    animation: toast-in 0.2s var(--spring);
  `;

  popup.innerHTML = `
    <button class="nav-item w-full" style="border-radius:0;padding:12px 16px" data-action="profile">
      ${icon('user', 16)}<span>Meu perfil</span>
    </button>
    <button class="nav-item w-full" style="border-radius:0;padding:12px 16px" data-action="settings">
      ${icon('settings', 16)}<span>Configurações</span>
    </button>
    <div style="height:1px;background:var(--border);margin:4px 0"></div>
    <button class="nav-item w-full" style="border-radius:0;padding:12px 16px;color:var(--expense)" data-action="logout">
      ${icon('log-out', 16)}<span>Sair</span>
    </button>
  `;

  popup.addEventListener('click', async e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    popup.remove();
    if (action === 'logout') {
      await signOut();
    } else if (action === 'settings') {
      navigate('/configuracoes');
    } else if (action === 'profile') {
      navigate('/configuracoes');
    }
  });

  document.body.appendChild(popup);

  // Fechar ao clicar fora
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 50);
}

// ─── Atualizar título da página ────────────────────────────────
export function setPageTitle(title) {
  const el = document.getElementById('topbar-title');
  if (el) el.textContent = title;
}

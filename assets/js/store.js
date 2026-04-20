// ============================================================
// VÉRTICE — Store de Estado Global
// assets/js/store.js
// ============================================================

import { currentMonth } from './utils.js';

// Estado global reativo simples
const listeners = {};

const state = {
  // Auth
  user:          null,
  profile:       null,

  // Dados carregados
  accounts:      [],
  creditCards:   [],
  categories:    [],
  tags:          [],
  places:        [],

  // Filtros ativos
  selectedMonth: currentMonth(),
  filterType:    'all',     // 'all' | 'income' | 'expense' | 'transfer'
  filterStatus:  'all',     // 'all' | 'paid' | 'pending' | 'overdue'
  filterCard:    null,
  filterAccount: null,
  filterCategory: null,
  searchQuery:   '',

  // UI
  sidebarOpen:   false,
  loading:       false,
  theme:         localStorage.getItem('vertice_theme') || 'dark',
};

/**
 * Obter valor do estado
 */
export function getState(key) {
  return key ? state[key] : { ...state };
}

/**
 * Atualizar estado e notificar listeners
 */
export function setState(updates) {
  Object.assign(state, updates);
  const keys = Object.keys(updates);

  // Notificar listeners específicos
  keys.forEach(key => {
    if (listeners[key]) {
      listeners[key].forEach(fn => fn(state[key], state));
    }
  });

  // Notificar listeners globais
  if (listeners['*']) {
    listeners['*'].forEach(fn => fn(state));
  }
}

/**
 * Inscrever em mudanças de estado
 * @param {string|'*'} key - Chave ou '*' para global
 * @param {Function} fn
 * @returns unsubscribe function
 */
export function subscribe(key, fn) {
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(fn);
  return () => {
    listeners[key] = listeners[key].filter(f => f !== fn);
  };
}

/**
 * Tema
 */
export function setTheme(theme) {
  setState({ theme });
  localStorage.setItem('vertice_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme() {
  const saved = localStorage.getItem('vertice_theme') || 'dark';
  let resolved = saved;

  if (saved === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', resolved);
  setState({ theme: saved });
}

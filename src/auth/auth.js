// ============================================================
// VÉRTICE — Módulo de Autenticação
// src/auth/auth.js
// ============================================================

import { db } from '../../assets/js/supabase.js';
import { setState, getState } from '../../assets/js/store.js';
import { toast, setLoading } from '../../assets/js/utils.js';
import { navigate } from '../../assets/js/router.js';
import { icon } from '../../assets/js/icons.js';

// ─── Renderizar tela de Auth ──────────────────────────────────
export function renderAuth(mode = 'login') {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="auth-screen">
      <div class="auth-container">

        <!-- Hero lateral -->
        <div class="auth-hero">
          <div class="auth-hero-bg"></div>
          <div class="auth-hero-logo">
            <div class="auth-hero-logo-icon">
              ${icon('trending-up', 28)}
            </div>
            <span class="auth-hero-logo-name">Vértice</span>
          </div>
          <h2 class="auth-hero-tagline">
            Controle financeiro<br>com precisão absoluta.
          </h2>
          <p class="auth-hero-desc">
            Gerencie receitas, despesas, cartões e investimentos em um único lugar, com design premium e sincronização em tempo real.
          </p>
          <div class="auth-features">
            <div class="auth-feature">
              <div class="auth-feature-dot"></div>
              <span>Controle total de cartões e faturas</span>
            </div>
            <div class="auth-feature">
              <div class="auth-feature-dot"></div>
              <span>Parcelamentos inteligentes automáticos</span>
            </div>
            <div class="auth-feature">
              <div class="auth-feature-dot"></div>
              <span>Relatórios e gráficos detalhados</span>
            </div>
            <div class="auth-feature">
              <div class="auth-feature-dot"></div>
              <span>Sincronização em tempo real</span>
            </div>
            <div class="auth-feature">
              <div class="auth-feature-dot"></div>
              <span>Segurança com isolamento total por usuário</span>
            </div>
          </div>
        </div>

        <!-- Formulário -->
        <div class="auth-form-side">
          <div class="auth-form-box" id="auth-form-box">
            ${renderAuthForm(mode)}
          </div>
        </div>

      </div>
    </div>
  `;

  bindAuthEvents();
}

// ─── Renderizar formulário conforme modo ─────────────────────
function renderAuthForm(mode) {
  if (mode === 'login')   return loginForm();
  if (mode === 'signup')  return signupForm();
  if (mode === 'reset')   return resetForm();
  return loginForm();
}

function loginForm() {
  return `
    <h1 class="auth-form-title">Bem-vindo de volta</h1>
    <p class="auth-form-subtitle">Entre na sua conta para continuar</p>

    <form id="auth-form" data-mode="login" novalidate>
      <div class="form-group">
        <label class="form-label" for="auth-email">E-mail</label>
        <div class="input-group">
          <span class="input-prefix">${icon('mail', 16)}</span>
          <input type="email" id="auth-email" class="form-control" placeholder="seu@email.com" autocomplete="email" required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="auth-password">
          Senha
          <span class="auth-link" style="float:right;font-size:0.75rem" data-action="forgot">Esqueci a senha</span>
        </label>
        <div class="input-group has-suffix">
          <span class="input-prefix">${icon('lock', 16)}</span>
          <input type="password" id="auth-password" class="form-control" placeholder="••••••••" autocomplete="current-password" required>
          <button type="button" class="input-suffix btn-ghost" id="toggle-password" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);width:24px;height:24px;display:flex;align-items:center;justify-content:center;padding:0">
            ${icon('eye', 16)}
          </button>
        </div>
      </div>

      <div id="auth-error" class="form-error mb-3" style="display:none"></div>

      <button type="submit" class="btn btn-primary w-full btn-lg" id="auth-submit">
        Entrar
      </button>
    </form>

    <div class="auth-divider">ou</div>

    <p style="text-align:center;font-size:0.875rem;color:var(--text-secondary)">
      Não tem conta?
      <span class="auth-link" data-action="signup">Criar conta grátis</span>
    </p>
  `;
}

function signupForm() {
  return `
    <h1 class="auth-form-title">Criar conta</h1>
    <p class="auth-form-subtitle">Comece a controlar suas finanças hoje</p>

    <form id="auth-form" data-mode="signup" novalidate>
      <div class="form-group">
        <label class="form-label" for="auth-name">Nome completo</label>
        <div class="input-group">
          <span class="input-prefix">${icon('user', 16)}</span>
          <input type="text" id="auth-name" class="form-control" placeholder="Seu nome" autocomplete="name" required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="auth-email">E-mail</label>
        <div class="input-group">
          <span class="input-prefix">${icon('mail', 16)}</span>
          <input type="email" id="auth-email" class="form-control" placeholder="seu@email.com" autocomplete="email" required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="auth-password">Senha</label>
        <div class="input-group has-suffix">
          <span class="input-prefix">${icon('lock', 16)}</span>
          <input type="password" id="auth-password" class="form-control" placeholder="Mínimo 8 caracteres" autocomplete="new-password" required minlength="8">
          <button type="button" class="input-suffix btn-ghost" id="toggle-password" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);width:24px;height:24px;display:flex;align-items:center;justify-content:center;padding:0">
            ${icon('eye', 16)}
          </button>
        </div>
      </div>

      <div id="auth-error" class="form-error mb-3" style="display:none"></div>

      <button type="submit" class="btn btn-primary w-full btn-lg" id="auth-submit">
        Criar conta
      </button>
    </form>

    <p style="text-align:center;font-size:0.875rem;color:var(--text-secondary);margin-top:20px">
      Já tem conta?
      <span class="auth-link" data-action="login">Entrar</span>
    </p>
  `;
}

function resetForm() {
  return `
    <h1 class="auth-form-title">Recuperar senha</h1>
    <p class="auth-form-subtitle">Enviaremos um link para redefinir sua senha</p>

    <form id="auth-form" data-mode="reset" novalidate>
      <div class="form-group">
        <label class="form-label" for="auth-email">E-mail da conta</label>
        <div class="input-group">
          <span class="input-prefix">${icon('mail', 16)}</span>
          <input type="email" id="auth-email" class="form-control" placeholder="seu@email.com" autocomplete="email" required>
        </div>
      </div>

      <div id="auth-error" class="form-error mb-3" style="display:none"></div>
      <div id="auth-success" style="display:none;background:var(--income-bg);color:var(--income);border-radius:var(--radius-sm);padding:12px 14px;font-size:0.875rem;margin-bottom:16px">
        ${icon('check', 16)} E-mail enviado! Verifique sua caixa de entrada.
      </div>

      <button type="submit" class="btn btn-primary w-full btn-lg" id="auth-submit">
        Enviar link de recuperação
      </button>
    </form>

    <p style="text-align:center;font-size:0.875rem;color:var(--text-secondary);margin-top:20px">
      <span class="auth-link" data-action="login">${icon('chevron-left', 14)} Voltar ao login</span>
    </p>
  `;
}

// ─── Bind de eventos da tela de auth ─────────────────────────
function bindAuthEvents() {
  const box = document.getElementById('auth-form-box');

  // Delegação de eventos
  box.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'login')  swapForm('login');
    if (action === 'signup') swapForm('signup');
    if (action === 'forgot') swapForm('reset');

    // Toggle senha
    if (e.target.closest('#toggle-password')) {
      const pwd = document.getElementById('auth-password');
      const btn = document.getElementById('toggle-password');
      if (pwd.type === 'password') {
        pwd.type = 'text';
        btn.innerHTML = icon('eye-off', 16);
      } else {
        pwd.type = 'password';
        btn.innerHTML = icon('eye', 16);
      }
    }
  });

  box.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const mode = form.dataset.mode;
    const btn  = document.getElementById('auth-submit');
    const errEl = document.getElementById('auth-error');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    const email    = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value;
    const name     = document.getElementById('auth-name')?.value?.trim();

    // Validação básica
    if (!email) return showError('Informe seu e-mail');
    if (mode !== 'reset' && !password) return showError('Informe sua senha');
    if (mode === 'signup' && password?.length < 8) return showError('A senha deve ter pelo menos 8 caracteres');

    setLoading(btn, true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        await signUp(email, password, name);
      } else if (mode === 'reset') {
        await resetPassword(email);
      }
    } catch (err) {
      showError(parseAuthError(err));
    } finally {
      setLoading(btn, false);
    }
  });
}

function swapForm(mode) {
  const box = document.getElementById('auth-form-box');
  if (box) {
    box.style.opacity = '0';
    box.style.transform = 'translateY(10px)';
    box.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => {
      box.innerHTML = renderAuthForm(mode);
      bindAuthEvents();
      box.style.opacity = '1';
      box.style.transform = 'translateY(0)';
    }, 200);
  }
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

// ─── Funções de Auth ──────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  setState({ user: data.user });
  navigate('/');
}

export async function signUp(email, password, fullName) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;

  toast('Conta criada! Verifique seu e-mail para confirmar.', 'success', 5000);
  setState({ user: data.user });

  // Seed categorias padrão
  if (data.user) {
    await db.rpc('seed_default_categories', { p_user_id: data.user.id });
  }

  navigate('/');
}

export async function signOut() {
  await db.auth.signOut();
  setState({ user: null, profile: null });
  navigate('/auth', true);
}

export async function resetPassword(email) {
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth?mode=update-password`,
  });
  if (error) throw error;
  const successEl = document.getElementById('auth-success');
  if (successEl) successEl.style.display = 'flex';
}

export async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

// ─── Traduzir erros do Supabase ───────────────────────────────
function parseAuthError(err) {
  const msg = err?.message || '';
  if (msg.includes('Invalid login credentials'))   return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))          return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered'))      return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be'))           return 'A senha deve ter pelo menos 8 caracteres.';
  if (msg.includes('Unable to validate email'))     return 'E-mail inválido.';
  if (msg.includes('For security purposes'))        return 'Aguarde alguns segundos antes de tentar novamente.';
  return msg || 'Ocorreu um erro. Tente novamente.';
}

// ============================================================
// VÉRTICE — Supabase Client
// assets/js/supabase.js
// ============================================================

// ⚠️  CONFIGURE SUAS CREDENCIAIS AQUI
// Obtenha em: https://supabase.com → seu projeto → Settings → API
const SUPABASE_URL  = 'https://ugsgtgdpoccspbchdmlz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_6bsAgCHaBJ6rXU4_bcgBig_bkF_8B2E';

// Importação do SDK (via CDN no index.html)
const { createClient } = window.supabase;

export const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// Listener global de sessão
db.auth.onAuthStateChange((event, session) => {
  window.dispatchEvent(new CustomEvent('auth:change', { detail: { event, session } }));
});

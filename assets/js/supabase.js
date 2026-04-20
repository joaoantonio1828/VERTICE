// ============================================================
// VÉRTICE — Supabase Client
// assets/js/supabase.js
// ============================================================

// ⚠️  CONFIGURE SUAS CREDENCIAIS AQUI
// Obtenha em: https://supabase.com → seu projeto → Settings → API
const SUPABASE_URL  = 'https://jaohqqtkpgktdxnwhger.supabase.co/rest/v1/';
const SUPABASE_ANON = 'sb_publishable_vm3DZks2wv4X2qynTQ3DsA_8BO2-yn3';

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

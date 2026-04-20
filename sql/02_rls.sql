-- ============================================================
-- VÉRTICE — Sistema Financeiro Pessoal
-- 02_rls.sql — Row Level Security (isolamento total por usuário)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE places             ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_invoices      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles: owner access" ON profiles
  FOR ALL USING (auth.uid() = id);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE POLICY "accounts: owner access" ON accounts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CREDIT_CARDS
-- ============================================================
CREATE POLICY "credit_cards: owner access" ON credit_cards
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE POLICY "categories: owner access" ON categories
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TAGS
-- ============================================================
CREATE POLICY "tags: owner access" ON tags
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PLACES
-- ============================================================
CREATE POLICY "places: owner access" ON places
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- INSTALLMENT_GROUPS
-- ============================================================
CREATE POLICY "installment_groups: owner access" ON installment_groups
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- RECURRING_RULES
-- ============================================================
CREATE POLICY "recurring_rules: owner access" ON recurring_rules
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE POLICY "transactions: owner access" ON transactions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRANSACTION_TAGS (acesso indireto via transactions)
-- ============================================================
CREATE POLICY "transaction_tags: owner access" ON transaction_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND t.user_id = auth.uid()
    )
  );

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE POLICY "budgets: owner access" ON budgets
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- GOALS
-- ============================================================
CREATE POLICY "goals: owner access" ON goals
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CARD_INVOICES
-- ============================================================
CREATE POLICY "card_invoices: owner access" ON card_invoices
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- GRANT básico para usuários autenticados
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================
-- VÉRTICE — Sistema Financeiro Pessoal
-- 01_tables.sql — Estrutura completa do banco de dados
-- ============================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT,
  avatar_url     TEXT,
  currency       TEXT DEFAULT 'BRL',
  locale         TEXT DEFAULT 'pt-BR',
  theme          TEXT DEFAULT 'system', -- 'light' | 'dark' | 'system'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTS (Contas / Carteiras)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'checking',
  -- 'checking' | 'savings' | 'cash' | 'investment' | 'credit' | 'other'
  bank           TEXT,
  color          TEXT DEFAULT '#6366f1',
  icon           TEXT DEFAULT 'wallet',
  initial_balance NUMERIC(12,2) DEFAULT 0,
  current_balance NUMERIC(12,2) DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  include_in_total BOOLEAN DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CREDIT_CARDS (Cartões de Crédito)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_cards (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  brand          TEXT DEFAULT 'visa',
  -- 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'other'
  color          TEXT DEFAULT '#1a1a2e',
  last_four      TEXT,
  credit_limit   NUMERIC(12,2) DEFAULT 0,
  used_limit     NUMERIC(12,2) DEFAULT 0,
  closing_day    INTEGER NOT NULL DEFAULT 1, -- dia do fechamento
  due_day        INTEGER NOT NULL DEFAULT 10, -- dia do vencimento
  account_id     UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT closing_day_range CHECK (closing_day BETWEEN 1 AND 31),
  CONSTRAINT due_day_range CHECK (due_day BETWEEN 1 AND 31)
);

-- ============================================================
-- CATEGORIES (Categorias e Subcategorias)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'expense', -- 'income' | 'expense' | 'transfer'
  icon           TEXT DEFAULT 'tag',
  color          TEXT DEFAULT '#6366f1',
  parent_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_default     BOOLEAN DEFAULT FALSE,
  is_active      BOOLEAN DEFAULT TRUE,
  sort_order     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  color          TEXT DEFAULT '#94a3b8',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ============================================================
-- PLACES (Locais / Estabelecimentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS places (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  total_spent    NUMERIC(12,2) DEFAULT 0,
  visit_count    INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INSTALLMENT_GROUPS (Grupo de compra parcelada)
-- ============================================================
CREATE TABLE IF NOT EXISTS installment_groups (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  total_amount   NUMERIC(12,2) NOT NULL,
  installment_amount NUMERIC(12,2) NOT NULL,
  total_installments INTEGER NOT NULL,
  card_id        UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  place_id       UUID REFERENCES places(id) ON DELETE SET NULL,
  purchase_date  DATE NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RECURRING_RULES (Regras de recorrência)
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL,
  type           TEXT NOT NULL DEFAULT 'expense', -- 'income' | 'expense'
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id     UUID REFERENCES accounts(id) ON DELETE SET NULL,
  card_id        UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  frequency      TEXT NOT NULL DEFAULT 'monthly',
  -- 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  day_of_month   INTEGER, -- para frequência mensal
  day_of_week    INTEGER, -- para frequência semanal (0=dom, 6=sab)
  start_date     DATE NOT NULL,
  end_date       DATE, -- NULL = sem fim
  last_generated DATE,
  is_active      BOOLEAN DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS (Lançamentos — tabela principal)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  type                TEXT NOT NULL DEFAULT 'expense',
  -- 'income' | 'expense' | 'transfer'
  status              TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'paid' | 'overdue' | 'cancelled'
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id          UUID REFERENCES accounts(id) ON DELETE SET NULL,
  card_id             UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  place_id            UUID REFERENCES places(id) ON DELETE SET NULL,
  transfer_to_account UUID REFERENCES accounts(id) ON DELETE SET NULL,
  -- Datas
  purchase_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  payment_date        DATE,
  -- Parcelamento
  installment_group_id UUID REFERENCES installment_groups(id) ON DELETE SET NULL,
  installment_number  INTEGER, -- 1, 2, 3...
  total_installments  INTEGER,
  manually_edited     BOOLEAN DEFAULT FALSE,
  -- Recorrência
  recurring_rule_id   UUID REFERENCES recurring_rules(id) ON DELETE SET NULL,
  -- Fatura do cartão
  invoice_month       TEXT, -- formato 'YYYY-MM'
  -- Metadados
  notes               TEXT,
  is_favourite        BOOLEAN DEFAULT FALSE,
  is_archived         BOOLEAN DEFAULT FALSE,
  payment_method      TEXT DEFAULT 'debit',
  -- 'debit' | 'credit' | 'pix' | 'cash' | 'ted' | 'doc' | 'other'
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de relacionamento transactions <-> tags
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id         UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ============================================================
-- BUDGETS (Orçamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id    UUID REFERENCES categories(id) ON DELETE CASCADE,
  month          TEXT NOT NULL, -- formato 'YYYY-MM'
  amount         NUMERIC(12,2) NOT NULL,
  spent          NUMERIC(12,2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, month)
);

-- ============================================================
-- GOALS (Metas)
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_amount  NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) DEFAULT 0,
  deadline       DATE,
  icon           TEXT DEFAULT 'target',
  color          TEXT DEFAULT '#10b981',
  is_completed   BOOLEAN DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CARD_INVOICES (Faturas — geradas automaticamente)
-- ============================================================
CREATE TABLE IF NOT EXISTS card_invoices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id        UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  month          TEXT NOT NULL, -- formato 'YYYY-MM'
  closing_date   DATE NOT NULL,
  due_date       DATE NOT NULL,
  total_amount   NUMERIC(12,2) DEFAULT 0,
  paid_amount    NUMERIC(12,2) DEFAULT 0,
  status         TEXT DEFAULT 'open', -- 'open' | 'closed' | 'paid'
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, month)
);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_purchase_date ON transactions(purchase_date);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_month ON transactions(invoice_month);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_card_invoices_card_month ON card_invoices(card_id, month);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_credit_cards_updated_at BEFORE UPDATE ON credit_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_places_updated_at BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_card_invoices_updated_at BEFORE UPDATE ON card_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: Criar profile automaticamente ao cadastrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNÇÃO: Calcular invoice_month baseado na data e fechamento
-- ============================================================
CREATE OR REPLACE FUNCTION calc_invoice_month(
  p_purchase_date DATE,
  p_closing_day   INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_year  INTEGER;
  v_month INTEGER;
BEGIN
  -- Se a compra foi feita APÓS o fechamento, cai na fatura do próximo mês
  IF EXTRACT(DAY FROM p_purchase_date) > p_closing_day THEN
    v_year  := EXTRACT(YEAR FROM p_purchase_date + INTERVAL '1 month');
    v_month := EXTRACT(MONTH FROM p_purchase_date + INTERVAL '1 month');
  ELSE
    v_year  := EXTRACT(YEAR FROM p_purchase_date);
    v_month := EXTRACT(MONTH FROM p_purchase_date);
  END IF;
  RETURN LPAD(v_year::TEXT, 4, '0') || '-' || LPAD(v_month::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

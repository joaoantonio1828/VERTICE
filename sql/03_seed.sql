-- ============================================================
-- VÉRTICE — Sistema Financeiro Pessoal
-- 03_seed.sql — Categorias padrão (inseridas por usuário no signup)
-- ============================================================

-- Esta função é chamada pelo frontend após o primeiro login
-- para popular as categorias padrão do usuário.
-- Pode ser chamada via RPC do Supabase.

CREATE OR REPLACE FUNCTION seed_default_categories(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- ===== DESPESAS =====
  INSERT INTO categories (user_id, name, type, icon, color, is_default, sort_order) VALUES
    -- Moradia
    (p_user_id, 'Moradia',        'expense', 'home',        '#6366f1', TRUE, 1),
    (p_user_id, 'Alimentação',    'expense', 'utensils',    '#f59e0b', TRUE, 2),
    (p_user_id, 'Transporte',     'expense', 'car',         '#3b82f6', TRUE, 3),
    (p_user_id, 'Saúde',          'expense', 'heart',       '#ef4444', TRUE, 4),
    (p_user_id, 'Educação',       'expense', 'book',        '#8b5cf6', TRUE, 5),
    (p_user_id, 'Lazer',          'expense', 'smile',       '#ec4899', TRUE, 6),
    (p_user_id, 'Roupas',         'expense', 'shirt',       '#14b8a6', TRUE, 7),
    (p_user_id, 'Tecnologia',     'expense', 'laptop',      '#0ea5e9', TRUE, 8),
    (p_user_id, 'Assinaturas',    'expense', 'repeat',      '#a78bfa', TRUE, 9),
    (p_user_id, 'Pets',           'expense', 'paw',         '#f97316', TRUE, 10),
    (p_user_id, 'Viagem',         'expense', 'plane',       '#06b6d4', TRUE, 11),
    (p_user_id, 'Impostos',       'expense', 'file-text',   '#64748b', TRUE, 12),
    (p_user_id, 'Outros',         'expense', 'more-horizontal', '#94a3b8', TRUE, 99);

  -- Subcategorias de Moradia
  INSERT INTO categories (user_id, name, type, icon, color, parent_id, is_default, sort_order)
  SELECT p_user_id, sub.name, 'expense', sub.icon, sub.color, c.id, TRUE, sub.sort_order
  FROM (VALUES
    ('Aluguel',        'home',      '#6366f1', 1),
    ('Condomínio',     'building',  '#6366f1', 2),
    ('Energia',        'zap',       '#6366f1', 3),
    ('Água',           'droplets',  '#6366f1', 4),
    ('Internet',       'wifi',      '#6366f1', 5),
    ('Gás',            'flame',     '#6366f1', 6),
    ('Reforma',        'wrench',    '#6366f1', 7),
    ('Limpeza',        'sparkles',  '#6366f1', 8)
  ) AS sub(name, icon, color, sort_order)
  JOIN categories c ON c.user_id = p_user_id AND c.name = 'Moradia' AND c.parent_id IS NULL;

  -- Subcategorias de Alimentação
  INSERT INTO categories (user_id, name, type, icon, color, parent_id, is_default, sort_order)
  SELECT p_user_id, sub.name, 'expense', sub.icon, sub.color, c.id, TRUE, sub.sort_order
  FROM (VALUES
    ('Mercado',        'shopping-cart', '#f59e0b', 1),
    ('Restaurante',    'utensils',      '#f59e0b', 2),
    ('Delivery',       'package',       '#f59e0b', 3),
    ('Lanche',         'coffee',        '#f59e0b', 4),
    ('Padaria',        'wheat',         '#f59e0b', 5)
  ) AS sub(name, icon, color, sort_order)
  JOIN categories c ON c.user_id = p_user_id AND c.name = 'Alimentação' AND c.parent_id IS NULL;

  -- Subcategorias de Transporte
  INSERT INTO categories (user_id, name, type, icon, color, parent_id, is_default, sort_order)
  SELECT p_user_id, sub.name, 'expense', sub.icon, sub.color, c.id, TRUE, sub.sort_order
  FROM (VALUES
    ('Combustível',    'fuel',          '#3b82f6', 1),
    ('Uber/99',        'car',           '#3b82f6', 2),
    ('Ônibus/Metrô',   'bus',           '#3b82f6', 3),
    ('Manutenção',     'wrench',        '#3b82f6', 4),
    ('IPVA/Seguro',    'file-text',     '#3b82f6', 5),
    ('Pedágio/Estac.', 'map-pin',       '#3b82f6', 6)
  ) AS sub(name, icon, color, sort_order)
  JOIN categories c ON c.user_id = p_user_id AND c.name = 'Transporte' AND c.parent_id IS NULL;

  -- ===== RECEITAS =====
  INSERT INTO categories (user_id, name, type, icon, color, is_default, sort_order) VALUES
    (p_user_id, 'Salário',        'income', 'briefcase',   '#10b981', TRUE, 1),
    (p_user_id, 'Freelance',      'income', 'code',        '#10b981', TRUE, 2),
    (p_user_id, 'Investimentos',  'income', 'trending-up', '#10b981', TRUE, 3),
    (p_user_id, 'Reembolso',      'income', 'rotate-ccw',  '#10b981', TRUE, 4),
    (p_user_id, 'Venda',          'income', 'tag',         '#10b981', TRUE, 5),
    (p_user_id, 'Outros (receita)', 'income', 'plus-circle', '#10b981', TRUE, 99);

  -- ===== TRANSFERÊNCIAS =====
  INSERT INTO categories (user_id, name, type, icon, color, is_default, sort_order) VALUES
    (p_user_id, 'Transferência',  'transfer', 'arrow-left-right', '#64748b', TRUE, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migração 003: Adicionar campo brasao_url na tabela tenants
-- Projeto: GovPrecos
-- Banco: PostgreSQL (Supabase)
-- Descrição: Adiciona campo para armazenar URL pública do brasão da prefeitura

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brasao_url TEXT;

COMMENT ON COLUMN tenants.brasao_url IS 'URL pública do brasão da prefeitura (armazenado no Supabase Storage)';

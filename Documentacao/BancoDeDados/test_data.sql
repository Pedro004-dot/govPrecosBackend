-- Script to insert test tenant and user for development
-- Run this in your Supabase SQL editor or psql

-- Insert test tenant
INSERT INTO tenants (id, cnpj, nome, tipo, ativo)
VALUES (
    '069d6090-46b2-4448-931c-b174684b2387',
    '12345678000199',
    'Prefeitura Municipal de Teste',
    'prefeitura',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Insert test user
INSERT INTO usuarios (id, tenant_id, email, nome, perfil, ativo)
VALUES (
    'fb18bf7f-438d-4954-a183-637a0af726a9',
    '069d6090-46b2-4448-931c-b174684b2387',
    'admin@teste.gov.br',
    'Administrador Teste',
    'admin',
    true
)
ON CONFLICT (id) DO NOTHING;

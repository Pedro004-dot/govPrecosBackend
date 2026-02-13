# Banco de dados

Documentação do banco PostgreSQL (Supabase) usado pelo backend.

## Conteúdo desta pasta

| Arquivo / Pasta | Descrição |
|-----------------|------------|
| [estrutura-proposta.md](./estrutura-proposta.md) | Proposta completa das tabelas: `licitacoes`, `itens_licitacao`, `tenants`, `usuarios`, `pesquisas_preco`, `pesquisa_itens`, `relatorios` — campos, índices, relacionamentos, RLS e performance. |
| [migrations/](./migrations/) | Scripts SQL versionados para criar as tabelas e índices. |

## Migrações

O script principal está em **migrations/001_create_tables.sql**. Ele cria, em ordem:

1. `tenants`
2. `usuarios`
3. `licitacoes`
4. `itens_licitacao` (com índice full-text em `descricao`)
5. `pesquisas_preco`
6. `pesquisa_itens` (com UNIQUE em `pesquisa_id`, `item_licitacao_id`)
7. `relatorios`
8. Triggers de `atualizado_em` onde aplicável

**Tabela `municipios`:** Não está neste script. A tabela `municipios` (codigo_ibge, nome, latitude, longitude, codigo_uf, etc.) já existe no projeto Supabase e é usada pelo backend para o filtro geográfico (Haversine). Ver [Integracoes/municipios.md](../Integracoes/municipios.md).

## Conexão

O backend usa a variável de ambiente **DATABASE_URL** (ou equivalente do Supabase) para conectar ao PostgreSQL. Ver [Desenvolvimento/variaveis-ambiente.md](../Desenvolvimento/variaveis-ambiente.md).

## Relacionamentos (resumo)

- `licitacoes` (1) ──< (N) `itens_licitacao`
- `tenants` (1) ──< (N) `usuarios`, `pesquisas_preco`, `relatorios`
- `usuarios` (1) ──< (N) `pesquisas_preco`
- `pesquisas_preco` (1) ──< (N) `pesquisa_itens`, `relatorios`
- `itens_licitacao` (1) ──< (N) `pesquisa_itens` (many-to-many entre pesquisas e itens)

Detalhes em [estrutura-proposta.md](./estrutura-proposta.md).

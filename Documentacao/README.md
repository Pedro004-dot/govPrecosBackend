# Documentação do Backend — Banca de Preços

Documentação do backend da plataforma **Banca de Preços**, SaaS para Prefeituras e Câmaras Municipais (pesquisa de preços, cotação, licitações em conformidade com a Lei 14.133/2021).

---

## Índice da documentação

| Pasta / Arquivo | Conteúdo |
|-----------------|----------|
| [**Fluxo do usuário**](./FluxoUsuario.md) | Passo a passo do fluxo de cotação (busca texto/planilha → seleção → gerar cotação → editar → estatísticas → relatório) e diagrama Mermaid. |
| [**Arquitetura**](./Arquitetura/README.md) | Visão geral do projeto, camadas (Routes, Controllers, Services, Repositories, Gateways, Domain), fluxos de dados e diagramas. |
| [**API**](./API/README.md) | Contrato das rotas REST: método, path, parâmetros, body, respostas, exemplos de requisição e como testar cada endpoint. |
| [**BancoDeDados**](./BancoDeDados/README.md) | Estrutura das tabelas (PostgreSQL/Supabase), migrações e convenções. |
| [**Dominio**](./Dominio/README.md) | Entidades de domínio (Licitacao, ItemLicitacao, PesquisaPreco, Cnpj) e regras de negócio. |
| [**Integracoes**](./Integracoes/README.md) | Integrações externas: PNCP (APIs 1, 2 e 3), tabela de municípios (IBGE). |
| [**Desenvolvimento**](./Desenvolvimento/README.md) | Setup local, variáveis de ambiente, scripts e boas práticas para desenvolvedores. |

---

## Visão rápida do que está implementado

- **Health:** `GET /api/health` — checagem de API e banco.
- **Admin:** Sincronização PNCP (histórico e atualizações) — licitações e itens com filtro por homologação.
- **Itens:** Busca por descrição (com filtro geográfico opcional) e **upload de planilha Excel** (retorna linhas com sugestões de itens).
- **Pesquisas (cotações):** Criar cotação (vazia ou já com itens), listar, detalhe, adicionar/remover itens, estatísticas, consolidar, relatório.
- **Relatório:** Esqueleto — registro em `relatorios` e retorno de URL/hash placeholder (geração real de PDF/Word em etapa futura).

Para detalhes de cada rota, exemplos de request/response e como testar, use [API](./API/README.md).

# Visão geral da arquitetura

## Contexto do produto

A **Banca de Preços** é uma plataforma SaaS voltada a Prefeituras e Câmaras Municipais. Objetivos principais:

- Automatizar a **pesquisa de preços** e a estruturação da fase interna de licitações em conformidade com a **Lei nº 14.133/2021**.
- Centralizar a coleta de dados via integração com bases públicas (PNCP, TCE), importação de planilhas e cadastros manuais.
- Aplicar **inteligência estatística**: média, mediana, menor preço, detecção de outliers e preços inexequíveis.
- Garantir rastreabilidade, padronização documental e segurança jurídica para auditorias dos Tribunais de Contas.
- Gerar relatórios oficiais (com QR Code e integração futura com Termo de Referência).

## Princípios da arquitetura

- **Camadas bem definidas:** Routes → Controllers → Services → Repositories / Gateways. Domain e Infra são transversais.
- **Isolamento de integrações:** Gateways encapsulam chamadas a APIs externas (ex.: PNCP); mudanças na API do governo impactam apenas o gateway.
- **Repositórios para persistência:** Acesso a dados (PostgreSQL/Supabase) concentrado em repositórios; serviços não conhecem SQL.
- **Entidades de domínio:** Licitacao, ItemLicitacao, PesquisaPreco, Cnpj etc. representam o núcleo do negócio; mapeamento para tabelas fica nos repositórios.
- **Escalabilidade:** Banco preparado para alto volume (índices, full-text na descrição de itens); filtro geográfico aplicado após busca textual para não sobrecarregar o banco.

## Stack técnica

- **Runtime:** Node.js
- **Linguagem:** TypeScript
- **Framework HTTP:** Express
- **Banco de dados:** PostgreSQL (Supabase)
- **Driver DB:** `pg` (pool de conexões em `src/infra/db.ts`)

## Estrutura de pastas do código-fonte

```
src/
├── index.ts              # Entrada da aplicação, montagem de rotas e dependências
├── controllers/          # Recebem HTTP, validam entrada, chamam services
├── routes/               # Definição das rotas Express (admin, item, pesquisa)
├── services/             # Lógica de negócio (sincronização, cotação, estatísticas, relatório)
├── repositories/         # Acesso a dados (licitacoes, itens_licitacao, pesquisas_preco, municipios, relatorios)
├── gateways/             # Integrações externas (PNCP)
├── domain/               # Entidades e value objects (Licitacao, ItemLicitacao, PesquisaPreco, Cnpj)
└── infra/                # DB, Haversine, etc.
```

Detalhamento de cada camada em [camadas.md](./camadas.md). Fluxos de dados em [fluxos.md](./fluxos.md).

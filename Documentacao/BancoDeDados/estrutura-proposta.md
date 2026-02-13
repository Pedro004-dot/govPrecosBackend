# Estrutura de Dados - Banca de Preços

## Contexto

Este documento descreve a estrutura de tabelas do banco de dados PostgreSQL (Supabase) para o projeto **GovPrecos**, seguindo os princípios de arquitetura limpa e otimização para escalabilidade (1M+ registros).

**Projeto Supabase:** GovPrecos

⚡ **Atualização:** Migração 002 adicionou novo sistema de projetos conforme Lei 14.133/2021.

---

## Tabelas Principais

### 1. `licitacoes`

Armazena o cabeçalho das licitações coletadas das APIs 1 e 2 do PNCP.
No nosso fluxo, **só serão persistidas licitações cujo `valorTotalHomologado` seja maior que 1**. Esse será o critério principal
para considerar que a licitação já foi efetivamente homologada para fins de pesquisa de preços.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único interno |
| `numero_controle_pncp` | VARCHAR(100) | UNIQUE, NOT NULL | Chave única do PNCP (ex: "37115383000153-1-000160/2025") |
| `cnpj_orgao` | VARCHAR(14) | NOT NULL | CNPJ do órgão (sem formatação) |
| `razao_social_orgao` | VARCHAR(500) | | Razão social do órgão |
| `poder_id` | CHAR(1) | | Poder (E=Executivo, L=Legislativo, J=Judiciário) |
| `esfera_id` | CHAR(1) | | Esfera (F=Federal, E=Estadual, M=Municipal) |
| `ano_compra` | INTEGER | NOT NULL | Ano da compra |
| `sequencial_compra` | INTEGER | NOT NULL | Sequencial da compra |
| `numero_compra` | VARCHAR(50) | | Número da compra (formato livre) |
| `processo` | VARCHAR(200) | | Número do processo |
| `objeto_compra` | TEXT | | Descrição do objeto da compra |
| `modalidade_id` | INTEGER | | ID da modalidade (8=Dispensa, etc.) |
| `modalidade_nome` | VARCHAR(200) | | Nome da modalidade |
| `situacao_compra_id` | INTEGER | | ID da situação (armazenado apenas para referência/auditoria) |
| `situacao_compra_nome` | VARCHAR(200) | | Nome da situação (armazenado apenas para referência/auditoria) |
| `valor_total_estimado` | DECIMAL(15,2) | | Valor total estimado |
| `valor_total_homologado` | DECIMAL(15,2) | | Valor total homologado |
| `data_publicacao_pncp` | TIMESTAMP WITH TIME ZONE | NOT NULL | Data de publicação no PNCP |
| `data_inclusao` | TIMESTAMP WITH TIME ZONE | | Data de inclusão no PNCP |
| `data_atualizacao` | TIMESTAMP WITH TIME ZONE | | Data de atualização no PNCP |
| `data_atualizacao_global` | TIMESTAMP WITH TIME ZONE | | Data de atualização global |
| `codigo_unidade` | VARCHAR(50) | | Código da unidade |
| `nome_unidade` | VARCHAR(500) | | Nome da unidade |
| `uf_sigla` | CHAR(2) | | Sigla da UF |
| `municipio_nome` | VARCHAR(200) | | Nome do município |
| `codigo_ibge` | VARCHAR(10) | | Código IBGE do município |
| `amparo_legal_codigo` | INTEGER | | Código do amparo legal |
| `amparo_legal_nome` | VARCHAR(500) | | Nome do amparo legal (ex: "Lei 14.133/2021, Art. 75, IX") |
| `amparo_legal_descricao` | TEXT | | Descrição completa do amparo legal |
| `link_processo_eletronico` | VARCHAR(500) | | Link do processo eletrônico |
| `link_sistema_origem` | VARCHAR(500) | | Link do sistema de origem |
| `informacao_complementar` | TEXT | | Informações complementares |
| `justificativa_presencial` | TEXT | | Justificativa presencial (se houver) |
| `srp` | BOOLEAN | DEFAULT false | Sistema de Registro de Preços |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação no nosso sistema |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização no nosso sistema |

**Índices:**

- `UNIQUE (numero_controle_pncp)` - Para upsert eficiente
- `INDEX idx_licitacoes_cnpj_ano_seq (cnpj_orgao, ano_compra, sequencial_compra)` - Para busca na API 3
- `INDEX idx_licitacoes_data_publicacao (data_publicacao_pncp)` - Para sincronização por data

**Observações:**

- A chave única `numero_controle_pncp` permite upsert sem duplicatas
- O filtro de quais licitações serão persistidas será feito no service usando **apenas o critério `valorTotalHomologado > 1`**, sem depender do código de situação do PNCP (que nem sempre é confiável).
- Campos de órgão/unidade estão "achatados" na tabela para evitar joins desnecessários em consultas frequentes

---

### 2. `itens_licitacao`

Armazena os itens detalhados coletados da API 3 do PNCP, vinculados a uma licitação.
Na rota de cotação, o usuário informa um texto livre e o backend faz **busca textual direta na coluna `descricao` desta tabela**,
retornando itens compatíveis para montagem da pesquisa de preços.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único interno |
| `licitacao_id` | UUID | FK → licitacoes.id, NOT NULL | Referência à licitação pai |
| `numero_item` | INTEGER | NOT NULL | Número do item na licitação |
| `descricao` | TEXT | NOT NULL | Descrição completa do item (usado para busca full-text) |
| `material_ou_servico` | CHAR(1) | | M=Material, S=Serviço |
| `material_ou_servico_nome` | VARCHAR(50) | | Nome do tipo |
| `valor_unitario_estimado` | DECIMAL(15,4) | | Valor unitário estimado |
| `valor_total` | DECIMAL(15,2) | | Valor total do item |
| `quantidade` | DECIMAL(15,4) | | Quantidade |
| `unidade_medida` | VARCHAR(20) | | Unidade de medida (UN, CX, KIT, etc.) |
| `situacao_compra_item` | INTEGER | | ID da situação do item |
| `situacao_compra_item_nome` | VARCHAR(200) | NOT NULL | Nome da situação (ex: "Homologado", "Em andamento") |
| `criterio_julgamento_id` | INTEGER | | ID do critério de julgamento |
| `criterio_julgamento_nome` | VARCHAR(200) | | Nome do critério (ex: "Menor preço") |
| `item_categoria_id` | INTEGER | | ID da categoria do item |
| `item_categoria_nome` | VARCHAR(200) | | Nome da categoria |
| `ncm_nbs_codigo` | VARCHAR(20) | | Código NCM/NBS |
| `ncm_nbs_descricao` | VARCHAR(500) | | Descrição NCM/NBS |
| `catalogo_codigo_item` | VARCHAR(100) | | Código do item no catálogo |
| `informacao_complementar` | TEXT | | Informações complementares |
| `orcamento_sigiloso` | BOOLEAN | DEFAULT false | Se o orçamento é sigiloso |
| `tem_resultado` | BOOLEAN | DEFAULT false | Se tem resultado |
| `data_inclusao` | TIMESTAMP WITH TIME ZONE | | Data de inclusão no PNCP |
| `data_atualizacao` | TIMESTAMP WITH TIME ZONE | | Data de atualização no PNCP |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação no nosso sistema |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização no nosso sistema |

**Índices:**

- `INDEX idx_itens_licitacao_id (licitacao_id)` - Para buscar itens de uma licitação
- **Full-Text Search:** `CREATE INDEX idx_itens_descricao_fts ON itens_licitacao USING GIN (to_tsvector('portuguese', descricao))` - Para busca textual em português na coluna `descricao`

**Observações:**

- A busca de itens na tela de cotação será feita diretamente sobre a coluna `descricao`, usando o índice de full-text search (ou, em uma V1 mais simples, um `ILIKE` com `LIMIT`).
- Não dependeremos do campo de situação do item (`situacao_compra_item_nome`) para definir se será salvo; o foco é ter os itens associados às licitações já filtradas pelo critério de `valorTotalHomologado > 1`.
- `valor_unitario_estimado` em DECIMAL(15,4) para precisão de centavos em valores unitários

---

### 3. `tenants`

Armazena os órgãos clientes (Prefeituras e Câmaras) que usam o sistema.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `cnpj` | VARCHAR(14) | UNIQUE, NOT NULL | CNPJ do órgão (sem formatação) |
| `nome` | VARCHAR(500) | NOT NULL | Nome do órgão |
| `tipo` | VARCHAR(20) | NOT NULL | Tipo: 'prefeitura' ou 'camara' |
| `ativo` | BOOLEAN | DEFAULT true | Se o tenant está ativo |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização |

**Índices:**

- `UNIQUE (cnpj)` - CNPJ único por tenant

**Observações:**

- Preparado para multi-tenant desde V1, mesmo sem autenticação implementada
- Todos os dados "do usuário" terão `tenant_id` para isolamento

---

### 4. `usuarios`

Armazena os usuários do sistema, vinculados a um tenant.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `tenant_id` | UUID | FK → tenants.id, NOT NULL | Referência ao tenant |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email do usuário |
| `nome` | VARCHAR(200) | NOT NULL | Nome completo |
| `perfil` | VARCHAR(20) | NOT NULL | Perfil: 'admin', 'operador', 'auditor' |
| `ativo` | BOOLEAN | DEFAULT true | Se o usuário está ativo |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização |

**Índices:**

- `UNIQUE (email)` - Email único no sistema
- `INDEX idx_usuarios_tenant (tenant_id)` - Para buscar usuários de um tenant

**Observações:**

- Estrutura pronta para autenticação futura (V2)
- Perfis definidos: admin (gerencia tenant), operador (cria pesquisas), auditor (visualiza relatórios)

---

### 5. `pesquisas_preco`

Armazena as pesquisas de preços criadas pelos usuários.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `tenant_id` | UUID | FK → tenants.id, NOT NULL | Referência ao tenant |
| `usuario_id` | UUID | FK → usuarios.id, NOT NULL | Usuário que criou a pesquisa |
| `nome` | VARCHAR(200) | NOT NULL | Nome da pesquisa |
| `descricao` | TEXT | | Descrição opcional |
| `status` | VARCHAR(20) | DEFAULT 'rascunho' | Status: 'rascunho', 'finalizada', 'cancelada' |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização |

**Índices:**

- `INDEX idx_pesquisas_tenant (tenant_id)` - Para listar pesquisas do tenant
- `INDEX idx_pesquisas_usuario (usuario_id)` - Para listar pesquisas do usuário

**Observações:**

- Cada pesquisa pertence a um tenant e foi criada por um usuário
- Status permite rastrear o ciclo de vida da pesquisa

---

### 6. `pesquisa_itens`

Tabela de relacionamento entre pesquisas e itens de licitação (many-to-many).

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `pesquisa_id` | UUID | FK → pesquisas_preco.id, NOT NULL | Referência à pesquisa |
| `item_licitacao_id` | UUID | FK → itens_licitacao.id, NOT NULL | Referência ao item |
| `ordem` | INTEGER | | Ordem do item na pesquisa (opcional) |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de inclusão |

**Índices:**

- `UNIQUE (pesquisa_id, item_licitacao_id)` - Evita duplicatas
- `INDEX idx_pesquisa_itens_pesquisa (pesquisa_id)` - Para buscar itens de uma pesquisa
- `INDEX idx_pesquisa_itens_item (item_licitacao_id)` - Para buscar pesquisas de um item

**Observações:**

- Permite que uma pesquisa tenha múltiplos itens e um item apareça em múltiplas pesquisas
- Campo `ordem` opcional para manter sequência definida pelo usuário

---

### 7. `relatorios`

Armazena metadados dos relatórios gerados (PDF/Word).

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `pesquisa_id` | UUID | FK → pesquisas_preco.id, NOT NULL | Referência à pesquisa |
| `tenant_id` | UUID | FK → tenants.id, NOT NULL | Referência ao tenant (redundante, mas útil para queries) |
| `tipo` | VARCHAR(20) | NOT NULL | Tipo: 'pdf' ou 'word' |
| `caminho_arquivo` | VARCHAR(500) | | Caminho do arquivo (S3, local, etc.) |
| `url_acesso` | VARCHAR(500) | | URL pública de acesso (se houver) |
| `qr_code_data` | TEXT | | Dados do QR Code (JSON ou texto) |
| `hash_arquivo` | VARCHAR(64) | | Hash SHA-256 do arquivo para integridade |
| `tamanho_bytes` | BIGINT | | Tamanho do arquivo em bytes |
| `gerado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de geração |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação do registro |

**Índices:**

- `INDEX idx_relatorios_pesquisa (pesquisa_id)` - Para buscar relatórios de uma pesquisa
- `INDEX idx_relatorios_tenant (tenant_id)` - Para buscar relatórios do tenant

**Observações:**

- Em V1, pode armazenar arquivos localmente ou em bucket S3/MinIO
- QR Code pode conter link para o relatório ou metadados da pesquisa
- Hash permite validar integridade do arquivo

---

## Relacionamentos

```
tenants (1) ──< (N) usuarios
tenants (1) ──< (N) pesquisas_preco
usuarios (1) ──< (N) pesquisas_preco
pesquisas_preco (1) ──< (N) pesquisa_itens
itens_licitacao (1) ──< (N) pesquisa_itens
licitacoes (1) ──< (N) itens_licitacao
pesquisas_preco (1) ──< (N) relatorios
```

---

## Políticas de Segurança (RLS - Row Level Security)

**Nota:** Em V1, RLS pode ser desabilitado se autenticação ainda não estiver implementada. Preparar para V2:

- `tenants`: Usuários só veem seu próprio tenant
- `usuarios`: Usuários só veem usuários do mesmo tenant
- `pesquisas_preco`: Usuários só veem pesquisas do seu tenant
- `relatorios`: Usuários só veem relatórios do seu tenant
- `licitacoes` e `itens_licitacao`: Dados públicos do PNCP, sem RLS necessário

---

## Considerações de Performance

1. **Índices Full-Text:** Usar `GIN` para busca textual em `itens_licitacao.descricao`
2. **Particionamento:** Em V2, considerar particionar `licitacoes` e `itens_licitacao` por ano se volume crescer muito
3. **Arquivamento:** Em V2, considerar mover licitações antigas (> 5 anos) para tabelas de arquivo
4. **Paginação:** Sempre usar cursor-based ou limit/offset com limites razoáveis (ex: max 100 por página)

---

## Migrações

Sugestão: Criar arquivos SQL versionados em `backend/infra/migrations/`:

- `001_create_licitacoes.sql`
- `002_create_itens_licitacao.sql`
- `003_create_tenants.sql`
- `004_create_usuarios.sql`
- `005_create_pesquisas_preco.sql`
- `006_create_pesquisa_itens.sql`
- `007_create_relatorios.sql`
- `008_create_indexes.sql` (índices adicionais e full-text)

---

## Próximos Passos

1. Revisar esta estrutura e ajustar conforme necessário
2. Validar apenas o comportamento das APIs do PNCP em relação ao campo `valorTotalHomologado` (garantir que `> 1` é um critério seguro para considerar homologada para o nosso caso de uso)
3. Criar scripts de migração SQL (ou adaptar os existentes) a partir desta definição
4. Implementar repositories no código

---

# ⚡ NOVO SISTEMA: Tabelas de Compliance Lei 14.133/2021

## Contexto da Atualização

A **Migração 002** (`002_law_14133_restructure.sql`) introduziu um novo sistema de pesquisa de preços totalmente compatível com os requisitos da Lei 14.133/2021. Este sistema opera em **paralelo** ao sistema antigo (pesquisas_preco), que foi marcado como "arquivado" para acesso somente leitura.

**Mudança Fundamental:**
- **Sistema Antigo:** Pesquisa → Seleciona itens PNCP → Calcula estatísticas globais
- **Novo Sistema:** Projeto → Define itens manualmente → Vincula 3+ fontes PNCP por item → Calcula mediana individual

---

## Tabelas Novas

### 8. `projetos`

Armazena projetos de pesquisa de preços conforme Lei 14.133/2021. É o container principal do novo sistema, substituindo funcionalmente `pesquisas_preco` com validações de compliance.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `tenant_id` | UUID | FK → tenants.id, NOT NULL | Referência ao tenant |
| `usuario_id` | UUID | FK → usuarios.id, NOT NULL | Usuário que criou o projeto |
| `nome` | VARCHAR(200) | NOT NULL | Nome do projeto |
| `descricao` | TEXT | | Descrição opcional |
| `numero_processo` | VARCHAR(100) | | Número do processo licitatório |
| `objeto` | TEXT | | Objeto da licitação |
| `status` | VARCHAR(20) | DEFAULT 'rascunho', CHECK | Status: 'rascunho', 'em_andamento', 'finalizado', 'cancelado' |
| `data_finalizacao` | TIMESTAMP WITH TIME ZONE | | Data de finalização do projeto |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização |

**Índices:**

- `INDEX idx_projetos_tenant (tenant_id)` - Para listar projetos do tenant
- `INDEX idx_projetos_usuario (usuario_id)` - Para listar projetos do usuário
- `INDEX idx_projetos_status (status)` - Para filtrar por status

**Observações:**

- Só pode ser finalizado se **todos os itens tiverem 3+ fontes** (validado pela função `validar_projeto_finalizacao`)
- Status 'finalizado' bloqueia edições (imutabilidade para compliance)
- Valor total do projeto = **soma das medianas** de todos os itens (não média global)

---

### 9. `projeto_itens`

Armazena **itens definidos manualmente pelo usuário** dentro de um projeto. Diferente do sistema antigo onde itens eram selecionados diretamente do PNCP, aqui o usuário define o item (nome, quantidade, unidade) e depois vincula 3+ fontes PNCP como referências de preço.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `projeto_id` | UUID | FK → projetos.id, NOT NULL, CASCADE | Referência ao projeto pai |
| `nome` | VARCHAR(200) | NOT NULL | Nome do item (ex: "Lápis nº 2 Preto") |
| `descricao` | TEXT | | Descrição detalhada do item |
| `quantidade` | DECIMAL(15,4) | NOT NULL | Quantidade solicitada |
| `unidade_medida` | VARCHAR(20) | NOT NULL | Unidade (UN, CX, KIT, etc.) |
| `ordem` | INTEGER | DEFAULT 0 | Ordem de exibição |
| `mediana_calculada` | DECIMAL(15,4) | | Mediana dos preços das fontes (auto-calculada) |
| `quantidade_fontes` | INTEGER | DEFAULT 0 | Contador de fontes vinculadas (auto-atualizado) |
| `observacoes` | TEXT | | Observações sobre o item |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização |

**Índices:**

- `INDEX idx_projeto_itens_projeto (projeto_id)` - Para listar itens de um projeto
- `INDEX idx_projeto_itens_ordem (projeto_id, ordem)` - Para ordenação

**Triggers:**

- `trigger_update_fontes_count_insert` - Incrementa `quantidade_fontes` ao adicionar fonte
- `trigger_update_fontes_count_delete` - Decrementa `quantidade_fontes` ao remover fonte
- `trigger_atualizar_mediana_after_fonte` - Recalcula `mediana_calculada` ao alterar fontes

**Observações:**

- `mediana_calculada` é atualizada automaticamente pela função `calcular_mediana_item(projeto_item_id)`
- `quantidade_fontes` é mantida por triggers (não deve ser editada manualmente)
- **Lei 14.133/2021 exige 3+ fontes por item** - validação automática antes de finalizar projeto
- Valor total do item = `mediana_calculada × quantidade`

---

### 10. `item_fontes`

Tabela de relacionamento que vincula **itens PNCP** como **fontes de preço** para cada item do projeto. Cada fonte contribui para o cálculo da mediana do item.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `projeto_item_id` | UUID | FK → projeto_itens.id, NOT NULL, CASCADE | Referência ao item do projeto |
| `item_licitacao_id` | UUID | FK → itens_licitacao.id, NOT NULL | Referência ao item PNCP (fonte) |
| `valor_unitario` | DECIMAL(15,4) | NOT NULL | Valor unitário da fonte (extraído do PNCP) |
| `ignorado_calculo` | BOOLEAN | DEFAULT false | Se a fonte foi marcada como outlier |
| `justificativa_exclusao` | TEXT | | Justificativa obrigatória para exclusão (outlier) |
| `data_licitacao` | TIMESTAMP WITH TIME ZONE | | Data da licitação (denormalizada para recency check) |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação |
| `atualizado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de atualização |

**Índices:**

- `UNIQUE (projeto_item_id, item_licitacao_id)` - Evita duplicar mesma fonte no item
- `INDEX idx_item_fontes_item (projeto_item_id)` - Para listar fontes de um item
- `INDEX idx_item_fontes_licitacao (item_licitacao_id)` - Para buscar uso de fonte

**Triggers:**

- `trigger_update_fontes_count_insert` - Atualiza contador em `projeto_itens`
- `trigger_update_fontes_count_delete` - Atualiza contador em `projeto_itens`
- `trigger_atualizar_mediana_after_fonte` - Recalcula mediana em `projeto_itens`

**Observações:**

- `valor_unitario` é extraído automaticamente do PNCP usando `COALESCE(valor_unitario_estimado, valor_total/quantidade)`
- `data_licitacao` é denormalizada de `licitacoes` para permitir alertas de recência (>12 meses)
- `ignorado_calculo = true` exclui fonte do cálculo da mediana (outlier management)
- `justificativa_exclusao` é **obrigatória** quando `ignorado_calculo = true` (auditabilidade)

---

### 11. `projeto_validacoes`

Log de validações de compliance executadas em projetos. Serve para auditoria e rastreabilidade das verificações da Lei 14.133/2021.

**Campos:**

| Campo | Tipo | Constraints | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `projeto_id` | UUID | FK → projetos.id, NOT NULL, CASCADE | Referência ao projeto |
| `tipo` | VARCHAR(50) | NOT NULL | Tipo: 'minimum_sources', 'recency_check', 'outlier_review' |
| `nivel` | VARCHAR(20) | NOT NULL | Nível: 'erro', 'aviso', 'info' |
| `mensagem` | TEXT | NOT NULL | Mensagem descritiva da validação |
| `dados` | JSONB | | Dados estruturados da validação (opcional) |
| `projeto_item_id` | UUID | FK → projeto_itens.id | Referência ao item (se específico) |
| `item_fonte_id` | UUID | FK → item_fontes.id | Referência à fonte (se específica) |
| `criado_em` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Data de criação |

**Índices:**

- `INDEX idx_projeto_validacoes_projeto (projeto_id)` - Para listar validações do projeto
- `INDEX idx_projeto_validacoes_nivel (nivel)` - Para filtrar por severidade
- `INDEX idx_projeto_validacoes_criado (criado_em)` - Para ordenação temporal

**Observações:**

- **Níveis de validação:**
  - `erro` - Bloqueia finalização (ex: <3 fontes por item)
  - `aviso` - Alerta, mas não bloqueia (ex: fontes >12 meses)
  - `info` - Informativo, usuário decide (ex: outlier detectado)
- Usado pelo `ProjetoValidacaoService` para gerar relatórios de compliance
- Permite rastrear histórico de validações ao longo do tempo

---

## Funções SQL de Suporte

### `calcular_mediana_item(projeto_item_id UUID)`

Calcula a **mediana** dos preços das fontes de um item, **excluindo fontes ignoradas** (outliers).

**Retorno:** `DECIMAL(15,4)` - Mediana dos preços ou NULL se não houver fontes

**Uso:** Chamada automaticamente por trigger ao adicionar/remover/ignorar fontes. Pode ser chamada manualmente via `UPDATE projeto_itens SET mediana_calculada = calcular_mediana_item(id) WHERE id = ?`

**Implementação:** Usa `PERCENTILE_CONT(0.5)` (PostgreSQL) para calcular mediana de forma eficiente.

---

### `validar_projeto_finalizacao(projeto_id UUID)`

Valida se um projeto pode ser finalizado conforme Lei 14.133/2021.

**Retorno:** Record com campos:
- `valido` (BOOLEAN) - Se projeto pode ser finalizado
- `total_itens` (INTEGER) - Total de itens no projeto
- `itens_pendentes` (INTEGER) - Itens com <3 fontes
- `mensagem` (TEXT) - Mensagem descritiva do resultado

**Regra:** Projeto só pode ser finalizado se **todos os itens tiverem 3+ fontes**.

---

## Views Úteis (Sugeridas)

### `view_projetos_com_metricas`

Agrega métricas de cada projeto:

```sql
CREATE VIEW view_projetos_com_metricas AS
SELECT
  p.id,
  p.nome,
  p.status,
  COUNT(pi.id) AS total_itens,
  SUM(CASE WHEN pi.quantidade_fontes < 3 THEN 1 ELSE 0 END) AS itens_pendentes,
  SUM(pi.mediana_calculada * pi.quantidade) AS valor_total_estimado,
  p.criado_em,
  p.atualizado_em
FROM projetos p
LEFT JOIN projeto_itens pi ON pi.projeto_id = p.id
GROUP BY p.id;
```

---

### `view_itens_com_status_compliance`

Lista itens com status de compliance:

```sql
CREATE VIEW view_itens_com_status_compliance AS
SELECT
  pi.id,
  pi.projeto_id,
  pi.nome,
  pi.quantidade_fontes,
  pi.mediana_calculada,
  CASE
    WHEN pi.quantidade_fontes >= 3 THEN 'compliant'
    WHEN pi.quantidade_fontes >= 1 THEN 'partial'
    ELSE 'pending'
  END AS status_compliance,
  (3 - pi.quantidade_fontes) AS fontes_faltantes
FROM projeto_itens pi;
```

---

## Diagrama de Relacionamentos (Atualizado)

```
tenants (1) ──< (N) usuarios
tenants (1) ──< (N) pesquisas_preco [ARQUIVADO - Somente Leitura]
tenants (1) ──< (N) projetos [NOVO SISTEMA]
usuarios (1) ──< (N) projetos
projetos (1) ──< (N) projeto_itens
projeto_itens (1) ──< (N) item_fontes
item_fontes (N) ──> (1) itens_licitacao [Fonte PNCP]
itens_licitacao (N) ──> (1) licitacoes
projetos (1) ──< (N) projeto_validacoes
```

---

## Diferenças Principais: Sistema Antigo vs. Novo

| Aspecto | Sistema Antigo | Novo Sistema |
|---------|---------------|--------------|
| **Tabela Principal** | `pesquisas_preco` | `projetos` |
| **Itens** | `pesquisa_itens` (join direto com PNCP) | `projeto_itens` (entidade própria) + `item_fontes` (join) |
| **Cálculo de Preço** | Média/mediana **global** de todos os itens | Mediana **individual** por item |
| **Valor Total** | Média global × soma quantidades | **Soma das medianas** de cada item |
| **Validação Mínima** | Nenhuma (pode finalizar com 0 itens) | **3+ fontes por item obrigatórias** |
| **Outliers** | Apenas detecta | Usuário **marca como ignorado** com justificativa |
| **Recência** | Não valida | **Alerta automático** para fontes >12 meses |
| **Compliance** | Sem garantias | **100% compliance** Lei 14.133/2021 |
| **Auditabilidade** | Limitada | Log completo em `projeto_validacoes` |
| **Status** | 'rascunho' → 'finalizada' | 'rascunho' → 'em_andamento' → 'finalizado' |

---

## Fluxo de Dados (Novo Sistema)

1. **Criar Projeto** → `INSERT INTO projetos` (status 'rascunho')
2. **Adicionar Item** → `INSERT INTO projeto_itens` (quantidade_fontes = 0)
3. **Buscar PNCP** → Query em `itens_licitacao` WHERE `descricao ILIKE '%termo%'`
4. **Vincular Fonte** → `INSERT INTO item_fontes` (trigger atualiza contador e mediana)
5. **Repetir 3-4** até ter 3+ fontes por item
6. **Marcar Outlier (Opcional)** → `UPDATE item_fontes SET ignorado_calculo = true` (trigger recalcula mediana)
7. **Validar** → Chamar `validar_projeto_finalizacao(projeto_id)`
8. **Finalizar** → `UPDATE projetos SET status = 'finalizado'` (se validação passar)

---

## Considerações de Segurança e Compliance

1. **Imutabilidade:** Projetos finalizados **não podem ser editados** (status 'finalizado' bloqueia alterações no backend)
2. **Justificativas Obrigatórias:** Exclusão de fontes (outliers) exige `justificativa_exclusao` (mínimo 10 caracteres)
3. **Rastreabilidade:** Todos os eventos de validação são logados em `projeto_validacoes`
4. **Recência:** Sistema alerta (não bloqueia) para fontes com data_licitacao > 12 meses
5. **Override Admin:** Finalização com <3 fontes **só é possível** com justificativa de override (admin)

---

## Migração de Dados

**Decisão:** Não há migração automática do sistema antigo para o novo.

**Motivo:**
- Estruturas fundamentalmente diferentes (global vs. per-item)
- Sistema antigo pode ter apenas 1 fonte por item (não cumpre 3+ fontes)
- Requer revisão manual para garantir compliance

**Estratégia:**
- Sistema antigo (`pesquisas_preco`) permanece **somente leitura** (flag `archived = true`)
- Dashboard mostra toggle "Ver Pesquisas Antigas (Arquivadas)"
- Novos projetos usam exclusivamente o novo sistema (`projetos`)

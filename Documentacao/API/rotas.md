# Rotas da API

## Health

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/health` | Verifica se a API e o banco estão respondendo. |

**Resposta (200):** `{ status, message, database: 'connected' }`  
**Implementado:** Sim. **Falta:** Nada.

---

## Admin — Sincronização PNCP

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/admin/sincronizar-historico` | Sincroniza licitações e itens do PNCP em um intervalo de datas (histórico). |
| POST | `/api/admin/sincronizar-atualizacoes` | Sincroniza licitações e itens do PNCP (atualizações por período). |

**Body (opcional):**
- `dataInicial` (string): data inicial — formato `YYYYMMDD` ou ISO.
- `dataFinal` (string): data final — formato `YYYYMMDD` ou ISO.
- `codigoModalidadeContratacao` (number): default 8 (Dispensa).

**Resposta (200):** `{ success, message, resultado: { totalProcessadas, totalSalvas, totalItensEnriquecidos, erros } }`  
**Implementado:** Parsing de datas, chamada PNCP (APIs 1/2 e 3), paginação, filtro `valorTotalHomologado > 1`, upsert licitações e itens.  
**Falta:** Autenticação/autorização; controle de concorrência.

---

## Itens — Busca para cotação

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/itens/buscar` | Busca itens por texto na descrição; opcionalmente filtra por raio (km) a partir de lat/long. |

**Query params:**
- `q` (obrigatório): termo de busca na descrição.
- `lat`, `lng`, `raioKm` (opcionais): se os três forem informados, aplica filtro geográfico (Haversine).
- `limit` (opcional): default 50, máx 100.
- `offset` (opcional): default 0.

**Resposta (200):** `{ success, itens: [...], total, limit, offset }` — cada item com `id`, `licitacaoId`, `numeroItem`, `descricao`, `valorUnitarioEstimado`, `valorTotal`, `quantidade`, `unidadeMedida`, e quando há filtro geográfico: `distanciaKm`, `municipioNome`, `ufSigla`.  
**Implementado:** Busca por descrição (JOIN com licitação), lat/long em `municipios`, Haversine, filtro por raio, ordenação por distância.  
**Falta:** Full-text avançado; autenticação.

---

### Upload de planilha (cotação)

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/itens/upload-planilha` | Envia planilha Excel; retorna linhas com sugestões de itens do histórico para o usuário selecionar. |

**Content-Type:** `multipart/form-data`.  
**Campo:** `arquivo` (obrigatório) — arquivo .xlsx ou .xls (máx. 5 MB).

**Resposta (200):** `{ success, linhas: [{ linha, descricaoOriginal, quantidade?, unidade?, matches: [{ id, descricao, valorUnitarioEstimado, valorTotal, quantidade, unidadeMedida }, ...] }] }`  
**Implementado:** Leitura da primeira aba, detecção de colunas (descrição, quantidade, unidade), busca por descrição para cada linha (até 200 linhas, 10 matches por linha).  
**Falta:** Autenticação.

---

## Pesquisas de preço (cotações)

### Criar pesquisa (cotação)

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/pesquisas` | Cria uma nova pesquisa de preço (cotação). Pode incluir itens já na criação. |

**Body:**
- `nome` (string, obrigatório)
- `descricao` (string, opcional)
- `tenantId` (string UUID, obrigatório)
- `usuarioId` (string UUID, obrigatório)
- `itemLicitacaoIds` (string[], opcional) — IDs dos itens selecionados; se enviado, a cotação é criada já com esses itens.

**Resposta (201):** `{ success, pesquisa: { id, tenantId, usuarioId, nome, descricao, status, criadoEm, atualizadoEm }, itensAdicionados? }` — `itensAdicionados` presente quando `itemLicitacaoIds` foi enviado.  
**Implementado:** Validação, insert em `pesquisas_preco`, e se `itemLicitacaoIds` existir, insert em `pesquisa_itens`.  
**Falta:** Validar existência de tenant e usuário; autenticação.

---

### Listar pesquisas

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/pesquisas` | Lista pesquisas do tenant. |

**Query params:** `tenantId` (obrigatório).

**Resposta (200):** `{ success, pesquisas: [...] }`  
**Implementado:** Listagem por tenant. **Falta:** Autenticação e restrição ao tenant do usuário.

---

### Detalhe da pesquisa

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/pesquisas/:id` | Retorna a pesquisa e os itens vinculados. |

**Resposta (200):** `{ success, pesquisa: {...}, itens: [...] }`  
**Implementado:** Busca pesquisa + itens via `pesquisa_itens`. **Falta:** Controle de acesso por tenant.

---

### Adicionar itens à pesquisa

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/pesquisas/:id/itens` | Associa itens de licitação à pesquisa. |

**Body:** `{ itemLicitacaoIds: string[] }` (array de UUIDs).

**Resposta (200):** `{ success, message: "N itens adicionados" }`  
**Implementado:** Insert em `pesquisa_itens` com ON CONFLICT DO NOTHING (evita duplicata).  
**Falta:** Validar existência dos itens em `itens_licitacao`; autenticação.

---

### Remover itens da pesquisa

| Método | Path | Descrição |
|--------|------|------------|
| DELETE | `/api/pesquisas/:id/itens` | Remove itens da cotação. |

**Body:** `{ itemLicitacaoIds: string[] }` (array de UUIDs dos itens a remover).

**Resposta (200):** `{ success, message: "N itens removidos" }`  
**Implementado:** DELETE em `pesquisa_itens` para os IDs informados.  
**Falta:** Autenticação.

---

### Estatísticas da pesquisa

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/pesquisas/:id/estatisticas` | Calcula média, mediana, menor/maior preço, desvio padrão e outliers (IQR) dos itens da pesquisa. |

**Resposta (200):** `{ success, pesquisaId, pesquisa: { id, nome, status }, estatisticas: { media, mediana, menorPreco, maiorPreco, desvioPadrao, quantidade, outliers }, itens: [{ index, itemId, descricao, valorUnitarioEstimado, valorTotal, isOutlier }, ...] }`  
**Implementado:** Extração de preços (valor unitário ou total), cálculo IQR, mapeamento de outliers para itens.  
**Falta:** Persistir resultado (ex.: status finalizada ou JSON); autenticação.

---

### Consolidar pesquisa

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/pesquisas/:id/consolidar` | Calcula as mesmas estatísticas e retorna (sem lista de itens). |

**Resposta (200):** `{ success, pesquisaId, message, estatisticas: { media, mediana, menorPreco, maiorPreco, desvioPadrao, quantidade, outliers } }`  
**Implementado:** Cálculo e retorno. **Falta:** Persistir status “finalizada”; autenticação.

---

### Gerar relatório

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/pesquisas/:id/relatorio` | Registra geração de relatório e retorna URL/hash placeholder. |

**Body (opcional):** `{ tipo: 'pdf' | 'word' }` — default `pdf`.

**Resposta (201):** `{ success, message, urlOuCaminho, hash, relatorioId }`
**Implementado:** Insert em `relatorios`, retorno com placeholder.
**Falta:** Geração real do arquivo PDF/Word, QR Code e URL de download.

---

# ⚡ NOVO SISTEMA: Projetos (Lei 14.133/2021)

> **Substitui o sistema antigo de `pesquisas_preco` com estrutura hierárquica compliance:**
> **Projeto → Itens (definidos pelo usuário) → Fontes PNCP (mínimo 3)**

---

## Projetos — CRUD

### Criar projeto

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/projetos` | Cria um novo projeto de pesquisa de preços conforme Lei 14.133/2021. |

**Body:**
- `nome` (string, obrigatório) — Nome do projeto.
- `descricao` (string, opcional) — Descrição detalhada.
- `numeroProcesso` (string, opcional) — Ex: "Processo 123/2026".
- `objeto` (string, opcional) — Objeto da contratação.
- `tenantId` (string UUID, obrigatório) — Organização.
- `usuarioId` (string UUID, obrigatório) — Usuário responsável.

**Resposta (201):** `{ success, projeto: { id, tenantId, usuarioId, nome, descricao, numeroProcesso, objeto, status: 'rascunho', criadoEm, atualizadoEm } }`
**Implementado:** Validação, insert em `projetos` com status inicial 'rascunho'.
**Falta:** Autenticação.

---

### Listar projetos

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/projetos` | Lista projetos do tenant. |

**Query params:**
- `tenantId` (obrigatório) — UUID da organização.
- `incluirArquivados` (opcional) — boolean, default `true`. Se `false`, exclui projetos cancelados.

**Resposta (200):** `{ success, projetos: [...] }`
**Implementado:** Listagem por tenant com filtro opcional de cancelados. **Falta:** Autenticação.

---

### Buscar projeto por ID

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/projetos/:id` | Retorna projeto com lista completa de itens. |

**Resposta (200):** `{ success, projeto: {...}, itens: [{ id, projetoId, nome, descricao, quantidade, unidadeMedida, ordem, medianaCalculada, quantidadeFontes, observacoes, criadoEm, atualizadoEm }, ...] }`
**Implementado:** Busca projeto + itens com mediana e contador de fontes. **Falta:** Controle de acesso por tenant.

---

### Atualizar projeto

| Método | Path | Descrição |
|--------|------|------------|
| PUT | `/api/projetos/:id` | Atualiza dados do projeto. |

**Body (todos opcionais):**
- `nome` (string)
- `descricao` (string)
- `numeroProcesso` (string)
- `objeto` (string)
- `status` ('rascunho' | 'em_andamento' | 'finalizado' | 'cancelado')

**Resposta (200):** `{ success, projeto: {...} }`
**Implementado:** Update dinâmico dos campos fornecidos. **Falta:** Validação de transições de status.

---

### Deletar projeto

| Método | Path | Descrição |
|--------|------|------------|
| DELETE | `/api/projetos/:id` | Deleta projeto (não permitido se finalizado). |

**Resposta (200):** `{ success, message: 'Projeto deletado com sucesso' }`
**Resposta (400):** Se projeto está finalizado.
**Implementado:** Validação de status + DELETE CASCADE. **Falta:** Autenticação.

---

### Validar projeto (Compliance)

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/projetos/:id/validar` | Valida compliance do projeto com Lei 14.133/2021. |

**Resposta (200):** `{ success, validacao: { valido: boolean, erros: [], avisos: [], infos: [] } }`

**Tipos de validação:**
1. **ERRO (bloqueia finalização)**: Itens com menos de 3 fontes.
2. **AVISO**: Fontes com mais de 12 meses de idade.
3. **INFO**: Outliers detectados pelo método IQR (usuário decide se ignora).

**Implementado:** Validação completa com 3 níveis de severidade. **Falta:** Persistir resultado em `projeto_validacoes`.

---

### Finalizar projeto

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/projetos/:id/finalizar` | Finaliza projeto (valida 3+ fontes por item, marca como 'finalizado'). |

**Body (opcional):**
- `justificativaOverride` (string) — Justificativa para sobrescrever validação (admin apenas).

**Resposta (200):** `{ success, projeto: {...}, validacao: { valido, totalItens, itensPendentes, mensagem } }`
**Resposta (400):** Se validação falhar e não houver justificativa.
**Implementado:** Validação SQL + atualização de status e data_finalizacao. **Falta:** Controle de permissão admin.

---

## Itens — CRUD e Fontes

### Criar item em projeto

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/projetos/:projetoId/itens` | Cria item definido manualmente pelo usuário. |

**Body:**
- `nome` (string, obrigatório) — Ex: "Lápis nº 2 Preto".
- `quantidade` (number, obrigatório) — Deve ser > 0.
- `unidadeMedida` (string, obrigatório) — Ex: "UN", "CX", "KG".
- `descricao` (string, opcional)
- `ordem` (number, opcional) — Ordem de exibição.
- `observacoes` (string, opcional)

**Resposta (201):** `{ success, item: { id, projetoId, nome, descricao, quantidade, unidadeMedida, ordem, medianaCalculada: null, quantidadeFontes: 0, ... } }`
**Implementado:** Validação + insert em `projeto_itens`. **Falta:** Autenticação.

---

### Listar itens de projeto

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/projetos/:projetoId/itens` | Lista todos os itens do projeto. |

**Resposta (200):** `{ success, itens: [...] }`
**Implementado:** Listagem ordenada por `ordem` e `criado_em`. **Falta:** Autenticação.

---

### Buscar item por ID (com fontes)

| Método | Path | Descrição |
|--------|------|------------|
| GET | `/api/projeto-itens/:id` | Retorna item com todas as fontes PNCP vinculadas (detalhadas). |

**Resposta (200):** `{ success, item: {...}, fontes: [{ id, projetoItemId, itemLicitacaoId, valorUnitario, ignoradoCalculo, justificativaExclusao, dataLicitacao, descricaoPNCP, numeroControlePNCP, razaoSocialOrgao, municipioNome, ufSigla, numeroCompra, criadoEm }, ...] }`
**Implementado:** JOIN com `itens_licitacao` e `licitacoes` para dados denormalizados. **Falta:** Autenticação.

---

### Atualizar item

| Método | Path | Descrição |
|--------|------|------------|
| PUT | `/api/projeto-itens/:id` | Atualiza dados do item. |

**Body (todos opcionais):**
- `nome` (string)
- `descricao` (string)
- `quantidade` (number, deve ser > 0)
- `unidadeMedida` (string)
- `ordem` (number)
- `observacoes` (string)

**Resposta (200):** `{ success, item: {...} }`
**Implementado:** Update dinâmico. **Falta:** Autenticação.

---

### Deletar item

| Método | Path | Descrição |
|--------|------|------------|
| DELETE | `/api/projeto-itens/:id` | Deleta item (remove todas as fontes em cascata). |

**Resposta (200):** `{ success, message: 'Item deletado com sucesso' }`
**Implementado:** DELETE CASCADE. **Falta:** Autenticação.

---

### Adicionar fonte PNCP a item

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/projeto-itens/:id/fontes` | Vincula fonte PNCP ao item (extrai preço automaticamente). |

**Body:**
- `itemLicitacaoId` (string UUID, obrigatório) — ID do item PNCP a usar como fonte.

**Resposta (201):** `{ success, fonte: { id, projetoItemId, itemLicitacaoId, valorUnitario, ignoradoCalculo: false, dataLicitacao }, medianaAtualizada: number | null }`
**Resposta (400):** Se fonte já está vinculada (constraint UNIQUE).
**Implementado:** Insert em `item_fontes` + recálculo automático da mediana. **Falta:** Autenticação.

---

### Remover fonte de item

| Método | Path | Descrição |
|--------|------|------------|
| DELETE | `/api/projeto-itens/:id/fontes/:fonteId` | Remove fonte do item. |

**Resposta (200):** `{ success, message: 'Fonte removida com sucesso', medianaAtualizada: number | null }`
**Implementado:** DELETE + recálculo automático da mediana. **Falta:** Autenticação.

---

### Marcar fonte como ignorada (outlier)

| Método | Path | Descrição |
|--------|------|------------|
| PUT | `/api/fontes/:id/ignorar` | Marca fonte como ignorada no cálculo da mediana (outlier). |

**Body:**
- `justificativa` (string, obrigatório) — Mínimo 10 caracteres. Ex: "Outlier - fornecedor especializado".

**Resposta (200):** `{ success, fonte: { id, projetoItemId, ignoradoCalculo: true, justificativaExclusao }, medianaAtualizada: number | null }`
**Implementado:** Update + recálculo automático. **Falta:** Autenticação.

---

### Desmarcar fonte como ignorada

| Método | Path | Descrição |
|--------|------|------------|
| PUT | `/api/fontes/:id/incluir` | Remove marcação de ignorada, incluindo fonte novamente no cálculo. |

**Resposta (200):** `{ success, fonte: { id, projetoItemId, ignoradoCalculo: false, justificativaExclusao: null }, medianaAtualizada: number | null }`
**Implementado:** Update + recálculo automático. **Falta:** Autenticação.

---

### Recalcular mediana de item

| Método | Path | Descrição |
|--------|------|------------|
| POST | `/api/projeto-itens/:id/recalcular` | Força recálculo da mediana do item (usando função SQL `calcular_mediana_item`). |

**Resposta (200):** `{ success, mediana: number | null, message }`
**Implementado:** Chamada à função SQL + update em `projeto_itens`. **Falta:** Autenticação.

---

## Diferenças: Sistema Antigo vs. Novo

| Aspecto | Sistema Antigo (`pesquisas_preco`) | Novo Sistema (`projetos`) |
|---------|-------------------------------------|----------------------------|
| **Estrutura** | Pesquisa → Itens PNCP selecionados | Projeto → Itens (usuário define) → Fontes PNCP (3+) |
| **Estatísticas** | Global (média/mediana de todos os itens) | **Por item** (cada item tem sua mediana) |
| **Compliance** | Sem validação mínima de fontes | **Exige 3+ fontes por item** (Lei 14.133/2021) |
| **Outliers** | Detecta mas não permite exclusão | Usuário pode **marcar como ignorado** com justificativa |
| **Recência** | Sem validação | **Alerta para fontes >12 meses** |
| **Valor total** | Média/mediana global | **Soma das medianas de cada item** |
| **Status** | Finalização manual | Validação automática (3+ fontes) |

---

## Migração de Dados

- Sistema antigo continua acessível via `/api/pesquisas` (read-only recomendado).
- `pesquisas_preco.archived = true` para todas as cotações antigas.
- Novos projetos devem usar `/api/projetos`.

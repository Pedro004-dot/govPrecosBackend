# Camadas da aplicação

## 1. Routes

Definem os endpoints HTTP e delegam ao controller correspondente.

| Arquivo | Prefixo | Responsabilidade |
|---------|---------|------------------|
| `admin.routes.ts` | `/api/admin` | Sincronização PNCP (histórico e atualizações). |
| `item.routes.ts` | `/api/itens` | Busca de itens (texto + filtro geográfico) e upload de planilha Excel. |
| `pesquisa.routes.ts` | `/api/pesquisas` | CRUD de pesquisas (cotações), adicionar/remover itens, estatísticas, consolidar, relatório. |

Registro em `src/index.ts`: health em `/api/health`, depois `createAdminRoutes`, `createItemRoutes`, `createPesquisaRoutes`.

---

## 2. Controllers

Recebem o request, validam parâmetros/body, chamam o service (ou repositório quando não há lógica extra) e montam a resposta HTTP.

| Controller | Responsabilidade |
|------------|------------------|
| **SincronizacaoController** | `sincronizarHistorico` e `sincronizarAtualizacoes` — parse de datas, chamada ao SincronizadorGovernoService, resposta com resultado. |
| **ItemController** | `buscar` — extrai `q`, `lat`, `lng`, `raioKm`, `limit`, `offset`; chama ItemService.buscarItensParaCotacao. `uploadPlanilha` — recebe Excel (multer), chama PlanilhaCotacaoService.processar; retorna linhas com matches. |
| **PesquisaController** | `criar` (aceita `itemLicitacaoIds` opcional para criar cotação já com itens), `listar`, `buscarPorId`, `adicionarItens`, `removerItens` — validação e delegação ao PesquisaPrecoRepository. |
| **ConsolidacaoController** | `getEstatisticas` e `consolidar` — carrega pesquisa e itens, extrai preços, chama CalculadoraEstatisticaService, retorna estatísticas (e lista de itens com isOutlier no GET). |
| **RelatorioController** | `gerar` — chama RelatorioService.gerar; retorna urlOuCaminho/hash/relatorioId (placeholder). |

---

## 3. Services (lógica de negócio)

| Service | Responsabilidade |
|---------|------------------|
| **SincronizadorGovernoService** | Orquestra sincronização: chama GovernoApiGateway (API 1 ou 2), filtra por `valorTotalHomologado > 1`, upsert em LicitacaoRepository; para cada licitação, dispara EnriquecedorItemService para buscar itens (API 3) e persistir. |
| **EnriquecedorItemService** | Recebe identificador da licitação, chama GovernoApiGateway.buscarDetalhesItem (API 3), persiste itens via ItemLicitacaoRepository (filtro de homologação opcional no gateway/service). |
| **ItemService** | `buscarItensParaCotacao`: chama ItemLicitacaoRepository.searchByDescricaoWithLicitacao; obtém lat/long dos municípios (MunicipioRepository.findLatLongByCodigos); aplica Haversine e filtro por raio; ordena por distância e retorna itens enriquecidos. |
| **PlanilhaCotacaoService** | `processar(buffer)`: lê Excel (xlsx), detecta colunas (descrição, quantidade, unidade); para cada linha com descrição chama ItemLicitacaoRepository.searchByDescricaoWithLicitacao; retorna linhas com matches sugeridos. |
| **CalculadoraEstatisticaService** | Funções puras: média, mediana, desvio padrão, menores/maiores; detecção de outliers por IQR (Q1, Q3, 1.5×IQR). Método `calcular(precos): ResultadoEstatisticas`. |
| **RelatorioService** | Esqueleto: busca pesquisa (tenant_id), insere registro em RelatorioRepository com URL/hash placeholder; retorna `{ urlOuCaminho, hash?, relatorioId }`. Geração real de PDF/Word em etapa futura. |

---

## 4. Repositories (acesso a dados)

| Repository | Tabelas / fonte | Principais métodos |
|------------|-----------------|--------------------|
| **LicitacaoRepository** | `licitacoes` | upsert por numero_controle_pncp, buscar por id, listar. |
| **ItemLicitacaoRepository** | `itens_licitacao` | upsert de itens, searchByDescricaoWithLicitacao (JOIN com licitacoes para codigo_ibge, municipio_nome, uf_sigla). |
| **MunicipioRepository** | `municipios` (Supabase) | findByCodigoIbge, findLatLongByCodigos (batch por códigos IBGE). |
| **PesquisaPrecoRepository** | `pesquisas_preco`, `pesquisa_itens` | criar, listarPorTenant, buscarPorId, adicionarItens (ON CONFLICT DO NOTHING), removerItens, buscarItensDaPesquisa. |
| **RelatorioRepository** | `relatorios` | criar (pesquisa_id, tenant_id, tipo, url_acesso, hash_arquivo). |

---

## 5. Gateways (integrações externas)

| Gateway | Responsabilidade |
|---------|------------------|
| **GovernoApiGateway** | PNCP: buscarHistorico (API 1 – publicacao), buscarAtualizacoes (API 2 – atualizacao), buscarDetalhesItem (API 3 – itens por CNPJ/ano/sequencial). Traduz JSON da API para entidades/objetos internos. Timeout configurável. |

Tipos da API PNCP em `gateways/pncp.types.ts`.

---

## 6. Domain (entidades e value objects)

| Entidade / VO | Descrição |
|----------------|-----------|
| **Licitacao** | Cabeçalho da licitação (numeroControlePNCP, orgao, unidade, datas, valorTotalHomologado, codigoIbge, etc.). |
| **ItemLicitacao** | Item da licitação (descricao, valorUnitarioEstimado, valorTotal, quantidade, unidadeMedida, situacaoCompraItemNome, etc.). |
| **PesquisaPreco** | Pesquisa de preço do usuário (id, tenantId, usuarioId, nome, descricao, status, criadoEm, atualizadoEm). |
| **Cnpj** | Value object para validação/formatação de CNPJ. |

---

## 7. Infra

| Módulo | Descrição |
|--------|-----------|
| **db.ts** | Singleton de conexão PostgreSQL (pool), métodos `query`, `queryOne`, `getClient`, `close`. Usa `DATABASE_URL` do ambiente. |
| **haversine.ts** | Função `calcularDistanciaKm(lat1, lon1, lat2, lon2): number` para filtro geográfico. |

---

## Fluxo de dependências (index.ts)

- **Database** → todos os repositórios.
- **GovernoApiGateway** → SincronizadorGovernoService, EnriquecedorItemService.
- **LicitacaoRepository**, **ItemLicitacaoRepository** → SincronizadorGovernoService, EnriquecedorItemService.
- **ItemLicitacaoRepository**, **MunicipioRepository** → ItemService.
- **PesquisaPrecoRepository** → PesquisaController, ConsolidacaoController, RelatorioService.
- **CalculadoraEstatisticaService** → ConsolidacaoController.
- **RelatorioRepository** + **PesquisaPrecoRepository** → RelatorioService.

Controllers recebem os services (ou repositórios quando não há service); rotas recebem os controllers.

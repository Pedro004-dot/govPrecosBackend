# Fluxos de dados

## 1. Sincronização PNCP (histórico ou atualizações)

1. Cliente chama `POST /api/admin/sincronizar-historico` ou `sincronizar-atualizacoes` com body opcional (dataInicial, dataFinal, codigoModalidadeContratacao).
2. **SincronizacaoController** faz parse das datas e chama **SincronizadorGovernoService**.
3. **SincronizadorGovernoService** chama **GovernoApiGateway** (API 1 ou 2) com paginação.
4. Para cada página: filtra licitações com `valorTotalHomologado > 1`; faz upsert em **LicitacaoRepository**.
5. Para cada licitação nova/atualizada: chama **EnriquecedorItemService** com identificador (CNPJ, ano, sequencial).
6. **EnriquecedorItemService** chama **GovernoApiGateway.buscarDetalhesItem** (API 3), mapeia itens e persiste via **ItemLicitacaoRepository** (upsert).
7. Resposta ao cliente: `{ success, message, resultado: { totalProcessadas, totalSalvas, totalItensEnriquecidos, erros } }`.

---

## 2. Busca de itens para cotação (com filtro geográfico opcional)

1. Cliente chama `GET /api/itens/buscar?q=...&lat=...&lng=...&raioKm=...&limit=50&offset=0`.
2. **ItemController** valida `q` (obrigatório), extrai lat, lng, raioKm, limit, offset e chama **ItemService.buscarItensParaCotacao**.
3. **ItemService** chama **ItemLicitacaoRepository.searchByDescricaoWithLicitacao(q, limit, offset)** — retorna itens com `codigo_ibge` (e nome/UF do município) da licitação.
4. Se lat, lng e raioKm foram informados:
   - Obtém códigos IBGE únicos dos itens; chama **MunicipioRepository.findLatLongByCodigos(codigos)**.
   - Para cada item, calcula distância (Haversine) entre (lat, lng) do usuário e (lat, lng) do município da licitação.
   - Filtra itens com `distanciaKm <= raioKm`, ordena por distância e limita ao `limit`.
5. Se não informou filtro geográfico: retorna itens da busca textual sem filtro de distância.
6. Resposta: `{ success, itens: [...], total, limit, offset }` — cada item com id, descricao, preços, distanciaKm, municipioNome, ufSigla (quando há filtro geográfico).

---

## 3. Upload de planilha (cotação)

1. Cliente chama `POST /api/itens/upload-planilha` (multipart, campo `arquivo`).
2. **ItemController** recebe o arquivo; **PlanilhaCotacaoService.processar(buffer)** lê a primeira aba do Excel, detecta colunas (descrição, quantidade, unidade) e para cada linha com descrição chama **ItemLicitacaoRepository.searchByDescricaoWithLicitacao** (até 10 matches por linha, máx. 200 linhas).
3. Resposta: `{ success, linhas: [{ linha, descricaoOriginal, quantidade?, unidade?, matches: [...] }] }`. O front exibe as sugestões; o usuário seleciona e cria a cotação com os IDs escolhidos.

---

## 4. Pesquisa de preço / cotação (criar, listar, detalhe, adicionar/remover itens)

- **Criar:** `POST /api/pesquisas` com `{ nome, descricao?, tenantId, usuarioId, itemLicitacaoIds? }` → **PesquisaPrecoRepository.criar** → se `itemLicitacaoIds` existir, **adicionarItens** em seguida. Cotação pode ser criada já com itens.
- **Listar:** `GET /api/pesquisas?tenantId=...` → **PesquisaPrecoRepository.listarPorTenant**.
- **Detalhe:** `GET /api/pesquisas/:id` → **PesquisaPrecoRepository.buscarPorId** + **buscarItensDaPesquisa** → resposta com pesquisa e itens.
- **Adicionar itens:** `POST /api/pesquisas/:id/itens` com `{ itemLicitacaoIds: string[] }` → **PesquisaPrecoRepository.adicionarItens** → insert em `pesquisa_itens` com ON CONFLICT DO NOTHING.
- **Remover itens:** `DELETE /api/pesquisas/:id/itens` com body `{ itemLicitacaoIds: string[] }` → **PesquisaPrecoRepository.removerItens** → DELETE em `pesquisa_itens`.

---

## 5. Estatísticas e consolidação

1. Cliente chama `GET /api/pesquisas/:id/estatisticas` ou `POST /api/pesquisas/:id/consolidar`.
2. **ConsolidacaoController** carrega pesquisa (**PesquisaPrecoRepository.buscarPorId**) e itens (**buscarItensDaPesquisa**).
3. Extrai preços dos itens (valorUnitarioEstimado ou valorTotal, apenas > 0) e mantém mapeamento índice-preço → índice-item.
4. Chama **CalculadoraEstatisticaService.calcular(precos)** → obtém média, mediana, menor/maior, desvio padrão, quantidade e índices de outliers (IQR).
5. Mapeia índices de outliers de volta para índices dos itens.
6. **GET estatisticas:** retorna estatísticas + lista de itens com flag `isOutlier`.
7. **POST consolidar:** retorna apenas estatísticas (persistir status “finalizada” é opcional e ainda não implementado).

---

## 6. Relatório (esqueleto)

1. Cliente chama `POST /api/pesquisas/:id/relatorio` com body opcional `{ tipo: 'pdf' | 'word' }`.
2. **RelatorioController** chama **RelatorioService.gerar(pesquisaId, tipo)**.
3. **RelatorioService** busca pesquisa (**PesquisaPrecoRepository.buscarPorId**) para obter tenant_id; insere registro em **RelatorioRepository** (tipo, url_acesso e hash placeholder).
4. Resposta: `{ success, urlOuCaminho, hash, relatorioId }`. Geração real de arquivo PDF/Word e QR Code fica para etapa futura.

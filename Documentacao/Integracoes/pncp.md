# Integração PNCP (Portal Nacional de Contratações Públicas)

O backend consome três endpoints do PNCP para sincronizar licitações e itens. O **GovernoApiGateway** encapsula as chamadas; o **SincronizadorGovernoService** e o **EnriquecedorItemService** orquestram o fluxo.

---

## API 1 — Publicação (histórico por data)

**URL:** `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`

**Método:** GET (ou POST, conforme documentação oficial).

**Parâmetros obrigatórios:**
- `dataInicial` — data inicial (YYYYMMDD)
- `dataFinal` — data final (YYYYMMDD)
- `codigoModalidadeContratacao` — ex.: 8 (Dispensa)
- `pagina` — número da página (paginação)

**Resposta:** Objeto com `data` (array de licitações), `totalRegistros`, `totalPaginas`, `numeroPagina`, `paginasRestantes`, `empty`. Cada item em `data` contém: numeroControlePNCP, orgaoEntidade (cnpj, razaoSocial, poderId, esferaId), anoCompra, sequencialCompra, numeroCompra, processo, objetoCompra, unidadeOrgao (ufSigla, municipioNome, codigoIbge, nomeUnidade, codigoUnidade), valorTotalHomologado, valorTotalEstimado, dataPublicacaoPncp, modalidadeId, modalidadeNome, amparoLegal, etc.

**Uso no backend:** SincronizadorGovernoService chama GovernoApiGateway.buscarHistorico(dataInicial, dataFinal, codigoModalidade, pagina). O service filtra licitações com `valorTotalHomologado > 1` e persiste via LicitacaoRepository; em seguida dispara o EnriquecedorItemService para cada licitação (API 3).

---

## API 2 — Atualização

**URL:** `https://pncp.gov.br/api/consulta/v1/contratacoes/atualizacao`

**Parâmetros:** Mesmos da API 1 (dataInicial, dataFinal, codigoModalidadeContratacao, pagina).

**Resposta:** Estrutura similar à API 1 (lista de licitações com os mesmos campos úteis).

**Uso no backend:** SincronizadorGovernoService chama GovernoApiGateway.buscarAtualizacoes(...). O fluxo de filtro e persistência é o mesmo: valorTotalHomologado > 1, upsert licitações, depois buscar itens via API 3.

---

## API 3 — Detalhes dos itens

**URL:** `https://pncp.gov.br/pncp-api/v1/orgaos/{CNPJ}/compras/{ANO}/{SEQUENCIAL}/itens`

**Método:** GET. CNPJ sem formatação (14 dígitos); ANO e SEQUENCIAL vêm da licitação (anoCompra, sequencialCompra).

**Resposta:** Array de itens. Cada item: numeroItem, descricao, materialOuServico, materialOuServicoNome, valorUnitarioEstimado, valorTotal, quantidade, unidadeMedida, situacaoCompraItem, situacaoCompraItemNome, criterioJulgamentoId, criterioJulgamentoNome, itemCategoriaId, itemCategoriaNome, orcamentoSigiloso, temResultado, dataInclusao, dataAtualizacao, ncmNbsCodigo, ncmNbsDescricao, catalogoCodigoItem, informacaoComplementar, etc.

**Uso no backend:** EnriquecedorItemService obtém CNPJ, ano e sequencial da licitação e chama GovernoApiGateway.buscarDetalhesItem(cnpj, ano, sequencial). O gateway retorna itens mapeados para o domínio; o service persiste via ItemLicitacaoRepository (upsert por licitacao_id + numero_item ou equivalente).

---

## Critério de homologação

Apenas licitações com **valorTotalHomologado > 1** são persistidas. Isso é aplicado no service (SincronizadorGovernoService) após obter a página da API 1 ou 2. Itens são buscados para todas as licitações salvas; o backend não filtra itens por situacaoCompraItemNome (ex.: "Homologado") de forma obrigatória — a decisão de filtrar por situação do item pode ser feita no gateway/service se necessário no futuro.

---

## Referência de tipos

Os tipos TypeScript que espelham o JSON do PNCP estão em **`src/gateways/pncp.types.ts`**. O **GovernoApiGateway** traduz esses tipos para as entidades de domínio (Licitacao, ItemLicitacao) antes de retornar ao service.

---

## Timeout e erros

O GovernoApiGateway usa timeout configurável (ex.: 30000 ms). Erros de rede ou respostas fora do esperado são tratados no service e podem ser registrados em `resultado.erros` na resposta da sincronização.

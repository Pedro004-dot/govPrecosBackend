# Integrações externas

Documentação das integrações usadas pelo backend.

| Arquivo | Descrição |
|---------|-----------|
| [pncp.md](./pncp.md) | APIs do PNCP (Governo): API 1 (publicação), API 2 (atualização), API 3 (detalhes dos itens). URLs, parâmetros, estrutura de resposta e como o backend as consome (GovernoApiGateway, SincronizadorGovernoService, EnriquecedorItemService). |
| [municipios.md](./municipios.md) | Tabela de municípios no Supabase (codigo_ibge, latitude, longitude). Uso no filtro geográfico (ItemService, MunicipioRepository, Haversine). |

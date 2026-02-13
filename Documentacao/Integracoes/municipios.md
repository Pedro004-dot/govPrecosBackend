# Tabela de municípios (filtro geográfico)

O filtro geográfico da busca de itens usa a tabela **municipios** já existente no projeto Supabase. Ela não é criada pelas migrações do backend (está no mesmo banco do projeto Supabase).

---

## Estrutura esperada

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| codigo_ibge | VARCHAR (PK) | Código IBGE do município (ex.: 5300108) |
| nome | VARCHAR | Nome do município |
| latitude | NUMERIC | Latitude |
| longitude | NUMERIC | Longitude |
| codigo_uf | VARCHAR | Código ou sigla da UF |
| capital | INTEGER | 1 se capital, 0 caso contrário (opcional) |
| siafi_id, ddd, fuso_horario | VARCHAR | Opcionais |
| created_at | TIMESTAMP | Opcional |

O backend utiliza principalmente **codigo_ibge**, **latitude** e **longitude**.

---

## Uso no backend

- **ItemLicitacaoRepository.searchByDescricaoWithLicitacao** retorna itens com o `codigo_ibge` da licitação (JOIN com `licitacoes`).
- **MunicipioRepository**:
  - `findByCodigoIbge(codigo_ibge)` — retorna `{ latitude, longitude, nome?, codigo_uf? }` para um município.
  - `findLatLongByCodigos(codigos: string[])` — retorna um Map de codigo_ibge → `{ latitude, longitude }` para vários municípios de uma vez (evita N consultas).
- **ItemService.buscarItensParaCotacao**: quando o cliente envia `lat`, `lng` e `raioKm`, o service obtém os códigos IBGE únicos dos itens retornados pela busca textual, chama `findLatLongByCodigos`, calcula a distância (Haversine) entre (lat, lng) do usuário e (lat, lng) de cada município, filtra itens com distância <= raioKm e ordena por distância.

---

## Haversine

A fórmula de Haversine está em **`src/infra/haversine.ts`**: `calcularDistanciaKm(lat1, lon1, lat2, lon2): number`. A distância é em quilômetros.

---

## Fonte dos dados

A tabela `municipios` é populada fora do backend (ex.: importação de planilha IBGE ou script próprio no Supabase). O backend apenas lê; não insere nem atualiza municípios.

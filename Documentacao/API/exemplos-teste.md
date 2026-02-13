# Exemplos para testar a API

Base URL: `http://localhost:3001`. Garanta que o backend está rodando (`npm run dev` ou `node dist/index.js`) e que `DATABASE_URL` está configurado.

---

## Health

```bash
curl http://localhost:3001/api/health
```

---

## Admin — Sincronização

**Histórico (período curto para teste):**
```bash
curl -X POST http://localhost:3001/api/admin/sincronizar-historico \
  -H "Content-Type: application/json" \
  -d '{"dataInicial":"20240101","dataFinal":"20240115"}'
```

**Atualizações:**
```bash
curl -X POST http://localhost:3001/api/admin/sincronizar-atualizacoes \
  -H "Content-Type: application/json" \
  -d '{"dataInicial":"20240201","dataFinal":"20240204"}'
```

---

## Itens — Busca

**Só texto (sem filtro geográfico):**
```bash
curl "http://localhost:3001/api/itens/buscar?q=notebook&limit=5"
```

**Com filtro geográfico (ex.: São Paulo, raio 100 km):**
```bash
curl "http://localhost:3001/api/itens/buscar?q=notebook&lat=-23.5505&lng=-46.6333&raioKm=100&limit=10"
```

**Upload de planilha Excel** (retorna linhas com sugestões de itens):
```bash
curl -X POST http://localhost:3001/api/itens/upload-planilha \
  -F "arquivo=@/caminho/para/sua-planilha.xlsx"
```

---

## Pesquisas (cotações)

**Criar cotação vazia:**
```bash
curl -X POST http://localhost:3001/api/pesquisas \
  -H "Content-Type: application/json" \
  -d '{"nome":"Minha cotação","descricao":"Teste","tenantId":"<UUID-TENANT>","usuarioId":"<UUID-USUARIO>"}'
```

**Criar cotação já com itens** (fluxo recomendado: busca → seleciona → gera cotação):
```bash
curl -X POST http://localhost:3001/api/pesquisas \
  -H "Content-Type: application/json" \
  -d '{"nome":"Cotação notebooks","tenantId":"<UUID-TENANT>","usuarioId":"<UUID-USUARIO>","itemLicitacaoIds":["<UUID-ITEM-1>","<UUID-ITEM-2>"]}'
```

**Listar pesquisas:**
```bash
curl "http://localhost:3001/api/pesquisas?tenantId=<UUID-TENANT>"
```

**Detalhe da pesquisa:**
```bash
curl "http://localhost:3001/api/pesquisas/<UUID-PESQUISA>"
```

**Adicionar itens** (UUIDs de `itens_licitacao`):
```bash
curl -X POST "http://localhost:3001/api/pesquisas/<UUID-PESQUISA>/itens" \
  -H "Content-Type: application/json" \
  -d '{"itemLicitacaoIds":["<UUID-ITEM-1>","<UUID-ITEM-2>"]}'
```

**Remover itens:**
```bash
curl -X DELETE "http://localhost:3001/api/pesquisas/<UUID-PESQUISA>/itens" \
  -H "Content-Type: application/json" \
  -d '{"itemLicitacaoIds":["<UUID-ITEM-1>"]}'
```

**Estatísticas:**
```bash
curl "http://localhost:3001/api/pesquisas/<UUID-PESQUISA>/estatisticas"
```

**Consolidar:**
```bash
curl -X POST "http://localhost:3001/api/pesquisas/<UUID-PESQUISA>/consolidar"
```

**Gerar relatório (placeholder):**
```bash
curl -X POST "http://localhost:3001/api/pesquisas/<UUID-PESQUISA>/relatorio" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"pdf"}'
```

---

## Obter tenant e usuário para testes

Para testar pesquisas é necessário ter pelo menos um registro em `tenants` e um em `usuarios`. Exemplo via SQL no Supabase (ou `psql`):

```sql
INSERT INTO tenants (id, nome, ativo) VALUES (gen_random_uuid(), 'Tenant Teste', true) RETURNING id;
INSERT INTO usuarios (id, tenant_id, nome, email) VALUES (gen_random_uuid(), '<TENANT_ID>', 'Usuario Teste', 'teste@exemplo.com') RETURNING id;
```

Use os UUIDs retornados em `tenantId` e `usuarioId` nas chamadas de criação e listagem de pesquisas.

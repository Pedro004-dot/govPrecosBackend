# Setup local

Passos para configurar o ambiente e rodar o backend na máquina local.

---

## Pré-requisitos

- **Node.js** (versão LTS recomendada, ex.: 18 ou 20)
- **npm** (ou yarn/pnpm, conforme o projeto)
- Acesso ao **PostgreSQL** (ex.: projeto Supabase com banco criado)

---

## 1. Clonar e instalar dependências

Na raiz do repositório (ou da pasta do backend):

```bash
cd backend
npm install
```

---

## 2. Variáveis de ambiente

Copiar o exemplo e preencher com valores reais:

```bash
cp .env.example .env
```

Editar `.env` e configurar pelo menos:

- **DATABASE_URL** — string de conexão do PostgreSQL (ex.: Supabase Dashboard > Project Settings > Database > Connection string URI).

Ver [variaveis-ambiente.md](./variaveis-ambiente.md) para detalhes.

---

## 3. Banco de dados

- **Criar as tabelas:** Executar o script de migração no banco apontado por `DATABASE_URL`:
  - Arquivo: `Documentacao/BancoDeDados/migrations/001_create_tables.sql`
  - No Supabase: SQL Editor > colar o conteúdo e executar.
- **Tabela municipios:** Já deve existir no projeto Supabase (usada no filtro geográfico). Se não existir, criar e popular conforme [Integracoes/municipios.md](../Integracoes/municipios.md).
- **Dados iniciais (opcional):** Para testar pesquisas, inserir pelo menos um `tenant` e um `usuario` (ver exemplos em [API/exemplos-teste.md](../API/exemplos-teste.md)).

---

## 4. Build e execução

**Build (TypeScript → JavaScript):**
```bash
npm run build
```

**Executar (produção):**
```bash
node dist/index.js
```

**Desenvolvimento (com watch):**
```bash
npm run dev
```
(Se o script `dev` existir no `package.json` — ex.: `ts-node-dev` ou `tsx watch`.)

---

## 5. Verificar

- **Health:** `curl http://localhost:3001/api/health` — deve retornar `{ status: 'ok', database: 'connected' }`.
- **Rotas:** Ver [API/rotas.md](../API/rotas.md) e [API/exemplos-teste.md](../API/exemplos-teste.md) para testar cada endpoint.

---

## Scripts úteis (package.json)

| Script | Descrição |
|--------|-----------|
| `npm run build` | Compila TypeScript (`tsc`). |
| `npm start` | Inicia o servidor (geralmente `node dist/index.js`). |
| `npm run dev` | Inicia em modo desenvolvimento com watch (se configurado). |

---

## Boas práticas para desenvolvedores

- Manter a documentação em **Documentacao/** atualizada ao adicionar rotas, entidades ou integrações.
- Novas migrações: criar arquivos numerados em `Documentacao/BancoDeDados/migrations/` e descrever em `BancoDeDados/README.md`.
- Novas rotas: documentar em **API/rotas.md** e incluir exemplo em **API/exemplos-teste.md**.
- Não commitar `.env`; usar `.env.example` para documentar variáveis necessárias.

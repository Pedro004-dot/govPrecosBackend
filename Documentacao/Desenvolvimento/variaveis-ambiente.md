# Variáveis de ambiente

O backend usa variáveis de ambiente para configuração. O arquivo **`.env`** na raiz do backend (não versionado) deve ser criado a partir do **`.env.example`**.

---

## Variáveis utilizadas

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| **DATABASE_URL** | Sim* | String de conexão PostgreSQL. Formato: `postgresql://usuario:senha@host:porta/banco`. No Supabase: Project Settings > Database > Connection string (URI). |
| **PORT** | Não | Porta do servidor Express. Default: 3001. |

\* Se não usar DATABASE_URL, o código pode estar preparado para usar SUPABASE_URL + SUPABASE_DB_PASSWORD (verificar em `src/infra/db.ts`). O `.env.example` documenta as opções.

---

## Alternativa: Supabase (sem DATABASE_URL)

Se **DATABASE_URL** não estiver definida, o código em `src/infra/db.ts` tenta montar a connection string a partir de:

| Variável | Descrição |
|----------|-----------|
| SUPABASE_URL | URL do projeto (ex.: `https://PROJECT_ID.supabase.co`). Obrigatória se não houver DATABASE_URL. |
| SUPABASE_DB_PASSWORD | Senha do banco (Project Settings > Database). |
| SUPABASE_SERVICE_ROLE_KEY | Alternativa à senha para montar a conexão (se usada pelo projeto). |

Pelo menos uma de: **SUPABASE_DB_PASSWORD** ou **SUPABASE_SERVICE_ROLE_KEY** deve estar configurada quando não se usa DATABASE_URL.

---

## Opcionais (futuro)

| Variável | Descrição |
|----------|-----------|
| SUPABASE_ANON_KEY | Chave anônima do Supabase (para uso futuro com Supabase Client). |

---

## Exemplo de .env

```env
# Conexão PostgreSQL (Supabase ou outro)
DATABASE_URL=postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# Porta do servidor
PORT=3001
```

**Segurança:** Nunca commitar `.env` no repositório. O `.env.example` deve conter apenas nomes de variáveis e valores de exemplo (placeholders), sem senhas reais.
